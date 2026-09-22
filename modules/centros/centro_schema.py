from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CentroCreate(BaseModel):
    codigo: str = Field(..., min_length=1, max_length=20, description="Código único del centro.")
    nombre: str = Field(..., min_length=3, max_length=150, description="Nombre del centro.")
    regional: str = Field(..., min_length=1, max_length=100, description="Regional SENA.")
    ciudad: str = Field(..., min_length=1, max_length=100, description="Ciudad del centro.")
    direccion: Optional[str] = Field(None, max_length=200)
    telefono: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=150)

    model_config = ConfigDict(extra="forbid")


class CentroResponse(CentroCreate):
    id: int
    status: str = "activo"

    model_config = ConfigDict(from_attributes=True)
