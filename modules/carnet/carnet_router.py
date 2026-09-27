from fastapi import APIRouter, Depends, status, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user, get_admin_user
from modules.carnet.carnet_schema import CarnetResponse, CarnetEstadoUpdate, CarnetDetailResponse
from modules.carnet.carnet_service import CarnetService
from services.qr_service import generate_qr_image
from services.pdf_service import generar_carnet_pdf

router = APIRouter(prefix="/carnets", tags=["Carnets"])


@router.post("/generate/{user_id}", response_model=CarnetResponse, status_code=status.HTTP_201_CREATED)
async def generate_carnet(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = CarnetService(db)
    return await service.generate_carnet(user_id)


@router.post("/regenerate/{user_id}", response_model=CarnetResponse, status_code=status.HTTP_200_OK)
async def regenerate_carnet(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = CarnetService(db)
    return await service.regenerate_carnet(user_id)


@router.get("/me", response_model=CarnetDetailResponse, status_code=status.HTTP_200_OK)
async def get_my_carnet(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    service = CarnetService(db)
    carnet = await service.get_carnet_by_user(current_user["id"])
    if not carnet:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No tienes un carnet asignado.")
    return carnet


@router.get("/", response_model=list[CarnetDetailResponse], status_code=status.HTTP_200_OK)
async def list_carnets(
    estado: str | None = Query(None, pattern="^(Activo|Suspendido|Vencido|Inactivo)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = CarnetService(db)
    return await service.list_carnets(estado)


@router.get("/{carnet_id}", response_model=CarnetDetailResponse, status_code=status.HTTP_200_OK)
async def get_carnet(
    carnet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    service = CarnetService(db)
    return await service.get_carnet_by_id(carnet_id)


@router.patch("/{carnet_id}/estado", response_model=CarnetResponse, status_code=status.HTTP_200_OK)
async def update_carnet_estado(
    carnet_id: int,
    estado_in: CarnetEstadoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = CarnetService(db)
    return await service.update_estado(carnet_id, estado_in.estado)


@router.get("/{carnet_id}/qr", status_code=status.HTTP_200_OK)
async def get_carnet_qr(
    carnet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    service = CarnetService(db)
    carnet = await service.get_carnet_by_id(carnet_id)
    qr_buffer = generate_qr_image(carnet["codigo_qr"])
    return Response(content=qr_buffer.getvalue(), media_type="image/png")


@router.get("/{carnet_id}/pdf", status_code=status.HTTP_200_OK)
async def download_carnet_pdf(
    carnet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    service = CarnetService(db)
    carnet = await service.get_carnet_by_id(carnet_id)
    user = {
        "nombres": carnet.get("nombres"),
        "apellidos": carnet.get("apellidos"),
        "email": carnet.get("email"),
        "tipo_documento": carnet.get("tipo_documento"),
        "numero_documento": carnet.get("numero_documento"),
        "tipo_sangre": carnet.get("tipo_sangre"),
        "centro_nombre": carnet.get("centro_nombre"),
        "estado": carnet.get("estado"),
        "foto_perfil": carnet.get("foto_perfil"),
    }
    pdf_buffer = generar_carnet_pdf(user, carnet, carnet["codigo_qr"])
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=carnet_{carnet['uuid']}.pdf"}
    )
