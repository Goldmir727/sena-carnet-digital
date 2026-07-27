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

        user_uuid = verify_qr_token(qr_token)
        if not user_uuid:
            await self._log_access(None, "DENEGADO", "Token QR inválido o corrupto")
            return {
                "permitido": False,
                "mensaje": "Acceso Denegado - Token QR inválido o corrupto",
                "usuario": None,
                "carnet_estado": None
            }

        query = text("""
            SELECT c.id as carnet_id, c.estado, c.uuid,
                   u.id as user_id, u.nombres, u.apellidos, u.numero_documento,
                   u.tipo_documento, u.foto_perfil
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.uuid = :uuid;
        """)
        result = await self.db.execute(query, {"uuid": user_uuid})
        carnet = result.mappings().first()

        if not carnet:
            await self._log_access(None, "DENEGADO", "Carnet no encontrado en el sistema")
            return {
                "permitido": False,
                "mensaje": "Acceso Denegado - Carnet no registrado en el sistema",
                "usuario": None,
                "carnet_estado": None
            }

        if carnet["estado"] != "Activo":
            mensaje = f"Acceso Denegado - Carnet {carnet['estado']}"
            await self._log_access(carnet["user_id"], "DENEGADO", mensaje)
            return {
                "permitido": False,
                "mensaje": mensaje,
                "usuario": {
                    "nombres": carnet["nombres"],
                    "apellidos": carnet["apellidos"],
                },
                "carnet_estado": carnet["estado"]
            }

        await self._log_access(carnet["user_id"], "PERMITIDO", "Acceso concedido", ubicacion)

        await self._register_attendance(carnet["user_id"], ubicacion)

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

    async def _log_access(self, user_id: int | None, resultado: str, mensaje: str, ubicacion: str | None = None) -> None:
        try:
            await self.db.execute(
                text("""
                    INSERT INTO access_logs (user_id, resultado, mensaje, ubicacion, timestamp)
                    VALUES (:user_id, :resultado, :mensaje, :ubicacion, :timestamp);
                """),
                {
                    "user_id": user_id,
                    "resultado": resultado,
                    "mensaje": mensaje,
                    "ubicacion": ubicacion,
                    "timestamp": datetime.now(timezone.utc)
                }
            )
            await self.db.commit()
        except Exception as e:
            logger.error(f"Error al registrar log de acceso: {str(e)}")

    async def _register_attendance(self, user_id: int, ubicacion: str | None) -> None:
        try:
            await self.db.execute(
                text("""
                    INSERT INTO asistencias (user_id, fecha_hora, ubicacion)
                    VALUES (:user_id, :fecha_hora, :ubicacion);
                """),
                {
                    "user_id": user_id,
                    "fecha_hora": datetime.now(timezone.utc),
                    "ubicacion": ubicacion
                }
            )
            await self.db.commit()
        except Exception as e:
            logger.error(f"Error al registrar asistencia: {str(e)}")
