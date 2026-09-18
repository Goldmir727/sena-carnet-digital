from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from core.redis_client import cache_delete
from services.qr_service import decode_qr_payload


class AsistenciaService:
    """RF-17/18/19 adaptado a base.sql:
    grupos=fichas, pertenencia=matriculas, QR clase=sesiones.qr_token,
    asistencias(user_id, session_id, status, time, observations).
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def escanear(self, user_id: int, qr_token: str) -> dict:
        payload = decode_qr_payload(qr_token)
        if not payload or payload.get("type") != "clase":
            raise HTTPException(status_code=400, detail="QR inválido o corrupto.")

        ses = await self.db.execute(
            text("SELECT id, ficha_id, instructor_id, qr_expires_at FROM sesiones WHERE qr_token = :t;"),
            {"t": qr_token},
        )
        s = ses.mappings().first()
        if not s:
            raise HTTPException(status_code=404, detail="Sesión QR no encontrada.")
        exp = s["qr_expires_at"]
        if exp is not None:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp:
                raise HTTPException(status_code=400, detail="QR de clase expirado (15 min).")

        ficha_id = s["ficha_id"]
        session_id = s["id"]

        memb = await self.db.execute(
            text("SELECT 1 FROM matriculas WHERE ficha_id = :g AND user_id = :u AND status = 'activa';"),
            {"g": ficha_id, "u": user_id},
        )
        if not memb.first():
            raise HTTPException(status_code=403, detail="No perteneces a este grupo.")

        dup = await self.db.execute(
            text("SELECT 1 FROM asistencias WHERE user_id = :u AND session_id = :s;"),
            {"u": user_id, "s": session_id},
        )
        if dup.first():
            raise HTTPException(status_code=409, detail="Asistencia ya registrada para esta sesión.")

        now = datetime.now(timezone.utc)
        try:
            res = await self.db.execute(
                text(
                    "INSERT INTO asistencias (user_id, session_id, status, time) "
                    "VALUES (:u, :s, 'presente', :t) "
                    "RETURNING id, user_id, session_id, time;"
                ),
                {"u": user_id, "s": session_id, "t": now},
            )
            await self.db.commit()
            await cache_delete("reports:*")
            row = dict(res.mappings().first())
            logger.info(f"Asistencia registrada user={user_id} sesion={session_id}")
            return {
                "id": row["id"],
                "user_id": row["user_id"],
                "grupo_id": ficha_id,
                "qr_clase_id": row["session_id"],
                "fecha_hora": row["time"],
            }
        except Exception:
            await self.db.rollback()
            logger.exception("Error al registrar asistencia.")
            raise HTTPException(status_code=500, detail="Error al registrar asistencia.")

    async def por_grupo(self, grupo_id: int, fecha: str | None = None) -> list[dict]:
        if fecha:
            try:
                base = datetime.fromisoformat(fecha).date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Fecha inválida, use YYYY-MM-DD.")
            q = text(
                "SELECT a.id, a.user_id, s.ficha_id AS grupo_id, a.session_id AS qr_clase_id, "
                "a.time AS fecha_hora, u.name, u.last_name, u.document "
                "FROM asistencias a JOIN sesiones s ON s.id = a.session_id "
                "JOIN users u ON u.id = a.user_id "
                "WHERE s.ficha_id = :g AND DATE(a.time) = :f ORDER BY a.time DESC;"
            )
            res = await self.db.execute(q, {"g": grupo_id, "f": base})
        else:
            res = await self.db.execute(
                text(
                    "SELECT a.id, a.user_id, s.ficha_id AS grupo_id, a.session_id AS qr_clase_id, "
                    "a.time AS fecha_hora, u.name, u.last_name, u.document "
                    "FROM asistencias a JOIN sesiones s ON s.id = a.session_id "
                    "JOIN users u ON u.id = a.user_id "
                    "WHERE s.ficha_id = :g ORDER BY a.time DESC LIMIT 500;"
                ),
                {"g": grupo_id},
            )
        return [dict(r) for r in res.mappings().all()]

    async def stats(self, grupo_id: int) -> dict:
        total_est = await self.db.execute(
            text("SELECT COUNT(*) AS c FROM matriculas WHERE ficha_id = :g AND status = 'activa';"),
            {"g": grupo_id},
        )
        total = total_est.mappings().first()["c"]
        hoy = await self.db.execute(
            text(
                "SELECT COUNT(DISTINCT a.user_id) AS c FROM asistencias a "
                "JOIN sesiones s ON s.id = a.session_id "
                "WHERE s.ficha_id = :g AND DATE(a.time) = CURRENT_DATE;"
            ),
            {"g": grupo_id},
        )
        presentes = hoy.mappings().first()["c"]
        return {
            "grupo_id": grupo_id,
            "total": total,
            "presentes_hoy": presentes,
            "ausentes": max(total - presentes, 0),
        }

    async def _sesion_para_fecha(self, ficha_id: int, fecha) -> int:
        """Busca sesión de la ficha en esa fecha; si no existe la crea con el director."""
        fdate = fecha.date() if isinstance(fecha, datetime) else fecha
        s = await self.db.execute(
            text("SELECT id FROM sesiones WHERE ficha_id = :g AND session_date = :f ORDER BY id LIMIT 1;"),
            {"g": ficha_id, "f": fdate},
        )
        row = s.mappings().first()
        if row:
            return row["id"]
        d = await self.db.execute(text("SELECT director_id FROM fichas WHERE id = :g;"), {"g": ficha_id})
        drow = d.mappings().first()
        instructor = drow["director_id"] if drow and drow["director_id"] else None
        if not instructor:
            ins = await self.db.execute(
                text("SELECT instructor_id FROM sesiones WHERE ficha_id = :g ORDER BY id LIMIT 1;"),
                {"g": ficha_id},
            )
            irow = ins.mappings().first()
            instructor = irow["instructor_id"] if irow else None
        if not instructor:
            raise ValueError("La ficha no tiene docente asignado para crear la sesión.")
        res = await self.db.execute(
            text("""
                INSERT INTO sesiones (ficha_id, instructor_id, session_date, start_time, end_time, status)
                VALUES (:g, :u, :f, '08:00', '12:00', 'realizada') RETURNING id;
            """),
            {"g": ficha_id, "u": instructor, "f": fdate},
        )
        return res.mappings().first()["id"]

    async def importar_excel(self, grupo_id: int, contenido: bytes) -> dict:
        from io import BytesIO
        from openpyxl import load_workbook

        try:
            wb = load_workbook(BytesIO(contenido), read_only=True, data_only=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Archivo .xlsx inválido.")
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            raise HTTPException(status_code=400, detail="Excel vacío.")
        headers = [(str(h or "").strip().lower()) for h in rows[0]]
        try:
            i_doc = headers.index("numero_documento")
            i_fecha = headers.index("fecha_hora")
        except ValueError:
            raise HTTPException(status_code=400, detail="Columnas requeridas: numero_documento, fecha_hora, observacion.")
        i_obs = headers.index("observacion") if "observacion" in headers else None

        procesados = insertados = errores = duplicados = 0
        detalle: list[dict] = []
        for n, r in enumerate(rows[1:], start=2):
            procesados += 1
            try:
                doc = str(r[i_doc] or "").strip()
                if not doc:
                    raise ValueError("documento vacío")
                raw_fecha = r[i_fecha]
                if isinstance(raw_fecha, datetime):
                    fecha = raw_fecha
                else:
                    fecha = datetime.fromisoformat(str(raw_fecha).strip())
                obs = str(r[i_obs]).strip() if i_obs is not None and r[i_obs] else None
                u = await self.db.execute(text("SELECT id FROM users WHERE document = :d;"), {"d": doc})
                um = u.mappings().first()
                if not um:
                    raise ValueError(f"documento {doc} no existe")
                uid = um["id"]
                memb = await self.db.execute(
                    text("SELECT 1 FROM matriculas WHERE ficha_id = :g AND user_id = :u AND status = 'activa';"),
                    {"g": grupo_id, "u": uid},
                )
                if not memb.first():
                    raise ValueError(f"documento {doc} no pertenece al grupo")
                session_id = await self._sesion_para_fecha(grupo_id, fecha)
                dup = await self.db.execute(
                    text("SELECT 1 FROM asistencias WHERE user_id = :u AND session_id = :s;"),
                    {"u": uid, "s": session_id},
                )
                if dup.first():
                    duplicados += 1
                    detalle.append({"fila": n, "estado": "duplicado", "documento": doc})
                    continue
                aware = fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)
                await self.db.execute(
                    text("INSERT INTO asistencias (user_id, session_id, status, time, observations) VALUES (:u, :s, 'presente', :t, :o);"),
                    {"u": uid, "s": session_id, "t": aware, "o": obs},
                )
                insertados += 1
                detalle.append({"fila": n, "estado": "insertado", "documento": doc})
            except Exception as e:
                errores += 1
                detalle.append({"fila": n, "estado": "error", "mensaje": str(e)})
        await self.db.commit()
        await cache_delete("reports:*")
        return {
            "procesados": procesados, "insertados": insertados,
            "errores": errores, "duplicados": duplicados, "detalle": detalle,
        }
