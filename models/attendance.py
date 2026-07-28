from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class Attendance(Base):
    __tablename__ = "asistencias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    ubicacion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_extra: Mapped[str | None] = mapped_column("metadata", Text, nullable=True)

    user = relationship("User", back_populates="attendances")
