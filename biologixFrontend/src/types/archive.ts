export interface ArchivedEmployeeSummary {
  id: number;
  original_user_id: number;
  badge_number: string;
  name: string;
  position: string;
  department_name: string;
  archived_at: string;
  archived_by: string;
  retention_days: number;
  purge_after: string;
  log_count: number;
}

export interface ArchivedAttendanceLog {
  id: number;
  timestamp: string;
  type: "clock_in" | "clock_out";
}

export interface ArchivedEmployeeResponse extends Omit<ArchivedEmployeeSummary, "log_count"> {
  logs: ArchivedAttendanceLog[];
}