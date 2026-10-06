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
