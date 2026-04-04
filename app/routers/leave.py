from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta

from db.database import get_db
from db.models.leave import Leave
from db.models.employee import Employee
from db.schemas.leave import LeaveCreate, LeaveUpdate, LeaveOut
from core.security.dependencies import get_current_admin

router = APIRouter(
  prefix="/leaves",
  tags=["Leaves"],
  dependencies=[Depends(get_current_admin)]
)




def enrich(leave: Leave) -> LeaveOut: # This is the response type.
  out = LeaveOut.model_validate(leave) # This is the base response with the leave details.
  if leave.employee:
    out.employee_name = leave.employee.name # This is the employee name from the Employee model.
    out.badge_number = leave.employee.badge_number # This is the badge number from the Employee model.
  return out


@router.get("/", response_model=List[LeaveOut])
def get_leaves(
  user_id: Optional[int] = Query(None),
  date_from : Optional[date] = Query(None),
  date_to : Optional[date] = Query(None),
  db :  Session = Depends(get_db),
):
  q = db.query(Leave)
  if user_id is not None:
    q = q.filter((Leave.user_id == user_id) | (Leave.applies_to_all == True)) # This is used to get leaves that apply to all employees or leaves that apply to a specific employee.
    if date_from:
       q = q.filter(Leave.date_to >= date_from) # This is used to filter leaves that end after the specified start date.
    if date_to:
      q = q.filter(Leave.date_from <= date_to) # This is used to filter leaves that start before the specified end date.

    return [enrich(leave) for leave in q.order_by(Leave.date_from.desc()).all()] # This is used to get all leaves for a specific user, ordered by the start date in descending order. The enrich function is used to add the employee name and badge number to the response.




# This is the search query endpoint.
# To avoid routing conflict i'm defining the before the get leave by ID endpoint.
@router.get("/search/employee", response_model=List[dict])
def search_employee_by_badge(
    badge: str = Query(..., description="Badge number to search for"),
    db: Session = Depends(get_db)
):
  # The employee attr
  employees = db.query(Employee).filter(Employee.badge_number.ilike(f"%{badge}%")).limit(10).all()

  return [
    {
      "user_id": emp.user_id,
      "badge_number": emp.badge_number,
      "name": emp.name,
      "department": emp.department.name if emp.department else None
    }
    for emp in employees
  ]

  


@router.get("/dates/{user_id}")
def get_leave_dates_for_user(
  user_id: int, 
  db: Session = Depends(get_db),
  date_from: Optional[date] = Query(None),
  date_to: Optional[date] = Query(None)
):
  q = db.query(Leave).filter(
    (Leave.user_id == user_id) | (Leave.applies_to_all == True)
  )
  if date_from:
    q = q.filter(Leave.date_from >= date_from)
  if date_to:
    q = q.filter(Leave.date_to <= date_to)
  leaves = q.all()
  result = [] # This is used to get the leave lists for the user.
  for leave in leaves:
    current = leave.date_from
    while current <= leave.date_to:
      result.append({
        "date": str(current),
        "leave_type" : leave.leave_type.value,
        "description" : leave.description
      })
      current += timedelta(days=1)
  return result


# Get a leave by ID.
@router.get("/{leave_id}", response_model=LeaveOut)
def get_leave(leave_id: int, db: Session = Depends(get_db)):
  leave = db.query(Leave).filter(Leave.id == leave_id).firts()

  if not leave:
    raise HTTPException(status_code =404, detail="Leave not found")
  return enrich(leave)


# The Post Leave endpoint.
@router.post("/", response_model=LeaveOut, status_code=201)
def create_leave(payload: LeaveCreate, db: Session = Depends(get_db)):
  if not payload.applies_to_all and payload.user_id is None:
    employee = db.query(Employee).filter(Employee.user_id == payload.user_id).first()
    if not employee:
      raise HTTPException(status_code=404, detail="Employee not found")
    
  leave = Leave(**payload.model_dump())
  db.add(leave)
  db.commit()
  db.refresh(leave)
  return enrich(leave)



# The Update Leave endpoint.
@router.patch("/{leave_id}", response_model=LeaveOut)
def update_leave(leave_id: int, payload: LeaveUpdate, db: Session = Depends(get_db)):
  leave = db.query(Leave).filter(Leave.id == leave_id).first()
  if not leave:
    raise HTTPException(status_code=404, detail="Leave not found")
  
  for field, value in payload.model_dump(exclude_unset=True).items():
    setattr(leave, field, value)
  
  db.commit()
  db.refresh(leave)
  return enrich(leave)




# The Delete Leave endpoint.
@router.delete("/{leave_id}", status_code=204)
def delete_leave(leave_id: int, db: Session = Depends(get_db)):
  leave = db.query(Leave).filter(Leave.id == leave_id).first()
  if not leave:
    raise HTTPException(status_code=404, detail="Leave not found")
  
  db.delete(leave)
  db.commit()


