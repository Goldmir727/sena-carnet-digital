from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ProgramaCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=200, description="Nombre del programa.")
    modality: Optional[str] = Field(None, max_length=50, description="Modalidad (presencial, virtual, etc.).")
    duration: Optional[int] = Field(None, gt=0, description="Duración en meses/horas según convención.")
    level: Optional[str] = Field(None, max_length=50, description="Nivel (Técnico, Tecnólogo, etc.).")
    description: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class ProgramaUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=200)
    modality: Optional[str] = Field(None, max_length=50)
    duration: Optional[int] = Field(None, gt=0)
    level: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class ProgramaResponse(BaseModel):
    id: int
    name: str
    modality: Optional[str] = None
    duration: Optional[int] = None
    level: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
