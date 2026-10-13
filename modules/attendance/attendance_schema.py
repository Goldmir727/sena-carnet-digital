from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime, time


class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    fecha_hora: datetime
    ubicacion: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceDetailResponse(AttendanceResponse):
    usuario_nombre: Optional[str] = None
    usuario_documento: Optional[str] = None


class LateArrivalResponse(BaseModel):
    """Llegada tarde: asistencia registrada después del inicio programado."""

    id: int
    user_id: int
    session_id: Optional[int] = None
    grupo_id: Optional[int] = None
    grupo_nombre: Optional[str] = None
    usuario_nombre: Optional[str] = None
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    usuario_documento: Optional[str] = None
    fecha_sesion: Optional[date] = None
    inicio_programado: Optional[time] = None
    fecha_hora: Optional[datetime] = None
    minutos_tarde: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class AbsenceResponse(BaseModel):
    """Inasistencia: matrícula activa, sesión finalizada y sin registro."""

    session_id: int
    user_id: int
    grupo_id: int
    grupo_nombre: Optional[str] = None
    programa_nombre: Optional[str] = None
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    usuario_documento: Optional[str] = None
    fecha_sesion: date
    inicio: Optional[time] = None
    fin: Optional[time] = None
    estado_sesion: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
