import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.security import (
    verify_password, create_access_token, create_refresh_token, create_reset_token,
    decode_token, decode_preauth_token, create_preauth_token, hash_password
)
from core.config import settings
from core.logger import logger
from core.rate_limit import rate_limiter, get_client_ip
from core.exceptions import AccountBlockedError
from services.email_service import send_verification_code, send_security_alert, send_email


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def login(self, username_in: str, password_in: str, request: Request) -> dict:
        logger.info(f"Intento de login para: {username_in}")

        query = text("""
                 SELECT id, email, document, password_hash, user_status, role_id,
                     name, last_name
                 FROM users
                 WHERE email = :username OR document = :username;
        """)
        result = await self.db.execute(query, {"username": username_in})
        user = result.mappings().first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
                headers={"WWW-Authenticate": "Bearer"}
            )

        if not verify_password(password_in, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
                headers={"WWW-Authenticate": "Bearer"}
            )

        if user["user_status"] not in ("ACTIVE", "ACTIVO", "active", "activo"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo.")

        if not user["email"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico no existe."
            )

        await self._invalidate_user_codes(user["id"])

        code = str(secrets.randbelow(900000) + 100000)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.VERIFICATION_CODE_EXPIRE_MINUTES)

        await self.db.execute(
            text("""
                INSERT INTO verification_codes (user_id, code, expires_at, used, attempts, created_at)
                VALUES (:user_id, :code, :expires_at, FALSE, 0, :now);
            """),
            {"user_id": user["id"], "code": code, "expires_at": expires_at, "now": datetime.now(timezone.utc)}
        )
        await self.db.commit()

        login_name = f"{user['name']} {user['last_name']}"
        email_sent = await send_verification_code(user["email"], login_name, code)

        email_masked = self._mask_email(user["email"])

        preauth_token = create_preauth_token(data={
            "sub": user["email"],
            "user_id": user["id"],
            "email": user["email"]
        })

        mensaje = (
            f"Codigo de verificacion enviado a {email_masked}"
            if email_sent
            else f"No se pudo enviar el correo. Usa el codigo desde la BD o reintenta."
        )

        return {
            "preauth_token": preauth_token,
            "message": mensaje,
            "requires_2fa": True,
            "email_masked": email_masked,
            "email_sent": email_sent
        }

    async def verify_2fa(self, preauth_token: str, code_in: str) -> dict:
        payload = decode_preauth_token(preauth_token)
        user_id = payload.get("user_id")

        query = text("""
            SELECT id, code, expires_at, used, attempts
            FROM verification_codes
            WHERE user_id = :user_id AND used = FALSE
            ORDER BY created_at DESC
            LIMIT 1;
        """)
        result = await self.db.execute(query, {"user_id": user_id})
        code_row = result.mappings().first()

        if not code_row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se encontró un código de verificación activo. Solicite uno nuevo."
            )

        if code_row["attempts"] >= settings.TWO_FA_MAX_ATTEMPTS:
            await self.db.execute(
                text("UPDATE verification_codes SET used = TRUE WHERE id = :id"),
                {"id": code_row["id"]}
            )
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos. Solicite un nuevo código de verificación."
            )

        if datetime.now(timezone.utc) > code_row["expires_at"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código de verificación ha expirado. Solicite uno nuevo."
            )

        if code_row["code"] != code_in:
            await self.db.execute(
                text("UPDATE verification_codes SET attempts = attempts + 1 WHERE id = :id"),
                {"id": code_row["id"]}
            )
            await self.db.commit()
            remaining = settings.TWO_FA_MAX_ATTEMPTS - (code_row["attempts"] + 1)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Código de verificación inválido. Intentos restantes: {remaining}"
            )

        await self.db.execute(
            text("UPDATE verification_codes SET used = TRUE WHERE id = :id"),
            {"id": code_row["id"]}
        )
        await self.db.commit()

        user_query = text("SELECT id, email, role_id FROM users WHERE id = :id AND user_status IN ('ACTIVE', 'ACTIVO');")
        user_result = await self.db.execute(user_query, {"id": user_id})
        user = user_result.mappings().first()

        access_token = create_access_token(data={
            "sub": user["email"],
            "user_id": user["id"],
            "role_id": user["role_id"]
        })
        refresh_token = create_refresh_token(data={
            "sub": user["email"],
            "user_id": user["id"]
        })

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }

    async def resend_2fa(self, preauth_token: str) -> dict:
        payload = decode_preauth_token(preauth_token)
        user_id = payload.get("user_id")
        username = payload.get("sub")

        user_query = text("SELECT email FROM users WHERE id = :id AND user_status IN ('ACTIVE', 'ACTIVO');")
        user_result = await self.db.execute(user_query, {"id": user_id})
        user = user_result.mappings().first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuario no encontrado o inactivo."
            )

        await self._invalidate_user_codes(user_id)

        code = str(secrets.randbelow(900000) + 100000)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.VERIFICATION_CODE_EXPIRE_MINUTES)

        await self.db.execute(
            text("""
                INSERT INTO verification_codes (user_id, code, expires_at, used, attempts, created_at)
                VALUES (:user_id, :code, :expires_at, FALSE, 0, :now);
            """),
            {"user_id": user_id, "code": code, "expires_at": expires_at, "now": datetime.now(timezone.utc)}
        )
        await self.db.commit()

        email_sent = await send_verification_code(user["email"], username, code)

        email_masked = self._mask_email(user["email"])

        new_preauth = create_preauth_token(data={
            "sub": username,
            "user_id": user_id,
            "email": user["email"]
        })

        mensaje = (
            f"Nuevo codigo de verificacion enviado a {email_masked}"
            if email_sent
            else f"No se pudo enviar el correo. Usa el codigo desde la BD o reintenta."
        )

        return {
            "preauth_token": new_preauth,
            "message": mensaje,
            "requires_2fa": True,
            "email_masked": email_masked,
            "email_sent": email_sent
        }

    async def refresh(self, refresh_token: str) -> dict:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token refresh inválido."
            )

        user_id = payload.get("user_id")
        username = payload.get("sub")

        if not user_id or not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token refresh corrupto."
            )

        query = text("SELECT id FROM users WHERE id = :id AND user_status IN ('ACTIVE', 'ACTIVO');")
        result = await self.db.execute(query, {"id": user_id})
        if not result.first():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no encontrado o inactivo."
            )

        new_access = create_access_token(data={
            "sub": username,
            "user_id": user_id,
            "role_id": payload.get("role_id")
        })

        return {"access_token": new_access, "token_type": "bearer"}
    

    async def forgot_password(self, email: str) -> dict:
        query = text("""
            SELECT id, email, name, last_name
            FROM users
            WHERE email = :email;
        """)
        result = await self.db.execute(query, {"email": email})
        user = result.mappings().first()
        if not user:
            return {"message": "Si el correo existe, recibira instrucciones para restablecer su contrasena."}

        reset_token = create_reset_token(data={"sub": email, "user_id": user["id"]})

        subject = "Recuperacion de contrasena"
        body = (
            f"Hola {user['name']} {user['last_name']},\n\n"
            f"Se solicito restablecer tu contrasena.\n\n"
            f"Copia el siguiente token completo:\n\n"
            f"------------------------------\n"
            f"{reset_token}\n"
            f"------------------------------\n\n"
            f"Este token expira en {settings.RESET_TOKEN_EXPIRE_MINUTES} minutos.\n\n"
            f"Luego utiliza el endpoint /auth/reset-password para cambiar tu contrasena.\n\n"
            f"Sistema de Gestion de Carnets."
        )

        enviado = await send_email(to=email, subject=subject, body=body)
        if not enviado:
            raise HTTPException(status_code=500, detail="No fue posible enviar el correo.")

        return {"message": "Si el correo existe, recibira instrucciones para restablecer su contrasena."}

    async def reset_password(self, token: str, new_password: str) -> dict:
        token = token.replace(" ", "").replace("\n", "").replace("\r", "")

        payload = decode_token(token)
        if payload.get("type") != "reset":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token invalido.")

        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token sin informacion del usuario.")

        query = text("SELECT id FROM users WHERE email = :email;")
        result = await self.db.execute(query, {"email": email})
        user = result.first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

        hashed = hash_password(new_password)
        update = await self.db.execute(
            text("UPDATE users SET password_hash = :pwd WHERE email = :email;"),
            {"pwd": hashed, "email": email}
        )
        await self.db.commit()

        if update.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo actualizar la contrasena.")

        return {"message": "Contrasena restablecida exitosamente."}

    async def _invalidate_user_codes(self, user_id: int) -> None:
        await self.db.execute(
            text("UPDATE verification_codes SET used = TRUE WHERE user_id = :user_id AND used = FALSE;"),
            {"user_id": user_id}
        )
        await self.db.commit()

    @staticmethod
    def _mask_email(email: str) -> str:
        local, domain = email.split("@")
        if len(local) <= 3:
            visible = local[0] + "***"
        else:
            visible = local[0] + local[1] + "***" + local[-1]
        return f"{visible}@{domain}"
