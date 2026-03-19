from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from db.models.employee import Employee, RoleEnum
from db.models.attendance import AttendanceLog, PunchStatusEnum, PunchTypeEnum


PUNCH_TYPE_MAP = {
    "1" : PunchTypeEnum.fingerprint,
    "3" : PunchTypeEnum.card,
    "15": PunchTypeEnum.face,
}

PUNCH_STATUS_MAP = {
    "0": PunchStatusEnum.check_in,
    "1": PunchStatusEnum.check_out,
}


def parse_user_dat(file_bytes: bytes, db: Session) -> dict:
    """
    Parses user.dat binary file and inserts employees into the database.
    Skips employees that already exist.
    """
    import struct

    RECORD_SIZE = 72
    inserted    = 0
    skipped     = 0
    errors      = 0

    for offset in range(0, len(file_bytes) - RECORD_SIZE + 1, RECORD_SIZE):
        try:
            chunk     = file_bytes[offset:offset + RECORD_SIZE]
            user_id   = struct.unpack_from('<H', chunk, 0x00)[0]
            privilege = struct.unpack_from('<H', chunk, 0x02)[0]
            name      = chunk[0x0b:0x0b+24].split(b'\x00')[0].decode('utf-8', errors='ignore').strip()
            badge     = chunk[0x30:0x30+8].split(b'\x00')[0].decode('utf-8', errors='ignore').strip()

            if not name or user_id == 0 or name == "Master":
                continue

            role = RoleEnum.admin if privilege == 14 else RoleEnum.user

            existing = db.query(Employee).filter(Employee.user_id == user_id).first()
            if existing:
                skipped += 1
                continue

            employee = Employee(
                user_id      = user_id,
                name         = name,
                badge_number = badge or None,
                role         = role,
            )
            db.add(employee)
            inserted += 1

        except Exception:
            errors += 1
            continue

    db.commit()
    return {
        "inserted": inserted,
        "skipped" : skipped,
        "errors"  : errors,
    }



def parse_attlog_dat(file_bytes: bytes, db: Session, force_status: str = None):
    lines = file_bytes.decode("utf-8", errors="ignore").splitlines()

    # ✅ Load ALL employees once — one query instead of one per line
    all_employees = db.query(Employee).all()
    employee_map = {emp.badge_number: emp for emp in all_employees}

    inserted = 0
    skipped  = 0
    errors   = 0

    records_to_insert = []

    for line in lines:
        try:
            parts = line.strip().split()
            if len(parts) < 4:
                skipped += 1
                continue

            badge_number    = str(parts[0])
            timestamp       = datetime.strptime(parts[1] + " " + parts[2], "%Y-%m-%d %H:%M:%S")
            attendance_date = timestamp.date()

            if force_status:
                punch_status = PunchStatusEnum(force_status)
            else:
                raw_status   = parts[4] if len(parts) > 4 else "1"
                punch_status = PUNCH_STATUS_MAP.get(raw_status, PunchStatusEnum.check_in)

            # ✅ Dict lookup instead of DB query
            employee = employee_map.get(badge_number)
            if not employee:
                skipped += 1
                continue

            records_to_insert.append(AttendanceLog(
                user_id      = employee.user_id,
                timestamp    = timestamp,
                date         = attendance_date,
                punch_status = punch_status,
                punch_type   = PunchTypeEnum.fingerprint,
            ))
            inserted += 1

        except Exception:
            errors += 1
            continue

    # ✅ Bulk insert instead of one-by-one
    if records_to_insert:
        db.bulk_save_objects(records_to_insert)

    db.commit()

    return {"inserted": inserted, "skipped": skipped, "errors": errors}



