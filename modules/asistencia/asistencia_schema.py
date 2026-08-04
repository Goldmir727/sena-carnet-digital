from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class EscanearQRRequest(BaseModel):
    qr_token: str


class AsistenciaResponse(BaseModel):
    id: int
    user_id: int
    usuario: dict
    fecha_hora: datetime
    ubicacion: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AsistenciaStatsResponse(BaseModel):
    total_asistencias: int
    presentes_hoy: int
    total_estudiantes: int


class ExcelUploadResponse(BaseModel):
    procesados: int
    insertados: int
    errores: int
    duplicados: int
    detalle: list[dict]
