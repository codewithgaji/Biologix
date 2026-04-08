"""make leaves user_id nullable

Revision ID: 2e0d1edca969
Revises: 8c5673aca247
Create Date: 2026-04-07 12:31:58.132971

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e0d1edca969'
down_revision: Union[str, Sequence[str], None] = '8c5673aca247'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.alter_column('leaves', 'user_id', nullable=True)


def downgrade() -> None:
    op.alter_column('leaves', 'user_id', nullable=False)
