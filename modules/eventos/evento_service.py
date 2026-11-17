import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from modules.eventos.evento_schema import EventoCreate


class EventoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _create_token(self, event_id: int, created_at: datetime) -> str:
        payload = json.dumps(
            {
                "type": "evento",
                "evento_id": event_id,
                "timestamp": created_at.isoformat(),
            },
            separators=(",", ":"),
        ).encode("utf-8")
        signature = hmac.new(
            settings.QR_SECRET.encode("utf-8"), payload, hashlib.sha256
        ).hexdigest()
        return f"{base64.urlsafe_b64encode(payload).decode('utf-8')}.{signature}"

    async def get_saved_names(self) -> list[str]:
        result = await self.db.execute(
            text("""
                SELECT name FROM (
                    SELECT DISTINCT name
                    FROM eventos
                    WHERE name IS NOT NULL AND TRIM(name) != ''
                ) AS sub
                ORDER BY LOWER(name), name;
            """)
        )
        return [row["name"] for row in result.mappings().all() if row["name"]]

    async def get_active(self) -> list[dict]:
        result = await self.db.execute(
            text("""
                SELECT id, name, description, qr_token, qr_expires_at, status
                FROM eventos
                WHERE status = 'activo' AND qr_expires_at > :now
                ORDER BY date DESC, time DESC, id DESC;
            """),
            {"now": datetime.now(timezone.utc)},
        )
        return [dict(row) for row in result.mappings().all()]

    async def create(self, data: EventoCreate, user_id: int) -> dict:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre del evento es obligatorio.")

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=24)
        result = await self.db.execute(
            text("""
                INSERT INTO eventos
                    (name, description, date, time, qr_expires_at, status, created_by)
                VALUES
                    (:name, :description, :date, :time, :expires_at, 'activo', :created_by)
                RETURNING id;
            """),
            {
                "name": name,
                "description": data.description,
                "date": now.date(),
                "time": now.time().replace(tzinfo=None, microsecond=0),
                "expires_at": expires_at,
                "created_by": user_id,
            },
        )
        event_id = result.mappings().first()["id"]
        token = self._create_token(event_id, now)
        await self.db.execute(
            text("UPDATE eventos SET qr_token = :token WHERE id = :id;"),
            {"token": token, "id": event_id},
        )
        await self.db.commit()
        return {
            "id": event_id,
            "name": name,
            "description": data.description,
            "qr_token": token,
            "qr_expires_at": expires_at,
            "status": "activo",
        }

    async def close(self, event_id: int) -> dict:
        result = await self.db.execute(
            text("""
                UPDATE eventos
                SET status = 'cerrado', qr_expires_at = :now
                WHERE id = :id AND status = 'activo'
                RETURNING id, name, status;
            """),
            {"id": event_id, "now": datetime.now(timezone.utc)},
        )
        event = result.mappings().first()
        if event is None:
            await self.db.rollback()
            raise HTTPException(
                status_code=404,
                detail="El evento no existe o ya fue cerrado.",
            )
        await self.db.commit()
        return dict(event)
