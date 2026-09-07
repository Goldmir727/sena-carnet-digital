from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from services.qr_service import decode_qr_payload


class AsistenciaService:
    """RF-17/18/19: asistencia por QR de clase + consulta + Excel."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def escanear(self, user_id: int, qr_token: str) -> dict:
        payload = decode_qr_payload(qr_token)
        if not payload or payload.get("type") != "clase":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="QR inválido o corrupto.",
            )

        grupo_id = payload.get("grupo_id")
        # Buscar sesión QR vigente en BD (fuente de verdad, no solo firma)
        qr_row = await self.db.execute(
            text("SELECT id, grupo_id, docente_id, expires_at FROM qr_clases WHERE token = :t;"),
            {"t": qr_token},
        )
        qr = qr_row.mappings().first()
        if not qr:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión QR no encontrada.")
        if qr["expires_at"] is not None:
            exp = qr["expires_at"]
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="QR de clase expirado (15 min).")

        grupo_id = qr["grupo_id"]

        # Verificar pertenencia al grupo
        memb = await self.db.execute(
            text("SELECT 1 FROM grupo_estudiantes WHERE grupo_id = :g AND user_id = :u;"),
            {"g": grupo_id, "u": user_id},
        )
        if not memb.first():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No perteneces a este grupo.",
            )

        # Anti-duplicado: mismo aprendiz + misma sesión QR
        dup = await self.db.execute(
            text("SELECT 1 FROM asistencias WHERE user_id = :u AND qr_clase_id = :q;"),
            {"u": user_id, "q": qr["id"]},
        )
        if dup.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Asistencia ya registrada para esta sesión.",
            )

        now = datetime.now(timezone.utc)
        try:
            res = await self.db.execute(
                text(
                    "INSERT INTO asistencias (user_id, grupo_id, qr_clase_id, fecha_hora) "
                    "VALUES (:u, :g, :q, :f) RETURNING id, user_id, grupo_id, qr_clase_id, fecha_hora;"
                ),
                {"u": user_id, "g": grupo_id, "q": qr["id"], "f": now},
            )
            await self.db.commit()
            row = res.mappings().first()
            logger.info(f"Asistencia registrada user={user_id} grupo={grupo_id} qr={qr['id']}")
            return dict(row)
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
                "SELECT a.id, a.user_id, a.grupo_id, a.qr_clase_id, a.fecha_hora, "
                "u.name, u.last_name, u.document "
                "FROM asistencias a JOIN users u ON u.id = a.user_id "
                "WHERE a.grupo_id = :g AND DATE(a.fecha_hora) = :f ORDER BY a.fecha_hora DESC;"
            )
            res = await self.db.execute(q, {"g": grupo_id, "f": base})
        else:
            res = await self.db.execute(
                text(
                    "SELECT a.id, a.user_id, a.grupo_id, a.qr_clase_id, a.fecha_hora, "
                    "u.name, u.last_name, u.document "
                    "FROM asistencias a JOIN users u ON u.id = a.user_id "
                    "WHERE a.grupo_id = :g ORDER BY a.fecha_hora DESC LIMIT 500;"
                ),
                {"g": grupo_id},
            )
        return [dict(r) for r in res.mappings().all()]

    async def stats(self, grupo_id: int) -> dict:
        total_est = await self.db.execute(
            text("SELECT COUNT(*) AS c FROM grupo_estudiantes WHERE grupo_id = :g;"),
            {"g": grupo_id},
        )
        total = total_est.mappings().first()["c"]
        hoy = await self.db.execute(
            text(
                "SELECT COUNT(DISTINCT user_id) AS c FROM asistencias "
                "WHERE grupo_id = :g AND DATE(fecha_hora) = CURRENT_DATE;"
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
            raise HTTPException(
                status_code=400,
                detail="Columnas requeridas: numero_documento, fecha_hora, observacion.",
            )
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
                # Buscar aprendiz
                u = await self.db.execute(
                    text("SELECT id FROM users WHERE document = :d;"), {"d": doc}
                )
                um = u.mappings().first()
                if not um:
                    raise ValueError(f"documento {doc} no existe")
                uid = um["id"]
                memb = await self.db.execute(
                    text("SELECT 1 FROM grupo_estudiantes WHERE grupo_id = :g AND user_id = :u;"),
                    {"g": grupo_id, "u": uid},
                )
                if not memb.first():
                    raise ValueError(f"documento {doc} no pertenece al grupo")
                dup = await self.db.execute(
                    text(
                        "SELECT 1 FROM asistencias WHERE user_id = :u AND grupo_id = :g "
                        "AND DATE(fecha_hora) = DATE(:f);"
                    ),
                    {"u": uid, "g": grupo_id, "f": fecha},
                )
                if dup.first():
                    duplicados += 1
                    detalle.append({"fila": n, "estado": "duplicado", "documento": doc})
                    continue
                await self.db.execute(
                    text(
                        "INSERT INTO asistencias (user_id, grupo_id, fecha_hora) "
                        "VALUES (:u, :g, :f);"
                    ),
                    {"u": uid, "g": grupo_id, "f": fecha},
                )
                insertados += 1
                detalle.append({"fila": n, "estado": "insertado", "documento": doc})
            except Exception as e:
                errores += 1
                detalle.append({"fila": n, "estado": "error", "mensaje": str(e)})
        await self.db.commit()
        return {
            "procesados": procesados,
            "insertados": insertados,
            "errores": errores,
            "duplicados": duplicados,
            "detalle": detalle,
        }
