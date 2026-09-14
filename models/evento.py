from datetime import date, time
from typing import TYPE_CHECKING
from sqlalchemy import Date, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base

if TYPE_CHECKING:
    from .asistencia import Asistencia

class Evento(Base):
    __tablename__ = "eventos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    time: Mapped[time] = mapped_column(Time, nullable=False)
    capacity_people: Mapped[int | None] = mapped_column(Integer, nullable=True)

    asistencias = relationship("Asistencia", back_populates="event")