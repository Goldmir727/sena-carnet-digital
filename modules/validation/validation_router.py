from fastapi import APIRouter, Depends, Path, Request, status
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


@router.get("/check/{codigo}", response_model=ValidationResponse, status_code=status.HTTP_200_OK)
async def check_carnet_status(
    codigo: str = Path(..., description="ID numérico del carnet o su UUID (código único)."),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_validator_user)
):
    from sqlalchemy import text
    if codigo.isdigit():
        res = await db.execute(
            text(
                "SELECT CASE WHEN c.expiration_date < CURRENT_DATE THEN 'Vencido' ELSE 'Activo' END AS estado, "
                "u.id AS user_id, u.name AS nombres, u.last_name AS apellidos "
                "FROM carnets c JOIN users u ON u.id=c.user_id WHERE c.id = :id;"
            ),
            {"id": int(codigo)},
        )
    else:
        res = await db.execute(
            text(
                "SELECT CASE WHEN c.expiration_date < CURRENT_DATE THEN 'Vencido' ELSE 'Activo' END AS estado, "
                "u.id AS user_id, u.name AS nombres, u.last_name AS apellidos "
                "FROM carnets c JOIN users u ON u.id=c.user_id WHERE c.qr_code = :codigo;"
            ),
            {"codigo": codigo},
        )
    row = res.mappings().first()
    if not row:
        return {"permitido": False, "mensaje": "Carnet no encontrado", "usuario": None, "carnet_estado": None}
    permitido = row["estado"] == "Activo"
    return {
        "permitido": permitido,
        "mensaje": "Acceso Permitido" if permitido else f"Acceso Denegado - Carnet {row['estado']}",
        "usuario": {"id": row["user_id"], "nombres": row["nombres"], "apellidos": row["apellidos"]},
        "carnet_estado": row["estado"],
    }
