from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from db.database import get_db
from db.models.admin_user import AdminUser, AdminRole, AdminStatus
from core.security.authHandler import AuthHandler

security = HTTPBearer()


def _get_verified_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db         : Session = Depends(get_db),
) -> AdminUser:
    token   = credentials.credentials
    payload = AuthHandler.decode_jwt(token)

    if not payload:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Invalid or expired token",
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Invalid token payload",
        )

    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "User no longer exists",
        )

    if user.status == AdminStatus.pending:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "Account pending approval. Contact your administrator.",
        )

    if user.status == AdminStatus.suspended:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "Account suspended. Contact your administrator.",
        )

    return user


def get_current_user(
    user: AdminUser = Depends(_get_verified_user),
) -> AdminUser:
    """Any active user regardless of role — viewer and above."""
    return user


def get_current_editor(
    user: AdminUser = Depends(_get_verified_user),
) -> AdminUser:
    """Editor and above — create/edit employees, manage leaves, import."""
    if user.role not in (AdminRole.editor, AdminRole.admin):
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "You don't have permission to perform this action",
        )
    return user


def get_current_payroll(
    user: AdminUser = Depends(_get_verified_user),
) -> AdminUser:
    """Payroll and above — export only."""
    if user.role not in (AdminRole.payroll, AdminRole.admin):
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "You don't have permission to perform this action",
        )
    return user


def get_current_admin(
    user: AdminUser = Depends(_get_verified_user),
) -> AdminUser:
    """Admin only — user management, role changes, audit logs, purge."""
    if user.role != AdminRole.admin:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "Admin access required",
        )
    return user





def get_current_superuser(
    user: AdminUser = Depends(_get_verified_user),
) -> AdminUser:
    """Superuser only — DB admin panel, stats, purge, backups."""
    if not user.is_superuser:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "Superuser access required",
        )
    return user