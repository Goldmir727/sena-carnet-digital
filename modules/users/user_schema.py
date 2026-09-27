# ============================
# IMPORTACIONES
# ============================

from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ============================
# ESQUEMAS DE USUARIOS
# Modelos utilizados para validar
# la información de entrada y salida
# de la API.
# ============================

# Tipos de sangre aceptados por el sistema.
TIPOS_SANGRE = ("O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-")


def normalizar_tipo_sangre(value: Optional[str]) -> Optional[str]:
    """Normaliza el tipo de sangre (mayúsculas, sin espacios)."""
    if value is None:
        return None
    text = str(value).strip().upper().replace(" ", "")
    return text or None


def validar_tipo_sangre(value: Optional[str]) -> Optional[str]:
    """Normaliza y valida estrictamente el tipo de sangre."""
    text = normalizar_tipo_sangre(value)
    if text is not None and text not in TIPOS_SANGRE:
        raise ValueError(f"Tipo de sangre inválido. Valores permitidos: {', '.join(TIPOS_SANGRE)}.")
    return text


class UserBase(BaseModel):
    """
    Información base de un usuario.

    Contiene los campos comunes utilizados
    para crear y consultar usuarios.
    """

    username: str = Field(
        ..., 
        min_length=4, 
        max_length=50, 
        description="Nombre de usuario."
    )
    
    email: EmailStr = Field(
        ..., 
        description="Correo electrónico del usuario.")
    
    nombres: Optional[str] = Field(
        None, 
        max_length=100, description="Nombres del usuario."
    )
    
    apellidos: Optional[str] = Field(
        None,
        max_length=100,
        description="Apellidos del usuario."
    )
    
    tipo_documento: Optional[str] = Field(
        None,
        max_length=20, 
        description="Tipo de documento del usuario."
    )
    
    numero_documento: Optional[str] = Field(
        None, 
        max_length=50, 
        description="Número de documento del usuario."
    )

    tipo_sangre: Optional[str] = Field(
        None,
        max_length=3,
        description="Tipo de sangre del usuario (O+, O-, A+, A-, B+, B-, AB+, AB-)."
    )

    @field_validator("tipo_sangre")
    @classmethod
    def _validar_tipo_sangre(cls, v: Optional[str]) -> Optional[str]:
        return validar_tipo_sangre(v)
    
    # No permite recibir campos que no existan en el esquema.
    model_config = ConfigDict(extra="forbid")


class UserCreate(UserBase):
    """
    Modelo utilizado para registrar un nuevo usuario.
    """

    password: str = Field(
        ..., 
        min_length=6,
        max_length=100, 
        description="Contraseña del usuario."
    )
    
    role_id: int = Field(
        ..., 
        gt=0,
        description="ID del rol asignado al usuario.")


class UserUpdate(BaseModel):
    """
    Modelo utilizado para actualizar un usuario.

    Todos los campos son opcionales para permitir
    actualizaciones parciales.
    """

    email: Optional[EmailStr] = Field(
        None, 
        description="Correo electrónico del usuario."
    )
    
    password: Optional[str] = Field(
        None,
        min_length=6,
        max_length=100,
        description="Contraseña del usuario."
    )
    
    nombres: Optional[str] = Field(
        None,
        max_length=100,
        description="Nombres del usuario."
    )
    
    apellidos: Optional[str] = Field(
        None,
        max_length=100,
        description="Apellidos del usuario."
    )
    
    tipo_documento: Optional[str] = Field(
        None,
        max_length=20,
        description="Tipo de documento del usuario."
    )
    
    numero_documento: Optional[str] = Field(
        None,
        max_length=50,
        description="Número de documento del usuario."
    )
    
    role_id: Optional[int] = Field(
        None,
        gt=0, 
        description="ID del rol asignado al usuario."
    )
    
    is_active: Optional[bool] = Field(
        None,
        description="Indica si el usuario está activo."
    )

    tipo_sangre: Optional[str] = Field(
        None,
        max_length=3,
        description="Tipo de sangre del usuario (O+, O-, A+, A-, B+, B-, AB+, AB-)."
    )

    @field_validator("tipo_sangre")
    @classmethod
    def _validar_tipo_sangre(cls, v: Optional[str]) -> Optional[str]:
        return validar_tipo_sangre(v)

    model_config = ConfigDict(extra="forbid")


class UserResponse(UserBase):
    """
    Modelo utilizado para responder al cliente
    con la información pública del usuario.
    """

    id: int = Field(
        ..., 
        description="ID del usuario."
    )
    
    is_active: bool = Field(
        ..., 
        description="Indica si el usuario está activo."
    )
    
    role_id: int = Field(
        ...,
        gt=0,
        description="ID del rol asignado al usuario."
    )
    
    foto_perfil: Optional[str] = Field(
        None,
        description="URL de la foto de perfil del usuario."
    )

    tipo_sangre: Optional[str] = Field(
        None,
        description="Tipo de sangre del usuario."
    )

    centro_id: Optional[int] = Field(
        None,
        description="ID del centro de formación (derivado del grupo/ficha del usuario)."
    )

    centro_nombre: Optional[str] = Field(
        None,
        description="Nombre del centro de formación (derivado del grupo/ficha del usuario)."
    )

    @field_validator("tipo_sangre")
    @classmethod
    def _normalizar_tipo_sangre(cls, v: Optional[str]) -> Optional[str]:
        # Solo normaliza: no rechaza datos antiguos que vengan de la BD.
        return normalizar_tipo_sangre(v)
    
    # Permite construir el esquema a partir de objetos ORM.
    model_config = ConfigDict(from_attributes=True)
