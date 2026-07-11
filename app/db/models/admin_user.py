from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SAEnum
from sqlalchemy.sql import func
from db.database import Base
import enum

# I'm doing this for accountability.... incase i'm not around to see what changes are being made to the admin users table.
class AdminRole(str, enum.Enum):
    viewer  = "viewer"
    editor  = "editor"
    payroll = "payroll"
    admin   = "admin"


class AdminStatus(str, enum.Enum):
    pending   = "pending"
    active    = "active"
    suspended = "suspended"


class AdminUser(Base):
    __tablename__ = "admin_users"

    id            = Column(Integer, primary_key=True, index=True)
    full_name     = Column(String,  nullable=False)
    email         = Column(String,  nullable=False, unique=True, index=True)
    password_hash = Column(String,  nullable=False)
    role          = Column(SAEnum(AdminRole),   nullable=False, default=AdminRole.viewer)
    status        = Column(SAEnum(AdminStatus), nullable=False, default=AdminStatus.pending)

    # Absolute, out-of-band tier. Independent of `role`. There is no API route
    # anywhere in this app that sets this column — it is only ever flipped by
    # direct database access (see migration below). This is intentional:
    # an endpoint that can grant/revoke it is itself something a stolen
    # session token could abuse.
    is_superuser  = Column(Boolean, nullable=False, default=False, server_default="false")

    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)