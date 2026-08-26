from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from db.database import get_db
from db.models.admin_user import AdminUser, AdminRole, AdminStatus
from db.schemas.admin_user import (
    AdminUserRegister, AdminUserLogin,
    AdminUserResponse, AdminUserUpdate, AdminRoleAssign
)
from core.security.authHandler import AuthHandler
from core.security.dependencies import get_current_admin, get_current_user
from core.security.hashHelper import HashHelper
from core.audit import log_critical, log_activity
from db.models.audit_log import AuditAction, ActivityAction
from typing import List

router = APIRouter(
    prefix="/admin",
    tags=["Admin Auth"],
)

# Placeholder identity shown for the superuser row wherever the roster is
# rendered. Never the real name/email — that only ever appears via /me.
_MASTER_KEY_LABEL = "Master Key"
_MASTER_KEY_EMAIL = "protected@system.internal"


def _serialize_user(user: AdminUser) -> dict:
    """Builds the dict returned to clients. Masks superuser identity."""
    if user.is_superuser:
        return {
            "id"           : user.id,
            "full_name"    : _MASTER_KEY_LABEL,
            "email"        : _MASTER_KEY_EMAIL,
            "role"         : user.role.value,
            "status"       : user.status.value,
            "is_superuser" : True,
            "created_at"   : user.created_at,
            "last_login_at": user.last_login_at,
        }
    return {
        "id"           : user.id,
        "full_name"    : user.full_name,
        "email"        : user.email,
        "role"         : user.role.value,
        "status"       : user.status.value,
        "is_superuser" : user.is_superuser,
        "created_at"   : user.created_at,
        "last_login_at": user.last_login_at,
    }


# ── Register ──────────────────────────────────────────────────────────────────
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: AdminUserRegister, db: Session = Depends(get_db)):
    existing = db.query(AdminUser).filter(AdminUser.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail      = "An account with this email already exists",
        )

    user = AdminUser(
        full_name     = payload.full_name,
        email         = payload.email,
        password_hash = HashHelper.get_password_hash(payload.password),
        role          = AdminRole.viewer,       # everyone starts as viewer
        status        = AdminStatus.pending,    # locked until admin approves
        # is_superuser is never set here, never accepted from payload,
        # and has no code path that can set it to True.
    )
    db.add(user)
    db.flush()

    log_critical(
        db           = db,
        action       = AuditAction.user_registered,
        performed_by = payload.email,
        target_type  = "admin_user",
        target_id    = str(user.id),
        target_label = user.full_name,
        notes        = "Self-registered — pending admin approval",
    )

    db.commit()
    return {
        "message": "Registration successful. Your account is pending approval by an administrator."
    }


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login")
def login(payload: AdminUserLogin, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.email == payload.email).first()

    if not user or not HashHelper.verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Invalid email or password",
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

    user.last_login_at = datetime.now(timezone.utc)

    log_activity(
        db           = db,
        action       = ActivityAction.user_login,
        performed_by = user.email,
        target_type  = "admin_user",
        target_id    = str(user.id),
        target_label = user.full_name,
    )

    db.commit()

    token = AuthHandler.sign_jwt(
        user_id = user.id,
        role    = user.role.value,
        status  = user.status.value,
    )

    return {
        "token"       : token,
        "user_id"     : user.id,
        "full_name"   : user.full_name,   # real identity — this IS you, logging in as you
        "email"       : user.email,
        "role"        : user.role.value,
        "status"      : user.status.value,
        "is_superuser": user.is_superuser,
    }


# ── Get current logged-in user ────────────────────────────────────────────────
@router.get("/me", response_model=AdminUserResponse)
def get_me(current_user: AdminUser = Depends(get_current_user)):
    # Deliberately NOT masked — you always see your own real identity.
    return current_user


# ── List all users — admin only ───────────────────────────────────────────────
@router.get("/users", response_model=List[AdminUserResponse])
def list_users(
    db           : Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    users = db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()
    return [_serialize_user(u) for u in users]


# ── Approve + assign role — admin only ───────────────────────────────────────
@router.patch("/users/{user_id}/approve")
def approve_user(
    user_id      : int,
    payload      : AdminRoleAssign,
    db           : Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.status != AdminStatus.pending:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail      = "User is not in pending status",
        )

    old_role   = user.role.value
    user.role   = payload.role
    user.status = AdminStatus.active

    log_critical(
        db           = db,
        action       = AuditAction.user_approved,
        performed_by = current_admin.email,
        target_type  = "admin_user",
        target_id    = str(user.id),
        target_label = user.full_name,
        old_value    = {"role": old_role, "status": "pending"},
        new_value    = {"role": payload.role.value, "status": "active"},
    )

    db.commit()
    return {
        "message" : f"{user.full_name} approved with role '{payload.role.value}'",
        "user_id" : user.id,
        "role"    : user.role.value,
        "status"  : user.status.value,
    }


# ── Change role — admin only ──────────────────────────────────────────────────
@router.patch("/users/{user_id}/role")
def change_role(
    user_id      : int,
    payload      : AdminRoleAssign,
    db           : Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Superuser status is checked FIRST and unconditionally — this blocks
    # every caller, including another superuser (there can only ever be one,
    # enforced by the DB), and it does not matter whether the request came
    # from the UI or a raw fetch/Postman call with a stolen token, because
    # this check happens on the server against the database, not the client.
    if user.is_superuser:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "This account is protected and cannot be modified.",
        )

    if user.id == current_admin.id:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail      = "You cannot change your own role",
        )

    old_role  = user.role.value
    user.role = payload.role

    log_critical(
        db           = db,
        action       = AuditAction.role_changed,
        performed_by = current_admin.email,
        target_type  = "admin_user",
        target_id    = str(user.id),
        target_label = user.full_name,
        old_value    = {"role": old_role},
        new_value    = {"role": payload.role.value},
    )

    db.commit()
    return {
        "message" : f"{user.full_name}'s role changed to '{payload.role.value}'",
        "user_id" : user.id,
        "role"    : user.role.value,
    }


# ── Suspend user — admin only ─────────────────────────────────────────────────
@router.patch("/users/{user_id}/suspend")
def suspend_user(
    user_id      : int,
    db           : Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_superuser:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "This account is protected and cannot be suspended.",
        )

    if user.id == current_admin.id:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail      = "You cannot suspend yourself",
        )

    user.status = AdminStatus.suspended

    log_critical(
        db           = db,
        action       = AuditAction.user_suspended,
        performed_by = current_admin.email,
        target_type  = "admin_user",
        target_id    = str(user.id),
        target_label = user.full_name,
        old_value    = {"status": "active"},
        new_value    = {"status": "suspended"},
    )

    db.commit()
    return {"message": f"{user.full_name} has been suspended"}


# ── Reactivate user — admin only ──────────────────────────────────────────────
@router.patch("/users/{user_id}/reactivate")
def reactivate_user(
    user_id      : int, # These are type hints
    db           : Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.status != AdminStatus.suspended:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail      = "User is not suspended",
        )

    user.status = AdminStatus.active

    log_critical(
        db           = db,
        action       = AuditAction.user_approved,
        performed_by = current_admin.email,
        target_type  = "admin_user",
        target_id    = str(user.id),
        target_label = user.full_name,
        old_value    = {"status": "suspended"},
        new_value    = {"status": "active"},
        notes        = "Reactivated from suspended state",
    )

    db.commit()
    return {"message": f"{user.full_name} has been reactivated"}



# Delete suspended user — admin only 
@router.delete("/users/{user_id}")
def delete_user(
    user_id      : int,
    db           : Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_superuser:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "This account is protected and cannot be deleted.",
        )

    if user.id == current_admin.id:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail      = "You cannot delete your own account",
        )

    if user.status != AdminStatus.suspended:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail      = "Only suspended users can be deleted. Suspend the user first.",
        )

    user_name = user.full_name
    user_email = user.email

    log_critical(
        db           = db,
        action       = AuditAction.user_suspended,   # closest available — no user_deleted enum yet
        performed_by = current_admin.email,
        target_type  = "admin_user",
        target_id    = str(user.id),
        target_label = user_name,
        old_value    = {"email": user_email, "role": user.role.value, "status": "suspended"},
        notes        = "Admin user permanently deleted",
    )

    db.delete(user)
    db.commit()
    return {"message": f"{user_name} has been permanently deleted"}