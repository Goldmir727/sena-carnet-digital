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
    centro_id: Optional[int] = Field(
        None, gt=0, description="ID del centro de formación (fichas.centro_id)."
    )
    programa_id: Optional[int] = Field(
        None, gt=0, description="ID del programa de formación (fichas.programa_id)."
    )
    director_id: Optional[int] = Field(
        None, gt=0, description="ID del usuario director de la ficha (fichas.director_id)."
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
    centro_id: Optional[int] = Field(None, description="Centro de formación.")
    programa_id: Optional[int] = Field(None, description="Programa de formación.")
    programa_nombre: Optional[str] = Field(None, description="Nombre del programa de formación.")
    director_id: Optional[int] = Field(None, description="Director de la ficha.")
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
    centro_id: Optional[int] = Field(
        None, gt=0, description="ID del centro de formación (fichas.centro_id)."
    )
    programa_id: Optional[int] = Field(
        None, gt=0, description="ID del programa de formación (fichas.programa_id)."
    )
    director_id: Optional[int] = Field(
        None, gt=0, description="ID del director de la ficha (fichas.director_id)."
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
