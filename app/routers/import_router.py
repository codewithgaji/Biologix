from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from db.database import get_db
from services.dat_parser import parse_user_dat, parse_attlog_dat
from core.security.dependencies import get_current_admin
import uuid

router = APIRouter(
    prefix="/import",
    tags=["Import"],
    dependencies=[Depends(get_current_admin)]
)

# ✅ In-memory job tracker
import_jobs: dict = {}
def run_user_import(job_id: str, contents: bytes, db: Session):
    try:
        import_jobs[job_id] = {"status": "processing"}
        result = parse_user_dat(contents, db)
        import_jobs[job_id] = {"status": "done", **result}
    except Exception as e:
        import_jobs[job_id] = {"status": "error", "detail": str(e)}
    finally:
        db.close()


def run_attendance_import(job_id: str, contents: bytes, db: Session, force_status: str):
    try:
        import_jobs[job_id] = {"status": "processing"}
        result = parse_attlog_dat(contents, db, force_status=force_status)
        import_jobs[job_id] = {"status": "done", **result}
    except Exception as e:
        import_jobs[job_id] = {"status": "error", "detail": str(e)}
    finally:
        db.close()


# ✅ Status polling endpoint
@router.get("/status/{job_id}")
async def get_import_status(job_id: str):
    job = import_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/users")
async def import_users(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".dat"):
        raise HTTPException(status_code=400, detail="Only .dat files are accepted")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")

    job_id = str(uuid.uuid4())
    import_jobs[job_id] = {"status": "queued"}
    background_tasks.add_task(run_user_import, job_id, contents, db)

    return {"job_id": job_id, "message": "User import started"}



@router.post("/attendance")
async def import_attendance(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    type: str = Query(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".dat"):
        raise HTTPException(status_code=400, detail="Only .dat files are accepted")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")

    if type == "clock_in":
        force_status = "check_in"
        label = "Clock-In"
    elif type == "clock_out":
        force_status = "check_out"
        label = "Clock-Out"
    else:
        raise HTTPException(status_code=400, detail="Invalid attendance type")

    job_id = str(uuid.uuid4())
    import_jobs[job_id] = {"status": "queued"}
    background_tasks.add_task(run_attendance_import, job_id, contents, db, force_status)

    return {"job_id": job_id, "message": f"{label} import started", "type": label}