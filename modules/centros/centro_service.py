from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.centros.centro_schema import CentroCreate
from core.logger import logger
from core.redis_client import cache_get, cache_set, cache_delete


async def invalidate_centro_cache() -> None:
    await cache_delete("centros:all")


class CentroService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self, regional: str | None = None) -> list[dict]:
        if regional:
            result = await self.db.execute(
                text("""
                    SELECT id, codigo, nombre, regional, ciudad,
                           direccion, telefono, email, status
                    FROM centros_formacion WHERE regional = :regional ORDER BY id ASC;
                """),
                {"regional": regional},
            )
            return [dict(r) for r in result.mappings().all()]
        cached = await cache_get("centros:all")
        if cached is not None:
            return cached
        result = await self.db.execute(
            text("""
                SELECT id, codigo, nombre, regional, ciudad,
                       direccion, telefono, email, status
                FROM centros_formacion ORDER BY id ASC;
            """)
        )
        data = [dict(r) for r in result.mappings().all()]
        await cache_set("centros:all", data, ex=60)
        return data

    async def create(self, data: CentroCreate) -> dict:
        existing = await self.db.execute(
            text("SELECT 1 FROM centros_formacion WHERE codigo = :c;"), {"c": data.codigo}
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un centro con ese código.",
            )
        try:
            result = await self.db.execute(
                text("""
                    INSERT INTO centros_formacion
                        (codigo, nombre, regional, ciudad, direccion, telefono, email)
                    VALUES (:codigo, :nombre, :regional, :ciudad, :direccion, :telefono, :email)
                    RETURNING id, codigo, nombre, regional, ciudad,
                              direccion, telefono, email, status;
                """),
                data.model_dump(),
            )
            await self.db.commit()
            await invalidate_centro_cache()
            return dict(result.mappings().first())
        except HTTPException:
            raise
        except Exception:
            await self.db.rollback()
            logger.exception("Error al crear centro.")
            raise HTTPException(status_code=500, detail="Error al crear el centro.")
