import uuid as uuid_lib
from datetime import date, timedelta
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.logger import logger
from core.exceptions import InvalidStateTransitionError
from core.redis_client import cache_get, cache_set, cache_delete
from services.qr_service import generate_qr_token


async def invalidate_carnet_cache(user_id: int | None = None) -> None:
    if user_id is not None:
        await cache_delete(f"carnets:user:{user_id}")
    await cache_delete("carnets:all*", "reports:*")


ESTADOS_VALIDOS = {"Activo", "Suspendido", "Vencido", "Inactivo"}

TRANSICIONES_PERMITIDAS = {
    "Activo": {"Suspendido", "Vencido"},
    "Suspendido": {"Activo", "Vencido", "Inactivo"},
    "Vencido": {"Inactivo", "Activo"},
    "Inactivo": set(),
}

# base.sql: carnets(id, user_id, qr_code, issue_date, expiration_date)
# Sin columna status -> estado derivado: Vencido si expiration_date < hoy, else Activo.
ESTADO_SQL = "CASE WHEN c.expiration_date < CURRENT_DATE THEN 'Vencido' ELSE 'Activo' END"

# Centro de formación del titular, derivado de su matrícula activa más
# reciente (matriculas -> fichas -> centros_formacion). No hay columna
# de centro en users, por eso se resuelve aquí igual que en UserService.
CENTRO_SQL = """(SELECT cf.nombre FROM matriculas m
              JOIN fichas f ON f.id = m.ficha_id
              LEFT JOIN centros_formacion cf ON cf.id = f.centro_id
              WHERE m.user_id = c.user_id AND m.status = 'activa'
              ORDER BY m.id DESC LIMIT 1) AS centro_nombre,
         (SELECT cf.id FROM matriculas m
              JOIN fichas f ON f.id = m.ficha_id
              LEFT JOIN centros_formacion cf ON cf.id = f.centro_id
              WHERE m.user_id = c.user_id AND m.status = 'activa'
              ORDER BY m.id DESC LIMIT 1) AS centro_id"""


class CarnetService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_carnet(self, user_id: int) -> dict:
        logger.info(f"Generando carnet para usuario ID: {user_id}")

        user_check = await self.db.execute(
            text("SELECT id, email FROM users WHERE id = :id AND user_status IN ('ACTIVE', 'ACTIVO');"),
            {"id": user_id}
        )
        if not user_check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado o inactivo.")

        existing = await self.db.execute(
            text("SELECT id FROM carnets WHERE user_id = :uid AND expiration_date >= CURRENT_DATE;"),
            {"uid": user_id}
        )
        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El usuario ya tiene un carnet activo. Inactive o regenere el existente."
            )

        qr_token = generate_qr_token(str(uuid_lib.uuid4()))
        issue_date = date.today()
        expiration_date = issue_date + timedelta(days=settings.CARNET_DURATION_DAYS)

        query = text("""
            INSERT INTO carnets (user_id, qr_code, issue_date, expiration_date)
            VALUES (:user_id, :qr_code, :issue_date, :expiration_date)
            RETURNING id, user_id, qr_code AS uuid, qr_code AS codigo_qr,
                      issue_date AS fecha_emision,
                      expiration_date AS fecha_vencimiento;
        """)
        try:
            result = await self.db.execute(query, {
                "user_id": user_id,
                "qr_code": qr_token,
                "issue_date": issue_date,
                "expiration_date": expiration_date,
            })
            await self.db.commit()
            row = dict(result.mappings().first())
            row["estado"] = "Activo"
            await invalidate_carnet_cache(user_id)
            logger.info(f"Carnet generado exitosamente: user={user_id} qr={qr_token[:12]}...")
            return row
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al generar carnet: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al generar el carnet.")

    async def get_carnet_by_user(self, user_id: int) -> dict | None:
        cached = await cache_get(f"carnets:user:{user_id}")
        if cached is not None:
            return cached
        query = text(f"""
                     SELECT c.id, c.user_id, c.qr_code AS uuid, c.qr_code AS codigo_qr,
                         {ESTADO_SQL} AS estado, c.issue_date AS fecha_emision,
                         c.expiration_date AS fecha_vencimiento,
                         u.name AS nombres, u.last_name AS apellidos, u.email,
                     u.document AS numero_documento, u.document_type AS tipo_documento,
                     u.blood_type AS tipo_sangre,
                     {CENTRO_SQL},
                     (SELECT f.number FROM matriculas m
                         JOIN fichas f ON f.id = m.ficha_id
                         WHERE m.user_id = c.user_id AND m.status = 'activa'
                         ORDER BY m.id DESC LIMIT 1) AS ficha_numero,
                     (SELECT p.name FROM matriculas m
                         JOIN fichas f ON f.id = m.ficha_id
                         LEFT JOIN programa_formacion p ON p.id = f.programa_id
                         WHERE m.user_id = c.user_id AND m.status = 'activa'
                         ORDER BY m.id DESC LIMIT 1) AS programa_nombre,
                     (SELECT cf.regional FROM matriculas m
                         JOIN fichas f ON f.id = m.ficha_id
                         JOIN centros_formacion cf ON cf.id = f.centro_id
                         WHERE m.user_id = c.user_id AND m.status = 'activa'
                         ORDER BY m.id DESC LIMIT 1) AS regional,
                     (u.name || ' ' || u.last_name) AS usuario_nombre,
                     u.document AS usuario_documento,
                     u.email AS usuario_email
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.user_id = :user_id
            ORDER BY c.id DESC LIMIT 1;
        """)
        result = await self.db.execute(query, {"user_id": user_id})
        row = result.mappings().first()
        data = dict(row) if row else None
        if data is not None:
            # datetime/date no son JSON serializables directos; redis_client usa default=str,
            # y al leer se devuelven strings. Normalizar a string aquí para consistencia.
            for k in ("fecha_emision", "fecha_vencimiento"):
                if data.get(k) is not None:
                    data[k] = str(data[k])
            await cache_set(f"carnets:user:{user_id}", data, ex=settings.CACHE_TTL_CARNETS)
        return data

    async def get_carnet_by_uuid(self, uuid: str) -> dict | None:
        query = text(f"""
                     SELECT c.id, c.user_id, c.qr_code AS uuid, c.qr_code AS codigo_qr,
                         {ESTADO_SQL} AS estado, c.issue_date AS fecha_emision,
                         c.expiration_date AS fecha_vencimiento,
                         u.name AS nombres, u.last_name AS apellidos, u.email,
                     u.document AS numero_documento, u.document_type AS tipo_documento,
                     u.blood_type AS tipo_sangre,
                     {CENTRO_SQL},
                     u.photo_profile AS foto_perfil,
                     (u.name || ' ' || u.last_name) AS usuario_nombre,
                     u.document AS usuario_documento,
                     u.email AS usuario_email
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.qr_code = :uuid;
        """)
        result = await self.db.execute(query, {"uuid": uuid})
        row = result.mappings().first()
        return dict(row) if row else None

    async def get_carnet_by_id(self, carnet_id: int) -> dict:
        query = text(f"""
                     SELECT c.id, c.user_id, c.qr_code AS uuid, c.qr_code AS codigo_qr,
                         {ESTADO_SQL} AS estado, c.issue_date AS fecha_emision,
                         c.expiration_date AS fecha_vencimiento,
                         u.name AS nombres, u.last_name AS apellidos, u.email,
                     u.document AS numero_documento, u.document_type AS tipo_documento,
                     u.blood_type AS tipo_sangre,
                     {CENTRO_SQL},
                     u.photo_profile AS foto_perfil,
                     (u.name || ' ' || u.last_name) AS usuario_nombre,
                     u.document AS usuario_documento,
                     u.email AS usuario_email
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = :id;
        """)
        result = await self.db.execute(query, {"id": carnet_id})
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carnet no encontrado.")
        return dict(row)

    async def list_carnets(self, estado: str | None = None) -> list[dict]:
        if estado and estado not in ESTADOS_VALIDOS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Estado inválido: {estado}")

        # base.sql no tiene Suspendido/Inactivo: se emulan como lista vacía
        if estado in ("Suspendido", "Inactivo"):
            return []

        cached = await cache_get(f"carnets:all:{estado or 'todos'}")
        if cached is not None:
            return cached

        where = ""
        if estado == "Activo":
            where = "WHERE c.expiration_date >= CURRENT_DATE"
        elif estado == "Vencido":
            where = "WHERE c.expiration_date < CURRENT_DATE"

        query = text(f"""
                  SELECT c.id, c.user_id, c.qr_code AS uuid, c.qr_code AS codigo_qr,
                      {ESTADO_SQL} AS estado, c.issue_date AS fecha_emision,
                      c.expiration_date AS fecha_vencimiento,
                      u.name AS nombres, u.last_name AS apellidos, u.document AS numero_documento,
                      u.document_type AS tipo_documento, u.blood_type AS tipo_sangre,
                      {CENTRO_SQL},
                      (u.name || ' ' || u.last_name) AS usuario_nombre,
                      u.document AS usuario_documento,
                      u.email AS usuario_email
                FROM carnets c
                JOIN users u ON u.id = c.user_id
                {where}
                ORDER BY c.id DESC;
            """)
        result = await self.db.execute(query)
        data = [dict(row) for row in result.mappings().all()]
        for r in data:
            for k in ("fecha_emision", "fecha_vencimiento"):
                if r.get(k) is not None:
                    r[k] = str(r[k])
        await cache_set(f"carnets:all:{estado or 'todos'}", data, ex=settings.CACHE_TTL_CARNETS)
        return data

    async def update_estado(self, carnet_id: int, nuevo_estado: str) -> dict:
        logger.info(f"Cambiando estado del carnet {carnet_id} a {nuevo_estado}")

        current = await self.db.execute(
            text(f"SELECT c.id, {ESTADO_SQL} AS estado, c.expiration_date FROM carnets c WHERE c.id = :id;"),
            {"id": carnet_id}
        )
        row = current.mappings().first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carnet no encontrado.")

        estado_actual = row["estado"]
        if nuevo_estado not in TRANSICIONES_PERMITIDAS.get(estado_actual, set()):
            raise InvalidStateTransitionError(
                detail=f"No se puede cambiar de '{estado_actual}' a '{nuevo_estado}'. "
                       f"Transiciones permitidas: {TRANSICIONES_PERMITIDAS.get(estado_actual, set())}"
            )

        # Emulación sin columna status:
        # Activo -> renovar 1 año; Vencido -> expirar ayer; Inactivo -> eliminar fila.
        if nuevo_estado == "Activo":
            await self.db.execute(
                text("UPDATE carnets SET expiration_date = CURRENT_DATE + 365 WHERE id = :id;"),
                {"id": carnet_id}
            )
            await self.db.commit()
            cur = await self.db.execute(text("SELECT user_id FROM carnets WHERE id = :id;"), {"id": carnet_id})
            r = cur.mappings().first()
            await invalidate_carnet_cache(r["user_id"] if r else None)
            return await self.get_carnet_by_id(carnet_id)
        if nuevo_estado == "Vencido":
            await self.db.execute(
                text("UPDATE carnets SET expiration_date = CURRENT_DATE - 1 WHERE id = :id;"),
                {"id": carnet_id}
            )
            await self.db.commit()
            cur = await self.db.execute(text("SELECT user_id FROM carnets WHERE id = :id;"), {"id": carnet_id})
            r = cur.mappings().first()
            await invalidate_carnet_cache(r["user_id"] if r else None)
            return await self.get_carnet_by_id(carnet_id)
        if nuevo_estado == "Inactivo":
            previo = await self.get_carnet_by_id(carnet_id)
            await self.db.execute(text("DELETE FROM carnets WHERE id = :id;"), {"id": carnet_id})
            await self.db.commit()
            await invalidate_carnet_cache(previo["user_id"])
            previo["estado"] = "Inactivo"
            return previo
        # Suspendido no tiene equivalente en base.sql
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado 'Suspendido' no soportado por base.sql (carnets sin columna status). Use Vencido/Inactivo.",
        )

    async def regenerate_carnet(self, user_id: int) -> dict:
        logger.info(f"Regenerando carnet para usuario ID: {user_id}")

        await self.db.execute(
            text("UPDATE carnets SET expiration_date = CURRENT_DATE - 1 WHERE user_id = :uid AND expiration_date >= CURRENT_DATE;"),
            {"uid": user_id}
        )
        await self.db.commit()

        return await self.generate_carnet(user_id)

    async def check_expired(self) -> int:
        # Estado derivado por fecha; nada que actualizar en base.sql.
        return 0
