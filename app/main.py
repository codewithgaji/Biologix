from fastapi import FastAPI
from contextlib import asynccontextmanager
from db.database import engine
from db.models import Employee, AttendanceLog
from routers import employees, attendance, departments, import_router, export_router, auth_router, holiday_router, leave
from routers.analytics_router import router as analytics_router
from fastapi.middleware.cors import CORSMiddleware
from db.models.department import Department
from db.models.holiday import Holiday
from db.models.leave import Leave
from dotenv import load_dotenv
import os


load_dotenv()


origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:8080")
ALLOWED_ORIGINS = [o.strip() for o in origins_raw.split(",")]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    Employee.metadata.create_all(bind=engine)
    AttendanceLog.metadata.create_all(bind=engine)
    Department.metadata.create_all(bind=engine)
    Holiday.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Biologics Attendance API",
    description="Biometric attendance management system",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)





app.include_router(auth_router.router, tags=["Auth"], prefix="/auth")
app.include_router(employees.router, tags=["Employees"])
app.include_router(attendance.router, tags=["Attendance"])
app.include_router(departments.router, tags=["Departments"])
app.include_router(import_router.router, tags=["Import"])
app.include_router(export_router.router, tags=["Export"])
app.include_router(leave.router, tags=["Leave"])
app.include_router(holiday_router.router, tags=["Holidays"])
app.include_router(analytics_router, tags=["Analytics"])










@app.get("/")
def root():
    return {"message": "Biologics API is running"}