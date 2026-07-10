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
  adminAgencies: "/admin/agencies",
  advertisements: "/dashboard/advertisements",
  advertisementNew: "/dashboard/advertisements/new",
  advertisementDraft: (draftId: string) => `/dashboard/advertisements/drafts/${draftId}`,
  advertisementDetail: (id: string) => `/dashboard/advertisements/${id}`,
} as const;

export const API_ROUTES = {
  agencies: "/api/agencies",
  agencyApprove: (id: string) => `/api/agencies/${id}/approve`,
  agencyReject: (id: string) => `/api/agencies/${id}/reject`,
  agencySuspend: (id: string) => `/api/agencies/${id}/suspend`,
  agencyActivate: (id: string) => `/api/agencies/${id}/activate`,
  joinRequests: "/api/join-requests",
  joinRequestApprove: (id: string) => `/api/join-requests/${id}/approve`,
  joinRequestReject: (id: string) => `/api/join-requests/${id}/reject`,
  employees: "/api/employees",
  uploadLogo: "/api/uploads/logo",
  advertisements: "/api/advertisements",
  advertisement: (id: string) => `/api/advertisements/${id}`,
  advertisementStatus: (id: string) => `/api/advertisements/${id}/status`,
  advertisementDuplicate: (id: string) => `/api/advertisements/${id}/duplicate`,
  advertisementArchive: (id: string) => `/api/advertisements/${id}/archive`,
  advertisementRestore: (id: string) => `/api/advertisements/${id}/restore`,
  advertisementDelete: (id: string) => `/api/advertisements/${id}/delete`,
  advertisementVersions: (id: string) => `/api/advertisements/${id}/versions`,
  advertisementHistory: (id: string) => `/api/advertisements/${id}/history`,
  advertisementDrafts: "/api/advertisement-drafts",
  advertisementDraft: (id: string) => `/api/advertisement-drafts/${id}`,
  advertisementDraftExtract: (id: string) => `/api/advertisement-drafts/${id}/extract`,
  advertisementDraftReview: (id: string) => `/api/advertisement-drafts/${id}/review`,
  advertisementDraftStyle: (id: string) => `/api/advertisement-drafts/${id}/style`,
  advertisementDraftSave: (id: string) => `/api/advertisement-drafts/${id}/save`,
  advertisementDraftDiscard: (id: string) => `/api/advertisement-drafts/${id}/discard`,
  uploadAdvertisementSource: "/api/uploads/advertisement-source",
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
  advertisementCreated: "advertisement.created",
  advertisementUpdated: "advertisement.updated",
  advertisementStatusChanged: "advertisement.status_changed",
  advertisementDuplicated: "advertisement.duplicated",
  advertisementArchived: "advertisement.archived",
  advertisementRestored: "advertisement.restored",
  advertisementDeleted: "advertisement.deleted",
  advertisementUndeleted: "advertisement.undeleted",
  advertisementDraftCreated: "advertisement_draft.created",
  advertisementDraftReviewed: "advertisement_draft.reviewed",
  advertisementDraftStyleSelected: "advertisement_draft.style_selected",
  advertisementDraftSaved: "advertisement_draft.saved",
  advertisementDraftDiscarded: "advertisement_draft.discarded",
} as const;

export const RATE_LIMITS = {
  agencyRegistration: { limit: 5, windowSeconds: 60 * 60 },
  joinRequest: { limit: 10, windowSeconds: 60 * 60 },
  logoUpload: { limit: 10, windowSeconds: 60 * 60 },
  advertisementCreate: { limit: 60, windowSeconds: 60 * 60 },
  advertisementDraftCreate: { limit: 60, windowSeconds: 60 * 60 },
  advertisementSourceUpload: { limit: 60, windowSeconds: 60 * 60 },
} as const;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
