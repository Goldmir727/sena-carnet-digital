"""initial_schema

Revision ID: c5cf8d927519
Revises: 
Create Date: 2026-08-09 17:17:06.177648
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5cf8d927519'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tablas independientes
    op.create_table(
        'eventos',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('time', sa.Time(), nullable=False),
        sa.Column('capacity_people', sa.Integer(), nullable=False),
        sa.CheckConstraint(
            'capacity_people > 0',
            name='ck_eventos_capacity_people_positive'
        ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'programa_formacion',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('modality', sa.String(length=50), nullable=False),
        sa.Column('duration', sa.Integer(), nullable=False),
        sa.Column('level', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.CheckConstraint(
            'duration > 0',
            name='ck_programa_formacion_duration_positive'
        ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # 2. Fichas depende de programa_formacion
    #    director_id todavía NO lleva FK a users
    op.create_table(
        'fichas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('programa_id', sa.Integer(), nullable=False),
        sa.Column('number', sa.String(length=50), nullable=False),
        sa.Column('director_id', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(
            ['programa_id'],
            ['programa_formacion.id']
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('number')
    )

    # 3. Users depende de roles y fichas
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('document_type', sa.String(length=20), nullable=False),
        sa.Column('document', sa.String(length=30), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('sex', sa.String(length=20), nullable=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('photo_profile', sa.String(length=500), nullable=True),
        sa.Column('user_status', sa.String(length=20), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('ficha_id', sa.Integer(), nullable=True),
        sa.Column(
            'registration_date',
            sa.DateTime(timezone=True),
            nullable=False
        ),
        sa.ForeignKeyConstraint(
            ['ficha_id'],
            ['fichas.id']
        ),
        sa.ForeignKeyConstraint(
            ['role_id'],
            ['roles.id']
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document'),
        sa.UniqueConstraint('email')
    )

    # 4. Ahora sí podemos crear la FK fichas.director_id -> users.id
    op.create_foreign_key(
        'fk_fichas_director_id_users',
        'fichas',
        'users',
        ['director_id'],
        ['id']
    )

    # 5. Tablas que dependen de users/fichas
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('accion', sa.String(length=100), nullable=False),
        sa.Column('detalles', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            ondelete='SET NULL'
        ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'carnets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('qr_code', sa.String(length=500), nullable=False),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('expiration_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('qr_code')
    )

    op.create_table(
        'sesiones',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ficha_id', sa.Integer(), nullable=False),
        sa.Column('instructor_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('session_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('qr_token', sa.String(length=255), nullable=True),
        sa.Column('qr_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ['ficha_id'],
            ['fichas.id']
        ),
        sa.ForeignKeyConstraint(
            ['instructor_id'],
            ['users.id']
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('qr_token')
    )

    op.create_table(
        'verification_codes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'asistencias',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('event_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('time', sa.DateTime(), nullable=False),
        sa.Column('observations', sa.Text(), nullable=True),
        sa.CheckConstraint(
            '''
            (session_id IS NOT NULL AND event_id IS NULL)
            OR
            (session_id IS NULL AND event_id IS NOT NULL)
            ''',
            name='ck_asistencias_session_or_event'
        ),
        sa.ForeignKeyConstraint(
            ['event_id'],
            ['eventos.id']
        ),
        sa.ForeignKeyConstraint(
            ['session_id'],
            ['sesiones.id']
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id']
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'event_id',
            'user_id',
            name='uq_asistencias_event_user'
        ),
        sa.UniqueConstraint(
            'session_id',
            'user_id',
            name='uq_asistencias_session_user'
        )
    )


def downgrade() -> None:
    op.drop_table('asistencias')
    op.drop_table('verification_codes')
    op.drop_table('sesiones')
    op.drop_table('carnets')
    op.drop_table('audit_logs')

    op.drop_constraint(
        'fk_fichas_director_id_users',
        'fichas',
        type_='foreignkey'
    )

    op.drop_table('users')
    op.drop_table('fichas')
    op.drop_table('roles')
    op.drop_table('programa_formacion')
    op.drop_table('eventos')