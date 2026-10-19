from datetime import date
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.logger import logger
from core.redis_client import cache_get, cache_set, cache_delete
from services.pdf_service import generar_reporte_pdf
from services.excel_service import generar_reporte_excel


async def invalidate_report_cache() -> None:
    await cache_delete("reports:*")


class ReportsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def report_usuarios(self) -> list[dict]:
        cached = await cache_get("reports:usuarios")
        if cached is not None:
            return cached
        query = text("""
                 SELECT u.id, u.email, u.name AS nombres, u.last_name AS apellidos,
                     u.document_type AS tipo_documento, u.document AS numero_documento,
                     (u.user_status IN ('ACTIVE', 'ACTIVO')) AS is_active,
                     r.name as rol, u.registration_date AS created_at
            FROM users u
            JOIN roles r ON r.id = u.role_id
            ORDER BY u.id ASC;
        """)
        result = await self.db.execute(query)
        data = [dict(row) for row in result.mappings().all()]
        await cache_set("reports:usuarios", data, ex=settings.CACHE_TTL_REPORTS)
        return data

    async def report_carnets(self) -> list[dict]:
        cached = await cache_get("reports:carnets")
        if cached is not None:
            return cached
        query = text("""
                 SELECT c.id, c.qr_code AS uuid,
                     CASE WHEN c.expiration_date < CURRENT_DATE THEN 'Vencido' ELSE 'Activo' END AS estado,
                     c.issue_date AS fecha_emision,
                     c.expiration_date AS fecha_vencimiento, u.name AS nombres,
                     u.last_name AS apellidos, u.document AS numero_documento
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            ORDER BY c.id DESC;
        """)
        result = await self.db.execute(query)
        data = [dict(row) for row in result.mappings().all()]
        await cache_set("reports:carnets", data, ex=settings.CACHE_TTL_REPORTS)
        return data

    async def report_carnets_por_estado(self, estado: str) -> list[dict]:
        if estado == "Activo":
            where = "WHERE c.expiration_date >= CURRENT_DATE"
        elif estado == "Vencido":
            where = "WHERE c.expiration_date < CURRENT_DATE"
        else:
            return []
        query = text(f"""
                 SELECT c.id, c.qr_code AS uuid,
                     CASE WHEN c.expiration_date < CURRENT_DATE THEN 'Vencido' ELSE 'Activo' END AS estado,
                     c.issue_date AS fecha_emision,
                     c.expiration_date AS fecha_vencimiento, u.name AS nombres,
                     u.last_name AS apellidos, u.document AS numero_documento
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            {where}
            ORDER BY c.id DESC;
        """)
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def report_asistencias(self, limit: int = 500) -> list[dict]:
        # base.sql: asistencias(id, session_id, event_id, user_id, status, time, observations)
        query = text("""
                 SELECT a.id, a.time AS fecha_hora, a.observations AS ubicacion,
                     u.name AS nombres, u.last_name AS apellidos, u.document AS numero_documento
            FROM asistencias a
            JOIN users u ON u.id = a.user_id
            ORDER BY a.time DESC
            LIMIT :limit;
        """)
        result = await self.db.execute(query, {"limit": limit})
        return [dict(row) for row in result.mappings().all()]

    async def report_asistencias_filtrado(
        self, grupo_id: int | None = None, desde: str | None = None, hasta: str | None = None
    ) -> list[dict]:
        key = f"reports:asistencias:{grupo_id}:{desde}:{hasta}"
        cached = await cache_get(key)
        if cached is not None:
            return cached
        # base.sql: grupo=fichas via sesiones.ficha_id, fecha=a.time
        conds = []
        params: dict = {"limit": 500}
        if grupo_id is not None:
            conds.append("s.ficha_id = :g")
            params["g"] = grupo_id
        if desde:
            conds.append("DATE(a.time) >= :d")
            params["d"] = date.fromisoformat(desde)
        if hasta:
            conds.append("DATE(a.time) <= :h")
            params["h"] = date.fromisoformat(hasta)
        where = f"WHERE {' AND '.join(conds)}" if conds else ""
        query = text(f"""
                 SELECT a.id, a.time AS fecha_hora, s.ficha_id AS grupo_id, a.session_id AS qr_clase_id,
                     u.name AS nombres, u.last_name AS apellidos, u.document AS numero_documento
            FROM asistencias a
            JOIN users u ON u.id = a.user_id
            LEFT JOIN sesiones s ON s.id = a.session_id
            {where}
            ORDER BY a.time DESC
            LIMIT :limit;
        """)
        result = await self.db.execute(query, params)
        data = [dict(row) for row in result.mappings().all()]
        await cache_set(key, data, ex=settings.CACHE_TTL_REPORTS)
        return data

    async def report_estadisticas(self) -> dict:
        cached = await cache_get("reports:estadisticas")
        if cached is not None:
            return cached
        total_users = await self.db.execute(text("SELECT COUNT(*) as c FROM users;"))
        active_users = await self.db.execute(text("SELECT COUNT(*) as c FROM users WHERE user_status IN ('ACTIVE', 'ACTIVO');"))
        total_carnets = await self.db.execute(text("SELECT COUNT(*) as c FROM carnets;"))
        # base.sql sin status: Activo = no vencido, Vencido = expirado
        carnet_activos = await self.db.execute(text("SELECT COUNT(*) as c FROM carnets WHERE expiration_date >= CURRENT_DATE;"))
        carnet_vencidos = await self.db.execute(text("SELECT COUNT(*) as c FROM carnets WHERE expiration_date < CURRENT_DATE;"))
        total_asistencias = await self.db.execute(text("SELECT COUNT(*) as c FROM asistencias;"))

        def val(r):
            return r.mappings().first()["c"]

        data = {
            "usuarios_registrados": val(total_users),
            "usuarios_activos": val(active_users),
            "carnets_emitidos": val(total_carnets),
            "carnets_activos": val(carnet_activos),
            "carnets_vencidos": val(carnet_vencidos),
            "carnets_inactivos": 0,
            "total_asistencias": val(total_asistencias),
        }
        await cache_set("reports:estadisticas", data, ex=settings.CACHE_TTL_REPORTS)
        return data

    async def export_pdf(self, tipo: str) -> bytes:
        if tipo == "usuarios":
            data = await self.report_usuarios()
            titulo = "Reporte de Usuarios"
        elif tipo == "carnets":
            data = await self.report_carnets()
            titulo = "Reporte de Carnets"
        elif tipo == "asistencias":
            data = await self.report_asistencias()
            titulo = "Reporte de Asistencias"
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de reporte inválido.")

        buffer = generar_reporte_pdf(data, titulo)
        return buffer.getvalue()

    async def export_excel(self, tipo: str) -> bytes:
        if tipo == "usuarios":
            data = await self.report_usuarios()
        elif tipo == "carnets":
            data = await self.report_carnets()
        elif tipo == "asistencias":
            data = await self.report_asistencias()
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de reporte inválido.")

        buffer = generar_reporte_excel(data, tipo)
        return buffer.getvalue()
