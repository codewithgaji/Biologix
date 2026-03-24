# 🔬 BioLogix
### Biometric Attendance Management System

> Built to replace expensive, outdated ZKTeco software with a modern, web-based system that organizations actually own.

---

## What is BioLogix?

BioLogix is a full-stack biometric attendance management system designed for organizations using ZKTeco fingerprint machines. Instead of relying on ZKTeco's proprietary — and costly — desktop software, BioLogix reads the raw binary `.DAT` files directly off the machine, processes them through a custom-built API, and presents the data through a clean, intuitive web dashboard accessible from any device.

No more per-seat licenses. No more clunky desktop installs. No more manual spreadsheets.

---

## The Problem It Solves

Most organizations with biometric attendance machines face the same frustrations:

- ZKTeco's software is expensive, outdated, and locked to a single machine
- HR teams spend hours manually compiling attendance data into spreadsheets every month
- There is no easy way to generate department-level reports or track shift-based expected hours
- Absence, late arrivals, and holiday exclusions require manual calculation
- There is no web access — the data lives on one computer

BioLogix eliminates all of this.

---

## Features

### 🖐️ Biometric Data Import
- Parses ZKTeco binary `.DAT` files directly — no proprietary software needed
- Supports separate **entry** and **exit** machines (dual-machine setups)
- Smart punch detection: automatically distinguishes clock-in from clock-out
- Bulk import with duplicate detection and error reporting

### 👥 Employee Management
- Full employee directory with badge numbers, machine IDs, departments, shifts, and work schedules
- Inline editing for department, shift type, and work days
- Bulk assignment of department, shift, and work schedule
- Employees sorted by badge number for fast lookup

### 🕐 Attendance Tracking
- Daily attendance summaries per employee: clock-in, clock-out, hours worked, status
- Grouped employee view with days present, total hours, and attendance percentage
- Clickable employee cards with full attendance history in a slide-up modal
- Date range filtering with quick presets: This Month, Last Month, 3 Months, 6 Months

### 📊 Monthly Hours & Analytics
- Expected vs actual hours per employee per month
- Shift-aware expected hours: Morning (8h), Afternoon (8h), Day (10h), Night (12h)
- Work schedule awareness: Mon–Fri and Mon–Sat employees calculated separately
- Visual hours bar showing percentage of expected hours worked

### 🗓️ Holiday Management
- HR team logs public holidays through the dashboard
- Holidays are automatically excluded from expected working day calculations
- Employees are never penalized for company-declared non-working days

### 🏥 Leave Management
- Supports Annual, Sick, Maternity, Paternity, Bereavement, and Unpaid leave
- Paid leaves (all except Unpaid) count as present and are excluded from expected days
- Unpaid leaves are excluded from expected days but do not count as present
- Leave approval workflow built in

### 📁 Excel Export
- One-click export to professionally formatted `.xlsx` reports
- Color-coded attendance status: Excellent, Good, Poor
- Conditional formatting on attendance % and hours % columns
- Department breakdown sheets auto-generated in the same workbook
- Export the entire organization, a single department, or a single employee
- Supports monthly, date range, and full-year export modes

### 🔐 Secure Access
- JWT-based authentication for admin portal
- Session expiry with automatic redirect to login
- No third-party cloud — your employee data stays on your infrastructure

---

## Time & Resource Savings

| Task | Before BioLogix | With BioLogix |
|---|---|---|
| Monthly attendance compilation | 4–6 hours manually | Instant — one export |
| Identifying absent employees | Manual cross-referencing | Automatic with status flags |
| Department-level reporting | Custom spreadsheet per dept | Auto-generated in export |
| Holiday deductions | Manual calculation per employee | Automatic |
| Accessing data remotely | Only on one desktop machine | Any device, any browser |
| Per-employee report | Hours of filtering | One click from employee modal |
| Software licensing | Recurring ZKTeco license fee | Zero — self-hosted |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Authentication | JWT (python-jose) |
| File Parsing | Custom binary DAT parser |
| Export Engine | openpyxl |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Deployment | Vercel (frontend) + Render (backend) |

---

## How It Works

```
ZKTeco Machine
     │
     ▼
  .DAT File (binary / text log)
     │
     ▼
BioLogix Import API
  ├── Parses employee records (user.dat)
  └── Parses attendance logs (clock_in.dat / clock_out.dat)
     │
     ▼
PostgreSQL Database
  ├── employees
  ├── attendance_logs
  ├── departments
  ├── holidays
  └── leaves
     │
     ▼
React Dashboard
  ├── Employee Management
  ├── Attendance View
  ├── Monthly Hours
  ├── Leave Management
  ├── Holiday Management
  └── Excel Export
```

---

## Outcomes

- **HR teams reclaim hours every month** previously lost to manual attendance compilation
- **Zero tolerance for data errors** — attendance is read directly from the machine, not typed in
- **Fair attendance calculation** — holidays and approved leaves never unfairly penalize employees
- **Management visibility** — department heads can see attendance rates, hours worked, and status at a glance
- **Portable** — works on any device with a browser, not locked to a single office computer
- **Cost elimination** — no recurring software licensing fees, fully self-hosted
- **Audit-ready exports** — professionally formatted Excel reports ready for payroll or HR review at any time

---

## Getting Started

### Backend
```bash
# Clone the repo
git clone https://github.com/your-org/biologix.git
cd biologix/backend

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Fill in DATABASE_URL, SECRET_KEY

# Run
uvicorn app.main:app --reload
```

### Frontend
```bash
cd biologix/frontend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Fill in VITE_API_BASE_URL

# Run
npm run dev
```

### Vercel Deployment
Add a `vercel.json` to the frontend root:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## Built By

BioLogix was designed and built by two developers who saw a real problem in their organization and decided to solve it properly — not with a workaround, but with a production-grade system built from the ground up.

---

*© 2026 BioLogix. Built with precision.*
