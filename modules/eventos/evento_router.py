from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_coordinador_user
from modules.eventos.evento_schema import EventoCreate, EventoResponse
from modules.eventos.evento_service import EventoService

router = APIRouter(prefix="/eventos", tags=["Eventos"])


@router.get("/nombres", response_model=list[str])
async def list_saved_event_names(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    return await EventoService(db).get_saved_names()


@router.get("/activos", response_model=list[EventoResponse])
async def list_active_events(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    return await EventoService(db).get_active()


@router.post("/", response_model=EventoResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    data: EventoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    return await EventoService(db).create(data, current_user["id"])


@router.post("/{event_id}/cerrar")
async def close_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    return await EventoService(db).close(event_id)
