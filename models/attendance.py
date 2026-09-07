from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class Attendance(Base):
    __tablename__ = "asistencias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sesiones.id"), nullable=True)
    event_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("eventos.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("(session_id IS NOT NULL) OR (event_id IS NOT NULL)", name="ck_asistencias_session_or_event"),
        UniqueConstraint("session_id", "user_id", name="uq_asistencias_session_user"),
        UniqueConstraint("event_id", "user_id", name="uq_asistencias_event_user"),
    )

    user = relationship("User", back_populates="attendances")
