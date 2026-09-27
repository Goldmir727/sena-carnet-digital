"""Módulo de sesiones de clase (base.sql: tabla sesiones).

El instructor crea la sesión, genera su QR y los aprendices lo escanean
(POST /asistencia/escanear). Mismo formato de token HMAC que /qr/clase
para que el escaneo funcione con QR generados por ambas vías.
"""
import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.logger import logger
from core.redis_client import cache_delete
from modules.sesiones.sesion_schema import SesionCreate, SesionUpdate


class SesionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _soy_dueno_o_coordinador(self, sesion_id: int, user_id: int, role: str) -> dict:
        res = await self.db.execute(text("SELECT * FROM sesiones WHERE id = :id;"), {"id": sesion_id})
        s = res.mappings().first()
        if not s:
            raise HTTPException(status_code=404, detail="Sesión no encontrada.")
        s = dict(s)
        if role != "Coordinador" and s["instructor_id"] != user_id:
            raise HTTPException(status_code=403, detail="Solo el instructor de la sesión o Coordinador.")
        return s

    async def _docente_asignado(self, ficha_id: int, docente_id: int) -> bool:
        r = await self.db.execute(
            text("""
                SELECT 1 FROM fichas WHERE id = :g AND director_id = :d
                UNION
                SELECT 1 FROM sesiones WHERE ficha_id = :g AND instructor_id = :d LIMIT 1;
            """),
            {"g": ficha_id, "d": docente_id},
        )
        return r.first() is not None

    def _row_to_response(self, row: dict) -> dict:
        exp = row.get("qr_expires_at")
        vigente = False
        if exp is not None:
            if getattr(exp, "tzinfo", None) is None:
                try:
                    exp = exp.replace(tzinfo=timezone.utc)
                except Exception:
                    pass
            try:
                vigente = datetime.now(timezone.utc) <= exp
            except Exception:
                vigente = False
        return {
            "id": row["id"],
            "ficha_id": row["ficha_id"],
            "ficha_number": row.get("ficha_number"),
            "instructor_id": row["instructor_id"],
            "instructor_nombre": row.get("instructor_nombre"),
            "description": row.get("description"),
            "session_date": row["session_date"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "status": row["status"],
            "qr_expires_at": row["qr_expires_at"].isoformat() if row.get("qr_expires_at") else None,
            "tiene_qr_vigente": vigente,
            "presentes": row.get("presentes", 0) or 0,
        }

    async def create(self, data: SesionCreate, instructor_id: int, role: str) -> dict:
        ficha = await self.db.execute(text("SELECT id FROM fichas WHERE id = :id;"), {"id": data.ficha_id})
        if not ficha.first():
            raise HTTPException(status_code=404, detail="Ficha no encontrada.")
        if role == "Docente" and not await self._docente_asignado(data.ficha_id, instructor_id):
            raise HTTPException(status_code=403, detail="No está asignado a esta ficha.")
        if data.end_time <= data.start_time:
            raise HTTPException(status_code=400, detail="La hora de fin debe ser posterior al inicio.")
        res = await self.db.execute(
            text("""
                INSERT INTO sesiones (ficha_id, instructor_id, description, session_date, start_time, end_time, status)
                VALUES (:f, :i, :d, :sd, :st, :et, 'programada')
                RETURNING id;
            """),
            {"f": data.ficha_id, "i": instructor_id, "d": data.description,
             "sd": data.session_date, "st": data.start_time, "et": data.end_time},
        )
        await self.db.commit()
        row = res.mappings().first()
        logger.info(f"Sesión {row['id']} creada por instructor {instructor_id}")
        return await self.get_by_id(row["id"], instructor_id, role)

    async def listar(self, ficha_id: int | None, instructor_id: int, role: str) -> list[dict]:
        conds, params = [], {}
        if role == "Docente":
            conds.append("s.instructor_id = :me")
            params["me"] = instructor_id
        if ficha_id is not None:
            conds.append("s.ficha_id = :f")
            params["f"] = ficha_id
        where = f"WHERE {' AND '.join(conds)}" if conds else ""
        res = await self.db.execute(
            text(f"""
                SELECT s.*, f.number AS ficha_number,
                       (u.name || ' ' || u.last_name) AS instructor_nombre,
                       (SELECT COUNT(*) FROM asistencias a WHERE a.session_id = s.id) AS presentes
                FROM sesiones s
                JOIN fichas f ON f.id = s.ficha_id
                JOIN users u ON u.id = s.instructor_id
                {where}
                ORDER BY s.session_date DESC, s.start_time DESC LIMIT 200;
            """),
            params,
        )
        return [self._row_to_response(dict(r)) for r in res.mappings().all()]

    async def get_by_id(self, sesion_id: int, user_id: int, role: str) -> dict:
        if role == "Docente":
            await self._soy_dueno_o_coordinador(sesion_id, user_id, role)
        res = await self.db.execute(
            text("""
                SELECT s.*, f.number AS ficha_number,
                       (u.name || ' ' || u.last_name) AS instructor_nombre,
                       (SELECT COUNT(*) FROM asistencias a WHERE a.session_id = s.id) AS presentes
                FROM sesiones s
                JOIN fichas f ON f.id = s.ficha_id
                JOIN users u ON u.id = s.instructor_id
                WHERE s.id = :id;
            """),
            {"id": sesion_id},
        )
        row = res.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Sesión no encontrada.")
        return self._row_to_response(dict(row))

    async def update(self, sesion_id: int, data: SesionUpdate, user_id: int, role: str) -> dict:
        await self._soy_dueno_o_coordinador(sesion_id, user_id, role)
        payload = data.model_dump(exclude_unset=True)
        if not payload:
            raise HTTPException(status_code=400, detail="Sin cambios para actualizar.")
        if payload.get("end_time") and payload.get("start_time") and payload["end_time"] <= payload["start_time"]:
            raise HTTPException(status_code=400, detail="La hora de fin debe ser posterior al inicio.")
        sets = ", ".join(f"{k} = :{k}" for k in payload)
        params = {**payload, "id": sesion_id}
        await self.db.execute(text(f"UPDATE sesiones SET {sets} WHERE id = :id;"), params)
        await self.db.commit()
        return await self.get_by_id(sesion_id, user_id, role)

    async def delete(self, sesion_id: int, user_id: int, role: str) -> dict:
        await self._soy_dueno_o_coordinador(sesion_id, user_id, role)
        a = await self.db.execute(
            text("SELECT 1 FROM asistencias WHERE session_id = :id LIMIT 1;"), {"id": sesion_id}
        )
        if a.first():
            raise HTTPException(status_code=409, detail="No se puede eliminar: ya tiene asistencias registradas.")
        await self.db.execute(text("DELETE FROM sesiones WHERE id = :id;"), {"id": sesion_id})
        await self.db.commit()
        return {"detail": "Sesión eliminada correctamente."}

    async def generate_qr(self, sesion_id: int, user_id: int, role: str) -> dict:
        """Genera (o rota) el QR de una sesión existente. Mismo token que /qr/clase."""
        s = await self._soy_dueno_o_coordinador(sesion_id, user_id, role)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.QR_CLASE_EXPIRE_MINUTES)
        payload = json.dumps({
            "type": "clase", "docente_id": s["instructor_id"],
            "grupo_id": s["ficha_id"], "timestamp": now.isoformat(),
        }).encode("utf-8")
        signature = hmac.new(settings.QR_SECRET.encode(), payload, hashlib.sha256).hexdigest()
        token = f"{base64.urlsafe_b64encode(payload).decode()}.{signature}"
        await self.db.execute(
            text("UPDATE sesiones SET qr_token = :t, qr_expires_at = :e, status = 'en_curso' WHERE id = :id;"),
            {"t": token, "e": expires_at, "id": sesion_id},
        )
        await self.db.commit()
        logger.info(f"QR generado para sesión {sesion_id}")
        return {
            "sesion_id": sesion_id,
            "qr_token": token,
            "expires_at": expires_at.isoformat(),
            "qr_image_url": f"/qr/clase/image?token={token}",
        }

    async def asistencias_de_sesion(self, sesion_id: int, user_id: int, role: str) -> list[dict]:
        """Registro en vivo: quiénes escanearon esta sesión."""
        s = await self._soy_dueno_o_coordinador(sesion_id, user_id, role)
        res = await self.db.execute(
            text("""
                SELECT a.id, a.user_id, a.time AS fecha_hora,
                       u.name, u.last_name, u.document
                FROM asistencias a JOIN users u ON u.id = a.user_id
                WHERE a.session_id = :s ORDER BY a.time ASC;
            """),
            {"s": sesion_id},
        )
        data = [dict(r) for r in res.mappings().all()]
        return {"sesion_id": sesion_id, "ficha_id": s["ficha_id"], "total": len(data), "registros": data}

    async def registro_manual(self, sesion_id: int, aprendiz_id: int, user_id: int, role: str) -> dict:
        """El instructor pasa lista manual a un aprendiz (sin QR)."""
        s = await self._soy_dueno_o_coordinador(sesion_id, user_id, role)
        memb = await self.db.execute(
            text("SELECT 1 FROM matriculas WHERE ficha_id = :g AND user_id = :u AND status = 'activa';"),
            {"g": s["ficha_id"], "u": aprendiz_id},
        )
        if not memb.first():
            raise HTTPException(status_code=400, detail="El usuario no está matriculado en esta ficha.")
        r = await self.db.execute(
            text("SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :id;"),
            {"id": aprendiz_id},
        )
        rol = r.mappings().first()
        if not rol or rol["name"] != "Aprendiz":
            raise HTTPException(status_code=400, detail="Solo se puede registrar a aprendices.")
        dup = await self.db.execute(
            text("SELECT 1 FROM asistencias WHERE user_id = :u AND session_id = :s;"),
            {"u": aprendiz_id, "s": sesion_id},
        )
        if dup.first():
            raise HTTPException(status_code=409, detail="Asistencia ya registrada para esta sesión.")
        now = datetime.now(timezone.utc)
        res = await self.db.execute(
            text("""
                INSERT INTO asistencias (user_id, session_id, status, time, observations)
                VALUES (:u, :s, 'presente', :t, 'registro manual por instructor')
                RETURNING id, user_id, session_id, time;
            """),
            {"u": aprendiz_id, "s": sesion_id, "t": now},
        )
        await self.db.commit()
        await cache_delete("reports:*")
        row = dict(res.mappings().first())
        return {"id": row["id"], "user_id": row["user_id"], "sesion_id": row["session_id"], "fecha_hora": row["time"]}
