import json
import hashlib
import hmac
import base64
from datetime import datetime, timezone, timedelta, date
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.logger import logger
from services.qr_service import generate_qr_token


class QRService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_qr_carnet(self, user_id: int) -> dict:
        # RF-14: solo Aprendiz, Docente, Funcionario, Coordinador (no Validador)
        role_row = await self.db.execute(
            text("SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :uid;"),
            {"uid": user_id}
        )
        role = role_row.mappings().first()
        if role and role["name"] == "Validador":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Los validadores no pueden generar QR de carnet."
            )

        # base.sql no tiene qr_carnets: token stateless HMAC (timestamp+15min).
        # Se intenta persistir si la tabla existe (entornos con migración 003), si no se ignora.
        try:
            await self.db.execute(
                text("UPDATE qr_carnets SET used = TRUE WHERE user_id = :uid AND used = FALSE;"),
                {"uid": user_id}
            )
            await self.db.commit()
        except Exception:
            await self.db.rollback()

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.QR_CARNET_EXPIRE_MINUTES)

        payload = json.dumps({"type": "carnet", "user_id": user_id, "timestamp": now.isoformat()}).encode("utf-8")
        signature = hmac.new(settings.QR_SECRET.encode(), payload, hashlib.sha256).hexdigest()
        token = f"{base64.urlsafe_b64encode(payload).decode()}.{signature}"

        try:
            await self.db.execute(
                text("INSERT INTO qr_carnets (user_id, token, expires_at, used) VALUES (:user_id, :token, :expires_at, FALSE);"),
                {"user_id": user_id, "token": token, "expires_at": expires_at}
            )
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            logger.info("qr_carnets no existe en base.sql; QR stateless sin persistencia.")

        return {"qr_token": token, "expires_at": expires_at.isoformat()}

    async def generate_qr_clase(self, docente_id: int, grupo_id: int) -> dict:
        # base.sql: grupos=fichas, QR clase=sesiones.qr_token/qr_expires_at
        ficha = await self.db.execute(
            text("SELECT id, number FROM fichas WHERE id = :gid;"),
            {"gid": grupo_id}
        )
        ficha_row = ficha.mappings().first()
        if not ficha_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado.")

        asign = await self.db.execute(
            text("""
                SELECT 1 FROM fichas WHERE id = :g AND director_id = :d
                UNION
                SELECT 1 FROM sesiones WHERE ficha_id = :g AND instructor_id = :d LIMIT 1;
            """),
            {"d": docente_id, "g": grupo_id}
        )
        if not asign.first():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No está asignado a este grupo.")

        docente = await self.db.execute(
            text("SELECT id, name, last_name FROM users WHERE id = :did;"),
            {"did": docente_id}
        )
        docente_row = docente.mappings().first()

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.QR_CLASE_EXPIRE_MINUTES)

        payload = json.dumps({"type": "clase", "docente_id": docente_id, "grupo_id": grupo_id, "timestamp": now.isoformat()}).encode("utf-8")
        signature = hmac.new(settings.QR_SECRET.encode(), payload, hashlib.sha256).hexdigest()
        token = f"{base64.urlsafe_b64encode(payload).decode()}.{signature}"

        # Crear la sesión de clase con el QR (base.sql.sesiones)
        hoy = date.today()
        start_t = now.time().replace(microsecond=0)
        end_dt = now + timedelta(minutes=settings.QR_CLASE_EXPIRE_MINUTES)
        end_t = end_dt.time().replace(microsecond=0)
        await self.db.execute(
            text("""
                INSERT INTO sesiones (ficha_id, instructor_id, session_date, start_time, end_time, status, qr_token, qr_expires_at)
                VALUES (:f, :d, :sd, :st, :et, 'en_curso', :tok, :exp);
            """),
            {"f": grupo_id, "d": docente_id, "sd": hoy, "st": start_t, "et": end_t, "tok": token, "exp": expires_at},
        )
        await self.db.commit()

        docente_nombre = f"{docente_row['name']} {docente_row['last_name']}" if docente_row else ""

        return {
            "qr_token": token,
            "expires_at": expires_at.isoformat(),
            "grupo": ficha_row["number"],
            "docente": docente_nombre,
        }
