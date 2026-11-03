from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ValidateQRRequest(BaseModel):
    qr_token: str


class ValidationResponse(BaseModel):
    permitido: bool
    mensaje: str
    usuario: Optional[dict] = None
    carnet_estado: Optional[str] = None


class AccessLogResponse(BaseModel):
    id: int
    user_id: int
    resultado: str
    mensaje: str
    timestamp: datetime


class AccessHistoryResponse(BaseModel):
    id: int
    user_id: int
    movement: str
    day: str
    time: str
    center: str
    timestamp: datetime
