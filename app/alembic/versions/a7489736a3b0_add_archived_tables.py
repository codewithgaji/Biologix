"""add archived tables

Revision ID: a7489736a3b0
Revises: 481424775d4b
Create Date: 2026-06-19 14:03:20.522442

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a7489736a3b0'
down_revision: Union[str, Sequence[str], None] = '481424775d4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'archived_employees',
        sa.Column('id',               sa.Integer(),                       nullable=False),
        sa.Column('original_user_id', sa.Integer(),                       nullable=False),
        sa.Column('badge_number',     sa.String(),                        nullable=False),
        sa.Column('name',             sa.String(),                        nullable=True),
        sa.Column('position',         sa.String(),                        nullable=True),
        sa.Column('department_name',  sa.String(),                        nullable=True),
        sa.Column('shift',            sa.String(),                        nullable=True),
        sa.Column('work_days',        sa.String(),                        nullable=True),
        sa.Column('archived_at',      sa.DateTime(timezone=True),         server_default=sa.func.now(), nullable=True),
        sa.Column('archived_by',      sa.String(),                        nullable=True),
        sa.Column('retention_days',   sa.Integer(),                       nullable=True),
        sa.Column('purge_after',      sa.DateTime(timezone=True),         nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_archived_employees_id'), 'archived_employees', ['id'], unique=False)

    op.create_table(
        'archived_attendance_logs',
        sa.Column('id',                      sa.Integer(),               nullable=False),
        sa.Column('archived_employee_id',    sa.Integer(),               nullable=False),
        sa.Column('original_log_id',         sa.Integer(),               nullable=True),
        sa.Column('original_user_id',        sa.Integer(),               nullable=False),
        sa.Column('punch_time',              sa.DateTime(timezone=True), nullable=True),
        sa.Column('punch_date',              sa.Date(),                  nullable=True),
        sa.Column('punch_type',              sa.String(),                nullable=True),
        sa.Column('hours_worked',            sa.Integer(),               nullable=True),
        sa.Column('raw_data',                sa.JSON(),                  nullable=True),
        sa.Column('archived_at',             sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['archived_employee_id'], ['archived_employees.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_archived_attendance_logs_id'), 'archived_attendance_logs', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_archived_attendance_logs_id'), table_name='archived_attendance_logs')
    op.drop_table('archived_attendance_logs')
    op.drop_index(op.f('ix_archived_employees_id'), table_name='archived_employees')
    op.drop_table('archived_employees')