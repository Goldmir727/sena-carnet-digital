from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_admin_user
from modules.reports.reports_service import ReportsService

router = APIRouter(prefix="/reports", tags=["Reportes"])


@router.get("/usuarios", status_code=status.HTTP_200_OK)
async def report_usuarios(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = ReportsService(db)
    return await service.report_usuarios()


@router.get("/carnets", status_code=status.HTTP_200_OK)
async def report_carnets(
    estado: str | None = Query(None, pattern="^(Activo|Suspendido|Vencido|Inactivo)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = ReportsService(db)
    if estado:
        return await service.report_carnets_por_estado(estado)
    return await service.report_carnets()


@router.get("/asistencias", status_code=status.HTTP_200_OK)
async def report_asistencias(
    grupo_id: int | None = Query(None, description="Filtrar por grupo"),
    desde: str | None = Query(None, description="YYYY-MM-DD"),
    hasta: str | None = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = ReportsService(db)
    # RF-20 con filtros; sin filtros mantiene comportamiento legacy
    if grupo_id is not None or desde is not None or hasta is not None:
        return await service.report_asistencias_filtrado(grupo_id, desde, hasta)
    return await service.report_asistencias()


@router.get("/estadisticas", status_code=status.HTTP_200_OK)
async def report_estadisticas(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = ReportsService(db)
    return await service.report_estadisticas()


@router.get("/export/pdf", status_code=status.HTTP_200_OK)
async def export_pdf(
    tipo: str = Query(..., pattern="^(usuarios|carnets|asistencias)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = ReportsService(db)
    pdf_bytes = await service.export_pdf(tipo)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=reporte_{tipo}.pdf"}
    )


@router.get("/export/excel", status_code=status.HTTP_200_OK)
async def export_excel(
    tipo: str = Query(..., pattern="^(usuarios|carnets|asistencias)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = ReportsService(db)
    excel_bytes = await service.export_excel(tipo)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=reporte_{tipo}.xlsx"}
    )
