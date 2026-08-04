from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_aprendiz_user, get_docente_user
from modules.asistencia.asistencia_schema import (
    AsistenciaResponse,
    AsistenciaStatsResponse,
    EscanearQRRequest,
    ExcelUploadResponse,
)
from modules.asistencia.asistencia_service import AsistenciaService

router = APIRouter(prefix="/asistencia", tags=["Asistencia"])


@router.post("/escanear", response_model=AsistenciaResponse, status_code=status.HTTP_201_CREATED)
async def escanear_qr(
    body: EscanearQRRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_aprendiz_user),
):
    service = AsistenciaService(db)
    return await service.escanear_qr(body.qr_token, current_user["id"])


@router.get("/grupo/{id}", response_model=list[AsistenciaResponse], status_code=status.HTTP_200_OK)
async def listar_asistencias_grupo(
    id: int,
    desde: str = Query(None),
    hasta: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_docente_user),
):
    service = AsistenciaService(db)
    return await service.get_by_grupo(id, desde, hasta)


@router.get("/grupo/{id}/stats", response_model=AsistenciaStatsResponse, status_code=status.HTTP_200_OK)
async def stats_grupo(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_docente_user),
):
    service = AsistenciaService(db)
    return await service.get_stats(id)


@router.post("/excel", response_model=ExcelUploadResponse, status_code=status.HTTP_200_OK)
async def upload_excel(
    file: UploadFile = File(...),
    grupo_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_docente_user),
):
    content = await file.read()
    service = AsistenciaService(db)
    return await service.process_excel(grupo_id, content)
