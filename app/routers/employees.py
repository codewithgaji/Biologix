from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from db.database import get_db
from db.models.employee import Employee
from db.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from core.security.dependencies import get_current_admin


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




@router.delete("/{user_id}")
def delete_employee(user_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee Not Found")
    db.delete(employee)
    db.commit()
    return {"message": f"Employee {user_id} deleted successfully"}




