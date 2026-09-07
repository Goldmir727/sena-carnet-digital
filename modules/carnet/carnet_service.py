import uuid as uuid_lib
from datetime import date, timedelta
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.logger import logger
from core.exceptions import InvalidStateTransitionError
from services.qr_service import generate_qr_token


ESTADOS_VALIDOS = {"Activo", "Suspendido", "Vencido", "Inactivo"}

TRANSICIONES_PERMITIDAS = {
    "Activo": {"Suspendido", "Vencido"},
    "Suspendido": {"Activo", "Vencido", "Inactivo"},
    "Vencido": {"Inactivo", "Activo"},
    "Inactivo": set(),
}


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
            text("SELECT id FROM carnets WHERE user_id = :uid AND status = 'Activo';"),
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
            INSERT INTO carnets (user_id, qr_code, issue_date, expiration_date, status)
            VALUES (:user_id, :qr_code, :issue_date, :expiration_date, 'Activo')
            RETURNING id, user_id, qr_code AS codigo_qr, issue_date AS fecha_emision,
                      expiration_date AS fecha_vencimiento, status AS estado;
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
            logger.info(f"Carnet generado exitosamente: user={user_id} qr={qr_token[:12]}...")
            return row
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al generar carnet: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al generar el carnet.")

    async def get_carnet_by_user(self, user_id: int) -> dict | None:
        query = text("""
                     SELECT c.id, c.user_id, c.qr_code AS uuid, c.qr_code AS codigo_qr,
                         c.status AS estado, c.issue_date AS fecha_emision,
                         c.expiration_date AS fecha_vencimiento,
                         u.name AS nombres, u.last_name AS apellidos, u.email,
                     u.document AS numero_documento, u.document_type AS tipo_documento
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.user_id = :user_id
            ORDER BY c.id DESC LIMIT 1;
        """)
        result = await self.db.execute(query, {"user_id": user_id})
        row = result.mappings().first()
        return dict(row) if row else None

    async def get_carnet_by_uuid(self, uuid: str) -> dict | None:
        query = text("""
                     SELECT c.id, c.user_id, c.qr_code AS uuid, c.qr_code AS codigo_qr,
                         c.status AS estado, c.issue_date AS fecha_emision,
                         c.expiration_date AS fecha_vencimiento,
                         u.name AS nombres, u.last_name AS apellidos, u.email,
                     u.document AS numero_documento, u.document_type AS tipo_documento,
                     u.photo_profile AS foto_perfil
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.qr_code = :uuid;
        """)
        result = await self.db.execute(query, {"uuid": uuid})
        row = result.mappings().first()
        return dict(row) if row else None

    async def get_carnet_by_id(self, carnet_id: int) -> dict:
        query = text("""
                     SELECT c.id, c.user_id, c.qr_code AS uuid, c.qr_code AS codigo_qr,
                         c.status AS estado, c.issue_date AS fecha_emision,
                         c.expiration_date AS fecha_vencimiento,
                         u.name AS nombres, u.last_name AS apellidos, u.email,
                     u.document AS numero_documento, u.document_type AS tipo_documento,
                     u.photo_profile AS foto_perfil
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

        if estado:
            query = text("""
                  SELECT c.id, c.user_id, c.qr_code AS uuid, c.qr_code AS codigo_qr,
                      c.status AS estado, c.issue_date AS fecha_emision,
                      c.expiration_date AS fecha_vencimiento,
                      u.name AS nombres, u.last_name AS apellidos, u.document AS numero_documento
                FROM carnets c
                JOIN users u ON u.id = c.user_id
                WHERE c.status = :estado
                ORDER BY c.id DESC;
            """)
            result = await self.db.execute(query, {"estado": estado})
        else:
            query = text("""
                  SELECT c.id, c.user_id, c.qr_code AS uuid, c.qr_code AS codigo_qr,
                      c.status AS estado, c.issue_date AS fecha_emision,
                      c.expiration_date AS fecha_vencimiento,
                      u.name AS nombres, u.last_name AS apellidos, u.document AS numero_documento
                FROM carnets c
                JOIN users u ON u.id = c.user_id
                ORDER BY c.id DESC;
            """)
            result = await self.db.execute(query)

        return [dict(row) for row in result.mappings().all()]

    async def update_estado(self, carnet_id: int, nuevo_estado: str) -> dict:
        logger.info(f"Cambiando estado del carnet {carnet_id} a {nuevo_estado}")

        current = await self.db.execute(
            text("SELECT id, status AS estado FROM carnets WHERE id = :id;"),
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

        result = await self.db.execute(
            text("UPDATE carnets SET status = :estado WHERE id = :id RETURNING *, status AS estado;"),
            {"estado": nuevo_estado, "id": carnet_id}
        )
        await self.db.commit()
        return dict(result.mappings().first())

    async def regenerate_carnet(self, user_id: int) -> dict:
        logger.info(f"Regenerando carnet para usuario ID: {user_id}")

        # Pasar por la máquina de estados: solo inactivar lo permitido.
        # Activo -> Inactivo directo está prohibido, ir vía Suspendido.
        cur = await self.db.execute(
            text("SELECT id, status FROM carnets WHERE user_id = :uid ORDER BY id DESC LIMIT 1;"),
            {"uid": user_id}
        )
        row = cur.mappings().first()
        if row and row["status"] == "Activo":
            await self.db.execute(
                text("UPDATE carnets SET status = 'Suspendido' WHERE id = :id;"),
                {"id": row["id"]}
            )
            await self.db.execute(
                text("UPDATE carnets SET status = 'Inactivo' WHERE id = :id;"),
                {"id": row["id"]}
            )
            await self.db.commit()
        elif row:
            await self.db.execute(
                text("UPDATE carnets SET status = 'Inactivo' WHERE id = :id;"),
                {"id": row["id"]}
            )
            await self.db.commit()

        return await self.generate_carnet(user_id)

    async def check_expired(self) -> int:
        now = date.today()
        result = await self.db.execute(
            text("UPDATE carnets SET status = 'Vencido' WHERE status = 'Activo' AND expiration_date < :now RETURNING id;"),
            {"now": now}
        )
        await self.db.commit()
        rows = result.all()
        return len(rows)
