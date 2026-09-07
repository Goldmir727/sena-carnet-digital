from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.grupos.grupo_schema import GrupoCreate
from core.logger import logger


class GrupoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _grupo_exists(self, grupo_id: int) -> bool:
        result = await self.db.execute(
            text("SELECT 1 FROM grupos WHERE id = :id"), {"id": grupo_id}
        )
        return result.first() is not None

    async def _usuarios_exist(self, user_ids: list[int]) -> bool:
        result = await self.db.execute(
            text("SELECT COUNT(*) as count FROM users WHERE id = ANY(:ids)"),
            {"ids": user_ids},
        )
        return result.mappings().first()["count"] == len(set(user_ids))

    async def _usuarios_tienen_rol(self, user_ids: list[int], role_name: str) -> bool:
        result = await self.db.execute(
            text("""
                SELECT COUNT(*) as count
                FROM users u
                INNER JOIN roles r ON u.role_id = r.id
                WHERE u.id = ANY(:ids) AND r.name = :role_name
            """),
            {"ids": user_ids, "role_name": role_name},
        )
        return result.mappings().first()["count"] == len(set(user_ids))

    async def get_all(self) -> list[dict]:
        logger.info("Consultando todos los grupos.")
        query = text("""
            SELECT g.id, g.nombre, g.descripcion, g.created_at,
                   u.id AS coordinador_id, u.email AS coordinador_username,
                   u.email AS coordinador_email
            FROM grupos g
            LEFT JOIN users u ON u.id = g.coordinador_id
            ORDER BY g.id ASC;
        """)
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def get_by_id(self, grupo_id: int) -> dict:
        logger.info(f"Consultando grupo ID: {grupo_id}")
        query = text("""
            SELECT g.id, g.nombre, g.descripcion, g.created_at,
                   u.id AS coordinador_id, u.email AS coordinador_username,
                   u.email AS coordinador_email
            FROM grupos g
            LEFT JOIN users u ON u.id = g.coordinador_id
            WHERE g.id = :id;
        """)
        result = await self.db.execute(query, {"id": grupo_id})
        row = result.mappings().first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado."
            )
        return dict(row)

    async def create(self, grupo_data: GrupoCreate, coordinador_id: int) -> dict:
        logger.info(f"Creando grupo '{grupo_data.nombre}' por coordinador ID: {coordinador_id}")

        existing = await self.db.execute(
            text("SELECT 1 FROM grupos WHERE nombre = :nombre"),
            {"nombre": grupo_data.nombre},
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un grupo con ese nombre.",
            )

        query = text("""
            INSERT INTO grupos (nombre, descripcion, coordinador_id)
            VALUES (:nombre, :descripcion, :coordinador_id)
            RETURNING id, nombre, descripcion, created_at, coordinador_id;
        """)
        try:
            result = await self.db.execute(
                query,
                {
                    "nombre": grupo_data.nombre,
                    "descripcion": grupo_data.descripcion,
                    "coordinador_id": coordinador_id,
                },
            )
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception:
            await self.db.rollback()
            logger.exception("Error al crear el grupo.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el grupo.",
            )

    async def update(self, grupo_id: int, data: dict) -> dict:
        logger.info(f"Actualizando grupo ID: {grupo_id}")

        if not await self._grupo_exists(grupo_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado."
            )

        update_fields = []
        params = {"id": grupo_id}

        if data.get("nombre") is not None:
            existing = await self.db.execute(
                text("SELECT 1 FROM grupos WHERE nombre = :nombre AND id != :id"),
                {"nombre": data["nombre"], "id": grupo_id},
            )
            if existing.first() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe un grupo con ese nombre.",
                )
            update_fields.append("nombre = :nombre")
            params["nombre"] = data["nombre"]

        if data.get("descripcion") is not None:
            update_fields.append("descripcion = :descripcion")
            params["descripcion"] = data["descripcion"]

        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se enviaron datos para actualizar.",
            )

        query_str = f"""
            UPDATE grupos
            SET {', '.join(update_fields)}
            WHERE id = :id
            RETURNING id, nombre, descripcion, created_at, coordinador_id;
        """

        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception:
            await self.db.rollback()
            logger.exception("Error al actualizar el grupo.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar el grupo.",
            )

    async def delete(self, grupo_id: int) -> dict:
        logger.info(f"Eliminando grupo ID: {grupo_id}")

        grupo = await self.get_by_id(grupo_id)

        # La columna asistencias.grupo_id solo existe si se aplicó la migración 003.
        # Si la BD aún tiene el esquema viejo (session_id/event_id), no bloquear.
        try:
            asistencias_check = await self.db.execute(
                text("SELECT 1 FROM asistencias WHERE grupo_id = :id LIMIT 1"),
                {"id": grupo_id},
            )
            if asistencias_check.first() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="No se puede eliminar el grupo porque tiene asistencias registradas.",
                )
        except HTTPException:
            raise
        except Exception:
            await self.db.rollback()
            logger.warning(
                "asistencias.grupo_id no existe en esta BD (falta migración 003); "
                "se omite el bloqueo por asistencias."
            )

        try:
            await self.db.execute(
                text("DELETE FROM grupo_docentes WHERE grupo_id = :id"),
                {"id": grupo_id},
            )
            await self.db.execute(
                text("DELETE FROM grupo_estudiantes WHERE grupo_id = :id"),
                {"id": grupo_id},
            )
            await self.db.execute(
                text("DELETE FROM grupos WHERE id = :id"), {"id": grupo_id}
            )
            await self.db.commit()
            return {"detail": f"Grupo '{grupo['nombre']}' eliminado correctamente."}
        except Exception:
            await self.db.rollback()
            logger.exception("Error al eliminar el grupo.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al eliminar el grupo.",
            )

    async def add_estudiantes(self, grupo_id: int, user_ids: list[int]) -> dict:
        logger.info(f"Asignando estudiantes al grupo ID: {grupo_id}")

        if not await self._grupo_exists(grupo_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado."
            )

        if not await self._usuarios_exist(user_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Uno o más usuarios no existen.",
            )

        if not await self._usuarios_tienen_rol(user_ids, "Aprendiz"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Todos los usuarios deben tener rol Aprendiz.",
            )

        added = 0
        skipped = 0
        for user_id in set(user_ids):
            existing = await self.db.execute(
                text(
                    "SELECT 1 FROM grupo_estudiantes WHERE grupo_id = :gid AND user_id = :uid"
                ),
                {"gid": grupo_id, "uid": user_id},
            )
            if existing.first() is not None:
                skipped += 1
                continue
            await self.db.execute(
                text(
                    "INSERT INTO grupo_estudiantes (grupo_id, user_id) VALUES (:gid, :uid)"
                ),
                {"gid": grupo_id, "uid": user_id},
            )
            added += 1

        await self.db.commit()
        return {
            "detail": "Estudiantes asignados correctamente.",
            "agregados": added,
            "omitidos_duplicados": skipped,
        }

    async def remove_estudiante(self, grupo_id: int, user_id: int) -> dict:
        logger.info(f"Removiendo estudiante ID {user_id} del grupo ID: {grupo_id}")

        if not await self._grupo_exists(grupo_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado."
            )

        result = await self.db.execute(
            text(
                "DELETE FROM grupo_estudiantes WHERE grupo_id = :gid AND user_id = :uid RETURNING grupo_id, user_id;"
            ),
            {"gid": grupo_id, "uid": user_id},
        )
        await self.db.commit()
        row = result.mappings().first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El estudiante no está asignado a este grupo.",
            )
        return {"detail": "Estudiante removido correctamente."}

    async def add_docentes(self, grupo_id: int, user_ids: list[int]) -> dict:
        logger.info(f"Asignando docentes al grupo ID: {grupo_id}")

        if not await self._grupo_exists(grupo_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado."
            )

        if not await self._usuarios_exist(user_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Uno o más usuarios no existen.",
            )

        if not await self._usuarios_tienen_rol(user_ids, "Docente"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Todos los usuarios deben tener rol Docente.",
            )

        added = 0
        skipped = 0
        for user_id in set(user_ids):
            existing = await self.db.execute(
                text(
                    "SELECT 1 FROM grupo_docentes WHERE grupo_id = :gid AND user_id = :uid"
                ),
                {"gid": grupo_id, "uid": user_id},
            )
            if existing.first() is not None:
                skipped += 1
                continue
            await self.db.execute(
                text(
                    "INSERT INTO grupo_docentes (grupo_id, user_id) VALUES (:gid, :uid)"
                ),
                {"gid": grupo_id, "uid": user_id},
            )
            added += 1

        await self.db.commit()
        return {
            "detail": "Docentes asignados correctamente.",
            "agregados": added,
            "omitidos_duplicados": skipped,
        }

    async def remove_docente(self, grupo_id: int, user_id: int) -> dict:
        logger.info(f"Removiendo docente ID {user_id} del grupo ID: {grupo_id}")

        if not await self._grupo_exists(grupo_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado."
            )

        result = await self.db.execute(
            text(
                "DELETE FROM grupo_docentes WHERE grupo_id = :gid AND user_id = :uid RETURNING grupo_id, user_id;"
            ),
            {"gid": grupo_id, "uid": user_id},
        )
        await self.db.commit()
        row = result.mappings().first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El docente no está asignado a este grupo.",
            )
        return {"detail": "Docente removido correctamente."}

    async def get_mis_grupos(self, user_id: int) -> list[dict]:
        logger.info(f"Consultando grupos del docente ID: {user_id}")
        query = text("""
            SELECT g.id, g.nombre, g.descripcion, g.created_at
            FROM grupos g
            INNER JOIN grupo_docentes gd ON gd.grupo_id = g.id
            WHERE gd.user_id = :user_id
            ORDER BY g.id ASC;
        """)
        result = await self.db.execute(query, {"user_id": user_id})
        return [dict(row) for row in result.mappings().all()]

    async def get_estudiantes(self, grupo_id: int) -> list[dict]:
        logger.info(f"Consultando estudiantes del grupo ID: {grupo_id}")

        if not await self._grupo_exists(grupo_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado."
            )

        query = text("""
            SELECT u.id, u.email AS username, u.email, u.name AS nombres, u.last_name AS apellidos,
                   u.document_type AS tipo_documento, u.document AS numero_documento
            FROM users u
            INNER JOIN grupo_estudiantes ge ON ge.user_id = u.id
            WHERE ge.grupo_id = :grupo_id
            ORDER BY u.last_name ASC, u.name ASC;
        """)
        result = await self.db.execute(query, {"grupo_id": grupo_id})
        return [dict(row) for row in result.mappings().all()]

    async def get_docentes(self, grupo_id: int) -> list[dict]:
        logger.info(f"Consultando docentes del grupo ID: {grupo_id}")

        if not await self._grupo_exists(grupo_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado."
            )

        query = text("""
            SELECT u.id, u.email AS username, u.email, u.name AS nombres, u.last_name AS apellidos,
                   u.document_type AS tipo_documento, u.document AS numero_documento
            FROM users u
            INNER JOIN grupo_docentes gd ON gd.user_id = u.id
            WHERE gd.grupo_id = :grupo_id
            ORDER BY u.last_name ASC, u.name ASC;
        """)
        result = await self.db.execute(query, {"grupo_id": grupo_id})
        return [dict(row) for row in result.mappings().all()]
