from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy.orm import Session
from db.database import get_db
from services.dat_parser import parse_user_dat, parse_attlog_dat
from core.security.dependencies import get_current_admin

router = APIRouter(
    prefix="/import",
    tags=["Import"],
    dependencies=[Depends(get_current_admin)]
)

@router.post("/users")
async def import_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".dat"):
        raise HTTPException(status_code=400, detail="Only .dat files are accepted")

    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")

    result = parse_user_dat(contents, db)

    return {
        "message" : "user.dat imported successfully",
        "imported": result["inserted"],  # ← renamed to match frontend
        "skipped" : result["skipped"],
        "errors"  : result["errors"],
    }




@router.post("/attendance")
async def import_attendance(
    file: UploadFile = File(...),
    type: str = Query(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".dat"):
        raise HTTPException(status_code=400, detail="Only .dat files are accepted")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")

    # Determine punch type from query parameter
    if type == "clock_in":
        force_status = "check_in"
        label = "Clock-In"

    elif type == "clock_out":
        force_status = "check_out"
        label = "Clock-Out"

    else:
        raise HTTPException(status_code=400, detail="Invalid attendance type")

    result = parse_attlog_dat(contents, db, force_status=force_status)

    return {
        "message": f"{label} attendance imported successfully",
        "imported": result["inserted"],
        "skipped": result["skipped"],
        "errors": result["errors"],
        "type": label,
    }


