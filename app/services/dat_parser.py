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

    inserted = 0
    skipped  = 0
    errors   = 0

    for line in lines:
        try:
            parts = line.strip().split()

            if len(parts) < 4:
                skipped += 1
                continue

            badge_number = str(parts[0])  # parts[0] is badge number, not user_id
            timestamp    = datetime.strptime(parts[1] + " " + parts[2], "%Y-%m-%d %H:%M:%S")
            attendance_date = timestamp.date()

            if force_status:
                punch_status = PunchStatusEnum(force_status)
            else:
                raw_status   = parts[4] if len(parts) > 4 else "1"
                punch_status = PUNCH_STATUS_MAP.get(raw_status, PunchStatusEnum.check_in)

            # Look up employee by badge number — this is the key fix
            employee = db.query(Employee).filter(Employee.badge_number == badge_number).first()
            if not employee:
                skipped += 1
                continue

            exists = db.query(AttendanceLog).filter(
                AttendanceLog.user_id  == employee.user_id,
                AttendanceLog.timestamp == timestamp
            ).first()

            if exists:
                skipped += 1
                continue

            log = AttendanceLog(
                user_id      = employee.user_id,  # store the real user_id from the employee record
                timestamp    = timestamp,
                date         = attendance_date,
                punch_status = punch_status,
                punch_type   = PunchTypeEnum.fingerprint,
            )

            db.add(log)
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





