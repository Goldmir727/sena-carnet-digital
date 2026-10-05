from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_coordinador_user

router = APIRouter(prefix="/regionales", tags=["Regionales"])


@router.get("/")
async def list_regionales(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    result = await db.execute(
        text("SELECT DISTINCT regional FROM centros_formacion WHERE regional IS NOT NULL AND regional <> '' ORDER BY regional ASC;")
    )
    return [{"name": row[0]} for row in result.all()]
