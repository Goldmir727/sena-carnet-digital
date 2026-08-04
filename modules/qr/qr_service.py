import json
import hashlib
import hmac
import base64
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from services.qr_service import generate_qr_token


class QRService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_qr_carnet(self, user_id: int) -> dict:
        await self.db.execute(
            text("UPDATE qr_carnets SET used = TRUE WHERE user_id = :uid AND used = FALSE;"),
            {"uid": user_id}
        )

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.QR_CARNET_EXPIRE_MINUTES)

        payload = json.dumps({"type": "carnet", "user_id": user_id, "timestamp": now.isoformat()}).encode("utf-8")
        signature = hmac.new(settings.QR_SECRET.encode(), payload, hashlib.sha256).hexdigest()
        token = f"{base64.urlsafe_b64encode(payload).decode()}.{signature}"

        await self.db.execute(
            text("INSERT INTO qr_carnets (user_id, token, expires_at, used) VALUES (:user_id, :token, :expires_at, FALSE);"),
            {"user_id": user_id, "token": token, "expires_at": expires_at}
        )
        await self.db.commit()

        return {"qr_token": token, "expires_at": expires_at.isoformat()}

    async def generate_qr_clase(self, docente_id: int, grupo_id: int) -> dict:
        grupo = await self.db.execute(
            text("SELECT id, nombre FROM grupos WHERE id = :gid;"),
            {"gid": grupo_id}
        )
        grupo_row = grupo.mappings().first()
        if not grupo_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado.")

        asignacion = await self.db.execute(
            text("SELECT id FROM grupo_docentes WHERE docente_id = :did AND grupo_id = :gid;"),
            {"did": docente_id, "gid": grupo_id}
        )
        if not asignacion.first():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No está asignado a este grupo."
            )

        docente = await self.db.execute(
            text("SELECT id, nombres, apellidos FROM users WHERE id = :did;"),
            {"did": docente_id}
        )
        docente_row = docente.mappings().first()

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.QR_CLASE_EXPIRE_MINUTES)

        payload = json.dumps({"type": "clase", "docente_id": docente_id, "grupo_id": grupo_id, "timestamp": now.isoformat()}).encode("utf-8")
        signature = hmac.new(settings.QR_SECRET.encode(), payload, hashlib.sha256).hexdigest()
        token = f"{base64.urlsafe_b64encode(payload).decode()}.{signature}"

        await self.db.execute(
            text("INSERT INTO qr_clases (docente_id, grupo_id, token, expires_at) VALUES (:docente_id, :grupo_id, :token, :expires_at);"),
            {"docente_id": docente_id, "grupo_id": grupo_id, "token": token, "expires_at": expires_at}
        )
        await self.db.commit()

        docente_nombre = f"{docente_row['nombres']} {docente_row['apellidos']}" if docente_row else ""

        return {
            "qr_token": token,
            "expires_at": expires_at.isoformat(),
            "grupo": grupo_row["nombre"],
            "docente": docente_nombre,
        }
