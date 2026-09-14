from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base

if TYPE_CHECKING:
    from .user import User
    from .ficha import Ficha

class Matricula(Base):
    __tablename__ = "matriculas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ficha_id: Mapped[int] = mapped_column(Integer, ForeignKey("fichas.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="activa", server_default="activa", nullable=False)
    registration_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    withdrawal_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "ficha_id", name="uq_matricula_usuario_ficha"),
    )

    user = relationship("User", back_populates="matriculas")
    ficha = relationship("Ficha", back_populates="matriculas")