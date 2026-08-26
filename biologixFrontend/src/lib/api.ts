const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";




function getToken(): string | null {
  return localStorage.getItem('biologix_token');
}

function clearAuth() {
  localStorage.removeItem('biologix_token');
  localStorage.removeItem('biologix_role');
  localStorage.removeItem('biologix_name');
  localStorage.removeItem('biologix_email');
  localStorage.removeItem('biologix_is_superuser');
  window.location.href = '/login';
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 403) {
  const err = await res.json().catch(() => ({ detail: 'Forbidden' }));
  
  // Only log out if it's genuinely a session/auth issue
  if (
    err.detail?.toLowerCase().includes("expired") ||
    err.detail?.toLowerCase().includes("invalid") ||
    err.detail?.toLowerCase().includes("no longer exists")
  ) {
    clearAuth();
    throw new Error('Session expired');
  }

  // Otherwise it's a permissions issue — throw so the component can toast it
  throw new Error(err.detail || "You don't have permission to perform this action");
}

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }

  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json();
  }

  return res as unknown as T;
}

// Auth
export async function login(email: string, password: string) {
  const data = await request<{
    token    : string;
    user_id  : number;
    full_name: string;
    email    : string;
    role     : string;
    status   : string;
    is_superuser: boolean;
  }>('/admin/login', {
    method: 'POST',
    body  : JSON.stringify({ email, password }),
  });

  localStorage.setItem('biologix_token', data.token);
  localStorage.setItem('biologix_role',  data.role);
  localStorage.setItem('biologix_name',  data.full_name);
  localStorage.setItem('biologix_email', data.email);
  localStorage.setItem('biologix_is_superuser', String(data.is_superuser));


  return data;
}

export async function getImportStatus(jobId: string) {
  const res = await fetch(`${API_BASE}/import/status/${jobId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}



// ── Admin user management ─────────────────────────────────────────────────────
export async function getAdminUsers() {
  return request<any[]>("/admin/users");
}

export async function approveUser(userId: number, role: string) {
  return request<any>(`/admin/users/${userId}/approve`, {
    method: "PATCH",
    body  : JSON.stringify({ role }),
  });
}

export async function changeUserRole(userId: number, role: string) {
  return request<any>(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body  : JSON.stringify({ role }),
  });
}

export async function suspendUser(userId: number) {
  return request<any>(`/admin/users/${userId}/suspend`, { method: "PATCH" });
}

export async function reactivateUser(userId: number) {
  return request<any>(`/admin/users/${userId}/reactivate`, { method: "PATCH" });
}

// DB Admin
// DB Admin
export async function getDbStats() {
  return request<{
    total_size: string;
    tables: { table_name: string; row_count: number; total_size: string; size_bytes: number }[];
  }>('/db-admin/stats');
}

export async function previewAttendancePurge(dateFrom: string, dateTo: string) {
  return request<{ count: number; date_from: string; date_to: string }>(
    `/db-admin/purge/attendance/preview?date_from=${dateFrom}&date_to=${dateTo}`
  );
}

export async function purgeAttendance(dateFrom: string, dateTo: string) {
  return request<{ deleted: number; date_from: string; date_to: string }>(
    `/db-admin/purge/attendance?date_from=${dateFrom}&date_to=${dateTo}`,
    { method: 'DELETE' }
  );
}



// Employees
export async function getEmployees() {
  return request<any[]>('/employees/');
}

export async function updateEmployee(userId: string | number, data: Record<string, any>) {
  return request<any>(`/employees/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function bulkUpdateDepartment(userIds: string[], departmentId: string) {
  return request<any>('/employees/bulk/department', {
    method: 'PATCH',
    body: JSON.stringify({
      user_ids     : userIds.map(id => parseInt(id)),
      department_id: parseInt(departmentId),
    }),
  });
}

export async function deleteEmployee(badgeNumber: string, retentionDays: number = 30) {
  return request<any>(`/employees/${badgeNumber}?retention_days=${retentionDays}`, {
    method: 'DELETE',
  });
}

// Archive
export async function getArchivedEmployees() {
  return request<any[]>('/archive/');
}

export async function getArchivedEmployeeDetail(archiveId: number) {
  return request<any>(`/archive/${archiveId}`);
}

export async function triggerManualPurge() {
  return request<any>('/archive/purge', { method: 'DELETE' });
}

// Departments
export async function getDepartments() {
  return request<any[]>('/departments/');
}

export async function createDepartment(data: { name: string; is_reportable: boolean }) {
  return request<any>('/departments/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDepartment(id: string, data: Record<string, any>) {
  return request<any>(`/departments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteDepartment(id: string) {
  return request<any>(`/departments/${id}`, { method: 'DELETE' });
}

// Attendance
export async function getAttendanceSummary(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return request<any[]>(`/attendance/summary?${query}`);
}

export async function getMonthlyHours(month: number, year: number) {
  return request<any[]>(`/attendance/monthly-hours?month=${month}&year=${year}`);
}

// Holidays
export async function getHolidays() {
  return request<any[]>('/holidays/');
}

export async function createHoliday(data: { name: string; date: string }) {
  return request<any>('/holidays/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteHoliday(id: number) {
  return request<any>(`/holidays/${id}`, { method: 'DELETE' });
}

// Import
export async function importUsers(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<any>('/import/users', {
    method: 'POST',
    body: formData,
  });
}

export async function importAttendance(file: File, type: "clock_in" | "clock_out") {
  const formData = new FormData();
  formData.append('file', file);
  return request<any>(`/import/attendance?type=${type}`, {
    method: 'POST',
    body: formData,
  });
}

// DB Admin — backup
export async function getBackupHistory() {
  return request<{ id: number; filename: string; size_bytes: number; created_at: string }[]>(
    '/db-admin/backup/history'
  );
}

export async function downloadBackup(): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/db-admin/backup/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to download backup');

  const disposition = res.headers.get('content-disposition');
  const match = disposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const filename = match ? match[1].replace(/['"]/g, "") : `biologix_backup_${Date.now()}.dump`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadHistoricalBackup(backupId: number, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/db-admin/backup/${backupId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to download backup');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Import history
export async function getImportHistory() {
  return request<{
    id: number;
    import_type: string;
    original_filename: string;
    inserted: number;
    skipped: number;
    errors: number;
    imported_by: string;
    imported_at: string;
  }[]>('/import/history');
}

export async function downloadImportFile(importId: number, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/import/${importId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Download failed' }));
    throw new Error(err.detail || 'Download failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


export async function deleteAdminUser(userId: number) {
  return request<any>(`/admin/users/${userId}`, { method: "DELETE" });
}


// Export
export async function exportAttendance(
  params: Record<string, string | number>,
  filename?: string
): Promise<void> {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  ).toString();

  const token = getToken();
  const res = await fetch(`${API_BASE}/export/attendance?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

 if (res.status === 403) {
  const err = await res.json().catch(() => ({ detail: 'Forbidden' }));
  if (
    err.detail?.toLowerCase().includes("expired") ||
    err.detail?.toLowerCase().includes("invalid") ||
    err.detail?.toLowerCase().includes("no longer exists")
  ) {
    clearAuth();
    throw new Error('Session expired');
  }
  throw new Error(err.detail || "You don't have permission to export data");
}

  const blob = await res.blob();

  const disposition = res.headers.get('content-disposition');
  let downloadName = filename;
  if (!downloadName) {
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      downloadName = match ? match[1].replace(/['"]/g, "") : undefined;
    }
    if (!downloadName) {
      const suffix = params.user_id ? `_employee_${params.user_id}` : "";
      downloadName = `attendance${suffix}_${params.date_from ?? ""}_${params.date_to ?? ""}.xlsx`;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { getToken, clearAuth };