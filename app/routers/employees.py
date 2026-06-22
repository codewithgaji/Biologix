from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from db.database import get_db
from db.models.employee import Employee
from db.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from core.security.dependencies import get_current_admin
from datetime import datetime, timezone, timedelta
from db.models.archive import ArchivedEmployee, ArchivedAttendanceLog
from db.models.attendance import AttendanceLog   
from db.models.department import Department          
from decouple import config

router = APIRouter(
    prefix="/employees",
    tags=["Employees"],
    dependencies=[Depends(get_current_admin)]
)




@router.get("/", response_model=List[EmployeeResponse])
def get_all_employees(db: Session = Depends(get_db)):
    return db.query(Employee).all() # This is used to get all employees




# This is used to get users per ID.
@router.get("/{user_id}", response_model=EmployeeResponse)
def get_employee(user_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee Not Found")
    return employee




@router.post("/", response_model=EmployeeResponse)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    existing = db.query(Employee).filter(Employee.user_id == payload.user_id).first()
    if existing: # If the user exists.
        raise HTTPException(status_code=400, detail=f"Employee with ID {payload.user_id} already exists")
    employee = Employee(**payload.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee) # To display the newly created employee with the ID and other details.
    return employee





@router.patch("/{user_id}", response_model=EmployeeResponse)
def update_employee(user_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee Not Found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value) # This is used to update the employee values if need be
    db.commit()
    db.refresh(employee)
    return employee




# This is used to update the department of multiple employees at once. This is useful when we want to move multiple employees to a new department. The payload should contain a list of user_ids and the new department_id. For example: {"user_ids": [1, 2, 3], "department_id": 2}
@router.patch("/bulk/department")
def bulk_update_department(
    payload: dict,
    db: Session = Depends(get_db)
):
    user_ids      = payload.get("user_ids", [])
    department_id = payload.get("department_id")

    if not user_ids or department_id is None: # The user id or department id is a necessity.
        raise HTTPException(status_code=400, detail="user_ids and department_id are required")

    updated = 0
    for uid in user_ids:
        employee = db.query(Employee).filter(Employee.user_id == uid).first()
        if employee:
            employee.department_id = department_id
            updated += 1

    db.commit()
    return {"message": f"{updated} employees updated successfully", "updated": updated}


# This is used to delete an employee. When i delete an employee, I want to archive their data instead of permanently deleting it. This is because I want to keep the data for a certain period of time before purging it permanently. 
@router.delete("/{badge_number}")
def delete_employee(
    badge_number  : str,
    retention_days: int = 30,
    db            : Session = Depends(get_db),
    current_admin = Depends(get_current_admin),
):
    employee = db.query(Employee).filter(Employee.badge_number == badge_number).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    dept_name = None
    if employee.department_id:
        dept = db.query(Department).filter(Department.id == employee.department_id).first()
        dept_name = dept.name if dept else None

    purge_after = datetime.now(timezone.utc) + timedelta(days=retention_days)
    archive = ArchivedEmployee(
        original_user_id = employee.user_id,
        badge_number     = employee.badge_number,
        name             = employee.name,
        position         = employee.position,
        department_name  = dept_name,
        shift            = str(employee.shift.value) if employee.shift else None,
        work_days        = str(employee.work_days.value) if employee.work_days else None,
        archived_by      =  config("ADMIN_EMAIL"), # str(current_admin.get("username")),
        retention_days   = retention_days,
        purge_after      = purge_after,
    )
    db.add(archive)
    db.flush()

    logs = db.query(AttendanceLog).filter(AttendanceLog.user_id == employee.user_id).all()
    for log in logs:
        db.add(ArchivedAttendanceLog(
            archived_employee_id = archive.id,
            original_log_id      = log.id,
            original_user_id     = log.user_id,
            punch_time           = log.timestamp,
            punch_date           = log.date,
            punch_type           = log.punch_status.value if log.punch_status else None,
            hours_worked         = None,
            raw_data             = {
                "id"           : log.id,
                "user_id"      : log.user_id,
                "timestamp"    : str(log.timestamp),
                "date"         : str(log.date),
                "punch_status" : log.punch_status.value if log.punch_status else None,
                "punch_type"   : log.punch_type.value if log.punch_type else None,
                "created_at"   : str(log.created_at),
            },
        ))

    db.query(AttendanceLog).filter(AttendanceLog.user_id == employee.user_id).delete(
        synchronize_session=False
    )

    db.delete(employee)
    db.commit()

    return {
        "message"       : f"{employee.name} archived and removed",
        "badge_number"  : badge_number,
        "logs_archived" : len(logs),
        "purge_after"   : purge_after.isoformat(),
    }



# A separate admin router or scheduled task- this will be used with a cron job to purge expired archives. This is useful for IT to set up a cron job that runs every day at midnight to purge expired archives.Damn, this thing is using me up.... The retention_days can be set by IT when they delete the employee, and the purge_after will be calculated based on that. This way, we can keep the data for a certain period of time before purging it permanently.
