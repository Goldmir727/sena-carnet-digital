import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from io import BytesIO

import openpyxl
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.exceptions import DuplicateError, ForbiddenError, NotFoundError
from core.logger import logger
from services.qr_service import verify_qr_token


class AsistenciaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _decode_qr_payload(self, token: str) -> dict | None:
        try:
            payload_b64, signature = token.split(".", 1)
            message = base64.urlsafe_b64decode(payload_b64)
            expected_sig = hmac.new(
                settings.QR_SECRET.encode("utf-8"),
                message,
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(signature, expected_sig):
                return None
            return json.loads(message.decode("utf-8"))
        except Exception:
            return None

    async def escanear_qr(self, qr_token: str, user_id: int) -> dict:
        payload = self._decode_qr_payload(qr_token)
        if not payload or payload.get("type") != "clase":
            raise ForbiddenError("QR invalido o no corresponde a una clase.")

        uuid = verify_qr_token(qr_token)
        if not uuid:
            raise NotFoundError("Token QR no valido.")

        qr_query = text("""
            SELECT id, grupo_id, docente_id, expires_at
            FROM qr_clases
            WHERE token = :token AND expires_at > NOW();
        """)
        result = await self.db.execute(qr_query, {"token": qr_token})
        qr_row = result.mappings().first()
        if not qr_row:
            raise NotFoundError("QR expirado o no encontrado.")

        grupo_id = qr_row["grupo_id"]
        qr_clase_id = qr_row["id"]

        grupo_query = text("""
            SELECT id FROM grupo_estudiantes
            WHERE grupo_id = :grupo_id AND user_id = :user_id;
        """)
        result = await self.db.execute(grupo_query, {"grupo_id": grupo_id, "user_id": user_id})
        if not result.mappings().first():
            raise ForbiddenError("No perteneces a este grupo.")

        dup_query = text("""
            SELECT id FROM asistencias
            WHERE user_id = :user_id AND qr_clase_id = :qr_clase_id;
        """)
        result = await self.db.execute(dup_query, {"user_id": user_id, "qr_clase_id": qr_clase_id})
        if result.mappings().first():
            raise DuplicateError("Ya registraste tu asistencia con este QR.")

        ahora = datetime.now(timezone.utc)
        insert_query = text("""
            INSERT INTO asistencias (user_id, grupo_id, qr_clase_id, fecha_hora, ubicacion)
            VALUES (:user_id, :grupo_id, :qr_clase_id, :fecha_hora, :ubicacion)
            RETURNING id;
        """)
        result = await self.db.execute(insert_query, {
            "user_id": user_id,
            "grupo_id": grupo_id,
            "qr_clase_id": qr_clase_id,
            "fecha_hora": ahora,
            "ubicacion": None,
        })
        await self.db.commit()

        asistencia_id = result.mappings().first()["id"]

        user_query = text("""
            SELECT id, nombres, apellidos, numero_documento
            FROM users WHERE id = :user_id;
        """)
        result = await self.db.execute(user_query, {"user_id": user_id})
        user_row = result.mappings().first()

        logger.info(f"Asistencia registrada: user_id={user_id}, grupo_id={grupo_id}, qr_clase_id={qr_clase_id}")

        return {
            "id": asistencia_id,
            "user_id": user_id,
            "usuario": {
                "nombres": user_row["nombres"],
                "apellidos": user_row["apellidos"],
                "documento": user_row["numero_documento"],
                "grupo_id": grupo_id,
            },
            "fecha_hora": ahora,
            "ubicacion": None,
        }

    async def get_by_grupo(self, grupo_id: int, desde=None, hasta=None) -> list[dict]:
        conditions = ["a.grupo_id = :grupo_id"]
        params = {"grupo_id": grupo_id}
        if desde:
            conditions.append("a.fecha_hora >= :desde")
            params["desde"] = desde
        if hasta:
            conditions.append("a.fecha_hora <= :hasta")
            params["hasta"] = hasta

        where_clause = " AND ".join(conditions)

        query = text(f"""
            SELECT a.*, u.nombres, u.apellidos, u.numero_documento
            FROM asistencias a
            JOIN users u ON u.id = a.user_id
            WHERE {where_clause}
            ORDER BY a.fecha_hora DESC;
        """)
        result = await self.db.execute(query, params)
        rows = result.mappings().all()

        return [
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "usuario": {
                    "nombres": row["nombres"],
                    "apellidos": row["apellidos"],
                    "documento": row["numero_documento"],
                    "grupo_id": grupo_id,
                },
                "fecha_hora": row["fecha_hora"],
                "ubicacion": row["ubicacion"],
            }
            for row in rows
        ]

    async def get_stats(self, grupo_id: int) -> dict:
        total = await self.db.execute(
            text("SELECT COUNT(*) as count FROM asistencias WHERE grupo_id = :grupo_id;"),
            {"grupo_id": grupo_id},
        )
        total_count = total.mappings().first()["count"]

        hoy_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        hoy = await self.db.execute(
            text("SELECT COUNT(*) as count FROM asistencias WHERE grupo_id = :grupo_id AND fecha_hora >= :start;"),
            {"grupo_id": grupo_id, "start": hoy_start},
        )
        hoy_count = hoy.mappings().first()["count"]

        total_est = await self.db.execute(
            text("SELECT COUNT(*) as count FROM grupo_estudiantes WHERE grupo_id = :grupo_id;"),
            {"grupo_id": grupo_id},
        )
        total_estudiantes_count = total_est.mappings().first()["count"]

        return {
            "total_asistencias": total_count,
            "presentes_hoy": hoy_count,
            "total_estudiantes": total_estudiantes_count,
        }

    async def process_excel(self, grupo_id: int, file_content: bytes) -> dict:
        wb = openpyxl.load_workbook(BytesIO(file_content))
        ws = wb.active

        headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]

        procesados = 0
        insertados = 0
        errores = 0
        duplicados = 0
        detalle = []

        for row in ws.iter_rows(min_row=2, values_only=True):
            procesados += 1
            try:
                numero_documento = row[headers.index("numero_documento")] if "numero_documento" in headers else row[0]
                fecha_hora_val = row[headers.index("fecha_hora")] if "fecha_hora" in headers else row[1]

                if not numero_documento or not fecha_hora_val:
                    errores += 1
                    detalle.append({"linea": procesados, "error": "Datos incompletos"})
                    continue

                user_query = text("SELECT id FROM users WHERE numero_documento = :doc;")
                result = await self.db.execute(user_query, {"doc": str(numero_documento).strip()})
                user_row = result.mappings().first()
                if not user_row:
                    errores += 1
                    detalle.append({"linea": procesados, "documento": str(numero_documento), "error": "Usuario no encontrado"})
                    continue

                user_id = user_row["id"]

                grupo_query = text("""
                    SELECT id FROM grupo_estudiantes
                    WHERE grupo_id = :grupo_id AND user_id = :user_id;
                """)
                result = await self.db.execute(grupo_query, {"grupo_id": grupo_id, "user_id": user_id})
                if not result.mappings().first():
                    errores += 1
                    detalle.append({"linea": procesados, "documento": str(numero_documento), "error": "No pertenece al grupo"})
                    continue

                if isinstance(fecha_hora_val, str):
                    fecha_hora_dt = datetime.fromisoformat(fecha_hora_val.strip())
                elif isinstance(fecha_hora_val, datetime):
                    fecha_hora_dt = fecha_hora_val
                else:
                    errores += 1
                    detalle.append({"linea": procesados, "documento": str(numero_documento), "error": "Formato de fecha invalido"})
                    continue

                dup_query = text("""
                    SELECT id FROM asistencias
                    WHERE user_id = :user_id AND grupo_id = :grupo_id AND fecha_hora = :fecha_hora;
                """)
                result = await self.db.execute(dup_query, {
                    "user_id": user_id,
                    "grupo_id": grupo_id,
                    "fecha_hora": fecha_hora_dt,
                })
                if result.mappings().first():
                    duplicados += 1
                    detalle.append({"linea": procesados, "documento": str(numero_documento), "error": "Asistencia duplicada"})
                    continue

                insert_query = text("""
                    INSERT INTO asistencias (user_id, grupo_id, fecha_hora, ubicacion)
                    VALUES (:user_id, :grupo_id, :fecha_hora, :ubicacion);
                """)
                await self.db.execute(insert_query, {
                    "user_id": user_id,
                    "grupo_id": grupo_id,
                    "fecha_hora": fecha_hora_dt,
                    "ubicacion": None,
                })
                insertados += 1
            except Exception as e:
                errores += 1
                detalle.append({"linea": procesados, "error": str(e)})
                logger.error(f"Error procesando Excel linea {procesados}: {e}")

        await self.db.commit()
        logger.info(f"Excel procesado: procesados={procesados}, insertados={insertados}, errores={errores}, duplicados={duplicados}")

        return {
            "procesados": procesados,
            "insertados": insertados,
            "errores": errores,
            "duplicados": duplicados,
            "detalle": detalle,
        }
