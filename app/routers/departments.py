from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from db.database import get_db
from db.models.department import Department
from db.models.employee import Employee
from db.schemas.department import DepartmentCreate, DepartmentResponse
from core.security.dependencies import get_current_admin

router = APIRouter(
    prefix="/departments",
    tags=["Departments"],
    dependencies=[Depends(get_current_admin)]
)


def with_employee_count(dept: Department, db: Session) -> dict:
    """Attaches live employee count to a department before returning it."""
    count = db.query(Employee).filter(Employee.department_id == dept.id).count()
    return {
        "id"            : dept.id,
        "name"          : dept.name,
        "is_reportable" : dept.is_reportable,
        "employee_count": count,
    }


@router.get("/", response_model=List[DepartmentResponse])
def get_all_departments(db: Session = Depends(get_db)):
    departments = db.query(Department).all()
    return [with_employee_count(d, db) for d in departments]


@router.get("/{department_id}", response_model=DepartmentResponse)
def get_department(department_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return with_employee_count(dept, db)


@router.post("/", response_model=DepartmentResponse)
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db)):
    existing = db.query(Department).filter(Department.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department already exists")
    dept = Department(name=payload.name, is_reportable=payload.is_reportable)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return with_employee_count(dept, db)


@router.patch("/{department_id}", response_model=DepartmentResponse)
def update_department(department_id: int, payload: DepartmentCreate, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.name          = payload.name
    dept.is_reportable = payload.is_reportable
    db.commit()
    db.refresh(dept)
    return with_employee_count(dept, db)


@router.delete("/{department_id}")
def delete_department(department_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()
    return {"message": f"Department {dept.name} deleted successfully"}