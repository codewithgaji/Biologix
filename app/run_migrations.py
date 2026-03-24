# run_migrations.py
import os
from alembic.config import Config
from alembic import command

# Path to your alembic.ini
alembic_cfg = Config("alembic.ini")

# Set the DATABASE_URL from environment (Render already has it)
alembic_cfg.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL"))

# Run migrations
command.upgrade(alembic_cfg, "head")

print("✅ Alembic migrations applied successfully")