# ============================
# IMPORTACIONES
# ============================

import os

from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
    Path,
)
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.security import get_admin_user, get_current_user, get_coordinador_user
from modules.users.user_schema import (
    UserCreate,
    UserResponse,
    UserUpdate,
)
from modules.users.user_service import UserService, generar_plantilla_excel
from modules.users.user_constants import (
    ADMIN_ROLE,
    ALLOWED_IMAGE_EXTENSIONS,
    MAX_IMAGE_SIZE,
)

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
    estado: Annotated[str, Query(description="activos | suspendidos | todos")] = "activos",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    """
    Obtiene la lista de usuarios filtrada por estado.

    El estado por defecto ("activos") conserva el comportamiento anterior.
    """
    if estado not in ("activos", "suspendidos", "todos"):
        raise HTTPException(status_code=400, detail="Estado inválido. Use: activos, suspendidos o todos.")
    service = UserService(db)
    return await service.get_all_users(estado)


@router.get(
    "/search", response_model=list[UserResponse], status_code=status.HTTP_200_OK
)
async def search_users(
    q: Annotated[str, Query(description="Texto utilizado para buscar usuarios.")],
    estado: Annotated[str, Query(description="activos | suspendidos | todos")] = "activos",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    """
    Busca usuarios por nombre, correo o documento respetando el estado.
    """
    if estado not in ("activos", "suspendidos", "todos"):
        raise HTTPException(status_code=400, detail="Estado inválido. Use: activos, suspendidos o todos.")
    service = UserService(db)
    return await service.search_users(q, estado)


# ============================
# IMPORTACIÓN MASIVA DESDE EXCEL
# (antes de /{user_id} para evitar colisión de ruta)
# ============================
@router.get("/import-template", status_code=status.HTTP_200_OK)
async def download_import_template(
    ficha: Annotated[str | None, Query(description="Número de ficha para prellenar la plantilla.")] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    """
    Descarga la plantilla .xlsx para la importación masiva de aprendices.

    Sin `ficha`: columnas oficiales con la columna `ficha` para diligenciar
    (importación libre desde Usuarios).
    Con `ficha=<numero>`: valida que la ficha exista y genera
    plantilla_aprendices_ficha_<numero>.xlsx con la columna ficha prellenada.
    """
    if ficha is not None:
        from sqlalchemy import text as _text
        existe = await db.execute(_text("SELECT 1 FROM fichas WHERE number = :n;"), {"n": str(ficha)})
        if not existe.first():
            raise HTTPException(status_code=404, detail=f"La ficha {ficha} no existe.")
        buffer = generar_plantilla_excel(str(ficha))
        filename = f"plantilla_aprendices_ficha_{ficha}.xlsx"
    else:
        buffer = generar_plantilla_excel()
        filename = "plantilla_aprendices.xlsx"
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/bulk-status", status_code=status.HTTP_200_OK)
async def bulk_status(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user),
):
    """
    Suspende o reactiva varios usuarios en una sola operación.

    Body esperado: {"user_ids": [1,2,3], "action": "suspender" | "reactivar"}
    """
    user_ids = payload.get("user_ids")
    action = payload.get("action")
    if not isinstance(user_ids, list) or not all(isinstance(x, int) for x in user_ids):
        raise HTTPException(status_code=400, detail="user_ids debe ser una lista de enteros.")
    service = UserService(db)
    return await service.bulk_status(user_ids, action, current_user.get("id"))


@router.post("/import-excel", status_code=status.HTTP_200_OK)
async def import_users_excel(
    file: UploadFile = File(..., description="Archivo .xlsx con columnas Documento, Correo, Nombres..."),
    grupo_id: Annotated[int | None, Form(description="ID del grupo (ficha) destino. Opcional.")] = None,
    ficha: Annotated[str | None, Form(description="Número de ficha esperada. Opcional; cuando se envía, las filas del Excel deben coincidir con ella.")] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_coordinador_user),
):
    """
    Carga masiva de usuarios desde .xlsx (máx 5 MB).

    Acepta el archivo original con alias en español:
    Documento, Correo, Nombres, Apellidos, Tipo, Usuario, Clave, Rol.

    Sin grupo_id: crea usuarios (cualquier rol según columna Rol, defecto Aprendiz).
    Con grupo_id: además matricula en el grupo a los Aprendiz (nuevos y
    existentes por documento, con carnet automático) y agrega al resumen
    creados, existentes, asignados y ya_en_grupo.
    """
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se acepta archivo Excel .xlsx")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archivo muy grande (máx 5 MB).")
    if grupo_id is not None:
        # Validar el grupo ANTES de crear usuarios para no dejar
        # cuentas huérfanas si el grupo no existe.
        from sqlalchemy import text as _text
        existe = await db.execute(
            _text("SELECT 1 FROM fichas WHERE id = :id;"), {"id": grupo_id}
        )
        if not existe.first():
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")
    expected_ficha = None
    if ficha is not None:
        from sqlalchemy import text as _text2
        r = await db.execute(
            _text2("SELECT f.number, f.id FROM fichas f WHERE f.number = :n;"), {"n": ficha}
        )
        row = r.mappings().first()
        if row is None:
            raise HTTPException(status_code=404, detail=f"La ficha {ficha} no existe.")
        expected_ficha = str(row["number"])
        if grupo_id is not None:
            gid = await db.execute(_text2("SELECT number FROM fichas WHERE id = :id;"), {"id": grupo_id})
            grow = gid.mappings().first()
            if grow and str(grow["number"]) != expected_ficha:
                raise HTTPException(status_code=400, detail=f"La ficha del parámetro ({ficha}) no coincide con el grupo seleccionado ({grow['number']}).")
    service = UserService(db)
    resultado = await service.import_users_excel(
        contents, forzar_rol_aprendiz=grupo_id is not None, expected_ficha=expected_ficha
    )
    if grupo_id is not None:
        extra = await service.asignar_importados_a_grupo(grupo_id, resultado.get("detalle", []))
        resultado.update(extra)
    else:
        # Si el Excel trae columna ficha/numero_ficha, matricular por número de ficha.
        usa_ficha = any((d.get("ficha") or d.get("ficha_id")) for d in resultado.get("detalle", []))
        if usa_ficha:
            extra = await service.asignar_importados_a_fichas(resultado.get("detalle", []))
            resultado.update(extra)
    return resultado


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
    if current_user["role_name"] != ADMIN_ROLE and current_user["id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permiso denegado. No tienes autorización para consultar este usuario.",
        )
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
    if current_user["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permiso denegado. No puedes desactivar tu propia cuenta.",
        )
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
    current_user: dict = Depends(get_current_user),
):
    """
    Carga la fotografía de perfil de un usuario.

    Permite que:
    - El coordinador suba la foto de cualquier usuario.
    - Un usuario suba únicamente su propia foto (auto-gestión del perfil).

    Args:
        user_id (int): Identificador del usuario.
        file (UploadFile): Imagen enviada por el cliente.

    Returns:
        dict: Usuario con la nueva fotografía.

    Raises:
        HTTPException: Si no tiene permiso o el formato no es válido.
    """

    if current_user["role_name"] != ADMIN_ROLE and current_user["id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes subir tu propia foto de perfil.",
        )

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


@router.get("{user_id}/foto", status_code=status.HTTP_200_OK)
async def get_foto(
    user_id: Annotated[int, Path(description="ID del usuario.")],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Obtiene la fotografía de perfil de un usuario.
    Permite que:
    - El coordinador vea la foto de cualquier usuario.
    - Un usuario vea únicamente su propia foto.
    """
    from fastapi.responses import FileResponse
    from pathlib import Path
    # Verificar permisos
    if current_user["role_name"] != ADMIN_ROLE and current_user["id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para ver esta fotografía.",
        )
    # Buscar el archivo
    upload_dir = Path(settings.UPLOAD_DIR)
    pattern = f"user_{user_id}.*"
    foto_files = list(upload_dir.glob(pattern))
    if not foto_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada."
        )
    foto_file = foto_files[0]
    return FileResponse(path=foto_file, media_type="image/*")

@router.delete("{user_id}/foto", status_code=status.HTTP_200_OK)
async def delete_foto(
    user_id: Annotated[int, Path(description="ID del usuario.")],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Elimina la fotografía de perfil de un usuario.
    Solo el coordinador o el propio usuario pueden eliminar.
    """
    if current_user["role_name"] != ADMIN_ROLE and current_user["id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para eliminar esta fotografía.",
        )
    # Buscar y eliminar el archivo
    upload_dir = Path(settings.UPLOAD_DIR)
    pattern = f"user_{user_id}.*"
    foto_files = list(upload_dir.glob(pattern))
    for f in foto_files:
        f.unlink(missing_ok=True)
    # Limpiar referencia en la base de datos
    service = UserService(db)
    return await service.update_foto(user_id, None)
