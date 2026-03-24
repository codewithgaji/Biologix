"""add position column

Revision ID: 98eff09190ee
Revises: 
Create Date: 2026-03-24 16:16:23.042686

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '98eff09190ee'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column('employees', sa.Column('position', sa.String(), nullable=True))

def downgrade():
    op.drop_column('employees', 'position')