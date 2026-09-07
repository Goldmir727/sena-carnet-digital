"""Alias /reportes para compatibilidad con el documento de requerimientos (RF-20).
Reutiliza ReportsService con prefijo en español.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_admin_user
from modules.reports.reports_service import ReportsService

router = APIRouter(prefix="/reportes", tags=["Reportes"])


@router.get("/asistencia")
async def asistencia(
    grupo_id: int | None = Query(None),
    desde: str | None = Query(None, description="YYYY-MM-DD"),
    hasta: str | None = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    service = ReportsService(db)
    if grupo_id is not None or desde or hasta:
        return await service.report_asistencias_filtrado(grupo_id, desde, hasta)
    return await service.report_asistencias()


@router.get("/asistencia/export/excel")
async def asistencia_excel(
    grupo_id: int | None = Query(None),
    desde: str | None = Query(None),
    hasta: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    from services.excel_service import generar_reporte_excel
    service = ReportsService(db)
    data = await service.report_asistencias_filtrado(grupo_id, desde, hasta)
    buf = generar_reporte_excel(data, "asistencia")
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=reporte_asistencia.xlsx"},
    )


@router.get("/estadisticas")
async def estadisticas(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    service = ReportsService(db)
    return await service.report_estadisticas()
