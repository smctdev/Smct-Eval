import { api, sanctum } from "./api";
import { pickApiTimestamp } from "@/lib/parseApiTimestamp";

/** Ask API for stable name order so OFFSET pagination does not overlap pages (backend may ignore). */
const USER_LIST_SORT_PARAMS = {
  sort: "lname",
  direction: "asc",
} as const;
import { EvaluationPayload } from "../components/evaluation/types";
import type { EvaluationResubmitType } from "@/lib/evaluationEditTypes";
import type { EvaluationSubmissionRecord } from "@/lib/evaluationSubmissionRecord";
import { asEvaluationSubmissionRecord } from "@/lib/evaluationSubmissionRecord";
import { normalizeMyEvalAsEmployeeResponse } from "@/lib/employeeEvalListResponse";
import { normalizePendingApprovalEvaluationsResponse } from "@/lib/evaluatorEvalListResponse";

export type ResubmitEvaluationType = EvaluationResubmitType;

function isAxiosNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

function toApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof data === "string" && data.trim() !== "") {
      return data.trim();
    }
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const message = record.message ?? record.error;
      if (typeof message === "string" && message.trim() !== "") {
        return message.trim();
      }
    }
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message.trim();
  }
  return fallback;
}

// Helper function to get CSRF cookie from Sanctum
export const sanctum_csrf = async () => {
  try {
    await sanctum.get("/sanctum/csrf-cookie");
  } catch (error) {
    console.error("Failed to get CSRF cookie:", error);
    throw error;
  }
};

export const apiService = {
  // Authentication
  login: async (email: string, password: string): Promise<any> => {
    await sanctum_csrf();
    const response = await api.post("/login", { email, password });
    return response.data;
  },

  sendPasswordResetOtp: async (email: string): Promise<any> => {
    const response = await api.post("/forgot-password/send-otp", { email });
    return response.data;
  },

  verifyPasswordResetOtp: async (email: string, otp: string): Promise<any> => {
    await sanctum_csrf();
    const response = await api.post("/forgot-password/verify-otp", {
      email,
      otp,
    });
    return response.data;
  },

  requestPasswordReset: async (
    email: string,
    payload?: { verificationToken?: string; otp?: string }
  ): Promise<any> => {
    const response = await api.post("/forgot-password", {
      email,
      ...(payload?.verificationToken
        ? { verification_token: payload.verificationToken }
        : {}),
      ...(payload?.otp ? { otp: payload.otp } : {}),
    });
    return response.data;
  },

  logout: async (): Promise<any> => {
    const response = await api.post("/logout");
    return response.data;
  },

  // Get current authenticated user
  authUser: async (): Promise<any> => {
    const response = await api.get("/profile");
    return response.data;
  },

  // Registration
  createPendingRegistration: async (formData: FormData): Promise<any> => {
    const response = await api.post("/register", formData);
    return response.data;
  },

  updateEmployee_auth: async (formData: FormData): Promise<any> => {
    const response = await api.post("/updateProfileUserAuth", formData);
    return response.data;
  },

  requestSignatureReset: async (): Promise<any> => {
    const response = await api.post("/requestSignatureReset");
    return response.data;
  },

  getSignatureResetRequests: async (searchTerm: string): Promise<any> => {
    const response = await api.get("/getAllSignatureReset", {
      params: {
        searchTerm: searchTerm || "",
      },
    });
    return response.data.users;
  },

  approveSignatureReset: async (userId: number | string): Promise<any> => {
    const response = await api.post(`/approvedSignatureReset/${userId}`);
    return response.data;
  },

  rejectSignatureReset: async (userId: number | string): Promise<any> => {
    const response = await api.post(`/rejectSignatureReset/${userId}`);
    return response.data;
  },

  updateEmployee: async (
    formData: FormData,
    id: string | number
  ): Promise<any> => {
    const response = await api.post(`/updateUser/${id}`, formData);
    return response.data;
  },

  approveRegistration: async (id: string | number): Promise<any> => {
    const response = await api.post(`/approveRegistration/${id}`);
    return response.data;
  },

  rejectRegistration: async (id: string | number): Promise<any> => {
    const response = await api.post(`/rejectRegistration/${id}`);
    return response.data;
  },

  deleteUser: async (id: string | number): Promise<any> => {
    const response = await api.post(`/deleteUser/${id}`);
    return response.data;
  },

  getPendingRegistrations: async (
    searchTerm: string,
    status: string | number,
    page: number,
    perPage: number
  ): Promise<any | null> => {
    const response = await api.get("/getPendingRegistrations", {
      params: {
        search: searchTerm || "",
        status: status || "",
        page: page,
        per_page: perPage,
        ...USER_LIST_SORT_PARAMS,
      },
    });
    return response.data.users || [];
  },

  getActiveRegistrations: async (
    searchTerm: string,
    role: string | number,
    page: number,
    perPage: number,
    branch?: string,
    department?: string
  ): Promise<any | null> => {
    const response = await api.get("/getAllActiveUsers", {
      params: {
        search: searchTerm || "",
        role: role || "",
        page: page,
        per_page: perPage,
        branch: branch || "",
        department: department || "",
        ...USER_LIST_SORT_PARAMS,
      },
    });
    return response.data.users || [];
  },

  getDepartments: async (): Promise<{ label: string; value: string }[]> => {
    const response = await api.get("/departments");
    return response.data.departments.map((departments: any) => ({
      value: departments.id,
      label: departments.department_name,
    }));
  },

  getPositions: async (): Promise<
    {
      label: string;
      value: string;
      created_at?: string | null;
      updated_at?: string | null;
    }[]
  > => {
    const response = await api.get("/positions");
    const payload = response.data;
    const list = Array.isArray(payload?.positions)
      ? payload.positions
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

    return list.map((position: Record<string, unknown>) => ({
      value: String(position.id ?? position.value ?? ""),
      label: String(position.label ?? position.name ?? ""),
      created_at: pickApiTimestamp(position, [
        "created_at",
        "createdAt",
        "created",
      ]),
      updated_at: pickApiTimestamp(position, [
        "updated_at",
        "updatedAt",
        "updated",
      ]),
    }));
  },

  // Add new position (HR/management maintenance)
  addPosition: async (label: string): Promise<any> => {
    const response = await api.post("/addPosition", {
      label,
    });
    return response.data;
  },

  // Update position by id (HR/management maintenance)
  updatePosition: async (
    positionId: string | number,
    label: string
  ): Promise<any> => {
    const response = await api.post(`/updatePosition/${positionId}`, {
      label,
    });
    return response.data;
  },

  // Delete position by id (HR/management maintenance)
  deletePosition: async (positionId: string | number): Promise<any> => {
    const response = await api.post(`/deletePosition/${positionId}`);
    return response.data;
  },

  getBranches: async (): Promise<{ label: string; value: string }[]> => {
    const response = await api.get("/branches");
    return response.data.branches.map((branches: any) => ({
      value: branches.id,
      label: branches.branch_name + " /" + branches.branch_code,
    }));
  },

  /** `branch` may be a comma-separated list of branch ids when filtering by multiple branches. */
  getSubmissions: async (
    searchTerm?: string,
    page?: number,
    perPage?: number,
    status?: string,
    quarter?: string,
    year?: string,
    rating?: string,
    branch?: string
  ): Promise<any> => {
    const response = await api.get(`/allEvaluations`, {
      params: {
        search: searchTerm || "",
        page: page,
        per_page: perPage,
        status: status || "",
        quarter: quarter || "",
        year: year || "",
        rating: rating || "",
        branch: branch || "",
      },
    });

    return response.data.evaluations;
  },

  getSubmissionById: async (
    id: number | string
  ): Promise<EvaluationSubmissionRecord | null> => {
    try {
      const response = await api.get(`/submissions/${id}`);
      return asEvaluationSubmissionRecord(response.data.user_eval);
    } catch (error) {
      // 404 is expected when a list row points at a deleted/missing evaluation.
      // Return null so callers show the dialog without Next.js surfacing an Axios throw.
      if (isAxiosNotFound(error)) {
        return null;
      }
      throw new Error(
        toApiErrorMessage(error, "Failed to load evaluation details.")
      );
    }
  },

  getQuarters: async (id: number | string): Promise<any> => {
    const response = await api.get(`/getQuarters/${id}`);
    return response.data.data;
  },

  getAllYears: async (): Promise<any> => {
    const response = await api.get(`getAllYears`);
    return response.data.years;
  },

  adminDashboard: async (): Promise<any> => {
    const response = await api.get(`/adminDashboard`);
    return response.data;
  },

  createSubmission: async (
    employeeId: number | string,
    submission: EvaluationPayload
  ): Promise<any> => {
    const response = await api.post(`/submit/${employeeId}`, submission);
    return response.data;
  },

  updateSubmission: async (id: number, updates: any): Promise<any> => {
    const response = await api.put(`/submissions/${id}`, updates);
    return response.data;
  },

  deleteSubmission: async (
    id: number
  ): Promise<{ success: boolean; message: string }> => {
    const delete_eval = await api.post(`/deleteEval/${id}`);
    return delete_eval.data;
  },

  approvedByEmployee: async (evaluationId: number): Promise<any> => {
    const response = await api.post(`/approvedByEmployee/${evaluationId}`);
    return response.data;
  },

  /** Evaluator accepts a draft evaluation (moves it into the review workflow). */
  acceptDraftEvaluation: async (
    evaluationId: number | string
  ): Promise<any> => {
    const response = await api.post(
      `/acceptDraftEvaluation/${evaluationId}`
    );
    return response.data;
  },

  /** Evaluator rejects a draft evaluation. */
  rejectDraftEvaluation: async (
    evaluationId: number | string,
    note: string
  ): Promise<any> => {
    const response = await api.post(
      `/rejectDraftEvaluation/${evaluationId}`,
      { note: note.trim() }
    );
    return response.data;
  },

  /** Assigned approver accepts an evaluation in the approval workflow. */
  acceptApprovalEvaluation: async (
    evaluationId: number | string
  ): Promise<any> => {
    const response = await api.post(
      `/acceptApprovalEvaluation/${evaluationId}`
    );
    return response.data;
  },

  /** Assigned approver rejects an evaluation in the approval workflow. */
  rejectApprovalEvaluation: async (
    evaluationId: number | string,
    note: string
  ): Promise<any> => {
    const response = await api.post(
      `/rejectApprovalEvaluation/${evaluationId}`,
      { note: note.trim() }
    );
    return response.data;
  },

  markNotificationAsRead: async (
    notificationId: string | number
  ): Promise<void> => {
    await api.post(`/isReadNotification/${notificationId}`);
  },

  markAllNotificationsAsRead: async (): Promise<void> => {
    await api.post("/markAllAsRead");
  },

  deleteNotification: async (
    notificationId: string | number
  ): Promise<void> => {
    await api.post(`/deleteNotification/${notificationId}`);
  },

  // ============================================
  // USER MANAGEMENT (Missing Endpoints)
  // ============================================

  // Get all users (except authenticated user)
  getAllUsers: async (): Promise<any[]> => {
    const response = await api.get("/getAllUsers");
    const data = response.data;

    if (data.success && data.users) {
      return data.users;
    }
    if (Array.isArray(data.users)) {
      return data.users;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  },

  // Get all branch heads/supervisors
  getAllBranchHeads: async (): Promise<any[]> => {
    const response = await api.get("/getAllBranchHeads");
    const data = response.data.branch_heads;

    if (data.success && data.users) {
      return data.users;
    }
    if (Array.isArray(data.users)) {
      return data.users;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  },

  // Get all area managers
  getAllAreaManager: async (): Promise<any> => {
    const response = await api.get("/getAllAreaManager");
    return response.data.branch_heads;
  },

  // Get all employees under authenticated user
  getAllEmployeeByAuth: async (
    search?: string,
    per_page?: number,
    page?: number,
    position_filter?: number
  ): Promise<any> => {
    const response = await api.get("/getAllEmployeeByAuth", {
      params: {
        search: search || "",
        per_page: per_page || 10,
        page: page || 1,
        position_filter: position_filter || "",
        ...USER_LIST_SORT_PARAMS,
      },
    });
    const data = response.data;
    return data.employees;
  },

  // Get specific user
  showUser: async (userId: string | number): Promise<any> => {
    const response = await api.get(`/showUser/${userId}`);
    const data = response.data;

    if (data.success && data.user) {
      return data.user;
    }
    if (data.user) {
      return data.user;
    }
    return data;
  },

  // Add new user
  addUser: async (formData: FormData): Promise<any> => {
    const response = await api.post("/addUser", formData);
    return response.data;
  },

  /**
   * Record a memorandum violation. Uses `FormData` fields:
   * id (target user), violation_date, title, offense, optional sanction.
   */
  addMemorandumViolation: async (
    formData: FormData
  ): Promise<any> => {
    const response = await api.post("/addMemorandumViolation", formData);
    return response.data;
  },

  /**
   * Update an existing memorandum violation (HR / authorized).
   * POST `updateMemorandumViolation/{id}` — JSON body (backend contract):
   * violation_date, title, offense, sanction.
   */
  updateMemorandumViolation: async (params: {
    id: string | number;
    title: string;
    violation_date: string;
    offense: string;
    sanction?: string;
  }): Promise<any> => {
    const routeId = encodeURIComponent(String(params.id));
    const offense = params.offense.trim();
    const sanction = (params.sanction ?? "").trim();
    const response = await api.post(
      `/updateMemorandumViolation/${routeId}`,
      {
        violation_date: params.violation_date,
        title: params.title.trim(),
        offense,
        sanction,
      }
    );
    return response.data;
  },

  /**
   * Delete an existing memorandum violation (HR / authorized).
   * POST `deleteMemorandumViolation/{id}`
   */
  deleteMemorandumViolation: async (
    id: string | number
  ): Promise<any> => {
    const routeId = encodeURIComponent(String(id));
    const response = await api.post(`/deleteMemorandumViolation/${routeId}`);
    return response.data;
  },

  /*
   * Logged-in employee: list memorandum violations recorded against them.
   * Query: search (title etc.), month (YYYY-MM, optional), page, per_page.
   * Backend should return a Laravel-style paginator or { data: [], total, ... }.
   */
  getMyMemorandumViolations: async (params: {
    search?: string;
    month?: string;
    page?: number;
    per_page?: number;
  }): Promise<any> => {
    const response = await api.get("/myMemorandumViolations", {
      params: {
        search: params.search?.trim() ?? "",
        month: params.month?.trim() ?? "",
        page: params.page ?? 1,
        per_page: params.per_page ?? 10,
      },
    });
    return response.data;
  },

  /**
   * HR (or authorized role): list memorandum violations for a specific user.
   * Backend: GET /showUserMemorandumViolation/{userId}
   */
  getUserMemorandumViolations: async (
    userId: string | number
  ): Promise<any> => {
    const response = await api.get(
      `/showUserMemorandumViolation/${encodeURIComponent(String(userId))}`
    );
    return response.data;
  },

  /**
   * HR: paginated memorandum violations across employees.
   * GET `/memorandumViolationsths` — query: search, per_page, month, year.
   */
  getMemorandumViolations: async (params: {
    search?: string;
    per_page?: number;
    month?: string | number;
    year?: string | number;
    page?: number;
  }): Promise<any> => {
    const pageNum = params.page != null ? Number(params.page) : NaN;
    const response = await api.get("/memorandumViolations", {
      params: {
        search: params.search?.trim() ?? "",
        per_page: params.per_page ?? 50,
        month:
          params.month === undefined || params.month === ""
            ? ""
            : String(params.month),
        year:
          params.year === undefined || params.year === ""
            ? ""
            : String(params.year),
        ...(Number.isFinite(pageNum) && pageNum >= 1 ? { page: pageNum } : {}),
      },
    });
    return response.data;
  },

  // Bulk register users (Excel/CSV upload)
  bulkRegisterUser: async (payload: Record<string, any>): Promise<any> => {
    const response = await api.post("/bulkRegisterUser", payload);
    return response.data;
  },

  // Update branches for specific user
  updateUserBranch: async (
    userId: string | number,
    formData: FormData
  ): Promise<any> => {
    const response = await api.post(`/updateUserBranch/${userId}`, formData);
    return response.data;
  },

  // Remove all assigned branches for specific user
  removeUserBranches: async (userId: string | number): Promise<any> => {
    const response = await api.post(`/removeUserBranches/${userId}`);
    return response.data;
  },

  // Get total employees under a branch
  getTotalEmployeesBranch: async (
    searchValue: string,
    currentPage: number,
    itemsPerPage: number
  ): Promise<any> => {
    const response = await api.get("/getTotalEmployeesBranch", {
      params: {
        search: searchValue || "",
        page: currentPage,
        per_page: itemsPerPage,
      },
    });
    return response.data.branches;
  },

  // Get subordinates by branch or department
  getSubordinate: async (params: {
    branch_id?: number | string;
    department_id?: number | string;
    page?: number;
    per_page?: number;
  }): Promise<any> => {
    const response = await api.get("/getSubordinate", {
      params: {
        branch_id: params.branch_id ?? "",
        department_id: params.department_id ?? "",
        page: params.page ?? 1,
        per_page: params.per_page ?? 300,
      },
    });
    return response.data;
  },

  getAllEvaluators: async (params?: {
    page?: number;
    per_page?: number;
    /** If the backend supports it, narrows results before pagination. */
    search?: string;
  }): Promise<any> => {
    const search =
      params?.search != null && String(params.search).trim() !== ""
        ? String(params.search).trim()
        : undefined;
    const response = await api.get("/getAllEvaluators", {
      params: {
        page: params?.page ?? 1,
        per_page: params?.per_page ?? 1000,
        ...(search ? { search } : {}),
      },
    });
    return response.data;
  },

  /** Evaluators in the same branch as the given user (approval flow approver list). */
  getEvaluatorsByBranch: async (userId: string | number): Promise<any> => {
    const response = await api.get(
      `/getEvaluatorsByBranch/${encodeURIComponent(String(userId))}`
    );
    return response.data;
  },

  /**
   * Save evaluator approval flow settings.
   * Backend: POST /saveApprovalFlow/{user}
   * Body: { requires_approval: 0|1, approver_ids: number[] }
   */
  saveApprovalFlow: async (
    evaluatorId: string | number,
    payload: {
      requiresApproval: boolean;
      approverIds: Array<string | number>;
    }
  ): Promise<any> => {
    const approverIds = payload.approverIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    const response = await api.post(
      `/saveApprovalFlow/${encodeURIComponent(String(evaluatorId))}`,
      {
        requires_approval: payload.requiresApproval ? 1 : 0,
        approver_ids: approverIds,
      }
    );
    return response.data;
  },

  getAllEvaluatorAssignedEmployees: async (
    userId: string | number,
    params?: {
      page?: number;
      per_page?: number;
    }
  ): Promise<any> => {
    const response = await api.get(
      `/getAllEvaluatorAssignedEmployees/${encodeURIComponent(String(userId))}`,
      {
        params: {
          page: params?.page ?? 1,
          per_page: params?.per_page ?? 500,
        },
      }
    );
    return response.data;
  },

  getAllEvaluatorEmployees: async (
    userId: string | number,
    params?: {
      page?: number;
      per_page?: number;
    }
  ): Promise<any> => {
    const response = await api.get(
      `/getAllEvaluatorEmployees/${encodeURIComponent(String(userId))}`,
      {
        params: {
          page: params?.page ?? 1,
          per_page: params?.per_page ?? 2000,
        },
      }
    );
    return response.data;
  },

  /**
   * Assign evaluator employees.
   * Backend: POST /assignEmployees/{user} with employee_ids + action.
   */
  assignEmployees: async (
    userId: string | number,
    payload: {
      employeeIds: Array<string | number>;
      action?: "assign" | "unassign";
    }
  ): Promise<any> => {
    const formData = new FormData();
    const employeeIdsCsv = payload.employeeIds.map(String).map((s) => s.trim()).filter(Boolean).join(",");

    formData.append("employee_ids", employeeIdsCsv);
    formData.append("action", payload.action ?? "assign");

    const response = await api.post(
      `/assignEmployees/${encodeURIComponent(String(userId))}`,
      formData
    );
    return response.data;
  },

  /**
   * POST /assignEmployees/{user} with empty FormData — many backends treat this as “clear all”
   * assignments for that evaluator. Do not use for unchecking a single row; use assignEmployees
   * with action "unassign" and one id instead.
   */
  assignEmployeesBlank: async (userId: string | number): Promise<any> => {
    const response = await api.post(
      `/assignEmployees/${encodeURIComponent(String(userId))}`,
      new FormData()
    );
    return response.data;
  },

  // Get specific branch
  getBranch: async (branchId: string | number): Promise<any> => {
    const response = await api.get(`/branch/${branchId}`);
    return response.data;
  },

  // Add new branch (plain object from admin/HR pages, or FormData for multipart)
  addBranch: async (payload: FormData | object): Promise<any> => {
    const response = await api.post("/addBranch", payload);
    return response.data;
  },

  // Get total employees under a department
  getTotalEmployeesDepartments: async (
    searchValue: string,
    currentPage: number,
    itemsPerPage: number
  ): Promise<any> => {
    const response = await api.get("/getTotalEmployeesDepartments", {
      params: {
        search: searchValue || "",
        page: currentPage,
        per_page: itemsPerPage,
      },
    });
    return response.data.departments;
  },

  // Add new department
  addDepartment: async (name: string): Promise<any> => {
    const response = await api.post("/addDepartment", {
      department_name: name,
    });
    return response.data;
  },

  // Delete department
  deleteDepartment: async (departmentId: string | number): Promise<any> => {
    const response = await api.post(`/deleteDepartment/${departmentId}`);
    return response.data;
  },

  // Delete department
  deleteBranches: async (branchId: string | number): Promise<any> => {
    const response = await api.post(`/deleteBranch/${branchId}`);
    return response.data;
  },

  // Get branch rank and file employees
  getBranchRankNFile: async (
  ): Promise<any> => {
    const response = await api.post("/BranchRankNFile", {
    });
    return response.data;
  },

  // Get branch basic employees
  getBranchBasic: async (
  ): Promise<any> => {
    const response = await api.post("/BranchBasic", {    
    });
    return response.data;
  },

  // Get head office basic employees
  postHoBasic: async (
    employeeId: number | string,
    submission: EvaluationPayload
  ): Promise<any> => {
    const response = await api.post(`/HoBasic/${employeeId}`, submission);
    return response.data;
  },

  // Head office rank and file employees
  postHoRankNFile: async (
    employeeId: number | string,
    submission: EvaluationPayload
  ): Promise<any> => {
    const response = await api.post(`/HoRankNFile/${employeeId}`, submission);
    return response.data;
  },

  /**
   * Unified resubmit API for all evaluation forms.
   *
   * Maps form type -> backend resubmit endpoint path.
   */
  resubmitEvaluation: async (
    submissionId: number | string,
    submission: EvaluationPayload | Record<string, unknown>,
    evaluationType: ResubmitEvaluationType
  ): Promise<any> => {
    const endpointByType: Record<ResubmitEvaluationType, string> = {
      rankNfile: "HoRankNFile",
      basic: "HoBasic",
      branchRankNfile: "BranchRankNFile",
      branchBasic: "BranchBasic",
      branchBasicAreaManager: "BranchBasicAreaManager",
    };

    const endpoint = endpointByType[evaluationType];
    const response = await api.post(
      `/${endpoint}/resubmit/${submissionId}`,
      submission,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    return response.data;
  },

  // Get branch basic employees
  postBranchBasic: async (
    employeeId: number | string,
    submission: EvaluationPayload
  ): Promise<any> => {
    const response = await api.post(`/BranchBasic/${employeeId}`, submission);
    return response.data;
  },

  // Area Manager evaluation (BranchBasicAreaManager)
  postBranchBasicAreaManager: async (
    employeeId: number | string,
    submission: EvaluationPayload
  ): Promise<any> => {
    const response = await api.post(`/BranchBasicAreaManager/${employeeId}`, submission);
    return response.data;
  },

  // Get branch rank and file employees
  postBranchRankNFile: async (
    employeeId: number | string,
    submission: EvaluationPayload
  ): Promise<any> => {
    const response = await api.post(`/BranchRankNFile/${employeeId}`, submission);
    return response.data;
  },

  /** Save a HO Rank & File evaluation as draft. Backend: POST `/HoRankNFile/draft/{user}` */
  postHoRankNFileDraft: async (
    userId: number | string,
    submission: EvaluationPayload | Record<string, unknown>
  ): Promise<any> => {
    const response = await api.post(
      `/HoRankNFile/draft/${userId}`,
      submission
    );
    return response.data;
  },

  /** Save a HO Basic evaluation as draft. Backend: POST `/HoBasic/draft/{user}` */
  postHoBasicDraft: async (
    userId: number | string,
    submission: EvaluationPayload | Record<string, unknown>
  ): Promise<any> => {
    const response = await api.post(`/HoBasic/draft/${userId}`, submission);
    return response.data;
  },

  /** Save a Branch Basic evaluation as draft. Backend: POST `/BranchBasic/draft/{user}` */
  postBranchBasicDraft: async (
    userId: number | string,
    submission: EvaluationPayload | Record<string, unknown>
  ): Promise<any> => {
    const response = await api.post(
      `/BranchBasic/draft/${userId}`,
      submission
    );
    return response.data;
  },

  /** Save a Branch Rank & File evaluation as draft. Backend: POST `/BranchRankNFile/draft/{user}` */
  postBranchRankNFileDraft: async (
    userId: number | string,
    submission: EvaluationPayload | Record<string, unknown>
  ): Promise<any> => {
    const response = await api.post(
      `/BranchRankNFile/draft/${userId}`,
      submission
    );
    return response.data;
  },

  /** Save an Area Manager evaluation as draft. Backend: POST `/BranchBasicAreaManager/draft/{user}` */
  postBranchBasicAreaManagerDraft: async (
    userId: number | string,
    submission: EvaluationPayload | Record<string, unknown>
  ): Promise<any> => {
    const response = await api.post(
      `/BranchBasicAreaManager/draft/${userId}`,
      submission
    );
    return response.data;
  },

  /**
   * Save an in-progress evaluation as draft using the matching form endpoint.
   */
  postEvaluationDraft: async (
    evaluationType: ResubmitEvaluationType,
    userId: number | string,
    submission: EvaluationPayload | Record<string, unknown>
  ): Promise<any> => {
    switch (evaluationType) {
      case "rankNfile":
        return apiService.postHoRankNFileDraft(userId, submission);
      case "basic":
        return apiService.postHoBasicDraft(userId, submission);
      case "branchRankNfile":
        return apiService.postBranchRankNFileDraft(userId, submission);
      case "branchBasic":
        return apiService.postBranchBasicDraft(userId, submission);
      case "branchBasicAreaManager":
        return apiService.postBranchBasicAreaManagerDraft(userId, submission);
      default: {
        const _exhaustive: never = evaluationType;
        throw new Error(`Unknown evaluation draft type: ${_exhaustive}`);
      }
    }
  },

  // Get evaluations by authenticated evaluator
  getEvalAuthEvaluator: async (
    search: string,
    page: number,
    per_page: number,
    status: string,
    quarter: string,
    year: number
  ): Promise<any> => {
    const response = await api.get("/getEvalAuthEvaluator", {
      params: {
        search: search || "",
        page: page || 1,
        per_page: per_page || 10,
        status: status || "",
        quarter: quarter || "",
        year: year || "",
      },
    });
    return response.data;
  },

  /**
   * Pending Approval tab for the signed-in evaluator/approver.
   * Backend: GET `/getPendingApprovalEvaluations`
   *
   * Expected query params (same style as getEvalAuthEvaluator):
   * - search, page, per_page, quarter, year
   * - status: "" | pending_approval_1 | pending_approval_2 | rejected
   *
   * Expected response:
   * {
   *   pending_approvals: { data, total, last_page, per_page }
   *   myEval_as_Evaluator_count: number  // All Records tab badge
   *   // legacy: myEval_as_Evaluator: { data, total, last_page, per_page }
   * }
   *
   * Backend should return only rows relevant to the current user as approver
   * (pending_approval_1/2 assigned to them) plus rejected rows they should see
   * (e.g. as original evaluator or rejecting approver).
   * Do NOT include plain `pending` drafts — those belong on All Records.
   */
  getPendingApprovalEvaluations: async (
    search: string,
    page: number,
    per_page: number,
    status: string,
    quarter: string,
    year: number
  ): Promise<any> => {
    const response = await api.get("/getPendingApprovalEvaluations", {
      params: {
        search: search || "",
        page: page || 1,
        per_page: per_page || 10,
        status: status || "",
        quarter: quarter || "",
        year: year || "",
      },
    });
    return normalizePendingApprovalEvaluationsResponse(response.data);
  },

  // Get evaluations by authenticated employee
  getMyEvalAuthEmployee: async (
    search: string,
    page: number,
    per_page: number,
    selectedYear?: string,
    selectedQuarter?: string
  ): Promise<any> => {
    const params: Record<string, string | number> = {
      search: search || "",
      page: page || 1,
      per_page: per_page || 10,
    };
    if (selectedYear) {
      params.year = selectedYear;
    }
    if (selectedQuarter) {
      params.quarter = selectedQuarter;
    }

    const response = await api.get("/getMyEvalAuthEmployee", { params });
    return normalizeMyEvalAsEmployeeResponse(response.data);
  },

  // Evaluator dashboard total cards
  evaluatorDashboard: async (
    searchTerm: string,
    currentPage: number,
    itemsPerPage: number
  ): Promise<any> => {
    const response = await api.get("/evaluatorDashboard", {
      params: {
        search: searchTerm || "",
        page: currentPage || 1,
        per_page: itemsPerPage || 10,
      },
    });
    return response.data;
  },

  // HR dashboard total cards
  hrDashboard: async (): Promise<any> => {
    const response = await api.get("/hrDashboard");
    return response.data;
  },

  // Employee dashboard total cards
  employeeDashboard: async (): Promise<any> => {
    const response = await api.get("/employeeDashboard");
    return response.data;
  },

  employeeDashboard2: async (employeeId: number): Promise<any> => {
    const response = await api.get(`/employeeDashboard2/${employeeId}`);
    return response.data;
  },

  // ============================================
  // OTHER MISSING ENDPOINTS
  // ============================================

  // Get all roles
  getAllRoles: async (): Promise<any[]> => {
    const response = await api.get("/getAllRoles");
    const data = response.data;
    return data.roles;
  },

  // Mark notification as read
  isReadNotification: async (notificationId: number): Promise<any> => {
    const response = await api.post("/isReadNotification", {
      notificationId,
    });
    return response.data;
  },
};

export default apiService;