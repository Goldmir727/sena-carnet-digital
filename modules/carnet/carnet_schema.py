from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class CarnetResponse(BaseModel):
    id: int
    user_id: int
    uuid: str
    codigo_qr: str
    estado: str
    fecha_emision: datetime
    fecha_vencimiento: datetime

    model_config = ConfigDict(from_attributes=True)


class CarnetEstadoUpdate(BaseModel):
    estado: str = Field(..., pattern="^(Activo|Suspendido|Vencido|Inactivo)$")


class CarnetDetailResponse(CarnetResponse):
    usuario_nombre: Optional[str] = None
    usuario_documento: Optional[str] = None
    usuario_email: Optional[str] = None
