from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from services.qr_service import decode_qr_payload


class ValidationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _log(self, user_id: int | None, resultado: str, mensaje: str, ubicacion: str | None) -> None:
        try:
            await self.db.execute(
                text(
                    "INSERT INTO access_logs (user_id, resultado, mensaje, ubicacion, timestamp) "
                    "VALUES (:u, :r, :m, :ub, :t);"
                ),
                {"u": user_id, "r": resultado, "m": mensaje[:255], "ub": ubicacion, "t": datetime.now(timezone.utc)},
            )
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            logger.warning("No se pudo escribir access_logs (¿tabla sin migrar?).")

    async def validate_qr(self, qr_token: str, ubicacion: str | None = None) -> dict:
        logger.info("Validando token QR")

        payload = decode_qr_payload(qr_token)
        if not payload or payload.get("type") != "carnet" or not payload.get("user_id"):
            await self._log(None, "DENEGADO", "Token QR inválido o corrupto", ubicacion)
            return {
                "permitido": False,
                "mensaje": "Acceso Denegado - Token QR inválido o corrupto",
                "usuario": None,
                "carnet_estado": None
            }

        user_id = int(payload["user_id"])

        # Buscar QR temporal vigente y no usado
        qr_row = await self.db.execute(
            text("SELECT id, user_id, expires_at, used FROM qr_carnets WHERE token = :t;"),
            {"t": qr_token},
        )
        qr = qr_row.mappings().first()
        if not qr:
            await self._log(user_id, "DENEGADO", "QR no registrado", ubicacion)
            return {
                "permitido": False,
                "mensaje": "Acceso Denegado - QR no registrado en el sistema",
                "usuario": None,
                "carnet_estado": None
            }
        if qr["used"]:
            await self._log(user_id, "DENEGADO", "QR ya usado (un solo uso)", ubicacion)
            return {
                "permitido": False,
                "mensaje": "Acceso Denegado - QR ya utilizado",
                "usuario": None,
                "carnet_estado": None
            }
        exp = qr["expires_at"]
        if exp is not None:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp:
                await self._log(user_id, "DENEGADO", "QR expirado", ubicacion)
                return {
                    "permitido": False,
                    "mensaje": "Acceso Denegado - QR expirado (15 min)",
                    "usuario": None,
                    "carnet_estado": None
                }

        query = text("""
                 SELECT c.id as carnet_id, c.status AS estado,
                     u.id as user_id, u.name AS nombres, u.last_name AS apellidos,
                     u.document AS numero_documento, u.document_type AS tipo_documento,
                     u.photo_profile AS foto_perfil
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.user_id = :uid
            ORDER BY c.id DESC LIMIT 1;
        """)
        result = await self.db.execute(query, {"uid": user_id})
        carnet = result.mappings().first()

        if not carnet:
            await self._log(user_id, "DENEGADO", "Carnet no registrado", ubicacion)
            return {
                "permitido": False,
                "mensaje": "Acceso Denegado - Carnet no registrado en el sistema",
                "usuario": None,
                "carnet_estado": None
            }

        if carnet["estado"] != "Activo":
            mensaje = f"Acceso Denegado - Carnet {carnet['estado']}"
            await self._log(user_id, "DENEGADO", mensaje, ubicacion)
            return {
                "permitido": False,
                "mensaje": mensaje,
                "usuario": {
                    "nombres": carnet["nombres"],
                    "apellidos": carnet["apellidos"],
                },
                "carnet_estado": carnet["estado"]
            }

        # Marcar QR como usado (un solo uso) y registrar acceso permitido
        await self.db.execute(
            text("UPDATE qr_carnets SET used = TRUE WHERE id = :id;"), {"id": qr["id"]}
        )
        await self.db.commit()
        await self._log(user_id, "PERMITIDO", "Acceso Permitido", ubicacion)

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

