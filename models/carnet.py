from datetime import date
from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class Carnet(Base):
    __tablename__ = "carnets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    qr_code: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiration_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)

    user = relationship("User")
