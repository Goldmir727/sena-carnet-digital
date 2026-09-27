from datetime import date, time
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class SesionCreate(BaseModel):
    ficha_id: int = Field(..., gt=0, description="ID de la ficha (grupo).")
    session_date: date = Field(..., description="Fecha de la sesión (YYYY-MM-DD).")
    start_time: time = Field(..., description="Hora de inicio (HH:MM).")
    end_time: time = Field(..., description="Hora de fin (HH:MM).")
    description: Optional[str] = Field(None, description="Tema o descripción de la clase.")

    model_config = ConfigDict(extra="forbid")


class SesionUpdate(BaseModel):
    session_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(programada|en_curso|realizada|cancelada)$")

    model_config = ConfigDict(extra="forbid")


class SesionResponse(BaseModel):
    id: int
    ficha_id: int
    ficha_number: Optional[str] = None
    instructor_id: int
    instructor_nombre: Optional[str] = None
    description: Optional[str] = None
    session_date: date
    start_time: time
    end_time: time
    status: str
    qr_expires_at: Optional[str] = None
    tiene_qr_vigente: bool = False
    presentes: int = 0

    model_config = ConfigDict(from_attributes=True)


class SesionQRResponse(BaseModel):
    sesion_id: int
    qr_token: str
    expires_at: str
    qr_image_url: str
