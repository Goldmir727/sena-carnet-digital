from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user, get_docente_user
from modules.qr.qr_schema import QRCarnetResponse, QRClaseRequest, QRClaseResponse
from modules.qr.qr_service import QRService
from services.qr_service import generate_qr_image

router = APIRouter(prefix="/qr", tags=["QR"])


@router.post("/carnet", response_model=QRCarnetResponse, status_code=status.HTTP_200_OK)
async def generate_carnet_qr(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    service = QRService(db)
    result = await service.generate_qr_carnet(current_user["id"])
    result["qr_image_url"] = f"/qr/carnet/image?token={result['qr_token']}"
    return result


@router.post("/clase", response_model=QRClaseResponse, status_code=status.HTTP_200_OK)
async def generate_clase_qr(
    body: QRClaseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_docente_user)
):
    service = QRService(db)
    return await service.generate_qr_clase(current_user["id"], body.grupo_id)


@router.get("/carnet/image")
async def get_carnet_qr_image(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    buffer = generate_qr_image(token)
    return Response(content=buffer.getvalue(), media_type="image/png")


@router.get("/clase/image")
async def get_clase_qr_image(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    buffer = generate_qr_image(token)
    return Response(content=buffer.getvalue(), media_type="image/png")
