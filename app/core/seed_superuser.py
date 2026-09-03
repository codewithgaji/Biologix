import os
from sqlalchemy.orm import Session

from db.database import SessionLocal
from db.models.admin_user import AdminUser, AdminRole, AdminStatus
from core.security.hashHelper import HashHelper


def seed_superuser() -> None:
    """
    Creates the protected superuser account on first run against a fresh DB.
    Idempotent: does nothing if ADMIN_EMAIL/ADMIN_PASSWORD are unset, or if
    a user with that email already exists.
    """
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if not admin_email or not admin_password:
        print("[seed_superuser] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping.")
        return

    db: Session = SessionLocal()
    try:
        existing = db.query(AdminUser).filter(AdminUser.email == admin_email).first()
        if existing:
            print(f"[seed_superuser] Superuser already exists ({admin_email}) — skipping.")
            return

        user = AdminUser(
            full_name     = "Super Admin",
            email         = admin_email,
            password_hash = HashHelper.get_password_hash(admin_password),
            role          = AdminRole.admin,
            status        = AdminStatus.active,
            is_superuser  = True,
        )
        db.add(user)
        db.commit()
        print(f"[seed_superuser] Superuser created: {admin_email}")
    except Exception as e:
        db.rollback()
        print(f"[seed_superuser] Failed to seed superuser: {e}")
    finally:
        db.close()