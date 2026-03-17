from fastapi import FastAPI
from contextlib import asynccontextmanager
from db.database import engine
from db.models import Employee, AttendanceLog
from routers import employees, attendance, departments, import_router, export_router, auth_router
from fastapi.middleware.cors import CORSMiddleware
from db.models.department import Department
from db.models.holiday import Holiday
from dotenv import load_dotenv
from routers import holiday_router
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






app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(departments.router)
app.include_router(import_router.router)
app.include_router(export_router.router)
app.include_router(auth_router.router, tags=["Auth"], prefix="/auth")
app.include_router(holiday_router.router)










@app.get("/")
def root():
    return {"message": "Biologics API is running"}