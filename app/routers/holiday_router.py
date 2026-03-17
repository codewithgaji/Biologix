from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from db.database import get_db
from db.models.holiday import Holiday
from db.schemas.holiday import HolidayCreate, HolidayResponse
from core.security.dependencies import get_current_admin

router = APIRouter(
    prefix="/holidays",
    tags=["Holidays"],
    dependencies=[Depends(get_current_admin)]
)


@router.get("/", response_model=List[HolidayResponse])
def get_holidays(db: Session = Depends(get_db)):
    return db.query(Holiday).order_by(Holiday.date).all()


@router.post("/", response_model=HolidayResponse)
def create_holiday(payload: HolidayCreate, db: Session = Depends(get_db)):
    existing = db.query(Holiday).filter(Holiday.date == payload.date).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday on this date already exists")
    holiday = Holiday(name=payload.name, date=payload.date)
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(holiday)
    db.commit()
    return {"message": f"{holiday.name} removed"}