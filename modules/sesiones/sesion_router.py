from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_coordinador_user, get_current_user, get_docente_user
from modules.sesiones.sesion_schema import SesionCreate, SesionQRResponse, SesionResponse, SesionUpdate
from modules.sesiones.sesion_service import SesionService
from pydantic import BaseModel

router = APIRouter(prefix="/sesiones", tags=["Sesiones"])


def _rol(user: dict) -> str:
    return user["role_name"]


class RegistroManualRequest(BaseModel):
    user_id: int


@router.get("/", response_model=list[SesionResponse])
async def list_sesiones(
    ficha_id: int | None = Query(None, description="Filtrar por ficha."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if _rol(current_user) not in ("Docente", "Coordinador"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    return await SesionService(db).listar(ficha_id, current_user["id"], _rol(current_user))


@router.post("/", response_model=SesionResponse, status_code=status.HTTP_201_CREATED)
async def create_sesion(
    data: SesionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if _rol(current_user) not in ("Docente", "Coordinador"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    instructor_id = current_user["id"]
    # El coordinador puede crear sesiones a nombre propio; el dueño queda como instructor.
    return await SesionService(db).create(data, instructor_id, _rol(current_user))


@router.get("/docente/mias", response_model=list[SesionResponse])
async def mis_sesiones(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_docente_user),
):
    return await SesionService(db).listar(None, current_user["id"], "Docente")


@router.get("/{sesion_id}", response_model=SesionResponse)
async def get_sesion(
    sesion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if _rol(current_user) not in ("Docente", "Coordinador"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    return await SesionService(db).get_by_id(sesion_id, current_user["id"], _rol(current_user))


@router.put("/{sesion_id}", response_model=SesionResponse)
async def update_sesion(
    sesion_id: int,
    data: SesionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if _rol(current_user) not in ("Docente", "Coordinador"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    return await SesionService(db).update(sesion_id, data, current_user["id"], _rol(current_user))


@router.delete("/{sesion_id}")
async def delete_sesion(
    sesion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if _rol(current_user) not in ("Docente", "Coordinador"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    return await SesionService(db).delete(sesion_id, current_user["id"], _rol(current_user))


@router.post("/{sesion_id}/qr", response_model=SesionQRResponse, status_code=status.HTTP_200_OK)
async def generar_qr_sesion(
    sesion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Genera (o rota) el QR de una sesión existente. El aprendiz lo escanea en POST /asistencia/escanear."""
    if _rol(current_user) not in ("Docente", "Coordinador"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    return await SesionService(db).generate_qr(sesion_id, current_user["id"], _rol(current_user))


@router.get("/{sesion_id}/asistencias", status_code=status.HTTP_200_OK)
async def asistencias_de_sesion(
    sesion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Registro en vivo: quiénes ya escanearon esta sesión."""
    if _rol(current_user) not in ("Docente", "Coordinador"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    return await SesionService(db).asistencias_de_sesion(sesion_id, current_user["id"], _rol(current_user))


@router.post("/{sesion_id}/asistencias", status_code=status.HTTP_201_CREATED)
async def registro_manual(
    sesion_id: int,
    body: RegistroManualRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_docente_user),
):
    """El instructor pasa lista manual a un aprendiz (sin QR)."""
    return await SesionService(db).registro_manual(sesion_id, body.user_id, current_user["id"], "Docente")
