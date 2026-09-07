from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    document_type: Mapped[str] = mapped_column(String(20), nullable=False)
    document: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    sex: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    photo_profile: Mapped[str | None] = mapped_column(String(500), nullable=True)
    user_status: Mapped[str] = mapped_column(String(20), nullable=False)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.id"), nullable=False)
    ficha_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("fichas.id"), nullable=True)
    registration_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    role = relationship("Role", back_populates="users")
    attendances = relationship("Attendance", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
