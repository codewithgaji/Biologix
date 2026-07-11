"""add is_superuser to admin_users

Revision ID: e982e6774824
Revises: 038489b00821
Create Date: 2026-07-10 13:17:30.315593

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e982e6774824'
down_revision: Union[str, Sequence[str], None] = '038489b00821'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('admin_users', sa.Column('is_superuser', sa.Boolean(), server_default='false', nullable=False))
    op.create_index(
        'ix_admin_users_single_superuser',
        'admin_users',
        ['is_superuser'],
        unique=True,
        postgresql_where=sa.text('is_superuser = true'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_admin_users_single_superuser', table_name='admin_users')
    op.drop_column('admin_users', 'is_superuser')