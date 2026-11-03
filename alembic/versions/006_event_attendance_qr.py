"""Add QR lifecycle fields to events.

Revision ID: 006
Revises: 005
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("eventos", sa.Column("qr_token", sa.String(length=512), nullable=True))
    op.add_column(
        "eventos",
        sa.Column("qr_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "eventos",
        sa.Column("status", sa.String(length=20), server_default="activo", nullable=False),
    )
    op.add_column("eventos", sa.Column("created_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_eventos_created_by_users",
        "eventos",
        "users",
        ["created_by"],
        ["id"],
    )
def downgrade() -> None:
    op.drop_constraint("fk_eventos_created_by_users", "eventos", type_="foreignkey")
    op.drop_column("eventos", "created_by")
    op.drop_column("eventos", "status")
    op.drop_column("eventos", "qr_expires_at")
    op.drop_column("eventos", "qr_token")
