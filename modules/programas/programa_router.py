from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_coordinador_user
from modules.programas.programa_schema import ProgramaCreate, ProgramaResponse, ProgramaUpdate
from modules.programas.programa_service import ProgramaService

router = APIRouter(prefix="/programas", tags=["Programas"])


@router.get("/", response_model=list[ProgramaResponse])
async def list_programas(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    return await ProgramaService(db).get_all()


@router.post("/", response_model=ProgramaResponse, status_code=201)
async def create_programa(
    data: ProgramaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    return await ProgramaService(db).create(data)


@router.put("/{programa_id}", response_model=ProgramaResponse)
async def update_programa(
    programa_id: int,
    data: ProgramaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    return await ProgramaService(db).update(programa_id, data.model_dump(exclude_unset=True))
