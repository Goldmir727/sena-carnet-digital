from datetime import date
from typing import TYPE_CHECKING
from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base

if TYPE_CHECKING:
    from .programa_formacion import ProgramaFormacion
    from .user import User
    from .centro_formacion import CentroFormacion
    from .matricula import Matricula
    from .sesion import Sesion

class Ficha(Base):
    __tablename__ = "fichas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    programa_id: Mapped[int] = mapped_column(Integer, ForeignKey("programa_formacion.id"), nullable=False)
    number: Mapped[str] = mapped_column(String(50), nullable=False)
    director_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    centro_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("centros_formacion.id", ondelete="CASCADE"), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    programa = relationship("ProgramaFormacion", back_populates="fichas")
    director = relationship("User")
    centro = relationship("CentroFormacion", back_populates="fichas")
    matriculas = relationship("Matricula", back_populates="ficha")
    sesiones = relationship("Sesion", back_populates="ficha")