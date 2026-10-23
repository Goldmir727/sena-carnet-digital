from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from services.qr_service import decode_qr_payload

# base.sql no tiene qr_carnets ni access_logs:
# - QR carnet = HMAC stateless (payload timestamp +15min) + set Redis un solo uso,
#   con intento de persistir si la tabla existe (entornos migrados).
# - Auditoría = access_logs si existe, si no audit_logs, si no se omite.
from core.redis_client import sadd, sismember

QR_USED_SET = "qr:used"
QR_USED_TTL = 15 * 60


class ValidationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _log(self, user_id: int | None, resultado: str, mensaje: str, ubicacion: str | None) -> None:
        now = datetime.now(timezone.utc)
        try:
            await self.db.execute(
                text(
                    "INSERT INTO access_logs (user_id, resultado, mensaje, ubicacion, timestamp) "
                    "VALUES (:u, :r, :m, :ub, :t);"
                ),
                {"u": user_id, "r": resultado, "m": mensaje[:255], "ub": ubicacion, "t": now},
            )
            await self.db.commit()
            return
        except Exception:
            await self.db.rollback()
        # Fallback base.sql: audit_logs(user_id NOT NULL, accion, detalles, created_at)
        try:
            if user_id is None:
                return
            await self.db.execute(
                text("INSERT INTO audit_logs (user_id, accion, detalles, created_at) VALUES (:u, :a, :d, :t);"),
                {"u": user_id, "a": f"validacion_qr_{resultado}", "d": f"{mensaje} | ubicacion={ubicacion}", "t": now},
            )
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            logger.warning("No se pudo auditar validación (sin access_logs/audit_logs).")

    def _stateless_expiry_ok(self, payload: dict) -> bool:
        try:
            ts = datetime.fromisoformat(payload.get("timestamp", ""))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            return datetime.now(timezone.utc) <= ts + timedelta(minutes=15)
        except Exception:
            return False

    async def _validate_printed_qr(self, qr_token: str, ubicacion: str | None) -> dict:
        """
        Valida el QR impreso en el carnet físico.

        Este token (payload con uuid, sin user_id ni timestamp) se emite una vez
        al generar el carnet y queda grabado en carnets.qr_code. No expira a los
        15 minutos ni es de un solo uso: su vigencia es la del carnet impreso.
        Se busca el carnet exacto por token para que un carnet regenerado deje
        de validar el QR anterior.
        """
        result = await self.db.execute(
            text("""
                SELECT c.id AS carnet_id,
                       CASE WHEN c.expiration_date < CURRENT_DATE THEN 'Vencido' ELSE 'Activo' END AS estado,
                       u.id AS user_id, u.name AS nombres, u.last_name AS apellidos,
                       u.document AS numero_documento, u.document_type AS tipo_documento,
                       u.photo_profile AS foto_perfil
                FROM carnets c
                JOIN users u ON u.id = c.user_id
                WHERE c.qr_code = :token
                ORDER BY c.id DESC LIMIT 1;
            """),
            {"token": qr_token},
        )
        carnet = result.mappings().first()

        if not carnet:
            await self._log(None, "DENEGADO", "QR impreso no registrado", ubicacion)
            return {"permitido": False, "mensaje": "Acceso Denegado - QR no registrado en el sistema", "usuario": None, "carnet_estado": None}

        if carnet["estado"] != "Activo":
            mensaje = f"Acceso Denegado - Carnet {carnet['estado']}"
            await self._log(carnet["user_id"], "DENEGADO", mensaje, ubicacion)
            return {"permitido": False, "mensaje": mensaje,
                    "usuario": {"nombres": carnet["nombres"], "apellidos": carnet["apellidos"]},
                    "carnet_estado": carnet["estado"]}

        await self._log(carnet["user_id"], "PERMITIDO", "Acceso Permitido (QR impreso)", ubicacion)
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
            "carnet_estado": "Activo",
        }

    async def validate_qr(self, qr_token: str, ubicacion: str | None = None) -> dict:
        logger.info("Validando token QR")

        payload = decode_qr_payload(qr_token)
        if not payload or payload.get("type") != "carnet":
            await self._log(None, "DENEGADO", "Token QR inválido o corrupto", ubicacion)
            return {"permitido": False, "mensaje": "Acceso Denegado - Token QR inválido o corrupto", "usuario": None, "carnet_estado": None}

        # QR del carnet impreso: se resuelve por token contra carnets.qr_code.
        if payload.get("user_id") is None:
            return await self._validate_printed_qr(qr_token, ubicacion)

        user_id = int(payload["user_id"])

        # 1) Intentar flujo con tabla qr_carnets (entornos con migración 003)
        qr = None
        qr_table_exists = True
        try:
            qr_row = await self.db.execute(
                text("SELECT id, user_id, expires_at, used FROM qr_carnets WHERE token = :t;"),
                {"t": qr_token},
            )
            qr = qr_row.mappings().first()
        except Exception:
            await self.db.rollback()
            qr_table_exists = False

        if qr_table_exists:
            if not qr:
                await self._log(user_id, "DENEGADO", "QR no registrado", ubicacion)
                return {"permitido": False, "mensaje": "Acceso Denegado - QR no registrado en el sistema", "usuario": None, "carnet_estado": None}
            if qr["used"]:
                await self._log(user_id, "DENEGADO", "QR ya usado (un solo uso)", ubicacion)
                return {"permitido": False, "mensaje": "Acceso Denegado - QR ya utilizado", "usuario": None, "carnet_estado": None}
            exp = qr["expires_at"]
            if exp is not None:
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) > exp:
                    await self._log(user_id, "DENEGADO", "QR expirado", ubicacion)
                    return {"permitido": False, "mensaje": "Acceso Denegado - QR expirado (15 min)", "usuario": None, "carnet_estado": None}
        else:
            # 2) Stateless base.sql: expiración por timestamp + un solo uso en Redis
            if await sismember(QR_USED_SET, qr_token):
                await self._log(user_id, "DENEGADO", "QR ya usado (un solo uso)", ubicacion)
                return {"permitido": False, "mensaje": "Acceso Denegado - QR ya utilizado", "usuario": None, "carnet_estado": None}
            if not self._stateless_expiry_ok(payload):
                await self._log(user_id, "DENEGADO", "QR expirado", ubicacion)
                return {"permitido": False, "mensaje": "Acceso Denegado - QR expirado (15 min)", "usuario": None, "carnet_estado": None}

        # Carnet en base.sql: sin status -> Activo si no vencido por fecha
        result = await self.db.execute(
            text("""
                 SELECT c.id as carnet_id,
                     CASE WHEN c.expiration_date < CURRENT_DATE THEN 'Vencido' ELSE 'Activo' END AS estado,
                     u.id as user_id, u.name AS nombres, u.last_name AS apellidos,
                     u.document AS numero_documento, u.document_type AS tipo_documento,
                     u.photo_profile AS foto_perfil
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.user_id = :uid
            ORDER BY c.id DESC LIMIT 1;
            """),
            {"uid": user_id},
        )
        carnet = result.mappings().first()

        if not carnet:
            await self._log(user_id, "DENEGADO", "Carnet no registrado", ubicacion)
            return {"permitido": False, "mensaje": "Acceso Denegado - Carnet no registrado en el sistema", "usuario": None, "carnet_estado": None}

        if carnet["estado"] != "Activo":
            mensaje = f"Acceso Denegado - Carnet {carnet['estado']}"
            await self._log(user_id, "DENEGADO", mensaje, ubicacion)
            return {"permitido": False, "mensaje": mensaje,
                    "usuario": {"nombres": carnet["nombres"], "apellidos": carnet["apellidos"]},
                    "carnet_estado": carnet["estado"]}

        # Marcar usado
        if qr_table_exists and qr is not None:
            try:
                await self.db.execute(text("UPDATE qr_carnets SET used = TRUE WHERE id = :id;"), {"id": qr["id"]})
                await self.db.commit()
            except Exception:
                await self.db.rollback()
        _used_qr_tokens_add = sadd(QR_USED_SET, qr_token, ex=QR_USED_TTL)
        await _used_qr_tokens_add
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
