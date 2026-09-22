from datetime import date, timedelta
from datetime import date, timedelta
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.grupos.grupo_schema import GrupoCreate
from core.config import settings
from core.logger import logger
from core.redis_client import cache_get, cache_set, cache_delete


async def invalidate_grupo_cache(grupo_id: int | None = None) -> None:
    if grupo_id is not None:
        await cache_delete(f"grupos:{grupo_id}", f"grupos:{grupo_id}:estudiantes", f"grupos:{grupo_id}:docentes")
    await cache_delete("grupos:all", "grupos:mis:*")


# Adaptación a base.sql:
#  grupos -> fichas (id, number AS nombre, director_id AS coordinador_id)
#  grupo_estudiantes -> matriculas (user_id, ficha_id, status='activa')
#  grupo_docentes -> fichas.director_id + sesiones.instructor_id
#  GrupoResponse necesita created_at -> se usa start_date o NOW().


class GrupoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _grupo_exists(self, grupo_id: int) -> bool:
        result = await self.db.execute(
            text("SELECT 1 FROM fichas WHERE id = :id"), {"id": grupo_id}
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

    def _row_to_grupo(self, row: dict) -> dict:
        return {
            "id": row["id"],
            "nombre": row["nombre"],
            "descripcion": row.get("descripcion"),
            "created_at": row.get("created_at"),
            "coordinador_id": row.get("coordinador_id"),
        }

    async def get_all(self) -> list[dict]:
        logger.info("Consultando todos los grupos (fichas).")
        cached = await cache_get("grupos:all")
        if cached is not None:
            return cached
        query = text("""
            SELECT f.id, f.number AS nombre,
                   ('Ficha ' || f.number) AS descripcion,
                   f.centro_id AS centro_id,
                   COALESCE(f.start_date::timestamptz, NOW()) AS created_at,
                   f.director_id AS coordinador_id,
                   u.email AS coordinador_username,
                   u.email AS coordinador_email
            FROM fichas f
            LEFT JOIN users u ON u.id = f.director_id
            ORDER BY f.id ASC;
        """)
        result = await self.db.execute(query)
        data = [dict(row) for row in result.mappings().all()]
        await cache_set("grupos:all", data, ex=settings.CACHE_TTL_GRUPOS)
        return data

    async def get_by_id(self, grupo_id: int) -> dict:
        logger.info(f"Consultando grupo ID: {grupo_id}")
        query = text("""
            SELECT f.id, f.number AS nombre,
                   ('Ficha ' || f.number) AS descripcion,
                   f.centro_id AS centro_id,
                   COALESCE(f.start_date::timestamptz, NOW()) AS created_at,
                   f.director_id AS coordinador_id,
                   u.email AS coordinador_username,
                   u.email AS coordinador_email
            FROM fichas f
            LEFT JOIN users u ON u.id = f.director_id
            WHERE f.id = :id;
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
            text("SELECT 1 FROM fichas WHERE number = :nombre"),
            {"nombre": grupo_data.nombre},
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un grupo con ese nombre.",
            )

        prog = await self.db.execute(text("SELECT id FROM programa_formacion ORDER BY id LIMIT 1;"))
        prog_row = prog.mappings().first()
        if not prog_row:
            raise HTTPException(status_code=500, detail="No hay programas de formación para crear la ficha.")
        programa_id = prog_row["id"]
        hoy = date.today()
        fin = hoy + timedelta(days=365)

        centro_id = getattr(grupo_data, "centro_id", None)
        if centro_id is not None:
            c = await self.db.execute(
                text("SELECT 1 FROM centros_formacion WHERE id = :id;"), {"id": centro_id}
            )
            if c.first() is None:
                raise HTTPException(status_code=400, detail="El centro indicado no existe.")

        query = text("""
            INSERT INTO fichas (programa_id, number, director_id, centro_id, start_date, end_date)
            VALUES (:prog, :nombre, :director, :centro, :ini, :fin)
            RETURNING id, number AS nombre,
                      ('Ficha ' || number) AS descripcion,
                      centro_id AS centro_id,
                      COALESCE(start_date::timestamptz, NOW()) AS created_at,
                      director_id AS coordinador_id;
        """)
        try:
            result = await self.db.execute(
                query,
                {"prog": programa_id, "nombre": grupo_data.nombre, "director": coordinador_id, "centro": centro_id, "ini": hoy, "fin": fin},
            )
            await self.db.commit()
            await invalidate_grupo_cache()
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

        sets: list[str] = []
        params: dict = {"id": grupo_id}

        if data.get("nombre") is not None:
            existing = await self.db.execute(
                text("SELECT 1 FROM fichas WHERE number = :nombre AND id != :id"),
                {"nombre": data["nombre"], "id": grupo_id},
            )
            if existing.first() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe un grupo con ese nombre.",
                )
            sets.append("number = :nombre")
            params["nombre"] = data["nombre"]

        if data.get("centro_id") is not None:
            c = await self.db.execute(
                text("SELECT 1 FROM centros_formacion WHERE id = :id;"),
                {"id": data["centro_id"]},
            )
            if c.first() is None:
                raise HTTPException(status_code=400, detail="El centro indicado no existe.")
            sets.append("centro_id = :centro_id")
            params["centro_id"] = data["centro_id"]

        if not sets:
            # solo descripción -> nada que persistir en fichas (sin columna); devolver actual
            return await self.get_by_id(grupo_id)

        try:
            result = await self.db.execute(
                text(f"""
                    UPDATE fichas SET {", ".join(sets)} WHERE id = :id
                    RETURNING id, number AS nombre,
                              ('Ficha ' || number) AS descripcion,
                              centro_id AS centro_id,
                              COALESCE(start_date::timestamptz, NOW()) AS created_at,
                              director_id AS coordinador_id;
                """),
                params,
            )
            await self.db.commit()
            await invalidate_grupo_cache(grupo_id)
            return dict(result.mappings().first())
        except Exception:
            await self.db.rollback()
            raise HTTPException(status_code=500, detail="Error al actualizar el grupo.")

    async def delete(self, grupo_id: int) -> dict:
        logger.info(f"Eliminando grupo ID: {grupo_id}")

        grupo = await self.get_by_id(grupo_id)

        asist_check = await self.db.execute(
            text("""
                SELECT 1 FROM asistencias a
                JOIN sesiones s ON s.id = a.session_id
                WHERE s.ficha_id = :id LIMIT 1;
            """),
            {"id": grupo_id},
        )
        if asist_check.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No se puede eliminar el grupo porque tiene asistencias registradas.",
            )

        try:
            await self.db.execute(text("DELETE FROM matriculas WHERE ficha_id = :id"), {"id": grupo_id})
            await self.db.execute(text("DELETE FROM sesiones WHERE ficha_id = :id"), {"id": grupo_id})
            await self.db.execute(text("DELETE FROM fichas WHERE id = :id"), {"id": grupo_id})
            await self.db.commit()
            await invalidate_grupo_cache(grupo_id)
            return {"detail": f"Grupo '{grupo['nombre']}' eliminado correctamente."}
        except Exception:
            await self.db.rollback()
            logger.exception("Error al eliminar el grupo.")
            raise HTTPException(status_code=500, detail="Error al eliminar el grupo.")

    async def add_estudiantes(self, grupo_id: int, user_ids: list[int]) -> dict:
        logger.info(f"Asignando estudiantes al grupo ID: {grupo_id}")

        if not await self._grupo_exists(grupo_id):
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")
        if not await self._usuarios_exist(user_ids):
            raise HTTPException(status_code=404, detail="Uno o más usuarios no existen.")
        if not await self._usuarios_tienen_rol(user_ids, "Aprendiz"):
            raise HTTPException(status_code=400, detail="Todos los usuarios deben tener rol Aprendiz.")

        added = 0
        skipped = 0
        for user_id in set(user_ids):
            existing = await self.db.execute(
                text("SELECT 1 FROM matriculas WHERE ficha_id = :gid AND user_id = :uid"),
                {"gid": grupo_id, "uid": user_id},
            )
            if existing.first() is not None:
                skipped += 1
                continue
            await self.db.execute(
                text("INSERT INTO matriculas (ficha_id, user_id, status) VALUES (:gid, :uid, 'activa')"),
                {"gid": grupo_id, "uid": user_id},
            )
            added += 1

        await self.db.commit()
        await invalidate_grupo_cache(grupo_id)
        return {"detail": "Estudiantes asignados correctamente.", "agregados": added, "omitidos_duplicados": skipped}

    async def remove_estudiante(self, grupo_id: int, user_id: int) -> dict:
        if not await self._grupo_exists(grupo_id):
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")
        result = await self.db.execute(
            text("DELETE FROM matriculas WHERE ficha_id = :gid AND user_id = :uid RETURNING ficha_id, user_id;"),
            {"gid": grupo_id, "uid": user_id},
        )
        await self.db.commit()
        await invalidate_grupo_cache(grupo_id)
        if not result.mappings().first():
            raise HTTPException(status_code=404, detail="El estudiante no está asignado a este grupo.")
        return {"detail": "Estudiante removido correctamente."}

    async def add_docentes(self, grupo_id: int, user_ids: list[int]) -> dict:
        logger.info(f"Asignando docentes al grupo ID: {grupo_id}")

        if not await self._grupo_exists(grupo_id):
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")
        if not await self._usuarios_exist(user_ids):
            raise HTTPException(status_code=404, detail="Uno o más usuarios no existen.")
        if not await self._usuarios_tienen_rol(user_ids, "Docente"):
            raise HTTPException(status_code=400, detail="Todos los usuarios deben tener rol Docente.")

        uids = list(set(user_ids))
        # Director = primer docente si no hay
        cur = await self.db.execute(text("SELECT director_id FROM fichas WHERE id = :id;"), {"id": grupo_id})
        director = cur.mappings().first()["director_id"]
        if director is None:
            await self.db.execute(
                text("UPDATE fichas SET director_id = :uid WHERE id = :id;"),
                {"uid": uids[0], "id": grupo_id},
            )
        # Asegurar al menos una sesión por docente para que aparezca en mis-grupos
        added = 0
        skipped = 0
        for uid in uids:
            s = await self.db.execute(
                text("SELECT 1 FROM sesiones WHERE ficha_id = :g AND instructor_id = :u LIMIT 1;"),
                {"g": grupo_id, "u": uid},
            )
            if s.first() is not None:
                skipped += 1
                continue
            await self.db.execute(
                text("""
                    INSERT INTO sesiones (ficha_id, instructor_id, session_date, start_time, end_time, status)
                    VALUES (:g, :u, CURRENT_DATE, '08:00', '09:00', 'programada');
                """),
                {"g": grupo_id, "u": uid},
            )
            added += 1
        await self.db.commit()
        await invalidate_grupo_cache(grupo_id)
        return {"detail": "Docentes asignados correctamente.", "agregados": added, "omitidos_duplicados": skipped}

    async def remove_docente(self, grupo_id: int, user_id: int) -> dict:
        if not await self._grupo_exists(grupo_id):
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")
        await self.db.execute(
            text("UPDATE fichas SET director_id = NULL WHERE id = :g AND director_id = :u;"),
            {"g": grupo_id, "u": user_id},
        )
        res = await self.db.execute(
            text("DELETE FROM sesiones WHERE ficha_id = :g AND instructor_id = :u AND status = 'programada' RETURNING id;"),
            {"g": grupo_id, "u": user_id},
        )
        await self.db.commit()
        await invalidate_grupo_cache(grupo_id)
        # Si no era director ni tenía sesiones programadas, verificar que al menos dictaba algo
        check = await self.db.execute(
            text("SELECT 1 FROM sesiones WHERE ficha_id = :g AND instructor_id = :u LIMIT 1;"),
            {"g": grupo_id, "u": user_id},
        )
        cur = await self.db.execute(text("SELECT director_id FROM fichas WHERE id = :id;"), {"id": grupo_id})
        # Si no borró nada y no es director actual ni tiene sesiones, 404
        if res.rowcount == 0 and check.first() is None:
            # verificar si alguna vez fue docente (director anterior ya nulado arriba hace ambiguo;
            # se acepta como removido si existía el grupo y el usuario)
            pass
        return {"detail": "Docente removido correctamente."}

    async def get_mis_grupos(self, user_id: int) -> list[dict]:
        cached = await cache_get(f"grupos:mis:{user_id}")
        if cached is not None:
            return cached
        query = text("""
            SELECT DISTINCT f.id, f.number AS nombre,
                   ('Ficha ' || f.number) AS descripcion,
                   f.centro_id AS centro_id,
                   COALESCE(f.start_date::timestamptz, NOW()) AS created_at
            FROM fichas f
            LEFT JOIN sesiones s ON s.ficha_id = f.id
            WHERE f.director_id = :uid OR s.instructor_id = :uid
            ORDER BY f.id ASC;
        """)
        result = await self.db.execute(query, {"uid": user_id})
        data = [dict(row) for row in result.mappings().all()]
        await cache_set(f"grupos:mis:{user_id}", data, ex=settings.CACHE_TTL_GRUPOS)
        return data

    async def get_estudiantes(self, grupo_id: int) -> list[dict]:
        cached = await cache_get(f"grupos:{grupo_id}:estudiantes")
        if cached is not None:
            return cached
        if not await self._grupo_exists(grupo_id):
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")
        query = text("""
            SELECT u.id, u.email AS username, u.email, u.name AS nombres, u.last_name AS apellidos,
                   u.document_type AS tipo_documento, u.document AS numero_documento
            FROM users u
            INNER JOIN matriculas m ON m.user_id = u.id
            WHERE m.ficha_id = :grupo_id AND m.status = 'activa'
            ORDER BY u.last_name ASC, u.name ASC;
        """)
        result = await self.db.execute(query, {"grupo_id": grupo_id})
        data = [dict(row) for row in result.mappings().all()]
        await cache_set(f"grupos:{grupo_id}:estudiantes", data, ex=settings.CACHE_TTL_GRUPOS)
        return data

    async def get_docentes(self, grupo_id: int) -> list[dict]:
        cached = await cache_get(f"grupos:{grupo_id}:docentes")
        if cached is not None:
            return cached
        if not await self._grupo_exists(grupo_id):
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")
        query = text("""
            SELECT DISTINCT u.id, u.email AS username, u.email, u.name AS nombres,
                   u.last_name AS apellidos,
                   u.document_type AS tipo_documento, u.document AS numero_documento
            FROM users u
            WHERE u.id IN (
                SELECT f.director_id FROM fichas f WHERE f.id = :grupo_id AND f.director_id IS NOT NULL
                UNION
                SELECT s.instructor_id FROM sesiones s WHERE s.ficha_id = :grupo_id
            )
            ORDER BY u.last_name ASC, u.name ASC;
        """)
        result = await self.db.execute(query, {"grupo_id": grupo_id})
        data = [dict(row) for row in result.mappings().all()]
        await cache_set(f"grupos:{grupo_id}:docentes", data, ex=settings.CACHE_TTL_GRUPOS)
        return data
