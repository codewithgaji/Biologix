from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
from db.database import get_db, SessionLocal
from db.models.admin_user import AdminUser
from db.models.audit_log import AuditAction
from db.models.import_file import ImportFile
from db.schemas.import_file import ImportFileResponse
from services.dat_parser import parse_user_dat, parse_attlog_dat
from core.security.dependencies import get_current_editor
from core.audit import log_critical
from core.storage import save_import_file, get_import_file
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
    filename    : str,
    db          : Session,
    performed_by: str,          # email passed in at request time
):
    try:
        import_jobs[job_id] = {"status": "processing"}
        result = parse_user_dat(contents, db)
        import_jobs[job_id] = {"status": "done", **result}

        # ── Audit log + import file record — written after successful import ──
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

            storage_path = save_import_file(contents, filename, "users")
            audit_db.add(ImportFile(
                import_type       = "users",
                original_filename = filename,
                storage_path      = storage_path,
                inserted          = result.get("inserted", 0),
                skipped           = result.get("skipped", 0),
                errors            = result.get("errors", 0),
                imported_by       = performed_by,
            ))

            audit_db.commit()
        except Exception as e:
            audit_db.rollback()
            print(f"[import_router] Failed to save import file record: {e}")
        finally:
            audit_db.close()

    except Exception as e:
        import_jobs[job_id] = {"status": "error", "detail": str(e)}
    finally:
        db.close()


def run_attendance_import(
    job_id      : str,
    contents    : bytes,
    filename    : str,
    db          : Session,
    force_status: str,
    label       : str,
    performed_by: str,          # email passed in at request time
):
    try:
        import_jobs[job_id] = {"status": "processing"}
        result = parse_attlog_dat(contents, db, force_status=force_status)
        import_jobs[job_id] = {"status": "done", **result}

        # ── Audit log + import file record — written after successful import ──
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

            storage_path = save_import_file(contents, filename, force_status)
            audit_db.add(ImportFile(
                import_type       = force_status,
                original_filename = filename,
                storage_path      = storage_path,
                inserted          = result.get("inserted", 0),
                skipped           = result.get("skipped", 0),
                errors            = result.get("errors", 0),
                imported_by       = performed_by,
            ))

            audit_db.commit()
        except Exception as e:
            audit_db.rollback()
            print(f"[import_router] Failed to save import file record: {e}")
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


# ─── GET import history — editor and above ───────────────────────────────────
@router.get("/history", response_model=List[ImportFileResponse])
async def get_import_history(
    current_user: AdminUser = Depends(get_current_editor),
    db          : Session   = Depends(get_db),
):
    return db.query(ImportFile).order_by(ImportFile.imported_at.desc()).all()


# ─── GET download original import file — editor and above ───────────────────
@router.get("/{import_id}/download")
async def download_import_file(
    import_id   : int,
    current_user: AdminUser = Depends(get_current_editor),
    db          : Session   = Depends(get_db),
):
    record = db.query(ImportFile).filter(ImportFile.id == import_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Import record not found")

    try:
        file_bytes = get_import_file(record.storage_path)
    except FileNotFoundError:
        raise HTTPException(status_code=410, detail="Import file no longer exists in storage")

    return Response(
        content     = file_bytes,
        media_type  = "application/octet-stream",
        headers     = {"Content-Disposition": f'attachment; filename="{record.original_filename}"'},
    )


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
        file.filename,
        db,
        current_editor.email,
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
        file.filename,
        db,
        force_status,
        label,
        current_editor.email,
    )

    return {"job_id": job_id, "message": f"{label} import started", "type": label}