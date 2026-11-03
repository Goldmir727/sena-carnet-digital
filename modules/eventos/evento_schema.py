from datetime import datetime

from pydantic import BaseModel, Field


class EventoCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)


class EventoResponse(BaseModel):
    id: int
    name: str
    description: str | None
    qr_token: str
    qr_expires_at: datetime
    status: str
