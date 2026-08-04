from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class GrupoCreate(BaseModel):
    nombre: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="Nombre del grupo.",
    )
    descripcion: Optional[str] = Field(
        None,
        max_length=255,
        description="Descripción del grupo.",
    )

    model_config = ConfigDict(extra="forbid")


class CoordinadorInfo(BaseModel):
    id: int = Field(..., description="ID del coordinador.")
    username: str = Field(..., description="Nombre de usuario del coordinador.")
    email: EmailStr = Field(..., description="Correo del coordinador.")

    model_config = ConfigDict(from_attributes=True)


class GrupoResponse(BaseModel):
    id: int = Field(..., description="ID del grupo.")
    nombre: str = Field(..., description="Nombre del grupo.")
    descripcion: Optional[str] = Field(None, description="Descripción del grupo.")
    created_at: datetime = Field(..., description="Fecha de creación.")

    model_config = ConfigDict(from_attributes=True)


class GrupoDetailResponse(GrupoResponse):
    coordinador: Optional[CoordinadorInfo] = Field(
        None, description="Información del coordinador asignado."
    )

    model_config = ConfigDict(from_attributes=True)


class GrupoUpdate(BaseModel):
    nombre: Optional[str] = Field(
        None,
        min_length=3,
        max_length=100,
        description="Nombre del grupo.",
    )
    descripcion: Optional[str] = Field(
        None,
        max_length=255,
        description="Descripción del grupo.",
    )

    model_config = ConfigDict(extra="forbid")


class AsignarEstudiantesRequest(BaseModel):
    user_ids: list[int] = Field(
        ...,
        min_length=1,
        description="Lista de IDs de usuarios con rol Aprendiz.",
    )

    model_config = ConfigDict(extra="forbid")


class AsignarDocentesRequest(BaseModel):
    user_ids: list[int] = Field(
        ...,
        min_length=1,
        description="Lista de IDs de usuarios con rol Docente.",
    )

    model_config = ConfigDict(extra="forbid")
