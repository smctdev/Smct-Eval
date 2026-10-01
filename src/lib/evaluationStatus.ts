export const EVALUATION_STATUSES = [
  "pending",
  "pending_approval_1",
  "pending_approval_2",
  "rejected",
  "completed",
] as const;

export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export const EVALUATION_STATUS_FILTER_OPTIONS: Array<{
  value: EvaluationStatus;
  label: string;
}> = [
  { value: "pending", label: "Pending" },
  { value: "pending_approval_1", label: "Pending Approval 1" },
  { value: "pending_approval_2", label: "Pending Approval 2" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
];

export function normalizeEvaluationStatus(status: unknown): string {
  return String(status ?? "").trim().toLowerCase();
}

export function formatEvaluationStatusLabel(status: string): {
  short: string;
  full: string;
} {
  const s = normalizeEvaluationStatus(status);

  switch (s) {
    case "pending":
      return { short: "⏳ Pend.", full: "⏳ Pending" };
    case "pending_approval_1":
      return { short: "① Appr.", full: "⏳ Pending Approval 1" };
    case "pending_approval_2":
      return { short: "② Appr.", full: "⏳ Pending Approval 2" };
    case "rejected":
      return { short: "✕ Rej.", full: "✕ Rejected" };
    case "completed":
      return { short: "✓ Done", full: "✓ Completed" };
    case "draft":
      return { short: "Draft", full: "Draft" };
    default:
      return { short: s || "—", full: s || "—" };
  }
}

export function getEvaluationStatusBadgeClass(status: string): string {
  const s = normalizeEvaluationStatus(status);

  switch (s) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "draft":
      return "bg-slate-100 text-slate-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "pending_approval_1":
      return "bg-orange-100 text-orange-800";
    case "pending_approval_2":
      return "bg-blue-100 text-blue-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function isEvaluationStatusCompleted(status: unknown): boolean {
  return normalizeEvaluationStatus(status) === "completed";
}

export function isEvaluationStatusRejected(status: unknown): boolean {
  return normalizeEvaluationStatus(status) === "rejected";
}

export function isEvaluationStatusPending(status: unknown): boolean {
  return normalizeEvaluationStatus(status) === "pending";
}

export function isEvaluationStatusPendingApproval1(status: unknown): boolean {
  return normalizeEvaluationStatus(status) === "pending_approval_1";
}

export function isEvaluationStatusPendingApproval2(status: unknown): boolean {
  return normalizeEvaluationStatus(status) === "pending_approval_2";
}

export function isEvaluationStatusAnyPending(status: unknown): boolean {
  const s = normalizeEvaluationStatus(status);
  return (
    s === "pending" ||
    s === "pending_approval_1" ||
    s === "pending_approval_2"
  );
}

/** Evaluator may edit rejected, or pending (with or without an assigned approver). */
export function isEvaluationStatusEditableByEvaluator(
  status: unknown,
  _hasApprover = false
): boolean {
  const s = normalizeEvaluationStatus(status);
  if (s === "rejected") return true;
  if (s === "pending") return true;
  return false;
}

export function getEvaluationStatusRowAccentClass(status: unknown): string | null {
  const s = normalizeEvaluationStatus(status);

  switch (s) {
    case "completed":
      return "bg-green-50 hover:bg-green-100 border-l-4 border-l-green-500 transition-colors";
    case "pending":
      return "bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500 transition-colors";
    case "pending_approval_1":
      return "bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-500 transition-colors";
    case "pending_approval_2":
      return "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500 transition-colors";
    case "rejected":
      return "bg-gray-200 hover:bg-gray-300 border-l-4 border-l-gray-600 transition-colors";
    default:
      return null;
  }
}
