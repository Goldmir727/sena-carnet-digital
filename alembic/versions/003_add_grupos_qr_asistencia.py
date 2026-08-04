"""grupos, qr_carnets, qr_clases, roles para sistema de asistencia

Revision ID: 003
Revises: 002
Create Date: 2026-07-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "grupos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=True),
        sa.Column("coordinador_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["coordinador_id"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "grupo_estudiantes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("grupo_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["grupo_id"], ["grupos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("grupo_id", "user_id"),
    )

    op.create_table(
        "grupo_docentes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("grupo_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["grupo_id"], ["grupos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("grupo_id", "user_id"),
    )

    op.create_table(
        "qr_carnets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_qr_carnets_lookup", "qr_carnets", ["token", "used", "expires_at"])

    op.create_table(
        "qr_clases",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("docente_id", sa.Integer(), nullable=False),
        sa.Column("grupo_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["docente_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["grupo_id"], ["grupos.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_qr_clases_lookup", "qr_clases", ["token", "expires_at"])

    op.add_column("asistencias", sa.Column("grupo_id", sa.Integer(), nullable=True))
    op.add_column("asistencias", sa.Column("qr_clase_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_asistencias_grupo", "asistencias", "grupos", ["grupo_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_asistencias_qr_clase", "asistencias", "qr_clases", ["qr_clase_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_asistencias_qr_clase", "asistencias", type_="foreignkey")
    op.drop_constraint("fk_asistencias_grupo", "asistencias", type_="foreignkey")
    op.drop_column("asistencias", "qr_clase_id")
    op.drop_column("asistencias", "grupo_id")
    op.drop_index("idx_qr_clases_lookup", table_name="qr_clases")
    op.drop_table("qr_clases")
    op.drop_index("idx_qr_carnets_lookup", table_name="qr_carnets")
    op.drop_table("qr_carnets")
    op.drop_table("grupo_docentes")
    op.drop_table("grupo_estudiantes")
    op.drop_table("grupos")
