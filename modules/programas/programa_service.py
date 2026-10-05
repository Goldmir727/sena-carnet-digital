from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ProgramaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self) -> list[dict]:
        result = await self.db.execute(
            text("""
                SELECT id, name, modality, duration, level, description
                FROM programa_formacion ORDER BY id ASC;
            """)
        )
        return [dict(r) for r in result.mappings().all()]

    async def create(self, data) -> dict:
        existing = await self.db.execute(
            text("SELECT 1 FROM programa_formacion WHERE name = :name;"), {"name": data.name}
        )
        if existing.first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un programa con ese nombre.")
        result = await self.db.execute(
            text("""
                INSERT INTO programa_formacion (name, modality, duration, level, description)
                VALUES (:name, :modality, :duration, :level, :description)
                RETURNING id, name, modality, duration, level, description;
            """),
            data.model_dump(),
        )
        await self.db.commit()
        return dict(result.mappings().first())

    async def update(self, programa_id: int, data: dict) -> dict:
        current = await self.db.execute(
            text("SELECT id FROM programa_formacion WHERE id = :id;"), {"id": programa_id}
        )
        if current.first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Programa no encontrado.")
        if data.get("name") is not None:
            dup = await self.db.execute(
                text("SELECT 1 FROM programa_formacion WHERE name = :name AND id != :id;"),
                {"name": data["name"], "id": programa_id},
            )
            if dup.first() is not None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un programa con ese nombre.")
        sets = []
        params = {"id": programa_id}
        for field in ("name", "modality", "duration", "level", "description"):
            if data.get(field) is not None:
                sets.append(f"{field} = :{field}")
                params[field] = data[field]
        if not sets:
            raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar.")
        result = await self.db.execute(
            text(f"""
                UPDATE programa_formacion SET {", ".join(sets)} WHERE id = :id
                RETURNING id, name, modality, duration, level, description;
            """),
            params,
        )
        await self.db.commit()
        return dict(result.mappings().first())
