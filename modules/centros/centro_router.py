from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_coordinador_user
from modules.centros.centro_schema import CentroCreate, CentroResponse
from modules.centros.centro_service import CentroService

router = APIRouter(prefix="/centros", tags=["Centros"])


@router.get("/", response_model=list[CentroResponse])
async def list_centros(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    return await CentroService(db).get_all()


@router.post("/", response_model=CentroResponse, status_code=status.HTTP_201_CREATED)
async def create_centro(
    data: CentroCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    return await CentroService(db).create(data)
