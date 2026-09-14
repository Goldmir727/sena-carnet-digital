from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base

if TYPE_CHECKING:
    from .sesion import Sesion
    from .evento import Evento
    from .user import User

class Asistencia(Base):
    __tablename__ = "asistencias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sesiones.id"), nullable=True)
    event_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("eventos.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)

    session = relationship("Sesion", back_populates="asistencias")
    event = relationship("Evento", back_populates="asistencias")
    user = relationship("User", back_populates="attendances")