"""agrega telefono y rh a users (opcionales, para no romper frontend actual)

Revision ID: 005
Revises: 004
Create Date: 2026-09-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("telefono", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("rh", sa.String(length=5), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "rh")
    op.drop_column("users", "telefono")
