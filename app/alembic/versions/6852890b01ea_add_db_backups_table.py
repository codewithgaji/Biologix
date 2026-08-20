"""add db_backups table

Revision ID: 6852890b01ea
Revises: d39890ad4bdc
Create Date: 2026-07-28 13:20:59.357383

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6852890b01ea'
down_revision: Union[str, Sequence[str], None] = 'd39890ad4bdc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'db_backups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('storage_path', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_db_backups_id'), 'db_backups', ['id'], unique=False)
    op.create_index(op.f('ix_db_backups_created_at'), 'db_backups', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_db_backups_created_at'), table_name='db_backups')
    op.drop_index(op.f('ix_db_backups_id'), table_name='db_backups')
    op.drop_table('db_backups')