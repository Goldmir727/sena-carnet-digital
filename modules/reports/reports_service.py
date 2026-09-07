from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from services.pdf_service import generar_reporte_pdf
from services.excel_service import generar_reporte_excel


class ReportsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def report_usuarios(self) -> list[dict]:
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
        return [dict(row) for row in result.mappings().all()]

    async def report_carnets(self) -> list[dict]:
        query = text("""
                 SELECT c.id, c.qr_code AS uuid, c.status AS estado, c.issue_date AS fecha_emision,
                     c.expiration_date AS fecha_vencimiento, u.name AS nombres,
                     u.last_name AS apellidos, u.document AS numero_documento
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            ORDER BY c.id DESC;
        """)
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def report_carnets_por_estado(self, estado: str) -> list[dict]:
        query = text("""
                 SELECT c.id, c.qr_code AS uuid, c.status AS estado, c.issue_date AS fecha_emision,
                     c.expiration_date AS fecha_vencimiento, u.name AS nombres,
                     u.last_name AS apellidos, u.document AS numero_documento
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.status = :estado
            ORDER BY c.id DESC;
        """)
        result = await self.db.execute(query, {"estado": estado})
        return [dict(row) for row in result.mappings().all()]

    async def report_asistencias(self, limit: int = 500) -> list[dict]:
        query = text("""
                 SELECT a.id, a.fecha_hora, a.ubicacion,
                     u.name AS nombres, u.last_name AS apellidos, u.document AS numero_documento
            FROM asistencias a
            JOIN users u ON u.id = a.user_id
            ORDER BY a.fecha_hora DESC
            LIMIT :limit;
        """)
        result = await self.db.execute(query, {"limit": limit})
        return [dict(row) for row in result.mappings().all()]

    async def report_asistencias_filtrado(
        self, grupo_id: int | None = None, desde: str | None = None, hasta: str | None = None
    ) -> list[dict]:
        # RF-20: filtros por grupo y rango de fechas (schema 001+003: fecha_hora/grupo_id)
        conds = []
        params: dict = {"limit": 500}
        if grupo_id is not None:
            conds.append("a.grupo_id = :g")
            params["g"] = grupo_id
        if desde:
            conds.append("DATE(a.fecha_hora) >= DATE(:d)")
            params["d"] = desde
        if hasta:
            conds.append("DATE(a.fecha_hora) <= DATE(:h)")
            params["h"] = hasta
        where = f"WHERE {' AND '.join(conds)}" if conds else ""
        try:
            query = text(f"""
                     SELECT a.id, a.fecha_hora, a.grupo_id, a.qr_clase_id,
                         u.name AS nombres, u.last_name AS apellidos, u.document AS numero_documento
                FROM asistencias a
                JOIN users u ON u.id = a.user_id
                {where}
                ORDER BY a.fecha_hora DESC
                LIMIT :limit;
            """)
            result = await self.db.execute(query, params)
            return [dict(row) for row in result.mappings().all()]
        except Exception:
            # Fallback a schema legacy (time/observations) si la BD no tiene 003
            return await self.report_asistencias()

    async def report_estadisticas(self) -> dict:
        total_users = await self.db.execute(text("SELECT COUNT(*) as c FROM users;"))
        active_users = await self.db.execute(text("SELECT COUNT(*) as c FROM users WHERE user_status IN ('ACTIVE', 'ACTIVO');"))
        total_carnets = await self.db.execute(text("SELECT COUNT(*) as c FROM carnets;"))
        carnet_activos = await self.db.execute(text("SELECT COUNT(*) as c FROM carnets WHERE status = 'Activo';"))
        carnet_vencidos = await self.db.execute(text("SELECT COUNT(*) as c FROM carnets WHERE status = 'Vencido';"))
        carnet_inactivos = await self.db.execute(text("SELECT COUNT(*) as c FROM carnets WHERE status = 'Inactivo';"))
        total_asistencias = await self.db.execute(text("SELECT COUNT(*) as c FROM asistencias;"))

        def val(r):
            return r.mappings().first()["c"]

        return {
            "usuarios_registrados": val(total_users),
            "usuarios_activos": val(active_users),
            "carnets_emitidos": val(total_carnets),
            "carnets_activos": val(carnet_activos),
            "carnets_vencidos": val(carnet_vencidos),
            "carnets_inactivos": val(carnet_inactivos),
            "total_asistencias": val(total_asistencias),
        }

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
