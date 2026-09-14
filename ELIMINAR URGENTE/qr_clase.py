from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class QRClase(Base):
    __tablename__ = "qr_clases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    docente_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    grupo_id: Mapped[int] = mapped_column(Integer, ForeignKey("grupos.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    docente = relationship("User", foreign_keys=[docente_id])
    grupo = relationship("Grupo")
