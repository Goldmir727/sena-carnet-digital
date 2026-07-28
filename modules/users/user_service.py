# ============================
# IMPORTACIONES
# ============================
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.users.user_schema import UserCreate, UserUpdate
from modules.users.user_constants import ADMIN_ROLE
from core.security import hash_password
from core.logger import logger

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
            text("SELECT 1 FROM users WHERE username = :username"),
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
            WHERE numero_documento = :doc
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
        query = text("""
            SELECT id, username, email, nombres, apellidos, tipo_documento,
                   numero_documento, foto_perfil, is_active, role_id
            FROM users ORDER BY id ASC;
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
        query = text("""
            SELECT id, username, email, nombres, apellidos, tipo_documento,
                   numero_documento, foto_perfil, is_active, role_id
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
        query = text("""
            SELECT id, username, email, nombres, apellidos, tipo_documento,
                   numero_documento, is_active, role_id
            FROM users
            WHERE username ILIKE :term OR email ILIKE :term
               OR numero_documento ILIKE :term OR nombres ILIKE :term
               OR apellidos ILIKE :term
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

        if not await self._role_exists(user_data.role_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="El rol no existe."
            )

        # Cifrar la contraseña antes de almacenarla.
        hashed_pwd = hash_password(user_data.password)

        query = text("""
            INSERT INTO users (username, email, hashed_password, nombres, apellidos,
                               tipo_documento, numero_documento, is_active, role_id)
            VALUES (:username, :email, :hashed_password, :nombres, :apellidos,
                    :tipo_documento, :numero_documento, TRUE, :role_id)
            RETURNING id, username, email, nombres, apellidos, tipo_documento,
                      numero_documento, is_active, role_id;
        """)
        try:
            result = await self.db.execute(
                query,
                {
                    "username": user_data.username,
                    "email": user_data.email,
                    "hashed_password": hashed_pwd,
                    "nombres": user_data.nombres,
                    "apellidos": user_data.apellidos,
                    "tipo_documento": user_data.tipo_documento,
                    "numero_documento": user_data.numero_documento,
                    "role_id": user_data.role_id,
                },
            )
            await self.db.commit()
            return dict(result.mappings().first())
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
                    detail="Permiso denegado. Solo un Administrador puede alterar roles o estados.",
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
            "nombres": "nombres",
            "apellidos": "apellidos",
            "tipo_documento": "tipo_documento",
            "numero_documento": "numero_documento",
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
            update_fields.append("hashed_password = :hashed_password")
            
           # Si se recibe una nueva contraseña, se almacena cifrada.
            params["hashed_password"] = hash_password(user_update.password)

        if user_update.role_id is not None:
            if not await self._role_exists(user_update.role_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El rol asignado no existe.",
                )
            update_fields.append("role_id = :role_id")
            params["role_id"] = user_update.role_id

        if user_update.is_active is not None:
            update_fields.append("is_active = :is_active")
            params["is_active"] = user_update.is_active

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
            WHERE id = :id
            RETURNING id, username, email, nombres, apellidos, tipo_documento,
                      numero_documento, foto_perfil, is_active, role_id;
        """

        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
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
                "UPDATE users SET is_active = FALSE WHERE id = :id AND is_active = TRUE RETURNING id, username, email, is_active;"
            ),
            {"id": user_id},
        )
        await self.db.commit()
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
                    "UPDATE users SET foto_perfil = :foto WHERE id = :id "
                    "RETURNING id, username, foto_perfil;"
                ),
                {"foto": foto_path, "id": user_id},
            )

            await self.db.commit()
            return dict(result.mappings().first())

        except Exception:
            await self.db.rollback()
            logger.exception("Error al actualizar la foto del usuario.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar la foto.",
            )
