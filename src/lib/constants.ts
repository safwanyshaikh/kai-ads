/**
 * Centralized constants. No magic strings/numbers scattered across the app.
 */

export const APP_ROUTES = {
  home: "/",
  register: "/register",
  pendingApproval: "/pending-approval",
  login: "/login",
  loginVerify: "/login/verify",
  join: "/join",
  dashboard: "/dashboard",
  dashboardAgency: "/dashboard/agency",
  dashboardEmployees: "/dashboard/employees",
  adminAgencies: "/admin/agencies",
} as const;

export const API_ROUTES = {
  auth: "/api/auth",
  agencies: "/api/agencies",
  agencyApprove: (id: string) => `/api/agencies/${id}/approve`,
  agencyReject: (id: string) => `/api/agencies/${id}/reject`,
  agencySuspend: (id: string) => `/api/agencies/${id}/suspend`,
  agencyActivate: (id: string) => `/api/agencies/${id}/activate`,
  joinRequests: "/api/join-requests",
  joinRequestApprove: (id: string) => `/api/join-requests/${id}/approve`,
  joinRequestReject: (id: string) => `/api/join-requests/${id}/reject`,
  employees: "/api/employees",
} as const;

export const AUDIT_ACTIONS = {
  agencyRegistered: "agency.registered",
  agencyApproved: "agency.approved",
  agencyRejected: "agency.rejected",
  agencySuspended: "agency.suspended",
  agencyActivated: "agency.activated",
  joinRequestCreated: "join_request.created",
  joinRequestApproved: "join_request.approved",
  joinRequestRejected: "join_request.rejected",
  userSignedIn: "user.signed_in",
} as const;

export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

export const SESSION_COOKIE_NAME = "kai_ads.session";
