"""add admin users and audit logs

Revision ID: 038489b00821
Revises: a7489736a3b0
Create Date: 2026-07-09 10:04:27.142511

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '038489b00821'
down_revision: Union[str, Sequence[str], None] = 'a7489736a3b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('activity_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('action', sa.Enum('employee_updated', 'leave_created', 'leave_deleted', 'holiday_created', 'holiday_deleted', 'department_created', 'department_updated', 'department_deleted', 'user_login', 'user_logout', name='activityaction'), nullable=False),
    sa.Column('performed_by', sa.String(), nullable=False),
    sa.Column('target_type', sa.String(), nullable=True),
    sa.Column('target_id', sa.String(), nullable=True),
    sa.Column('target_label', sa.String(), nullable=True),
    sa.Column('old_value', sa.JSON(), nullable=True),
    sa.Column('new_value', sa.JSON(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_activity_logs_id'), 'activity_logs', ['id'], unique=False)
    op.create_index(op.f('ix_activity_logs_timestamp'), 'activity_logs', ['timestamp'], unique=False)

    op.create_table('admin_users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('full_name', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('password_hash', sa.String(), nullable=False),
    sa.Column('role', sa.Enum('viewer', 'editor', 'payroll', 'admin', name='adminrole'), nullable=False),
    sa.Column('status', sa.Enum('pending', 'active', 'suspended', name='adminstatus'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_admin_users_email'), 'admin_users', ['email'], unique=True)
    op.create_index(op.f('ix_admin_users_id'), 'admin_users', ['id'], unique=False)

    op.create_table('critical_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('action', sa.Enum('employee_created', 'employee_deleted', 'employee_archived', 'user_registered', 'user_approved', 'user_suspended', 'role_changed', 'data_imported', 'data_exported', 'snapshot_reverted', 'archive_purged', name='auditaction'), nullable=False),
    sa.Column('performed_by', sa.String(), nullable=False),
    sa.Column('target_type', sa.String(), nullable=True),
    sa.Column('target_id', sa.String(), nullable=True),
    sa.Column('target_label', sa.String(), nullable=True),
    sa.Column('old_value', sa.JSON(), nullable=True),
    sa.Column('new_value', sa.JSON(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_critical_logs_id'), 'critical_logs', ['id'], unique=False)
    op.create_index(op.f('ix_critical_logs_timestamp'), 'critical_logs', ['timestamp'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_critical_logs_timestamp'), table_name='critical_logs')
    op.drop_index(op.f('ix_critical_logs_id'), table_name='critical_logs')
    op.drop_table('critical_logs')
    op.drop_index(op.f('ix_admin_users_id'), table_name='admin_users')
    op.drop_index(op.f('ix_admin_users_email'), table_name='admin_users')
    op.drop_table('admin_users')
    op.drop_index(op.f('ix_activity_logs_timestamp'), table_name='activity_logs')
    op.drop_index(op.f('ix_activity_logs_id'), table_name='activity_logs')
    op.drop_table('activity_logs')