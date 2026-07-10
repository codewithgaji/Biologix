from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from db.models.admin_user import AdminRole, AdminStatus


class AdminUserRegister(BaseModel):
    full_name: str
    email    : EmailStr
    password : str


class AdminUserLogin(BaseModel):
    email   : EmailStr
    password: str


class AdminUserResponse(BaseModel):
    id            : int
    full_name     : str
    email         : str
    role          : AdminRole
    status        : AdminStatus
    is_superuser  : bool = False
    created_at    : datetime
    last_login_at : Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserUpdate(BaseModel):
    """Used by admin to approve, change role, or suspend a user.
    Deliberately has no is_superuser field — that tier is never
    settable through any API payload, only via direct DB access."""
    role  : Optional[AdminRole]   = None
    status: Optional[AdminStatus] = None


class AdminRoleAssign(BaseModel):
    """Used when approving a pending user — must assign role at same time.
    Deliberately has no is_superuser field, same reasoning as above."""
    role: AdminRole