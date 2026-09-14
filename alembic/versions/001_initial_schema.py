"""initial_schema_with_centros_and_matriculas

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    # 1. roles
    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. centros_formacion
    op.create_table(
        'centros_formacion',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('codigo', sa.String(length=20), nullable=False),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('regional', sa.String(length=100), nullable=False),
        sa.Column('ciudad', sa.String(length=100), nullable=False),
        sa.Column('direccion', sa.String(length=200), nullable=True),
        sa.Column('telefono', sa.String(length=30), nullable=True),
        sa.Column('email', sa.String(length=150), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='activo', nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('codigo', name='uq_centros_formacion_codigo')
    )

    # 3. programa_formacion
    op.create_table(
        'programa_formacion',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('modality', sa.String(length=50), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('level', sa.String(length=50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. users (sin ficha_id)
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
        sa.Column('registration_date', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document'),
        sa.UniqueConstraint('email')
    )

    # 5. fichas (con centro_id)
    op.create_table(
        'fichas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('programa_id', sa.Integer(), nullable=False),
        sa.Column('number', sa.String(length=50), nullable=False),
        sa.Column('director_id', sa.Integer(), nullable=True),
        sa.Column('centro_id', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(['programa_id'], ['programa_formacion.id']),
        sa.ForeignKeyConstraint(['director_id'], ['users.id']),
        sa.ForeignKeyConstraint(['centro_id'], ['centros_formacion.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 6. matriculas
    op.create_table(
        'matriculas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('ficha_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='activa', nullable=False),
        sa.Column('registration_date', sa.TIMESTAMP(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('withdrawal_date', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='matriculas_user_id_fkey', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ficha_id'], ['fichas.id'], name='matriculas_ficha_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'ficha_id', name='uq_matricula_usuario_ficha')
    )

    # 7. sesiones
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
        sa.Column('qr_expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['ficha_id'], ['fichas.id']),
        sa.ForeignKeyConstraint(['instructor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 8. eventos
    op.create_table(
        'eventos',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('time', sa.Time(), nullable=False),
        sa.Column('capacity_people', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 9. asistencias
    op.create_table(
        'asistencias',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('event_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('time', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('observations', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['sesiones.id']),
        sa.ForeignKeyConstraint(['event_id'], ['eventos.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 10. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('accion', sa.String(length=100), nullable=False),
        sa.Column('detalles', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 11. verification_codes
    op.create_table(
        'verification_codes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 12. carnets
    op.create_table(
        'carnets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('qr_code', sa.String(length=500), nullable=False),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('expiration_date', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('carnets')
    op.drop_table('verification_codes')
    op.drop_table('audit_logs')
    op.drop_table('asistencias')
    op.drop_table('eventos')
    op.drop_table('sesiones')
    op.drop_table('matriculas')
    op.drop_table('fichas')
    op.drop_table('users')
    op.drop_table('programa_formacion')
    op.drop_table('centros_formacion')
    op.drop_table('roles')