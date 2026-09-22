from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base

if TYPE_CHECKING:
    from .role import Role
    from .asistencia import Asistencia
    from .audit_log import AuditLog
    from .matricula import Matricula
    from .carnet import Carnet
    from .verification_code import VerificationCode

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    document_type: Mapped[str] = mapped_column(String(20), nullable=False)
    document: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    sex: Mapped[str | None] = mapped_column(String(20), nullable=True)
    blood_type: Mapped[str | None] = mapped_column(String(5), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(30), nullable=True)
    rh: Mapped[str | None] = mapped_column(String(5), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    photo_profile: Mapped[str | None] = mapped_column(String(500), nullable=True)
    user_status: Mapped[str] = mapped_column(String(20), nullable=False)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.id"), nullable=False)
    registration_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    role = relationship("Role", back_populates="users")
    attendances = relationship("Asistencia", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    matriculas = relationship("Matricula", back_populates="user")
    carnets = relationship("Carnet", back_populates="user")
    verification_codes = relationship("VerificationCode", back_populates="user")