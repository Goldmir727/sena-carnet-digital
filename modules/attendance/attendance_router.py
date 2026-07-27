from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_admin_user
from modules.attendance.attendance_schema import AttendanceDetailResponse
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
