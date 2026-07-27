from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_validator_user
from modules.validation.validation_schema import ValidateQRRequest, ValidationResponse
from modules.validation.validation_service import ValidationService

router = APIRouter(prefix="/validate", tags=["Validación QR"])


@router.post("/qr", response_model=ValidationResponse, status_code=status.HTTP_200_OK)
async def validate_qr(
    body: ValidateQRRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_validator_user)
):
    ubicacion = request.headers.get("X-Ubicacion")
    service = ValidationService(db)
    return await service.validate_qr(body.qr_token, ubicacion)


@router.get("/check/{uuid}", response_model=ValidationResponse, status_code=status.HTTP_200_OK)
async def check_carnet_status(
    uuid: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_validator_user)
):
    ubicacion = request.headers.get("X-Ubicacion")
    qr_token = f"check:{uuid}"
    service = ValidationService(db)
    return await service.validate_qr(qr_token, ubicacion)
