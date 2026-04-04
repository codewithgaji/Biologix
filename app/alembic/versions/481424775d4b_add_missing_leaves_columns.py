"""add missing leaves columns

Revision ID: 481424775d4b
Revises: 2e0d1edca969
Create Date: 2026-04-07 12:43:16.896920

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '481424775d4b'
down_revision: Union[str, Sequence[str], None] = '2e0d1edca969'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('leaves', sa.Column('leave_type', sa.String(), nullable=False, server_default='paid'))
    op.add_column('leaves', sa.Column('date_from', sa.Date(), nullable=False, server_default='2026-01-01'))
    op.add_column('leaves', sa.Column('date_to', sa.Date(), nullable=False, server_default='2026-01-01'))
    op.add_column('leaves', sa.Column('description', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('leaves', 'description')
    op.drop_column('leaves', 'date_to')
    op.drop_column('leaves', 'date_from')
    op.drop_column('leaves', 'leave_type')