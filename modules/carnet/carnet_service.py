import uuid as uuid_lib
from datetime import datetime, timezone, timedelta
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
            text("SELECT id, username FROM users WHERE id = :id AND is_active = TRUE;"),
            {"id": user_id}
        )
        if not user_check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado o inactivo.")

        existing = await self.db.execute(
            text("SELECT id FROM carnets WHERE user_id = :uid AND estado = 'Activo';"),
            {"uid": user_id}
        )
        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El usuario ya tiene un carnet activo. Inactive o regenere el existente."
            )

        carnet_uuid = str(uuid_lib.uuid4())
        qr_token = generate_qr_token(carnet_uuid)
        fecha_emision = datetime.now(timezone.utc)
        fecha_vencimiento = fecha_emision + timedelta(days=settings.CARNET_DURATION_DAYS)

        query = text("""
            INSERT INTO carnets (user_id, uuid, codigo_qr, estado, fecha_emision, fecha_vencimiento)
            VALUES (:user_id, :uuid, :codigo_qr, 'Activo', :fecha_emision, :fecha_vencimiento)
            RETURNING id, user_id, uuid, codigo_qr, estado, fecha_emision, fecha_vencimiento;
        """)
        try:
            result = await self.db.execute(query, {
                "user_id": user_id,
                "uuid": carnet_uuid,
                "codigo_qr": qr_token,
                "fecha_emision": fecha_emision,
                "fecha_vencimiento": fecha_vencimiento,
            })
            await self.db.commit()
            row = dict(result.mappings().first())
            logger.info(f"Carnet generado exitosamente: UUID={carnet_uuid}")
            return row
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al generar carnet: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al generar el carnet.")

    async def get_carnet_by_user(self, user_id: int) -> dict | None:
        query = text("""
            SELECT c.*, u.nombres, u.apellidos, u.email, u.numero_documento, u.tipo_documento
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
            SELECT c.*, u.nombres, u.apellidos, u.email, u.numero_documento, u.tipo_documento, u.foto_perfil
            FROM carnets c
            JOIN users u ON u.id = c.user_id
            WHERE c.uuid = :uuid;
        """)
        result = await self.db.execute(query, {"uuid": uuid})
        row = result.mappings().first()
        return dict(row) if row else None

    async def get_carnet_by_id(self, carnet_id: int) -> dict:
        query = text("""
            SELECT c.*, u.nombres, u.apellidos, u.email, u.numero_documento, u.tipo_documento, u.foto_perfil
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
                SELECT c.*, u.nombres, u.apellidos, u.numero_documento
                FROM carnets c
                JOIN users u ON u.id = c.user_id
                WHERE c.estado = :estado
                ORDER BY c.id DESC;
            """)
            result = await self.db.execute(query, {"estado": estado})
        else:
            query = text("""
                SELECT c.*, u.nombres, u.apellidos, u.numero_documento
                FROM carnets c
                JOIN users u ON u.id = c.user_id
                ORDER BY c.id DESC;
            """)
            result = await self.db.execute(query)

        return [dict(row) for row in result.mappings().all()]

    async def update_estado(self, carnet_id: int, nuevo_estado: str) -> dict:
        logger.info(f"Cambiando estado del carnet {carnet_id} a {nuevo_estado}")

        current = await self.db.execute(
            text("SELECT id, estado FROM carnets WHERE id = :id;"),
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
            text("UPDATE carnets SET estado = :estado WHERE id = :id RETURNING *;"),
            {"estado": nuevo_estado, "id": carnet_id}
        )
        await self.db.commit()
        return dict(result.mappings().first())

    async def regenerate_carnet(self, user_id: int) -> dict:
        logger.info(f"Regenerando carnet para usuario ID: {user_id}")

        await self.db.execute(
            text("UPDATE carnets SET estado = 'Inactivo' WHERE user_id = :uid AND estado = 'Activo';"),
            {"uid": user_id}
        )
        await self.db.commit()

        return await self.generate_carnet(user_id)

    async def check_expired(self) -> int:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            text("UPDATE carnets SET estado = 'Vencido' WHERE estado = 'Activo' AND fecha_vencimiento < :now RETURNING id;"),
            {"now": now}
        )
        await self.db.commit()
        rows = result.all()
        return len(rows)
