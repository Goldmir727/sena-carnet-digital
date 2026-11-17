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
    tipo_sangre: Optional[str] = None
    centro_id: Optional[int] = None
    centro_nombre: Optional[str] = None
    centro_codigo: Optional[str] = None
    regional: Optional[str] = None
    ciudad: Optional[str] = None
    ficha_numero: Optional[str] = None
    programa_nombre: Optional[str] = None
    rol_nombre: Optional[str] = None
