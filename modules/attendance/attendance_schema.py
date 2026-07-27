from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    fecha_hora: datetime
    ubicacion: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceDetailResponse(AttendanceResponse):
    usuario_nombre: Optional[str] = None
    usuario_documento: Optional[str] = None
