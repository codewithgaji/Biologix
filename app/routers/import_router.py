from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from db.database import get_db, SessionLocal
from db.models.admin_user import AdminUser
from db.models.audit_log import AuditAction
from services.dat_parser import parse_user_dat, parse_attlog_dat
from core.security.dependencies import get_current_editor
from core.audit import log_critical
import uuid

# ─── Router ───────────────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/import",
    tags=["Import"],
)

# ─── In-memory job tracker ────────────────────────────────────────────────────
import_jobs: dict = {}


# ─── Background tasks ─────────────────────────────────────────────────────────
def run_user_import(
    job_id      : str,
    contents    : bytes,
    db          : Session,
    performed_by: str,          # email passed in at request time
):
    try:
        import_jobs[job_id] = {"status": "processing"}
        result = parse_user_dat(contents, db)
        import_jobs[job_id] = {"status": "done", **result}

        # ── Audit log — written after successful import ────────────────────
        audit_db = SessionLocal()
        try:
            log_critical(
                db           = audit_db,
                action       = AuditAction.data_imported,
                performed_by = performed_by,
                target_type  = "import",
                target_id    = job_id,
                target_label = "user.dat",
                new_value    = {
                    "type"    : "users",
                    "inserted": result.get("inserted"),
                    "skipped" : result.get("skipped"),
                    "errors"  : result.get("errors"),
                },
            )
            audit_db.commit()
        except Exception:
            audit_db.rollback()
        finally:
            audit_db.close()

    except Exception as e:
        import_jobs[job_id] = {"status": "error", "detail": str(e)}
    finally:
        db.close()


def run_attendance_import(
    job_id      : str,
    contents    : bytes,
    db          : Session,
    force_status: str,
    label       : str,
    performed_by: str,          # email passed in at request time
):
    try:
        import_jobs[job_id] = {"status": "processing"}
        result = parse_attlog_dat(contents, db, force_status=force_status)
        import_jobs[job_id] = {"status": "done", **result}

        # ── Audit log — written after successful import ────────────────────
        audit_db = SessionLocal()
        try:
            log_critical(
                db           = audit_db,
                action       = AuditAction.data_imported,
                performed_by = performed_by,
                target_type  = "import",
                target_id    = job_id,
                target_label = f"{label.lower().replace(' ', '_')}.dat",
                new_value    = {
                    "type"    : force_status,
                    "inserted": result.get("inserted"),
                    "skipped" : result.get("skipped"),
                    "errors"  : result.get("errors"),
                },
            )
            audit_db.commit()
        except Exception:
            audit_db.rollback()
        finally:
            audit_db.close()

    except Exception as e:
        import_jobs[job_id] = {"status": "error", "detail": str(e)}
    finally:
        db.close()


# ─── GET job status ───────────────────────────────────────────────────────────
@router.get("/status/{job_id}")
async def get_import_status(
    job_id      : str,
    current_user: AdminUser = Depends(get_current_editor),
):
    job = import_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ─── POST import users — editor and above ────────────────────────────────────
@router.post("/users")
async def import_users(
    background_tasks: BackgroundTasks,
    file            : UploadFile  = File(...),
    db              : Session     = Depends(get_db),
    current_editor  : AdminUser   = Depends(get_current_editor),
):
    if not file.filename.endswith(".dat"):
        raise HTTPException(status_code=400, detail="Only .dat files are accepted")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")

    job_id = str(uuid.uuid4())
    import_jobs[job_id] = {"status": "queued"}

    background_tasks.add_task(
        run_user_import,
        job_id,
        contents,
        db,
        current_editor.email,   # ← pass email at request time
    )

    return {"job_id": job_id, "message": "User import started"}


# ─── POST import attendance — editor and above ────────────────────────────────
@router.post("/attendance")
async def import_attendance(
    background_tasks: BackgroundTasks,
    file            : UploadFile = File(...),
    type            : str        = Query(...),
    db              : Session    = Depends(get_db),
    current_editor  : AdminUser  = Depends(get_current_editor),
):
    if not file.filename.endswith(".dat"):
        raise HTTPException(status_code=400, detail="Only .dat files are accepted")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")

    if type == "clock_in":
        force_status = "check_in"
        label        = "Clock-In"
    elif type == "clock_out":
        force_status = "check_out"
        label        = "Clock-Out"
    else:
        raise HTTPException(status_code=400, detail="Invalid attendance type")

    job_id = str(uuid.uuid4())
    import_jobs[job_id] = {"status": "queued"}

    background_tasks.add_task(
        run_attendance_import,
        job_id,
        contents,
        db,
        force_status,
        label,
        current_editor.email,   # ← pass email at request time
    )

    return {"job_id": job_id, "message": f"{label} import started", "type": label}