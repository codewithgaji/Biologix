"""add attendance_purged to AuditAction

Revision ID: d39890ad4bdc
Revises: e982e6774824
Create Date: 2026-07-27 14:33:32.150123

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd39890ad4bdc'
down_revision: Union[str, Sequence[str], None] = 'e982e6774824'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'attendance_purged'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres does not support removing a value from an enum type.
    # A downgrade would require creating a new enum type without the value,
    # migrating the column over, and dropping the old type — not done here
    # since it's destructive and unnecessary for a purely additive change.
    pass