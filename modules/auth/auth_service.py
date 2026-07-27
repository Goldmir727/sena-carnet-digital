from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.security import verify_password, create_access_token, create_refresh_token, create_reset_token, decode_token, hash_password
from core.config import settings
from core.logger import logger
from core.rate_limit import rate_limiter, get_client_ip
from core.exceptions import AccountBlockedError


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def login(self, username_in: str, password_in: str, request: Request) -> dict:
        logger.info(f"Intento de login para: {username_in}")

        query = text("""
            SELECT id, username, hashed_password, email, is_active,
                   intentos_fallidos, bloqueado_hasta, role_id
            FROM users WHERE username = :username;
        """)
        result = await self.db.execute(query, {"username": username_in})
        user = result.mappings().first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
                headers={"WWW-Authenticate": "Bearer"}
            )

        if user["bloqueado_hasta"] and datetime.now(timezone.utc) < user["bloqueado_hasta"]:
            raise AccountBlockedError(
                detail=f"Cuenta bloqueada hasta {user['bloqueado_hasta']}. "
                       f"Revise su correo {user['email']} para instrucciones de desbloqueo."
            )

        if not verify_password(password_in, user["hashed_password"]):
            await self._register_failed_attempt(user["id"])
            if user["intentos_fallidos"] + 1 >= settings.MAX_LOGIN_ATTEMPTS:
                await self._block_account(user["id"])
                raise AccountBlockedError(
                    detail=f"Cuenta bloqueada por {settings.BLOCK_DURATION_MINUTES} minutos. "
                           f"Se ha enviado una alerta a {user['email']}."
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
                headers={"WWW-Authenticate": "Bearer"}
            )

        if not user["is_active"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo.")

        await self._reset_failed_attempts(user["id"])

        access_token = create_access_token(data={
            "sub": user["username"],
            "user_id": user["id"],
            "role_id": user["role_id"]
        })
        refresh_token = create_refresh_token(data={
            "sub": user["username"],
            "user_id": user["id"]
        })

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
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

        query = text("SELECT id, is_active FROM users WHERE id = :id AND is_active = TRUE;")
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
        query = text("SELECT id, email FROM users WHERE email = :email;")
        result = await self.db.execute(query, {"email": email})
        user = result.mappings().first()
        if not user:
            return {"message": "Si el correo existe, recibirá instrucciones para restablecer su contraseña."}

        reset_token = create_reset_token(data={"sub": email, "user_id": user["id"]})
        logger.info(f"Token de reseteo generado para {email}: {reset_token}")
        return {"reset_token": reset_token, "message": "Revise su correo para restablecer la contraseña."}

    async def reset_password(self, token: str, new_password: str) -> dict:
        payload = decode_token(token)
        if payload.get("type") != "reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token de reseteo inválido."
            )

        email = payload.get("sub")
        hashed = hash_password(new_password)

        await self.db.execute(
            text("UPDATE users SET hashed_password = :pwd WHERE email = :email;"),
            {"pwd": hashed, "email": email}
        )
        await self.db.commit()

        return {"message": "Contraseña restablecida exitosamente."}

    async def _register_failed_attempt(self, user_id: int) -> None:
        await self.db.execute(
            text("UPDATE users SET intentos_fallidos = intentos_fallidos + 1 WHERE id = :id;"),
            {"id": user_id}
        )
        await self.db.commit()

    async def _block_account(self, user_id: int) -> None:
        block_until = datetime.now(timezone.utc) + timedelta(minutes=settings.BLOCK_DURATION_MINUTES)
        await self.db.execute(
            text("UPDATE users SET bloqueado_hasta = :block_until WHERE id = :id;"),
            {"id": user_id, "block_until": block_until}
        )
        await self.db.commit()

    async def _reset_failed_attempts(self, user_id: int) -> None:
        await self.db.execute(
            text("UPDATE users SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = :id;"),
            {"id": user_id}
        )
        await self.db.commit()
