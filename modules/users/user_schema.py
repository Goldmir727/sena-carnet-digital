from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional


class UserBase(BaseModel):
    username: str = Field(..., min_length=4, max_length=50)
    email: EmailStr
    nombres: Optional[str] = Field(None, max_length=100)
    apellidos: Optional[str] = Field(None, max_length=100)
    tipo_documento: Optional[str] = Field(None, max_length=20)
    numero_documento: Optional[str] = Field(None, max_length=50)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)
    role_id: int = Field(..., gt=0)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    nombres: Optional[str] = Field(None, max_length=100)
    apellidos: Optional[str] = Field(None, max_length=100)
    tipo_documento: Optional[str] = Field(None, max_length=20)
    numero_documento: Optional[str] = Field(None, max_length=50)
    role_id: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    role_id: int
    foto_perfil: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
