from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_aprendiz_user, get_current_user, get_docente_user
from modules.attendance.asistencia_service import AsistenciaService


class EscanearQRRequest(BaseModel):
    qr_token: str


# Prefijo /asistencia según requerimientos RF-17..RF-19
router = APIRouter(prefix="/asistencia", tags=["Asistencia QR"])


@router.post("/escanear", status_code=status.HTTP_201_CREATED)
async def escanear_qr(
    body: EscanearQRRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_aprendiz_user),
):
    service = AsistenciaService(db)
    return await service.escanear(current_user["id"], body.qr_token)


@router.get("/grupo/{grupo_id}", status_code=status.HTTP_200_OK)
async def asistencia_por_grupo(
    grupo_id: int,
    fecha: str | None = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role_name"] not in ("Docente", "Coordinador"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    service = AsistenciaService(db)
    return await service.por_grupo(grupo_id, fecha)


@router.get("/grupo/{grupo_id}/stats", status_code=status.HTTP_200_OK)
async def asistencia_stats(
    grupo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role_name"] not in ("Docente", "Coordinador"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    service = AsistenciaService(db)
    return await service.stats(grupo_id)


@router.post("/excel", status_code=status.HTTP_200_OK)
async def importar_excel(
    grupo_id: int = Query(..., gt=0),
    archivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_docente_user),
):
    if not archivo.filename.lower().endswith(".xlsx"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Solo se acepta .xlsx")
    contenido = await archivo.read()
    if len(contenido) > 5 * 1024 * 1024:
        from fastapi import HTTPException
        raise HTTPException(status_code=413, detail="Archivo muy grande (máx 5MB).")
    service = AsistenciaService(db)
    return await service.importar_excel(grupo_id, contenido)
