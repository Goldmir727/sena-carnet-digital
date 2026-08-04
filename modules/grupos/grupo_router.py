from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_coordinador_user, get_docente_user
from modules.grupos.grupo_schema import (
    AsignarDocentesRequest,
    AsignarEstudiantesRequest,
    GrupoCreate,
    GrupoDetailResponse,
    GrupoResponse,
    GrupoUpdate,
)
from modules.grupos.grupo_service import GrupoService

router = APIRouter(
    prefix="/grupos",
    tags=["Grupos"],
)


@router.get("/", response_model=list[GrupoResponse])
async def list_grupos(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.get_all()


@router.get("/mis-grupos", response_model=list[GrupoResponse])
async def list_mis_grupos(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_docente_user),
):
    service = GrupoService(db)
    return await service.get_mis_grupos(current_user["id"])


@router.post("/", response_model=GrupoResponse, status_code=status.HTTP_201_CREATED)
async def create_grupo(
    grupo_in: GrupoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.create(grupo_in, current_user["id"])


@router.get("/{grupo_id}", response_model=GrupoDetailResponse)
async def get_grupo(
    grupo_id: int = Path(..., description="ID del grupo."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.get_by_id(grupo_id)


@router.put("/{grupo_id}", response_model=GrupoResponse)
async def update_grupo(
    grupo_data: GrupoUpdate,
    grupo_id: int = Path(..., description="ID del grupo."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.update(grupo_id, grupo_data.model_dump(exclude_unset=True))


@router.delete("/{grupo_id}")
async def delete_grupo(
    grupo_id: int = Path(..., description="ID del grupo."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.delete(grupo_id)


@router.get("/{grupo_id}/estudiantes")
async def list_estudiantes(
    grupo_id: int = Path(..., description="ID del grupo."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.get_estudiantes(grupo_id)


@router.post("/{grupo_id}/estudiantes", status_code=status.HTTP_201_CREATED)
async def add_estudiantes(
    payload: AsignarEstudiantesRequest,
    grupo_id: int = Path(..., description="ID del grupo."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.add_estudiantes(grupo_id, payload.user_ids)


@router.delete("/{grupo_id}/estudiantes/{user_id}")
async def remove_estudiante(
    grupo_id: int = Path(..., description="ID del grupo."),
    user_id: int = Path(..., description="ID del usuario a remover."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.remove_estudiante(grupo_id, user_id)


@router.get("/{grupo_id}/docentes")
async def list_docentes(
    grupo_id: int = Path(..., description="ID del grupo."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.get_docentes(grupo_id)


@router.post("/{grupo_id}/docentes", status_code=status.HTTP_201_CREATED)
async def add_docentes(
    payload: AsignarDocentesRequest,
    grupo_id: int = Path(..., description="ID del grupo."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.add_docentes(grupo_id, payload.user_ids)


@router.delete("/{grupo_id}/docentes/{user_id}")
async def remove_docente(
    grupo_id: int = Path(..., description="ID del grupo."),
    user_id: int = Path(..., description="ID del usuario a remover."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    service = GrupoService(db)
    return await service.remove_docente(grupo_id, user_id)
