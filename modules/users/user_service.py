# ============================
# IMPORTACIONES
# ============================
from datetime import date, timedelta
from io import BytesIO
import uuid as uuid_lib
from fastapi import HTTPException, status
from openpyxl import Workbook, load_workbook
from openpyxl.worksheet.datavalidation import DataValidation
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.users.user_schema import (
    UserCreate,
    UserUpdate,
    TIPOS_SANGRE,
    validar_tipo_sangre,
)
from modules.users.user_constants import ADMIN_ROLE
from core.security import hash_password
from core.config import settings
from core.logger import logger
from core.redis_client import cache_delete
from services.qr_service import generate_qr_token


def _centro_cols(alias: str) -> str:
    """
    Fragmento SQL que resuelve el centro de formación del usuario
    a través de su matrícula activa más reciente:
    matriculas -> fichas -> centros_formacion.

    No existe columna de centro en users, por eso se deriva.
    """
    return f"""(SELECT cf.nombre FROM matriculas m
                JOIN fichas f ON f.id = m.ficha_id
                LEFT JOIN centros_formacion cf ON cf.id = f.centro_id
                WHERE m.user_id = {alias}.id AND m.status = 'activa'
                ORDER BY m.id DESC LIMIT 1) AS centro_nombre,
            (SELECT cf.id FROM matriculas m
                JOIN fichas f ON f.id = m.ficha_id
                LEFT JOIN centros_formacion cf ON cf.id = f.centro_id
                WHERE m.user_id = {alias}.id AND m.status = 'activa'
                ORDER BY m.id DESC LIMIT 1) AS centro_id"""


async def _invalidate_user_caches() -> None:
    await cache_delete("reports:*")

# ============================
# SERVICIO DE USUARIOS
# Contiene toda la lógica de negocio
# relacionada con la gestión de usuarios.
# ============================


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        """
        Inicializa el servicio de usuarios.

        Args:
            db (AsyncSession): Sesión asíncrona de la base de datos.
        """
        self.db = db

    # ============================
    # MÉTODOS PRIVADOS DE VALIDACIÓN
    # Se utilizan internamente para
    # verificar la existencia de registros.
    # ============================

    async def _username_exists(self, username: str) -> bool:
        """
        Verifica si un nombre de usuario ya existe en la base de datos.

        Args:
            username (str): Nombre de usuario a consultar.

        Returns:
            bool: True si existe, False en caso contrario.
        """
        result = await self.db.execute(
            text("SELECT 1 FROM users WHERE email = :username OR document = :username"),
            {"username": username},
        )
        return result.first() is not None

    async def _user_exists(self, user_id: int) -> bool:
        """
        Verifica si un usuario ya existe en la base de datos.

        Args:
            user_id (int): ID del usuario a consultar.

        Returns:
            bool: True si existe, False en caso contrario.
        """

        result = await self.db.execute(
            text("SELECT 1 FROM users WHERE id = :id"), {"id": user_id}
        )
        return result.first() is not None

    async def _email_exists(self, email: str, exclude_id: int | None = None) -> bool:
        """
        Verifica si un correo electrónico ya existe en la base de datos.

        Args:
            email (str): Correo electrónico a consultar.
            exclude_id (int | None): ID del usuario a excluir de la verificación.

        Returns:
            bool: True si existe, False en caso contrario.
        """

        query = """
            SELECT 1
            FROM users
            WHERE email = :email
        """

        params = {"email": email}

        if exclude_id is not None:
            query += " AND id != :id"
            params["id"] = exclude_id

        result = await self.db.execute(text(query), params)
        return result.first() is not None

    async def _document_exists(
        self, document: str, exclude_id: int | None = None
    ) -> bool:
        """
        Verifica si un número de documento ya existe en la base de datos.

        Args:
            document (str): Número de documento a consultar.
            exclude_id (int | None): ID del usuario a excluir de la verificación.

        Returns:
            bool: True si existe, False en caso contrario.
        """
        query = """
            SELECT 1
            FROM users
            WHERE document = :doc
        """

        params = {"doc": document}

        if exclude_id is not None:
            query += " AND id != :id"
            params["id"] = exclude_id

        result = await self.db.execute(text(query), params)
        return result.first() is not None

    async def _role_exists(self, role_id: int) -> bool:
        """
        Verifica si un rol ya existe en la base de datos.

        Args:
            role_id (int): ID del rol a consultar.

        Returns:
            bool: True si existe, False en caso contrario.
        """

        result = await self.db.execute(
            text("SELECT 1 FROM roles WHERE id = :id"), {"id": role_id}
        )
        return result.first() is not None

    # ============================
    # CONSULTAS
    # Obtención de información de usuarios.
    # ============================

    async def get_all_users(self) -> list[dict]:
        """
        Obtiene todos los usuarios registrados.

        Returns:
            list[dict]: Lista de usuarios.
        """

        logger.info("Consultando todos los usuarios.")
        centro = _centro_cols("users")
        query = text(f"""
                 SELECT id, email AS username, email, name AS nombres, last_name AS apellidos,
                     document_type AS tipo_documento, document AS numero_documento,
                     blood_type AS tipo_sangre,
                     photo_profile AS foto_perfil,
                     (user_status IN ('ACTIVE', 'ACTIVO')) AS is_active, role_id,
                     {centro}
            FROM users WHERE user_status IN ('ACTIVE', 'ACTIVO') ORDER BY id ASC;
        """)
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def get_user_by_id(self, user_id: int) -> dict:
        """
        Obtiene un usuario por su identificador.

        Args:
            user_id (int): ID del usuario.

        Returns:
            dict: Información del usuario.

        Raises:
            HTTPException: Si el usuario no existe.
        """
        logger.info(f"Consultando usuario ID: {user_id}")
        centro = _centro_cols("users")
        query = text(f"""
                 SELECT id, email AS username, email, name AS nombres, last_name AS apellidos,
                     document_type AS tipo_documento, document AS numero_documento,
                     blood_type AS tipo_sangre,
                     photo_profile AS foto_perfil,
                     (user_status IN ('ACTIVE', 'ACTIVO')) AS is_active, role_id,
                     {centro}
            FROM users WHERE id = :id;
        """)
        result = await self.db.execute(query, {"id": user_id})
        row = result.mappings().first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado."
            )
        return dict(row)

    async def search_users(self, term: str) -> list[dict]:
        """
        Busca usuarios por coincidencia parcial.

        La búsqueda se realiza sobre:
        - Nombre de usuario
        - Correo electrónico
        - Número de documento
        - Nombres
        - Apellidos

        Args:
            term (str): Texto a buscar.

        Returns:
            list[dict]: Lista de usuarios encontrados.
        """
        logger.info(f"Buscando usuarios con: {term}")
        centro = _centro_cols("users")
        query = text(f"""
                 SELECT id, email AS username, email, name AS nombres, last_name AS apellidos,
                     document_type AS tipo_documento, document AS numero_documento,
                     blood_type AS tipo_sangre,
                     (user_status IN ('ACTIVE', 'ACTIVO')) AS is_active, role_id,
                     {centro}
            FROM users
                WHERE user_status IN ('ACTIVE', 'ACTIVO') AND (email ILIKE :term OR document ILIKE :term
                    OR name ILIKE :term OR last_name ILIKE :term
                    OR document_type ILIKE :term)
            ORDER BY id ASC;
        """)
        result = await self.db.execute(query, {"term": f"%{term}%"})
        return [dict(row) for row in result.mappings().all()]

    # ============================
    # REGISTRO DE USUARIOS
    # ============================
    async def create_user(self, user_data: UserCreate) -> dict:
        """
        Registra un nuevo usuario.

        Realiza las validaciones de:
        - Nombre de usuario
        - Correo electrónico
        - Documento
        - Rol

        Posteriormente cifra la contraseña y guarda el usuario.

        Args:
            user_data (UserCreate): Datos del usuario.

        Returns:
            dict: Usuario creado.
        """
        logger.info(f"Registrando usuario {user_data.username}")

        if await self._username_exists(user_data.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de usuario ya existe.",
            )

        if await self._email_exists(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo ya está registrado.",
            )

        if user_data.numero_documento:
            if await self._document_exists(user_data.numero_documento):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El número de documento ya está registrado.",
                )
        else:
            # Sin documento, se usa el username como documento: validar unicidad igual
            if await self._document_exists(user_data.username):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El nombre de usuario ya está registrado.",
                )

        if not await self._role_exists(user_data.role_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="El rol no existe."
            )

        # Cifrar la contraseña antes de almacenarla.
        hashed_pwd = hash_password(user_data.password)

        query = text("""
            INSERT INTO users (name, last_name, document_type, document, email,
                       blood_type, password_hash, user_status, role_id, registration_date)
            VALUES (:name, :last_name, :document_type, :document, :email,
                :blood_type, :password_hash, 'ACTIVE', :role_id, NOW())
            RETURNING id, email AS username, email, name AS nombres, last_name AS apellidos,
                  document_type AS tipo_documento, document AS numero_documento,
                  blood_type AS tipo_sangre,
                      TRUE AS is_active, role_id;
        """)
        try:
            result = await self.db.execute(
                query,
                {
                    "name": user_data.nombres or user_data.username,
                    "last_name": user_data.apellidos or "-",
                    "document_type": user_data.tipo_documento or "CC",
                    "document": user_data.numero_documento or user_data.username,
                    "email": user_data.email,
                    "blood_type": user_data.tipo_sangre,
                    "password_hash": hashed_pwd,
                    "role_id": user_data.role_id,
                },
            )
            await self.db.commit(); await _invalidate_user_caches()
            created = dict(result.mappings().first())
            # RF-06: si el rol es Aprendiz, generar carnet automáticamente
            try:
                role_res = await self.db.execute(
                    text("SELECT name FROM roles WHERE id = :rid;"),
                    {"rid": user_data.role_id},
                )
                role_row = role_res.mappings().first()
                if role_row and role_row["name"] == "Aprendiz":
                    issue = date.today()
                    exp = issue + timedelta(days=settings.CARNET_DURATION_DAYS)
                    await self.db.execute(
                        text(
                            "INSERT INTO carnets (user_id, qr_code, issue_date, expiration_date) "
                            "VALUES (:u, :q, :i, :e);"
                        ),
                        {"u": created["id"], "q": generate_qr_token(str(uuid_lib.uuid4())), "i": issue, "e": exp},
                    )
                    await self.db.commit(); await _invalidate_user_caches()
            except Exception:
                await self.db.rollback()
                logger.warning("No se pudo auto-generar carnet de Aprendiz (¿tabla sin migrar?).")
            return created
        except Exception:
            await self.db.rollback()
            logger.exception("Error al guardar usuario.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el usuario.",
            )

    # ============================
    # ACTUALIZACIÓN Y PERMISOS
    # ============================
    async def update_user(
        self, target_user_id: int, user_update: UserUpdate, current_user: dict
    ) -> dict:
        """
        Actualiza la información de un usuario.

        Permite que:
        - Un administrador modifique cualquier usuario.
        - Un usuario modifique únicamente su propia información.

        Args:
            target_user_id (int): Usuario a modificar.
            user_update (UserUpdate): Datos nuevos.
            current_user (dict): Usuario autenticado.

        Returns:
            dict: Usuario actualizado.

        Raises:
            HTTPException: Si no tiene permisos o el usuario no existe.
        """
        logger.info(
            f"Usuario '{current_user['username']}' intenta modificar el usuario ID: {target_user_id}"
        )

        if (
            current_user["role_name"] != ADMIN_ROLE
            and current_user["id"] != target_user_id
        ):
            logger.warning(f"Acceso denegado para '{current_user['username']}'")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permiso denegado. No tienes autorización para modificar datos de otros usuarios.",
            )

        if current_user["role_name"] != ADMIN_ROLE:
            if user_update.role_id is not None or user_update.is_active is not None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permiso denegado. Solo un Coordinador puede alterar roles o estados.",
                )

        if (
            current_user["id"] == target_user_id
            and user_update.role_id is not None
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permiso denegado. No puedes cambiar tu propio rol.",
            )

        if not await self._user_exists(target_user_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario a modificar no existe.",
            )

        update_fields = []
        params = {"id": target_user_id}

        # Campos permitidos para actualización.
        field_map = {
            "email": "email",
            "nombres": "name",
            "apellidos": "last_name",
            "tipo_documento": "document_type",
            "numero_documento": "document",
            "tipo_sangre": "blood_type",
        }

        for attr, col in field_map.items():
            value = getattr(user_update, attr, None)
            if value is not None:
                if attr == "email":
                    if await self._email_exists(value, target_user_id):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="El correo ya está registrado.",
                        )
                        
                if attr == "numero_documento":
                    if await self._document_exists(value, target_user_id):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="El documento ya está registrado.",
                        )
                update_fields.append(f"{col} = :{col}")
                params[col] = value

        if user_update.password is not None:
            update_fields.append("password_hash = :password_hash")
            
           # Si se recibe una nueva contraseña, se almacena cifrada.
            params["password_hash"] = hash_password(user_update.password)

        if user_update.role_id is not None:
            if not await self._role_exists(user_update.role_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El rol asignado no existe.",
                )
            update_fields.append("role_id = :role_id")
            params["role_id"] = user_update.role_id

        if user_update.is_active is not None:
            update_fields.append("user_status = :user_status")
            params["user_status"] = "ACTIVE" if user_update.is_active else "INACTIVE"

        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se enviaron datos para actualizar.",
            )
        # Construcción dinámica de la consulta UPDATE únicamente con
        # los campos enviados por el cliente.
        query_str = f"""
            UPDATE users
            SET {', '.join(update_fields)}
            WHERE id = :id;
        """

        try:
            await self.db.execute(text(query_str), params)
            await self.db.commit(); await _invalidate_user_caches()
            # Releer con la forma completa (incluye tipo_sangre y centro).
            return await self.get_user_by_id(target_user_id)
        except HTTPException:
            raise
        except Exception:
            await self.db.rollback()
            logger.exception("Error al actualizar usuario.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al procesar los datos.",
            )

    # ============================
    # ELIMINACIÓN LÓGICA
    # ============================

    async def soft_delete_user(self, user_id: int) -> dict:
        """
                Desactiva un usuario sin eliminarlo de la base de datos.

                Args:
                    user_id (int): Identificador del usuario.

                Returns:
            dict: Información básica del usuario desactivado.

        Raises:
            HTTPException: Si el usuario no existe o ya estaba desactivado.
        """
        logger.info(f"Desactivando lógicamente usuario ID: {user_id}")
        result = await self.db.execute(
            text(
                "UPDATE users SET user_status = 'INACTIVE' WHERE id = :id AND user_status IN ('ACTIVE', 'ACTIVO') RETURNING id, email AS username, email, FALSE AS is_active;"
            ),
            {"id": user_id},
        )
        await self.db.commit(); await _invalidate_user_caches()
        row = result.mappings().first()
        if not row:
            logger.warning(f"Intento de desactivar usuario no encontrado: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado."
            )
        return dict(row)

    # ============================
    # GESTIÓN DE FOTO DE PERFIL
    # ============================

    async def update_foto(self, user_id: int, foto_path: str) -> dict:
        """
                Actualiza la fotografía de perfil de un usuario.

                Args:
                    user_id (int): Usuario al que pertenece la fotografía.
                    foto_path (str): Ruta donde fue almacenada.

                Returns:
            dict: Usuario con la fotografía actualizada.

        Raises:
            HTTPException:
                Si el usuario no existe o ocurre un error durante la actualización.
        """

        if not await self._user_exists(user_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado."
            )

        try:
            result = await self.db.execute(
                text(
                    "UPDATE users SET photo_profile = :foto WHERE id = :id "
                    "RETURNING id, email AS username, photo_profile AS foto_perfil;"
                ),
                {"foto": foto_path, "id": user_id},
            )

            await self.db.commit(); await _invalidate_user_caches()
            return dict(result.mappings().first())

        except Exception:
            await self.db.rollback()
            logger.exception("Error al actualizar la foto del usuario.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar la foto.",
            )

    # ============================
    # CARGA MASIVA EXCEL
    # Acepta el .xlsx original del profe con alias en español.
    # Con grupo_id (endpoint), además matricula Aprendices en el grupo.
    # ============================

    async def import_users_excel(self, contenido: bytes) -> dict:
        """
        Importa usuarios desde un .xlsx fila por fila.

        Columnas aceptadas (insensible a mayúsculas/tildes/espacios):
        - Documento: documento, numero_documento, numero, document, cc
        - Correo: correo, email, correo_electronico
        - Nombres: nombres, nombre, name
        - Apellidos: apellidos, apellido, last_name
        - Tipo doc: tipo_documento, tipo, document_type
        - Usuario: username, usuario
        - Clave: password, contraseña, contrasena (si falta, se usa el documento)
        - Rol: role_id, rol (id numérico o nombre: Aprendiz/Docente/...)
        - Sangre: tipo_sangre, sangre, grupo_sanguineo (opcional: O+, O-, A+, ...)
        """
        import unicodedata
        from io import BytesIO
        from openpyxl import load_workbook

        def norm(h) -> str:
            h = str(h or "").strip().lower()
            h = "".join(c for c in unicodedata.normalize("NFD", h) if unicodedata.category(c) != "Mn")
            return h.replace(" ", "_")

        ALIAS = {
            "documento": {"documento", "numero_documento", "numero", "document", "cc", "dni"},
            "correo": {"correo", "email", "correo_electronico", "e_mail"},
            "nombres": {"nombres", "nombre", "name"},
            "apellidos": {"apellidos", "apellido", "last_name"},
            "tipo_documento": {"tipo_documento", "tipo", "document_type", "tipo_doc"},
            "username": {"username", "usuario", "user"},
            "password": {"password", "contrasena", "clave"},
            "rol": {"role_id", "rol", "role"},
            "tipo_sangre": {"tipo_sangre", "sangre", "grupo_sanguineo"},
        }

        try:
            wb = load_workbook(BytesIO(contenido), read_only=True, data_only=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Archivo .xlsx inválido.")
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows or not any(rows[0]):
            raise HTTPException(status_code=400, detail="Excel vacío o sin encabezados.")

        col: dict[str, int] = {}
        for i, h in enumerate(rows[0]):
            n = norm(h)
            for campo, variantes in ALIAS.items():
                if n in variantes and campo not in col:
                    col[campo] = i
        faltan = [c for c in ("documento", "correo", "nombres") if c not in col]
        if faltan:
            raise HTTPException(
                status_code=400,
                detail=f"Faltan columnas requeridas: {', '.join(faltan)}. "
                       "Se aceptan alias: Documento, Correo, Nombres, Apellidos.",
            )

        roles = await self.db.execute(text("SELECT id, name FROM roles;"))
        rol_por_nombre = {r["name"].strip().lower(): r["id"] for r in roles.mappings().all()}

        procesados = insertados = errores = duplicados = 0
        detalle: list[dict] = []
        for n, r in enumerate(rows[1:], start=2):
            if all(v is None or str(v).strip() == "" for v in r):
                continue
            procesados += 1
            try:
                def val(campo):
                    i = col.get(campo)
                    v = r[i] if i is not None and i < len(r) else None
                    return str(v).strip() if v is not None else ""

                documento, correo = val("documento"), val("correo")
                nombres, apellidos = val("nombres"), val("apellidos") or "-"
                if not documento or not correo or not nombres:
                    raise ValueError("Documento, Correo y Nombres son obligatorios")
                if await self._document_exists(documento) or await self._email_exists(correo):
                    duplicados += 1
                    detalle.append({"fila": n, "estado": "duplicado", "documento": documento})
                    continue

                rol_raw = val("rol")
                if not rol_raw:
                    role_id = rol_por_nombre.get("aprendiz")
                elif rol_raw.isdigit():
                    role_id = int(rol_raw)
                    if not await self._role_exists(role_id):
                        raise ValueError(f"role_id {rol_raw} no existe")
                else:
                    role_id = rol_por_nombre.get(rol_raw.strip().lower())
                    if role_id is None:
                        raise ValueError(f"rol '{rol_raw}' desconocido")

                username = val("username") or correo
                if await self._username_exists(username):
                    raise ValueError(f"usuario '{username}' ya existe")
                password = val("password") or documento

                try:
                    sangre = validar_tipo_sangre(val("tipo_sangre") or None)
                except ValueError as e:
                    raise ValueError(str(e))

                await self.db.execute(
                    text("""
                        INSERT INTO users (name, last_name, document_type, document, email,
                                   blood_type, password_hash, user_status, role_id, registration_date)
                        VALUES (:name, :last_name, :document_type, :document, :email,
                            :blood_type, :password_hash, 'ACTIVE', :role_id, NOW());
                    """),
                    {
                        "name": nombres,
                        "last_name": apellidos,
                        "document_type": val("tipo_documento") or "CC",
                        "document": documento,
                        "email": correo,
                        "blood_type": sangre,
                        "password_hash": hash_password(password),
                        "role_id": role_id,
                    },
                )
                insertados += 1
                detalle.append({"fila": n, "estado": "insertado", "documento": documento})
            except HTTPException:
                raise
            except Exception as e:
                errores += 1
                doc = ""
                try:
                    doc = str(r[col["documento"]] or "").strip()
                except Exception:
                    pass
                detalle.append({"fila": n, "estado": "error", "documento": doc, "mensaje": str(e)})

        await self.db.commit(); await _invalidate_user_caches()
        return {
            "procesados": procesados, "insertados": insertados,
            "errores": errores, "duplicados": duplicados, "detalle": detalle,
        }

    # ============================
    # MATRÍCULA DE IMPORTADOS EN UN GRUPO
    # Se usa cuando POST /users/import-excel recibe grupo_id.
    # ============================

    async def asignar_importados_a_grupo(
        self, grupo_id: int, detalle: list[dict]
    ) -> dict:
        """
        Matricula en el grupo a los Aprendiz del detalle de importación.

        - Usuarios nuevos (insertado): asegura carnet activo y matricula.
        - Usuarios existentes (duplicado por documento): reutiliza solo si
          el rol es Aprendiz; con otro rol se reporta como error de fila.
        - Devuelve conteos compatibles con el resumen del frontend de grupos.
        """
        logger.info(f"Asignando importados al grupo ID: {grupo_id}")

        grupo = await self.db.execute(
            text("SELECT id FROM fichas WHERE id = :id"), {"id": grupo_id}
        )
        if not grupo.first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado."
            )

        rol = await self.db.execute(
            text("SELECT id FROM roles WHERE name = 'Aprendiz' LIMIT 1;")
        )
        rol_row = rol.mappings().first()
        if not rol_row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No existe el rol Aprendiz en el sistema.",
            )
        aprendiz_id = rol_row["id"]

        creados = existentes = asignados = ya_en_grupo = 0
        errores: list[dict] = []

        try:
            for item in detalle or []:
                estado = item.get("estado")
                if estado not in ("insertado", "duplicado"):
                    continue
                fila = item.get("fila")
                documento = item.get("documento") or ""

                user_res = await self.db.execute(
                    text("SELECT id, role_id FROM users WHERE document = :doc;"),
                    {"doc": documento},
                )
                user_row = user_res.mappings().first()
                if user_row is None:
                    errores.append({"fila": fila, "documento": documento or None,
                                    "error": "No se encontró tras importar."})
                    continue
                if user_row["role_id"] != aprendiz_id:
                    rol_check = await self.db.execute(
                        text("SELECT name FROM roles WHERE id = :rid;"),
                        {"rid": user_row["role_id"]},
                    )
                    rol_nombre = (rol_check.mappings().first() or {}).get("name")
                    errores.append({"fila": fila, "documento": documento,
                                    "error": f"Existe con rol {rol_nombre or 'desconocido'}; solo Aprendiz entra al grupo."})
                    continue

                user_id = user_row["id"]
                if estado == "insertado":
                    creados += 1
                    carnet = await self.db.execute(
                        text("SELECT id FROM carnets WHERE user_id = :uid "
                             "AND expiration_date >= CURRENT_DATE LIMIT 1;"),
                        {"uid": user_id},
                    )
                    if not carnet.first():
                        issue = date.today()
                        exp = issue + timedelta(days=settings.CARNET_DURATION_DAYS)
                        await self.db.execute(
                            text("INSERT INTO carnets (user_id, qr_code, issue_date, expiration_date) "
                                 "VALUES (:u, :q, :i, :e);"),
                            {"u": user_id, "q": generate_qr_token(str(uuid_lib.uuid4())),
                             "i": issue, "e": exp},
                        )
                else:
                    existentes += 1

                mat = await self.db.execute(
                    text("SELECT 1 FROM matriculas WHERE ficha_id = :g AND user_id = :u;"),
                    {"g": grupo_id, "u": user_id},
                )
                if mat.first() is not None:
                    ya_en_grupo += 1
                else:
                    await self.db.execute(
                        text("INSERT INTO matriculas (ficha_id, user_id, status) "
                             "VALUES (:g, :u, 'activa');"),
                        {"g": grupo_id, "u": user_id},
                    )
                    asignados += 1

            await self.db.commit()
        except HTTPException:
            raise
        except Exception:
            await self.db.rollback()
            logger.exception("Error al matricular importados; se revirtió la matrícula.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al asignar al grupo. Los usuarios creados se conservan.",
            )

        await _invalidate_user_caches()
        try:
            from modules.grupos.grupo_service import invalidate_grupo_cache
            await invalidate_grupo_cache(grupo_id)
        except Exception:
            pass
        return {
            "creados": creados,
            "existentes": existentes,
            "asignados": asignados,
            "ya_en_grupo": ya_en_grupo,
            "errores": errores,
        }


def generar_plantilla_excel() -> BytesIO:
    """
    Genera la plantilla .xlsx para la importación masiva de estudiantes.

    Solo contiene el encabezado con las columnas esperadas, validaciones
    desplegables y anchos ajustados. Sin filas de ejemplo para evitar
    importaciones accidentales.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Estudiantes"
    headers = [
        "nombres",
        "apellidos",
        "tipo_documento",
        "numero_documento",
        "email",
        "tipo_sangre",
    ]
    ws.append(headers)
    widths = [25, 25, 16, 20, 32, 14]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = w

    dv_doc = DataValidation(
        type="list",
        formula1='"CC,CE,TI,PEP"',
        allow_blank=True,
        showErrorMessage=True,
        errorTitle="Tipo inválido",
        error="Use: CC, CE, TI, PEP",
    )
    ws.add_data_validation(dv_doc)
    dv_doc.add("C2:C1001")

    dv_sangre = DataValidation(
        type="list",
        formula1=f'"{",".join(TIPOS_SANGRE)}"',
        allow_blank=True,
        showErrorMessage=True,
        errorTitle="Tipo inválido",
        error=f"Use: {', '.join(TIPOS_SANGRE)}",
    )
    ws.add_data_validation(dv_sangre)
    dv_sangre.add("F2:F1001")

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
