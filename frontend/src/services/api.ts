import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ── API helpers ───────────────────────────────────────────────────────────────

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; details?: Array<{ message: string }> };
    if (data?.details?.length) return data.details[0].message;
    return data?.error ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  getProfile: () => api.get('/auth/profile').then(r => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then(r => r.data),
  createUser: (data: unknown) => api.post('/auth/users', data).then(r => r.data),
};

// Customers
export const customerApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/customers', { params }).then(r => r.data),
  get: (id: string) => api.get(`/customers/${id}`).then(r => r.data),
  create: (data: unknown) => api.post('/customers', data).then(r => r.data),
  update: (id: string, data: unknown) => api.patch(`/customers/${id}`, data).then(r => r.data),
  updateKyc: (id: string, data: unknown) =>
    api.patch(`/customers/${id}/kyc`, data).then(r => r.data),
  uploadDocument: (customerId: string, type: string, file: File) => {
    const form = new FormData();
    form.append('document', file);
    form.append('type', type);
    return api.post(`/documents/customers/${customerId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  getDocument: (documentId: string) =>
    `${API_URL}/api/documents/${documentId}`,
  getRepayments: (customerId: string) =>
    api.get(`/customers/${customerId}/repayments`).then(r => r.data),
  getTier: (id: string) =>
    api.get(`/customers/${id}/tier`).then(r => r.data),
};

// Credit Scoring
export const scoringApi = {
  run: (customerId: string, data: unknown) =>
    api.post(`/scoring/customers/${customerId}`, data).then(r => r.data),
  getHistory: (customerId: string) =>
    api.get(`/scoring/customers/${customerId}`).then(r => r.data),
};

// Loans
export const loanApi = {
  stats: () => api.get('/loans/stats').then(r => r.data),
  apply: (data: unknown) => api.post('/loans/applications', data).then(r => r.data),
  listApplications: (params?: Record<string, string | number>) =>
    api.get('/loans/applications', { params }).then(r => r.data),
  getApplication: (id: string) =>
    api.get(`/loans/applications/${id}`).then(r => r.data),
  reviewApplication: (id: string, data: unknown) =>
    api.patch(`/loans/applications/${id}/review`, data).then(r => r.data),
  disburse: (id: string, data: unknown) =>
    api.post(`/loans/applications/${id}/disburse`, data).then(r => r.data),
  getLoan: (id: string) => api.get(`/loans/${id}`).then(r => r.data),
  recordRepayment: (loanId: string, data: unknown) =>
    api.post(`/loans/${loanId}/repayments`, data).then(r => r.data),
  portfolio: () => api.get('/loans/portfolio').then(r => r.data),
};

// BCC
export const bccApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/bcc', { params }).then(r => r.data),
  get: (id: string) => api.get(`/bcc/${id}`).then(r => r.data),
  open: (data: unknown) => api.post('/bcc', data).then(r => r.data),
  vote: (id: string, data: unknown) => api.post(`/bcc/${id}/votes`, data).then(r => r.data),
  comment: (id: string, body: string) =>
    api.post(`/bcc/${id}/comments`, { body }).then(r => r.data),
  decide: (id: string, data: unknown) =>
    api.post(`/bcc/${id}/decide`, data).then(r => r.data),
  // Case presentation
  getCasePresentation: (sessionId: string) =>
    api.get(`/bcc/${sessionId}/case`).then(r => r.data),
  updateNarrative: (sessionId: string, data: { loRecommendation?: string; loNarrative?: string }) =>
    api.patch(`/bcc/${sessionId}/narrative`, data).then(r => r.data),
  // Flags
  raiseFlag: (sessionId: string, data: unknown) =>
    api.post(`/bcc/${sessionId}/flags`, data).then(r => r.data),
  resolveFlag: (sessionId: string, flagId: string, data?: { resolvedNote?: string }) =>
    api.patch(`/bcc/${sessionId}/flags/${flagId}/resolve`, data ?? {}).then(r => r.data),
  recordFlagOutcome: (flagId: string, data: { didMaterialize: boolean; materializedNote?: string }) =>
    api.patch(`/bcc/flags/${flagId}/outcome`, data).then(r => r.data),
  // Conditions
  addCondition: (sessionId: string, data: unknown) =>
    api.post(`/bcc/${sessionId}/conditions`, data).then(r => r.data),
  verifyCondition: (sessionId: string, condId: string, data?: { verifiedNote?: string }) =>
    api.patch(`/bcc/${sessionId}/conditions/${condId}/verify`, data ?? {}).then(r => r.data),
  // Analytics
  getFlagAccuracy: (params?: Record<string, string | number>) =>
    api.get('/bcc/analytics/flag-accuracy', { params }).then(r => r.data),
};

// Meetings
export const meetingApi = {
  list: (params?: Record<string, string>) =>
    api.get('/bcc/meetings', { params }).then(r => r.data),
  get: (id: string) => api.get(`/bcc/meetings/${id}`).then(r => r.data),
  create: (data: { title?: string; scheduledAt?: string }) =>
    api.post('/bcc/meetings', data).then(r => r.data),
  activate: (id: string) =>
    api.patch(`/bcc/meetings/${id}/activate`).then(r => r.data),
  addSession: (meetingId: string, data: { loanApplicationId: string; quorumRequired?: number }) =>
    api.post(`/bcc/meetings/${meetingId}/sessions`, data).then(r => r.data),
  reorderAgenda: (meetingId: string, order: Array<{ sessionId: string; agendaIndex: number }>) =>
    api.patch(`/bcc/meetings/${meetingId}/agenda`, { order }).then(r => r.data),
  startPresenting: (sessionId: string) =>
    api.patch(`/bcc/meetings/sessions/${sessionId}/present`).then(r => r.data),
};

// Notifications
export const notificationApi = {
  list: () => api.get('/notifications').then(r => r.data),
  getUnreadCount: () => api.get('/notifications/unread-count').then(r => r.data),
  markRead: (ids: string[]) =>
    api.patch('/notifications/read', { ids }).then(r => r.data),
  markAllRead: () =>
    api.patch('/notifications/read', { all: true }).then(r => r.data),
};

// Quality
export const qualityApi = {
  checkName: (params: { firstName: string; lastName: string; dateOfBirth?: string; excludeCustomerId?: string }) =>
    api.get('/quality/check-name', { params }).then(r => r.data),
  scanCustomer: (id: string) => api.post(`/quality/scan/customer/${id}`).then(r => r.data),
  scanApplication: (id: string) => api.post(`/quality/scan/application/${id}`).then(r => r.data),
  getFlags: (entityType: string, entityId: string) =>
    api.get(`/quality/flags/${entityType}/${entityId}`).then(r => r.data),
  resolveFlag: (flagId: string, resolvedNote?: string) =>
    api.patch(`/quality/flags/${flagId}/resolve`, { resolvedNote }).then(r => r.data),
  report: () => api.get('/quality/report').then(r => r.data),
  branchScan: () => api.post('/quality/scan/branch').then(r => r.data),
};

// Interviews
export const interviewApi = {
  listAll: (params?: Record<string, string | number>) =>
    api.get('/interviews', { params }).then(r => r.data),
  save: (customerId: string, data: unknown) =>
    api.post(`/interviews/${customerId}`, data).then(r => r.data),
  list: (customerId: string) =>
    api.get(`/interviews/${customerId}`).then(r => r.data),
  get: (interviewId: string) =>
    api.get(`/interviews/single/${interviewId}`).then(r => r.data),
  delete: (interviewId: string) =>
    api.delete(`/interviews/single/${interviewId}`),
  // ILP interview endpoints
  saveILP: (customerId: string, segment: string, data: unknown) =>
    api.post(`/interviews/ilp/${customerId}/${segment}`, data).then(r => r.data),
  getILP: (customerId: string, segment: string) =>
    api.get(`/interviews/ilp/${customerId}/${segment}`).then(r => r.data),
};

// Collections
export const collectionsApi = {
  summary: () => api.get('/collections/summary').then(r => r.data),
  arrears: (params?: Record<string, string | number>) =>
    api.get('/collections/arrears', { params }).then(r => r.data),
  getLoan: (loanId: string) => api.get(`/collections/${loanId}`).then(r => r.data),
  logAction: (loanId: string, data: unknown) =>
    api.post(`/collections/${loanId}/actions`, data).then(r => r.data),
};

// Loan Groups
export const groupApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/groups', { params }).then(r => r.data),
  get: (id: string) => api.get(`/groups/${id}`).then(r => r.data),
  create: (data: unknown) => api.post('/groups', data).then(r => r.data),
  update: (id: string, data: unknown) => api.patch(`/groups/${id}`, data).then(r => r.data),
  toggleActive: (id: string) => api.patch(`/groups/${id}/toggle-active`).then(r => r.data),
  addMember: (groupId: string, data: { customerId: string; role?: string }) =>
    api.post(`/groups/${groupId}/members`, data).then(r => r.data),
  removeMember: (groupId: string, memberId: string) =>
    api.delete(`/groups/${groupId}/members/${memberId}`).then(r => r.data),
};

// M-Pesa Statements (scoped to a customer)
export const mpesaApi = {
  list: (customerId: string) =>
    api.get(`/customers/${customerId}/mpesa`).then(r => r.data),
  get: (customerId: string, statementId: string) =>
    api.get(`/customers/${customerId}/mpesa/${statementId}`).then(r => r.data),
  upload: (customerId: string, file: File) => {
    const form = new FormData();
    form.append('statement', file);
    return api.post(`/customers/${customerId}/mpesa`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    }).then(r => r.data);
  },
  retry: (customerId: string, statementId: string) =>
    api.post(`/customers/${customerId}/mpesa/${statementId}/retry`).then(r => r.data),
};

// KPI & Worklist
export const kpiApi = {
  getRiskFlags: (loanId: string) =>
    api.get(`/ilp/risk-flags/${loanId}`).then(r => r.data),
  resolveFlag: (flagId: string, note: string) =>
    api.patch(`/ilp/risk-flags/${flagId}/resolve`, { note }).then(r => r.data),
  getLOWorklist: () =>
    api.get('/lo/worklist').then(r => r.data),
};

// Branches (public list used in forms)
export const branchApi = {
  list: () => api.get('/branches').then(r => r.data),
};

// Admin
export const adminApi = {
  // Users
  listUsers:   (params?: Record<string, string | number | boolean>) =>
    api.get('/admin/users', { params }).then(r => r.data),
  createUser:  (data: unknown) => api.post('/admin/users', data).then(r => r.data),
  updateUser:  (id: string, data: unknown) => api.patch(`/admin/users/${id}`, data).then(r => r.data),
  resetPassword: (id: string) => api.post(`/admin/users/${id}/reset-password`).then(r => r.data),
  toggleUserActive: (id: string) => api.patch(`/admin/users/${id}/toggle-active`).then(r => r.data),

  // Branches
  listBranches:  () => api.get('/admin/branches').then(r => r.data),
  createBranch:  (data: unknown) => api.post('/admin/branches', data).then(r => r.data),
  updateBranch:  (id: string, data: unknown) => api.patch(`/admin/branches/${id}`, data).then(r => r.data),
  toggleBranchActive: (id: string) => api.patch(`/admin/branches/${id}/toggle-active`).then(r => r.data),

  // Activity log
  listActivity: (params?: Record<string, string | number>) =>
    api.get('/admin/activity', { params }).then(r => r.data),

  // LO locations
  getLocations: () => api.get('/admin/locations').then(r => r.data),
  pingLocation: (data: { latitude: number; longitude: number; accuracy?: number; activity?: string }) =>
    api.post('/admin/locations/ping', data).then(r => r.data),

  // M-Pesa analysis monitoring
  listMpesaAnalyses: (params?: Record<string, string | number>) =>
    api.get('/admin/mpesa-analyses', { params }).then(r => r.data),

  // System config (AI prompt tuning)
  getConfig:    (key: string) => api.get(`/admin/config/${key}`).then(r => r.data),
  updateConfig: (key: string, value: string, description?: string) =>
    api.put(`/admin/config/${key}`, { value, description }).then(r => r.data),
  deleteConfig: (key: string) => api.delete(`/admin/config/${key}`).then(r => r.data),
};


// System Config (admin constants)
export const configApi = {
  list: (category?: string) =>
    api.get('/config', { params: category ? { category } : {} }).then(r => r.data),
  update: (key: string, value: string) =>
    api.patch(`/config/${encodeURIComponent(key)}`, { value }).then(r => r.data),
  reset: (key: string) =>
    api.post(`/config/reset/${encodeURIComponent(key)}`).then(r => r.data),
};

// Weather
export const weatherApi = {
  getBranchWeather: (branchId: string) =>
    api.get(`/weather/branches/${branchId}`).then(r => r.data),
  getAllBranchWeather: () =>
    api.get('/weather/branches').then(r => r.data),
};

// ILP (Individual Loan Product) API
export const ilpApi = {
  getBranchEligibility: (branchId: string) =>
    api.get(`/ilp/branch-eligibility/${branchId}`).then(r => r.data),
  grantEligibility: (branchId: string, data: { segment: string; notes?: string }) =>
    api.post(`/ilp/branch-eligibility/${branchId}/grant`, data).then(r => r.data),
  updateStatus: (branchId: string, data: { segment: string; status: string; notes?: string }) =>
    api.patch(`/ilp/branch-eligibility/${branchId}`, data).then(r => r.data),
  saveAssessment: (applicationId: string, data: unknown) =>
    api.post(`/ilp/assessment/${applicationId}`, data).then(r => r.data),
  getAssessment: (applicationId: string) =>
    api.get(`/ilp/assessment/${applicationId}`).then(r => r.data),
  getFollowUps: (loanId: string) =>
    api.get(`/ilp/follow-up/${loanId}`).then(r => r.data),
  completeFollowUp: (followUpId: string, data: { visitNotes?: string; riskFlags?: string[] }) =>
    api.patch(`/ilp/follow-up/${followUpId}/complete`, data).then(r => r.data),
};
