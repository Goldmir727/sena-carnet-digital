from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from services.qr_service import verify_qr_token


class ValidationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def validate_qr(self, qr_token: str, ubicacion: str | None = None) -> dict:
        logger.info("Validando token QR")

        if not verify_qr_token(qr_token):
            return {
                "permitido": False,
                "mensaje": "Acceso Denegado - Token QR inválido o corrupto",
                "usuario": None,
                "carnet_estado": None
            }

        query = text("""
                 SELECT c.id as carnet_id, c.status AS estado, c.qr_code AS uuid,
                     u.id as user_id, u.name AS nombres, u.last_name AS apellidos,
                     u.document AS numero_documento, u.document_type AS tipo_documento,
                     u.photo_profile AS foto_perfil
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.qr_code = :uuid;
        """)
        result = await self.db.execute(query, {"uuid": qr_token})
        carnet = result.mappings().first()

        if not carnet:
            return {
                "permitido": False,
                "mensaje": "Acceso Denegado - Carnet no registrado en el sistema",
                "usuario": None,
                "carnet_estado": None
            }

        if carnet["estado"] != "Activo":
            mensaje = f"Acceso Denegado - Carnet {carnet['estado']}"
            return {
                "permitido": False,
                "mensaje": mensaje,
                "usuario": {
                    "nombres": carnet["nombres"],
                    "apellidos": carnet["apellidos"],
                },
                "carnet_estado": carnet["estado"]
            }

        return {
            "permitido": True,
            "mensaje": "Acceso Permitido",
            "usuario": {
                "id": carnet["user_id"],
                "nombres": carnet["nombres"],
                "apellidos": carnet["apellidos"],
                "numero_documento": carnet["numero_documento"],
                "tipo_documento": carnet["tipo_documento"],
                "foto_perfil": carnet["foto_perfil"],
            },
            "carnet_estado": "Activo"
        }

