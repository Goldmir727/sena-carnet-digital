# ============================
# IMPORTACIONES
# ============================

import os

from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
    Path,
)
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.security import get_admin_user, get_current_user
from modules.users.user_schema import UserCreate, UserResponse, UserUpdate
from modules.users.user_service import UserService
from modules.users.user_constants import ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_SIZE

# ============================
# RUTAS DE USUARIOS
# Expone los endpoints para
# gestionar usuarios.
# ============================

router = APIRouter(
    prefix="/users",
    tags=["Usuarios"],
)


# ============================
# CONSULTAS
# ============================
@router.get("/", response_model=list[UserResponse], status_code=status.HTTP_200_OK)
async def read_users(
    db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_admin_user)
):
    """
    Obtiene la lista de todos los usuarios.

    Requiere permisos de administrador.

    Returns:
        list[UserResponse]: Lista de usuarios registrados.
    """
    service = UserService(db)
    return await service.get_all_users()


@router.get(
    "/search", response_model=list[UserResponse], status_code=status.HTTP_200_OK
)
async def search_users(
    q: Annotated[str, Query(description="Texto utilizado para buscar usuarios.")],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    """
    Busca usuarios por nombre, correo o documento.

    Args:
        q (str): Texto de búsqueda.

    Returns:
        list[UserResponse]: Usuarios encontrados.
    """
    service = UserService(db)
    return await service.search_users(q)


# ============================
# CARGA MASIVA EXCEL (antes de /{user_id} para evitar colisión de ruta)
# ============================
@router.post("/import-excel", status_code=status.HTTP_200_OK)
async def import_users_excel(
    file: UploadFile = File(..., description="Archivo .xlsx con columnas Documento, Correo, Nombres..."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    """
    Carga masiva de usuarios desde .xlsx (máx 5 MB).

    Acepta el archivo original del profe con alias en español:
    Documento, Correo, Nombres, Apellidos, Tipo, Usuario, Clave, Rol.
    """
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se acepta archivo Excel .xlsx")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archivo muy grande (máx 5 MB).")
    service = UserService(db)
    return await service.import_users_excel(contents)


@router.get("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def read_user(
    user_id: Annotated[int, Path(description="ID del usuario.")],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Obtiene la información de un usuario.

    Args:
        user_id (int): Identificador del usuario.

    Returns:
        UserResponse: Datos del usuario.
    """
    service = UserService(db)
    return await service.get_user_by_id(user_id)


# ============================
# REGISTRO
# ============================
@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def add_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    """
    Registra un nuevo usuario.

    Solo un administrador puede crear usuarios.

    Args:
        user_in (UserCreate): Datos del usuario.

    Returns:
        UserResponse: Usuario creado.
    """
    service = UserService(db)
    return await service.create_user(user_in)


# ============================
# ACTUALIZACIÓN
# ============================
@router.put("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def update_existing_user(
    user_id: Annotated[int, Path(description="ID del usuario.")],
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Actualiza la información de un usuario.

    Permite que:
    - El administrador modifique cualquier usuario.
    - Un usuario modifique únicamente su propia información.

    Args:
        user_id (int): Usuario a modificar.
        user_data (UserUpdate): Datos nuevos.

    Returns:
        UserResponse: Usuario actualizado.
    """
    service = UserService(db)
    return await service.update_user(user_id, user_data, current_user)


# ============================
# ELIMINACIÓN LÓGICA
# ============================
@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def deactivate_user(
    user_id: Annotated[int, Path(description="ID del usuario.")],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    """
    Realiza la eliminación lógica de un usuario.

    Args:
        user_id (int): Identificador del usuario.

    Returns:
        dict: Usuario desactivado.
    """
    service = UserService(db)
    return await service.soft_delete_user(user_id)


# ============================
# FOTO DE PERFIL
# ============================
@router.post("/{user_id}/foto", status_code=status.HTTP_200_OK)
async def upload_foto(
    user_id: Annotated[int, Path(description="ID del usuario.")],
    file: UploadFile = File(..., description="Imagen de perfil del usuario."),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    """
    Carga la fotografía de perfil de un usuario.

    Args:
        user_id (int): Identificador del usuario.
        file (UploadFile): Imagen enviada por el cliente.

    Returns:
        dict: Usuario con la nueva fotografía.

    Raises:
        HTTPException: Si el formato de la imagen no es válido.
    """

    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagen no permitido.",
        )

    contents = await file.read()

    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen supera el tamaño máximo permitido (5 MB).",
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    filename = f"user_{user_id}{ext}"
    # Ruta relativa con forward slashes: sirve como URL (/uploads/...) y como ruta en disco
    upload_dir_url = settings.UPLOAD_DIR.replace("\\", "/")
    filepath = f"{upload_dir_url}/{filename}"

    with open(filepath, "wb") as f:
        f.write(contents)
    # Validar y almacenar la imagen en el servidor
    service = UserService(db)
    # Registrar la ruta de la imagen en la base de datos
    return await service.update_foto(user_id, filepath)
