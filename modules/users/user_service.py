from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.users.user_schema import UserCreate, UserUpdate
from core.security import hash_password
from core.logger import logger


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_users(self) -> list[dict]:
        logger.info("Consultando todos los usuarios.")
        query = text("""
            SELECT id, username, email, nombres, apellidos, tipo_documento,
                   numero_documento, foto_perfil, is_active, role_id
            FROM users ORDER BY id ASC;
        """)
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def get_user_by_id(self, user_id: int) -> dict:
        logger.info(f"Consultando usuario ID: {user_id}")
        query = text("""
            SELECT id, username, email, nombres, apellidos, tipo_documento,
                   numero_documento, foto_perfil, is_active, role_id
            FROM users WHERE id = :id;
        """)
        result = await self.db.execute(query, {"id": user_id})
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
        return dict(row)

    async def search_users(self, term: str) -> list[dict]:
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

    async def create_user(self, user_data: UserCreate) -> dict:
        logger.info(f"Registrando usuario {user_data.username}")

        dup = await self.db.execute(
            text("SELECT id FROM users WHERE username = :username OR email = :email;"),
            {"username": user_data.username, "email": user_data.email}
        )
        if dup.first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El usuario o correo ya existen.")

        if user_data.numero_documento:
            dup_doc = await self.db.execute(
                text("SELECT id FROM users WHERE numero_documento = :doc;"),
                {"doc": user_data.numero_documento}
            )
            if dup_doc.first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El número de documento ya está registrado.")

        role_check = await self.db.execute(
            text("SELECT id FROM roles WHERE id = :role_id;"),
            {"role_id": user_data.role_id}
        )
        if not role_check.first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El role_id proveído no existe.")

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
            result = await self.db.execute(query, {
                "username": user_data.username,
                "email": user_data.email,
                "hashed_password": hashed_pwd,
                "nombres": user_data.nombres,
                "apellidos": user_data.apellidos,
                "tipo_documento": user_data.tipo_documento,
                "numero_documento": user_data.numero_documento,
                "role_id": user_data.role_id
            })
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al guardar usuario: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al crear el usuario.")

    async def update_user(self, target_user_id: int, user_update: UserUpdate, current_user: dict) -> dict:
        logger.info(f"Usuario '{current_user['username']}' intenta modificar el usuario ID: {target_user_id}")

        if current_user["role_name"] != "Administrador" and current_user["id"] != target_user_id:
            logger.warning(f"Acceso denegado para '{current_user['username']}'")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permiso denegado. No tienes autorización para modificar datos de otros usuarios."
            )

        if current_user["role_name"] != "Administrador":
            if user_update.role_id is not None or user_update.is_active is not None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permiso denegado. Solo un Administrador puede alterar roles o estados."
                )

        check = await self.db.execute(text("SELECT id FROM users WHERE id = :id;"), {"id": target_user_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El usuario a modificar no existe.")

        update_fields = []
        params = {"id": target_user_id}

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
                    dup = await self.db.execute(
                        text("SELECT id FROM users WHERE email = :email AND id != :id;"),
                        {"email": value, "id": target_user_id}
                    )
                    if dup.first():
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El correo ya está registrado.")
                if attr == "numero_documento":
                    dup = await self.db.execute(
                        text("SELECT id FROM users WHERE numero_documento = :doc AND id != :id;"),
                        {"doc": value, "id": target_user_id}
                    )
                    if dup.first():
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El documento ya está registrado.")
                update_fields.append(f"{col} = :{col}")
                params[col] = value

        if user_update.password is not None:
            update_fields.append("hashed_password = :hashed_password")
            params["hashed_password"] = hash_password(user_update.password)

        if user_update.role_id is not None:
            role_exist = await self.db.execute(text("SELECT id FROM roles WHERE id = :r_id;"), {"r_id": user_update.role_id})
            if not role_exist.first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El rol asignado no existe.")
            update_fields.append("role_id = :role_id")
            params["role_id"] = user_update.role_id

        if user_update.is_active is not None:
            update_fields.append("is_active = :is_active")
            params["is_active"] = user_update.is_active

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

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
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")

    async def soft_delete_user(self, user_id: int) -> dict:
        logger.info(f"Desactivando lógicamente usuario ID: {user_id}")
        result = await self.db.execute(
            text("UPDATE users SET is_active = FALSE WHERE id = :id RETURNING id, username, email, is_active;"),
            {"id": user_id}
        )
        await self.db.commit()
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
        return dict(row)

    async def update_foto(self, user_id: int, foto_path: str) -> dict:
        result = await self.db.execute(
            text("UPDATE users SET foto_perfil = :foto WHERE id = :id RETURNING id, username, foto_perfil;"),
            {"foto": foto_path, "id": user_id}
        )
        await self.db.commit()
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
        return dict(row)
