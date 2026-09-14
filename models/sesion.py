from datetime import date, time, datetime
from typing import TYPE_CHECKING
from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base

if TYPE_CHECKING:
    from .ficha import Ficha
    from .user import User
    from .asistencia import Asistencia

class Sesion(Base):
    __tablename__ = "sesiones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ficha_id: Mapped[int] = mapped_column(Integer, ForeignKey("fichas.id"), nullable=False)
    instructor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    qr_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    qr_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    ficha = relationship("Ficha", back_populates="sesiones")
    instructor = relationship("User")
    asistencias = relationship("Asistencia", back_populates="session")