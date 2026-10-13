from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_admin_user, get_current_user
from modules.attendance.attendance_schema import (
    AbsenceResponse,
    AttendanceDetailResponse,
    LateArrivalResponse,
)
from modules.attendance.attendance_service import AttendanceService
from datetime import datetime

router = APIRouter(prefix="/attendance", tags=["Asistencias"])


@router.get("/", response_model=list[AttendanceDetailResponse], status_code=status.HTTP_200_OK)
async def list_attendance(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = AttendanceService(db)
    return await service.get_all(limit, offset)


@router.get("/user/{user_id}", response_model=list[AttendanceDetailResponse], status_code=status.HTTP_200_OK)
async def user_attendance(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = AttendanceService(db)
    return await service.get_by_user(user_id)


@router.get("/stats", status_code=status.HTTP_200_OK)
async def attendance_stats(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = AttendanceService(db)
    return await service.get_stats()


@router.get("/range", response_model=list[AttendanceDetailResponse], status_code=status.HTTP_200_OK)
async def attendance_by_range(
    desde: str = Query(..., description="Formato ISO: YYYY-MM-DD"),
    hasta: str = Query(..., description="Formato ISO: YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    desde_dt = datetime.fromisoformat(desde)
    hasta_dt = datetime.fromisoformat(hasta)
    service = AttendanceService(db)
    return await service.get_by_date_range(desde_dt, hasta_dt)


def _docente_scope(current_user: dict) -> int | None:
    """Docente ve solo sus fichas; Coordinador ve todas."""
    if current_user["role_name"] == "Docente":
        return current_user["id"]
    return None


@router.get("/llegadas-tarde", response_model=list[LateArrivalResponse], status_code=status.HTTP_200_OK)
async def late_arrivals(
    limit: int = Query(500, ge=1, le=1000),
    ficha_id: int | None = Query(None, ge=1, description="Filtrar por ficha."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role_name"] not in ("Docente", "Coordinador"):
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    service = AttendanceService(db)
    instructor = _docente_scope(current_user)
    if instructor is not None and ficha_id is not None:
        if not await service.ficha_permitida(ficha_id, instructor):
            raise HTTPException(
                status_code=403,
                detail="Ficha no asignada a tu cuenta.",
            )
    return await service.get_late_arrivals(limit, instructor, ficha_id)


@router.get("/inasistencias", response_model=list[AbsenceResponse], status_code=status.HTTP_200_OK)
async def absences(
    limit: int = Query(1000, ge=1, le=5000),
    ficha_id: int | None = Query(None, ge=1, description="Filtrar por ficha."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role_name"] not in ("Docente", "Coordinador"):
        raise HTTPException(status_code=403, detail="Solo Docente o Coordinador.")
    service = AttendanceService(db)
    instructor = _docente_scope(current_user)
    if instructor is not None and ficha_id is not None:
        if not await service.ficha_permitida(ficha_id, instructor):
            raise HTTPException(
                status_code=403,
                detail="Ficha no asignada a tu cuenta.",
            )
    return await service.get_absences(limit, instructor, ficha_id)
