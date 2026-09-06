from datetime import date as DateValue, datetime, time as TimeValue

from sqlalchemy import CheckConstraint, Date as SqlDate, DateTime, ForeignKey, Integer, String, Text, Time as SqlTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class ProgramaFormacion(Base):
    __tablename__ = "programa_formacion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    modality: Mapped[str] = mapped_column(String(50), nullable=False)
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    level: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)

    fichas = relationship("Ficha", back_populates="programa")

    __table_args__ = (CheckConstraint("duration > 0", name="ck_programa_formacion_duration_positive"),)


class Ficha(Base):
    __tablename__ = "fichas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    programa_id: Mapped[int] = mapped_column(Integer, ForeignKey("programa_formacion.id"), nullable=False)
    number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    director_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    start_date: Mapped[DateValue] = mapped_column(SqlDate, nullable=False)
    end_date: Mapped[DateValue] = mapped_column(SqlDate, nullable=False)

    programa = relationship("ProgramaFormacion", back_populates="fichas")
    sesiones = relationship("Sesion", back_populates="ficha")


class Sesion(Base):
    __tablename__ = "sesiones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ficha_id: Mapped[int] = mapped_column(Integer, ForeignKey("fichas.id"), nullable=False)
    instructor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    session_date: Mapped[DateValue] = mapped_column(SqlDate, nullable=False)
    start_time: Mapped[TimeValue] = mapped_column(SqlTime, nullable=False)
    end_time: Mapped[TimeValue] = mapped_column(SqlTime, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    qr_token: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    qr_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    ficha = relationship("Ficha", back_populates="sesiones")


class Evento(Base):
    __tablename__ = "eventos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[DateValue] = mapped_column(SqlDate, nullable=False)
    time: Mapped[TimeValue] = mapped_column(SqlTime, nullable=False)
    capacity_people: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (CheckConstraint("capacity_people > 0", name="ck_eventos_capacity_people_positive"),)