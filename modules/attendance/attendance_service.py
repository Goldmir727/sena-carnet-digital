from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger


class AttendanceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self, limit: int = 100, offset: int = 0) -> list[dict]:
        # base.sql: asistencias.time / observations (sin fecha_hora/ubicacion).
        query = text("""
            SELECT a.id, a.user_id, a.time AS fecha_hora, a.observations AS ubicacion,
                   (u.name || ' ' || u.last_name) AS usuario_nombre,
                   u.document AS usuario_documento,
                   u.name AS nombres, u.last_name AS apellidos,
                   u.document AS numero_documento
            FROM asistencias a
            JOIN users u ON u.id = a.user_id
            ORDER BY a.time DESC
            LIMIT :limit OFFSET :offset;
        """)
        result = await self.db.execute(query, {"limit": limit, "offset": offset})
        return [dict(row) for row in result.mappings().all()]

    async def get_by_user(self, user_id: int, limit: int = 50) -> list[dict]:
        query = text("""
            SELECT a.id, a.user_id, a.time AS fecha_hora, a.observations AS ubicacion,
                   (u.name || ' ' || u.last_name) AS usuario_nombre,
                   u.document AS usuario_documento,
                   u.name AS nombres, u.last_name AS apellidos,
                   u.document AS numero_documento
            FROM asistencias a
            JOIN users u ON u.id = a.user_id
            WHERE a.user_id = :user_id
            ORDER BY a.time DESC
            LIMIT :limit;
        """)
        result = await self.db.execute(query, {"user_id": user_id, "limit": limit})
        return [dict(row) for row in result.mappings().all()]

    async def get_by_date_range(self, desde: datetime, hasta: datetime) -> list[dict]:
        query = text("""
            SELECT a.id, a.user_id, a.time AS fecha_hora, a.observations AS ubicacion,
                   (u.name || ' ' || u.last_name) AS usuario_nombre,
                   u.document AS usuario_documento,
                   u.name AS nombres, u.last_name AS apellidos,
                   u.document AS numero_documento
            FROM asistencias a
            JOIN users u ON u.id = a.user_id
            WHERE a.time BETWEEN :desde AND :hasta
            ORDER BY a.time DESC;
        """)
        result = await self.db.execute(query, {"desde": desde, "hasta": hasta})
        return [dict(row) for row in result.mappings().all()]

    async def get_stats(self) -> dict:
        total = await self.db.execute(text("SELECT COUNT(*) as count FROM asistencias;"))
        total_count = total.mappings().first()["count"]

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today = await self.db.execute(
            text("SELECT COUNT(*) as count FROM asistencias WHERE time >= :start;"),
            {"start": today_start}
        )
        today_count = today.mappings().first()["count"]

        unique = await self.db.execute(
            text("SELECT COUNT(DISTINCT user_id) as count FROM asistencias;")
        )
        unique_count = unique.mappings().first()["count"]

        return {
            "total_asistencias": total_count,
            "hoy": today_count,
            "usuarios_unicos": unique_count
        }

    def _scope_instructor(self, instructor_id: int | None, params: dict) -> str:
        """Docente: solo sus fichas (director o instructor), como get_mis_grupos."""
        if instructor_id is None:
            return ""
        params["uid"] = instructor_id
        return """
            AND (s.instructor_id = :uid
                 OR s.ficha_id IN (SELECT f.id FROM fichas f WHERE f.director_id = :uid))"""

    def _filtro_ficha(self, ficha_id: int | None, params: dict) -> str:
        """Restricción opcional por ficha (solo filtra; no amplía el alcance)."""
        if ficha_id is None:
            return ""
        params["ficha_id"] = ficha_id
        return "AND s.ficha_id = :ficha_id"

    async def ficha_permitida(self, ficha_id: int, user_id: int) -> bool:
        """Verifica que la ficha esté asignada al docente (director o instructor)."""
        res = await self.db.execute(
            text("""
                SELECT 1 FROM fichas f
                WHERE f.id = :fid
                  AND (f.director_id = :uid
                       OR f.id IN (SELECT s.ficha_id FROM sesiones s
                                   WHERE s.instructor_id = :uid))
                LIMIT 1;
            """),
            {"fid": ficha_id, "uid": user_id},
        )
        return res.first() is not None

    async def get_late_arrivals(
        self,
        limit: int = 500,
        instructor_id: int | None = None,
        ficha_id: int | None = None,
    ) -> list[dict]:
        """Llegadas tarde: asistencia registrada después del inicio programado.

        Requiere start_time en la sesión y que la llegada corresponda a la fecha
        de la sesión. El proyecto no tiene tolerancia configurada: cualquier
        llegada posterior al inicio programado cuenta como tarde.
        """
        params: dict = {"limit": limit}
        scope = self._scope_instructor(instructor_id, params)
        filtro = self._filtro_ficha(ficha_id, params)
        query = text(f"""
            SELECT a.id, a.user_id, a.session_id, a.time AS fecha_hora,
                   s.ficha_id AS grupo_id, s.session_date AS fecha_sesion,
                   s.start_time AS inicio_programado,
                   f.number AS grupo_nombre,
                   (u.name || ' ' || u.last_name) AS usuario_nombre,
                   u.name AS nombres, u.last_name AS apellidos,
                   u.document AS usuario_documento
            FROM asistencias a
            JOIN sesiones s ON s.id = a.session_id
            JOIN fichas f ON f.id = s.ficha_id
            JOIN users u ON u.id = a.user_id
            WHERE s.start_time IS NOT NULL
              AND DATE(a.time) = s.session_date
              AND a.time::time > s.start_time
              {scope}
              {filtro}
            ORDER BY a.time DESC
            LIMIT :limit;
        """)
        result = await self.db.execute(query, params)
        rows = [dict(row) for row in result.mappings().all()]
        for row in rows:
            llegada = row.get("fecha_hora")
            inicio = row.get("inicio_programado")
            if llegada is not None and inicio is not None:
                row["minutos_tarde"] = max(
                    (llegada.hour * 60 + llegada.minute) - (inicio.hour * 60 + inicio.minute),
                    0,
                )
            else:
                row["minutos_tarde"] = None
        return rows

    async def get_absences(
        self,
        limit: int = 1000,
        instructor_id: int | None = None,
        ficha_id: int | None = None,
    ) -> list[dict]:
        """Inasistencias: aprendiz con matrícula activa en la ficha, sesión cuyo
        periodo ya terminó (día anterior, o de hoy marcada 'realizada') y sin
        registro de asistencia para esa sesión. Solo lectura; no inventa datos.
        """
        params: dict = {"limit": limit}
        scope = self._scope_instructor(instructor_id, params)
        filtro = self._filtro_ficha(ficha_id, params)
        query = text(f"""
            SELECT s.id AS session_id, s.session_date AS fecha_sesion,
                   s.start_time AS inicio, s.end_time AS fin,
                   s.status AS estado_sesion,
                   s.ficha_id AS grupo_id, f.number AS grupo_nombre,
                   p.name AS programa_nombre,
                   u.id AS user_id, u.name AS nombres, u.last_name AS apellidos,
                   u.document AS usuario_documento
            FROM sesiones s
            JOIN fichas f ON f.id = s.ficha_id
            JOIN programa_formacion p ON p.id = f.programa_id
            JOIN matriculas m ON m.ficha_id = s.ficha_id AND m.status = 'activa'
            JOIN users u ON u.id = m.user_id
            LEFT JOIN asistencias a ON a.session_id = s.id AND a.user_id = m.user_id
            WHERE a.id IS NULL
              AND (s.session_date < CURRENT_DATE
                   OR (s.session_date = CURRENT_DATE AND s.status = 'realizada'))
              {scope}
              {filtro}
            ORDER BY s.session_date DESC, s.start_time DESC, u.last_name ASC
            LIMIT :limit;
        """)
        result = await self.db.execute(query, params)
        return [dict(row) for row in result.mappings().all()]
