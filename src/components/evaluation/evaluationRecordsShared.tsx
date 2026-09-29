"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
} from "react";
import { Check, Eye, Info, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  formatEvaluationStatusLabel,
  getEvaluationStatusBadgeClass,
  getEvaluationStatusRowAccentClass,
  isEvaluationStatusAnyPending,
  isEvaluationStatusEditableByEvaluator,
  isEvaluationStatusPending,
  isEvaluationStatusRejected,
  normalizeEvaluationStatus,
} from "@/lib/evaluationStatus";
import { recordHasApprover } from "@/lib/evaluationSubmissionRecord";
import { cn } from "@/lib/utils";
import {
  isQuarterLateByStaticPeriod,
  normalizeQuarterLabelForSchedule,
  QUARTER_EVALUATION_SCHEDULE_HINT,
} from "@/lib/quarterUtils";

export type EvaluationRecordReview = {
  id: number;
  employee: any;
  evaluator: any;
  reviewTypeProbationary: number | string;
  reviewTypeRegular: number | string;
  reviewTypeOthersImprovement?: boolean | number;
  reviewTypeOthersCustom?: string;
  created_at: string;
  rating: number;
  status: string;
};

export const RATING_DISPLAY_BANDS = [
  {
    maxExclusive: 2.5,
    badgeClass: "bg-red-100 text-red-800",
    legend: "Poor (<2.5)",
  },
  {
    maxExclusive: 3.0,
    badgeClass: "bg-orange-100 text-orange-800",
    legend: "Low (<3.0)",
  },
  {
    maxExclusive: 4.0,
    badgeClass: "bg-blue-100 text-blue-800",
    legend: "Good (3.0–3.9)",
  },
  {
    maxExclusive: Number.POSITIVE_INFINITY,
    badgeClass: "bg-green-100 text-green-800",
    legend: "Excellent (≥4.0)",
  },
] as const;

export const ratingPillClass =
  "inline-flex items-center justify-center rounded-md border border-transparent px-1.5 py-0.5 text-[0.65rem] font-medium whitespace-nowrap sm:px-2 sm:text-xs";

export const EVAL_RECORDS_TABLE_CLASS =
  "min-w-[38rem] sm:min-w-[48rem] md:min-w-[56rem] lg:min-w-[68rem] xl:min-w-0 xl:w-full [&_th]:h-auto [&_th]:min-h-8 [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-2 [&_th]:align-middle [&_th]:text-[0.6rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-600 sm:[&_th]:min-h-9 sm:[&_th]:px-2.5 sm:[&_th]:py-2.5 sm:[&_th]:text-[0.65rem] lg:[&_th]:px-3 lg:[&_th]:text-xs xl:[&_th]:px-4 [&_td]:min-w-0 [&_td]:px-2 [&_td]:py-2 [&_td]:align-top [&_td]:text-[0.7rem] [&_td]:leading-snug sm:[&_td]:px-2.5 sm:[&_td]:py-2.5 sm:[&_td]:text-xs lg:[&_td]:px-3 lg:[&_td]:text-sm lg:[&_td]:leading-snug";

export const EVAL_TABLE_ACTIONS_HEAD_CLASS = cn(
  "w-[3.25rem] min-w-[3.25rem] p-1 text-center sm:min-w-[4.5rem] sm:p-2 lg:sticky lg:right-0 lg:z-[4] lg:min-w-[7rem] lg:bg-white lg:text-left lg:shadow-[-6px_0_12px_-4px_rgba(15,23,42,0.12)]"
);

export function evalTableActionsCellClass(rowClassName: string) {
  return cn(
    "w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] p-1 sm:w-auto sm:min-w-[4.5rem] sm:max-w-none sm:p-2",
    "lg:sticky lg:right-0 lg:z-[3] lg:min-w-[7rem] lg:w-auto lg:shadow-[-6px_0_12px_-4px_rgba(15,23,42,0.12)]",
    rowClassName.includes("bg-green-50") && "lg:bg-green-50",
    rowClassName.includes("bg-red-200") && "lg:bg-red-200",
    rowClassName.includes("bg-yellow-50") && "lg:bg-yellow-50",
    rowClassName.includes("bg-blue-50") && "lg:bg-blue-50",
    rowClassName.includes("bg-orange-50") && "lg:bg-orange-50",
    rowClassName.includes("bg-violet-50") && "lg:bg-violet-50",
    rowClassName.includes("bg-gray-100") && "lg:bg-gray-100",
    !rowClassName.includes("bg-green-50") &&
      !rowClassName.includes("bg-red-200") &&
      !rowClassName.includes("bg-yellow-50") &&
      !rowClassName.includes("bg-blue-50") &&
      !rowClassName.includes("bg-orange-50") &&
      !rowClassName.includes("bg-violet-50") &&
      !rowClassName.includes("bg-gray-50") &&
      "lg:bg-white"
  );
}

export function parseRatingNumber(
  rating: number | string | null | undefined
): number | null {
  if (rating === null || rating === undefined || rating === "") return null;
  const n = typeof rating === "string" ? parseFloat(rating) : Number(rating);
  return Number.isNaN(n) ? null : n;
}

export function getRatingBadgeClassFromBands(
  rating: number | string | null | undefined
): string {
  const n = parseRatingNumber(rating);
  if (n === null) return "bg-gray-100 text-gray-600";
  for (const band of RATING_DISPLAY_BANDS) {
    if (n < band.maxExclusive) return band.badgeClass;
  }
  return RATING_DISPLAY_BANDS[RATING_DISPLAY_BANDS.length - 1].badgeClass;
}

export function getReviewListRating(
  review: EvaluationRecordReview | null | undefined
): number | null {
  if (!review) return null;
  const extended = review as EvaluationRecordReview & {
    overall_rating?: number | string | null;
    overallRating?: number | string | null;
  };
  const raw =
    extended.rating ?? extended.overall_rating ?? extended.overallRating;
  const n = parseRatingNumber(raw as number | string | null | undefined);
  if (n === null) return null;
  if (n === 0) return null;
  return n;
}

export function formatReviewListDate(createdAt: string): {
  short: string;
  full: string;
} {
  const d = new Date(createdAt);
  return {
    short: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit",
    }),
    full: d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function formatReviewStatusLabel(status: string): {
  short: string;
  full: string;
} {
  return formatEvaluationStatusLabel(status);
}

export function isReviewRejected(review: EvaluationRecordReview): boolean {
  return isEvaluationStatusRejected(review.status);
}

export function getReviewRejectionNote(
  review: EvaluationRecordReview
): string | null {
  const extended = review as EvaluationRecordReview & {
    noteIfRejected?: string | null;
    note_if_rejected?: string | null;
    rejection_note?: string | null;
  };
  for (const value of [
    extended.noteIfRejected,
    extended.note_if_rejected,
    extended.rejection_note,
  ]) {
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

export function isReviewDraft(review: EvaluationRecordReview): boolean {
  return String(review.status ?? "").toLowerCase() === "draft";
}

function normalizeRecordUserId(id: unknown): string | null {
  if (id == null || String(id).trim() === "") return null;
  return String(id).trim();
}

/** True when the evaluation's evaluator matches the signed-in user. */
export function isReviewEvaluatorCurrentUser(
  review: EvaluationRecordReview,
  currentUserId: string | number | null | undefined
): boolean {
  const profileId = normalizeRecordUserId(currentUserId);
  if (!profileId) return false;

  const evaluator = review.evaluator as { id?: unknown } | null | undefined;
  const evaluatorId = normalizeRecordUserId(evaluator?.id);
  if (evaluatorId && evaluatorId === profileId) return true;

  const extended = review as EvaluationRecordReview & {
    evaluator_id?: unknown;
    evaluatorId?: unknown;
  };
  const topLevelId = normalizeRecordUserId(
    extended.evaluator_id ?? extended.evaluatorId
  );
  return topLevelId != null && topLevelId === profileId;
}

/** Draft evaluations created by the signed-in evaluator can be edited. */
export function isReviewDraftEditableByEvaluator(
  review: EvaluationRecordReview,
  currentUserId: string | number | null | undefined
): boolean {
  return (
    isReviewDraft(review) &&
    isReviewEvaluatorCurrentUser(review, currentUserId)
  );
}

/** Pending evaluations can be edited when the signed-in user is the evaluator. */
export function isReviewPendingEditableByEvaluator(
  review: EvaluationRecordReview,
  currentUserId: string | number | null | undefined
): boolean {
  return (
    isEvaluationStatusPending(review.status) &&
    isReviewEvaluatorCurrentUser(review, currentUserId)
  );
}

/** Whether a delete action may be offered; availability is gated by wiring `onDeleteAction`. */
export function isReviewDeletable(_review: EvaluationRecordReview): boolean {
  return true;
}

function isPresentId(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== "" && s !== "0" && s.toLowerCase() !== "null";
}

/** True when the evaluation record has at least one assigned approver. */
export function reviewHasApprover(review: EvaluationRecordReview): boolean {
  return recordHasApprover(review as EvaluationRecordReview & Record<string, unknown>);
}

export function getReviewApproverUserId(
  review: EvaluationRecordReview,
  slot: 1 | 2
): string | null {
  const extended = review as EvaluationRecordReview & Record<string, unknown>;

  const objectValue =
    slot === 1
      ? extended.approver1 ?? extended.approver_1
      : extended.approver2 ?? extended.approver_2;

  if (objectValue && typeof objectValue === "object") {
    const record = objectValue as Record<string, unknown>;
    const id = record.id ?? record.user_id ?? record.approver_id;
    if (isPresentId(id)) return String(id).trim();
  }

  // Some list payloads only include scalar approver ids.
  const scalarValue =
    slot === 1
      ? extended.approver1_id ??
        extended.approver_1_id ??
        extended.approverId1 ??
        (typeof objectValue === "string" || typeof objectValue === "number"
          ? objectValue
          : null)
      : extended.approver2_id ??
        extended.approver_2_id ??
        extended.approverId2 ??
        (typeof objectValue === "string" || typeof objectValue === "number"
          ? objectValue
          : null);

  return isPresentId(scalarValue) ? String(scalarValue).trim() : null;
}

export function getReviewApproverSlotForUser(
  review: EvaluationRecordReview,
  currentUserId: string | number | null | undefined
): 1 | 2 | null {
  const profileId = normalizeRecordUserId(currentUserId);
  if (!profileId) return null;

  if (getReviewApproverUserId(review, 1) === profileId) return 1;
  if (getReviewApproverUserId(review, 2) === profileId) return 2;
  return null;
}

/** Signed-in user is the active approver for this evaluation's current approval step. */
export function isReviewApproverActionable(
  review: EvaluationRecordReview,
  currentUserId: string | number | null | undefined
): boolean {
  const slot = getReviewApproverSlotForUser(review, currentUserId);
  if (!slot) return false;

  const status = normalizeEvaluationStatus(review.status);
  if (slot === 1 && status === "pending_approval_1") return true;
  if (slot === 2 && status === "pending_approval_2") return true;
  return false;
}

export function isReviewEditable(
  review: EvaluationRecordReview,
  currentUserId: string | number | null | undefined
): boolean {
  return isEvaluationRecordEditableByEvaluator(review, currentUserId);
}

/** Evaluator may open the edit flow (draft, or pending with approver). */
export function canEvaluatorOpenEvaluationEdit(
  review: EvaluationRecordReview,
  currentUserId: string | number | null | undefined,
  options?: { allowPendingEditByCurrentUser?: boolean }
): boolean {
  if (isReviewDraftEditableByEvaluator(review, currentUserId)) return true;
  if (
    options?.allowPendingEditByCurrentUser &&
    isReviewPendingEditableByEvaluator(review, currentUserId)
  ) {
    return true;
  }
  return isEvaluationRecordEditableByEvaluator(review, currentUserId);
}

export function isEvaluationRecordEditableByEvaluator(
  review: EvaluationRecordReview,
  currentUserId: string | number | null | undefined
): boolean {
  if (!isReviewEvaluatorCurrentUser(review, currentUserId)) return false;
  if (isReviewEditDisabledForEvaluator(review, currentUserId)) return false;

  const status = normalizeEvaluationStatus(review.status);
  return isEvaluationStatusEditableByEvaluator(status, reviewHasApprover(review));
}

/** Evaluator currently has no status that should render disabled Edit. */
export function isReviewEditDisabledForEvaluator(
  review: EvaluationRecordReview,
  currentUserId: string | number | null | undefined
): boolean {
  if (!isReviewEvaluatorCurrentUser(review, currentUserId)) return false;

  const _status = normalizeEvaluationStatus(review.status);
  void _status;
  return false;
}

export function getEvaluationApiErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (
      error as { response?: { data?: unknown; status?: number } }
    ).response;
    const data = response?.data;

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

    if (response?.status === 404) {
      return "Evaluation record was not found. Please refresh to view the latest updates.";
    }
  }

  if (error instanceof Error && error.message.trim() !== "") {
    const msg = error.message.trim();
    if (msg !== "Request failed with status code 404") {
      return msg;
    }
    return "Evaluation record was not found. Please refresh to view the latest updates.";
  }

  return fallback;
}

export function getDeleteEvaluationErrorMessage(error: unknown): string {
  return getEvaluationApiErrorMessage(
    error,
    "Failed to delete evaluation. Please try again."
  );
}

export function getViewEvaluationErrorMessage(error: unknown): string {
  return getEvaluationApiErrorMessage(
    error,
    "Failed to load evaluation details. Please try again."
  );
}

export function EvaluationApiErrorDialog({
  open,
  title,
  message,
  onCloseAction,
  dialogClassName,
}: {
  open: boolean;
  title: string;
  message: string | null;
  onCloseAction: () => void;
  dialogClassName?: string;
}) {
  if (!open || !message) {
    return null;
  }

  return (
    <Dialog
      open
      onOpenChangeAction={(next) => {
        if (!next) {
          onCloseAction();
        }
      }}
    >
      <DialogContent
        portalClassName="z-[200]"
        className={cn("max-w-md p-6", dialogClassName)}
      >
        <DialogHeader className="rounded-lg bg-amber-50 pb-4">
          <DialogTitle className="text-center text-amber-900">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 px-1 py-2">
          <img
            src="/error2.gif"
            alt=""
            className="max-h-36 w-auto object-contain"
            draggable={false}
          />
          <p className="text-center text-sm leading-relaxed text-gray-700">
            {message}
          </p>
        </div>
        <DialogFooter className="pt-4">
          <Button
            type="button"
            onClick={onCloseAction}
            className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700 hover:text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isHrRoleName(name: string): boolean {
  const n = name.toLowerCase().trim();
  if (!n) return false;
  if (n === "evaluator" || n.endsWith("_evaluator")) return false;
  if (n === "hr" || n === "human resources") return true;
  if (n.startsWith("hr_") || n.endsWith("_hr")) return true;
  return /\bhr\b/.test(n) && !n.includes("evaluator");
}

function isEvaluatorRoleName(name: string): boolean {
  const n = name.toLowerCase().trim();
  return n === "evaluator" || n.endsWith("_evaluator") || n.includes("evaluator");
}

/** All role hints for the user who conducted the evaluation (list rows vary by API). */
function collectConductingPartyRoleNames(
  review: EvaluationRecordReview
): string[] {
  const ev = review.evaluator;
  const names: string[] = [];
  if (!ev || typeof ev !== "object") {
    const top = review as EvaluationRecordReview & { evaluator_role?: string };
    if (top.evaluator_role) names.push(String(top.evaluator_role).toLowerCase());
    return [...new Set(names.filter(Boolean))];
  }

  const roles = ev.roles;
  if (Array.isArray(roles)) {
    for (const entry of roles) {
      const label =
        typeof entry === "object" && entry !== null && "name" in entry
          ? (entry as { name?: string }).name
          : entry;
      if (label) names.push(String(label).toLowerCase());
    }
  } else if (roles && typeof roles === "object" && "name" in roles) {
    names.push(String((roles as { name?: string }).name ?? "").toLowerCase());
  }

  for (const key of ["role", "role_name", "user_type", "type"] as const) {
    const value = (ev as Record<string, unknown>)[key];
    if (value) names.push(String(value).toLowerCase());
  }

  const top = review as EvaluationRecordReview & { evaluator_role?: string };
  if (top.evaluator_role) names.push(String(top.evaluator_role).toLowerCase());

  return [...new Set(names.filter(Boolean))];
}

function inferHrConductingFromProfile(
  review: EvaluationRecordReview
): boolean {
  const ev = review.evaluator as
    | (Record<string, unknown> & {
        position?: string | { name?: string; position_name?: string };
      })
    | null
    | undefined;
  if (!ev) return false;

  const positionRaw = ev.position;
  const positionLabel =
    typeof positionRaw === "string"
      ? positionRaw
      : positionRaw?.name ?? positionRaw?.position_name ?? "";
  const p = String(positionLabel).toLowerCase().trim();
  if (!p) return false;
  return (
    p.includes("hr manager") ||
    p.includes("human resource") ||
    p === "hr" ||
    p.startsWith("hr ")
  );
}

/** HR staff conducted this evaluation (sign shows under HR Sign, not Evaluator Sign). */
export function isHrEvaluatingParty(review: EvaluationRecordReview): boolean {
  const names = collectConductingPartyRoleNames(review);
  if (names.length > 0) {
    const hasHr = names.some(isHrRoleName);
    const hasEvaluator = names.some(isEvaluatorRoleName);
    if (hasHr && !hasEvaluator) return true;
    if (hasHr && hasEvaluator) return true;
    return false;
  }
  return inferHrConductingFromProfile(review);
}

/** Non-HR evaluator conducted this evaluation. */
export function isEvaluatorEvaluatingParty(
  review: EvaluationRecordReview
): boolean {
  if (isHrEvaluatingParty(review)) return false;
  const names = collectConductingPartyRoleNames(review);
  if (names.some(isEvaluatorRoleName)) return true;
  return hasUserParty(review.evaluator);
}

type ReviewWithApprovals = EvaluationRecordReview & {
  employeeApprovedAt?: string | null;
  employee_approved_at?: string | null;
  employeeSignature?: string | null;
  employee_signature?: string | null;
  evaluatorSignature?: string | null;
  evaluator_signature?: string | null;
  evaluatorApprovedAt?: string | null;
  evaluator_approved_at?: string | null;
  hrApprovedAt?: string | null;
  hr_approved_at?: string | null;
  hrSignature?: string | null;
  hr_signature?: string | null;
  hrVerifiedAt?: string | null;
  hr_verified_at?: string | null;
};

function hasNonEmpty(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function hasUserParty(
  user: { id?: unknown; fname?: string; lname?: string; name?: string } | null | undefined
): boolean {
  if (!user || typeof user !== "object") return false;
  if (user.id != null && String(user.id).trim() !== "") return true;
  return (
    [user.fname, user.lname, user.name].filter(Boolean).join(" ").trim().length > 0
  );
}

/** Record has an employee subject (employee sign column applies). */
export function hasEmployeeParty(review: EvaluationRecordReview): boolean {
  return hasUserParty(review.employee);
}

/** Record has an evaluator who conducted the review (not HR-only evaluation). */
export function hasEvaluatorParty(review: EvaluationRecordReview): boolean {
  return isEvaluatorEvaluatingParty(review) && hasUserParty(review.evaluator);
}

/** HR conducted this evaluation (HR Sign column applies). */
export function hasHrParty(review: EvaluationRecordReview): boolean {
  return isHrEvaluatingParty(review) && hasUserParty(review.evaluator);
}

/** The user who conducted the evaluation signed at submission. */
function hasConductingPartySigned(review: EvaluationRecordReview): boolean {
  const extended = review as ReviewWithApprovals;
  if (
    hasNonEmpty(extended.evaluatorSignature) ||
    hasNonEmpty(extended.evaluator_signature) ||
    hasNonEmpty(extended.evaluatorApprovedAt) ||
    hasNonEmpty(extended.evaluator_approved_at)
  ) {
    return true;
  }
  if (hasNonEmpty(review.evaluator?.signature)) return true;

  const status = String(review.status ?? "").toLowerCase();
  return Boolean(
    review.evaluator &&
      review.id &&
      (status === "pending" || status === "completed")
  );
}

/** Employee acknowledgment signature on the evaluation. */
export function hasEmployeeSigned(review: EvaluationRecordReview): boolean {
  const extended = review as ReviewWithApprovals;
  if (
    hasNonEmpty(extended.employeeApprovedAt) ||
    hasNonEmpty(extended.employee_approved_at) ||
    hasNonEmpty(extended.employeeSignature) ||
    hasNonEmpty(extended.employee_signature)
  ) {
    return true;
  }
  return String(review.status ?? "").toLowerCase() === "completed";
}

/**
 * Evaluator who conducted the evaluation signed at submission.
 * Separate from HR verification — not shown when HR staff performed the evaluation.
 */
export function hasEvaluatorSigned(
  review: EvaluationRecordReview,
  options?: { evaluatorOwnRecords?: boolean }
): boolean {
  if (options?.evaluatorOwnRecords && review.id) {
    return true;
  }
  if (!isEvaluatorEvaluatingParty(review)) return false;
  if (!hasUserParty(review.evaluator)) return false;
  return hasConductingPartySigned(review);
}

/** HR conducted and signed this evaluation (separate column from evaluator-conducted). */
export function hasHrSigned(review: EvaluationRecordReview): boolean {
  const extended = review as ReviewWithApprovals;
  if (
    hasNonEmpty(extended.hrApprovedAt) ||
    hasNonEmpty(extended.hr_approved_at) ||
    hasNonEmpty(extended.hrSignature) ||
    hasNonEmpty(extended.hr_signature) ||
    hasNonEmpty(extended.hrVerifiedAt) ||
    hasNonEmpty(extended.hr_verified_at)
  ) {
    return true;
  }
  if (!isHrEvaluatingParty(review)) return false;
  if (!hasUserParty(review.evaluator)) return false;
  return hasConductingPartySigned(review);
}

export function shouldShowEmployeeSignPending(
  review: EvaluationRecordReview
): boolean {
  return (
    hasEmployeeParty(review) &&
    !hasEmployeeSigned(review) &&
    String(review.status ?? "").toLowerCase() === "pending"
  );
}

export function shouldShowEvaluatorSignPending(
  review: EvaluationRecordReview
): boolean {
  return (
    hasEvaluatorParty(review) &&
    !hasEvaluatorSigned(review) &&
    String(review.status ?? "").toLowerCase() === "pending"
  );
}

export function shouldShowHrSignPending(
  review: EvaluationRecordReview
): boolean {
  return (
    hasHrParty(review) &&
    !hasHrSigned(review) &&
    String(review.status ?? "").toLowerCase() === "pending"
  );
}

function getReviewStatusBadgeClass(status: string): string {
  return getEvaluationStatusBadgeClass(status);
}

export const REJECTED_STATUS_HOVER_HINT =
  "Hover a rejected status badge to view the rejection reason.";

export function EvalRecordRejectedHoverHintBanner({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-2 flex items-start gap-2.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-2.5 shadow-sm sm:gap-3 sm:px-3.5 sm:py-3",
        className
      )}
      role="note"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 ring-2 ring-blue-200">
        <Info className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold text-blue-950 sm:text-sm">
          Rejected evaluations
        </p>
        <p className="text-xs leading-snug text-blue-900 sm:text-sm">
          {REJECTED_STATUS_HOVER_HINT} Look for the{" "}
          <Badge className="mx-0.5 align-middle bg-red-100 px-1.5 text-[0.65rem] font-semibold text-red-800 sm:text-xs">
            ✕ rejected
          </Badge>{" "}
          badge in the Status column.
        </p>
      </div>
    </div>
  );
}

export function EvalRecordStatusTableHead({
  className,
}: {
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      Status
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 ring-1 ring-blue-300 transition-colors hover:bg-blue-200 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Status column help"
          >
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[16rem] border border-blue-200 bg-blue-50 text-center text-blue-950"
        >
          {REJECTED_STATUS_HOVER_HINT}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

export function EvalRecordStatusBadge({
  review,
}: {
  review: EvaluationRecordReview;
}) {
  const statusLabels = formatReviewStatusLabel(review.status);
  const rejectionNote = getReviewRejectionNote(review);
  const showRejectionTooltip =
    isReviewRejected(review) && rejectionNote != null;

  const badge = (
    <Badge
      className={cn(
        "text-[0.65rem] sm:text-xs",
        getReviewStatusBadgeClass(review.status),
        showRejectionTooltip && "cursor-help"
      )}
    >
      <span className="sm:hidden">{statusLabels.short}</span>
      <span className="hidden sm:inline">{statusLabels.full}</span>
    </Badge>
  );

  if (!showRejectionTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="mb-1 text-[0.65rem] font-medium opacity-90">
          Rejection reason
        </p>
        <p className="whitespace-pre-wrap">{rejectionNote}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function EvalRecordSignBadge({
  signed,
  pending = false,
}: {
  signed: boolean;
  pending?: boolean;
}) {
  if (signed) {
    return (
      <Badge className="bg-green-100 text-[0.65rem] text-green-800 sm:text-xs">
        ✓ Signed
      </Badge>
    );
  }
  if (pending) {
    return (
      <Badge className="bg-gray-100 text-[0.65rem] text-gray-600 sm:text-xs">
        ⏳ Pending
      </Badge>
    );
  }
  return <span className="text-[0.65rem] text-gray-400 sm:text-xs">—</span>;
}

export function formatRatingDisplay(rating: number | null): string {
  if (rating === null) return "—";
  return rating % 1 === 0 ? String(rating) : rating.toFixed(2);
}

export function getQuarterColor(quarter: string): string {
  if (quarter.includes("Q1")) return "bg-blue-100 text-blue-800";
  if (quarter.includes("Q2")) return "bg-green-100 text-green-800";
  if (quarter.includes("Q3")) return "bg-yellow-100 text-yellow-800";
  return "bg-purple-100 text-purple-800";
}

export const QUARTER_LATE_BADGE_CLASS =
  "border border-red-500 bg-red-500 text-white shadow-sm ring-1 ring-red-600/40";

export const QUARTER_LATE_LEGEND_LABEL = "Late Submission";
export const QUARTER_LATE_HOVER_LABEL = "Late submit";
export const QUARTER_LATE_TOOLTIP = QUARTER_EVALUATION_SCHEDULE_HINT;

export function isReviewQuarterLate(review: EvaluationRecordReview): boolean {
  const display = normalizeQuarterLabelForSchedule(getReviewQuarterDisplay(review));
  if (!/Q[1-4]/i.test(display)) return false;
  const yearFallback = new Date(review.created_at).getFullYear();
  return isQuarterLateByStaticPeriod(display, review.created_at, {
    yearFallback,
  });
}

/** Row accent when quarter was submitted after the input month (distinct from yellow “New”). */
export const QUARTER_LATE_ROW_CLASS =
  "bg-red-200 hover:!bg-red-300 border-l-4 border-l-red-600 ring-1 ring-inset ring-red-400/60 cursor-help";

export function getReviewQuarterBadgeClass(
  review: EvaluationRecordReview
): string {
  const display = getReviewQuarterDisplay(review);
  if (isReviewQuarterLate(review)) return QUARTER_LATE_BADGE_CLASS;
  return getQuarterColor(display);
}

export function getReviewQuarterDisplay(review: EvaluationRecordReview): string {
  const isOthersSelected =
    Boolean(review.reviewTypeOthersImprovement) ||
    (review.reviewTypeOthersCustom &&
      review.reviewTypeOthersCustom.trim() !== "");

  if (
    review.reviewTypeRegular != null &&
    review.reviewTypeRegular !== "" &&
    review.reviewTypeRegular !== "null" &&
    String(review.reviewTypeRegular).trim() !== "" &&
    review.reviewTypeRegular !== 0
  ) {
    return normalizeQuarterLabelForSchedule(
      String(review.reviewTypeRegular).trim()
    );
  }

  if (
    review.reviewTypeProbationary != null &&
    review.reviewTypeProbationary !== "" &&
    review.reviewTypeProbationary !== "null" &&
    String(review.reviewTypeProbationary).trim() !== ""
  ) {
    return "M" + String(review.reviewTypeProbationary).trim();
  }

  if (isOthersSelected) {
    if (review.reviewTypeOthersCustom?.trim()) {
      return review.reviewTypeOthersCustom.trim();
    }
    return "Others";
  }

  return "Others";
}

export function getReviewRowClassName(review: EvaluationRecordReview): string {
  const submittedDate = new Date(review.created_at);
  const now = new Date();
  const hoursDiff =
    (now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60);
  const isNew = hoursDiff <= 24;
  const isRecent = hoursDiff > 24 && hoursDiff <= 168;
  const isQuarterLate = isReviewQuarterLate(review);

  if (isQuarterLate) {
    return `${QUARTER_LATE_ROW_CLASS} transition-colors`;
  }

  if (isReviewDraft(review)) {
    return "bg-violet-50 hover:bg-violet-200 border-l-4 border-l-violet-600 transition-colors";
  }

  const statusAccent = getEvaluationStatusRowAccentClass(review.status);
  if (statusAccent) return statusAccent;

  if (isNew) {
    return "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500 transition-colors";
  }
  if (isRecent) {
    return "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500 transition-colors";
  }
  if (isEvaluationStatusAnyPending(review.status)) {
    return "bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500 transition-colors";
  }
  return "hover:bg-gray-100 transition-colors";
}

type EvalRecordTableRowProps = ComponentProps<typeof TableRow> & {
  review: EvaluationRecordReview;
};

/**
 * Table row for evaluation records. Late rows show a native `title` on each cell
 * (browsers ignore `title` on `<tr>`; Radix Tooltip around `<tr>` breaks table markup).
 */
export function EvalRecordTableRow({
  review,
  className,
  children,
  title,
  ...props
}: EvalRecordTableRowProps) {
  const late = isReviewQuarterLate(review);
  const lateTooltip = late ? (title ?? QUARTER_LATE_HOVER_LABEL) : undefined;

  const rowChildren =
    lateTooltip != null
      ? Children.map(children, (child) => {
          if (
            !isValidElement<ComponentProps<typeof TableCell>>(
              child as ReactElement
            )
          ) {
            return child;
          }
          const cell = child as ReactElement<ComponentProps<typeof TableCell>>;
          return cloneElement(cell, {
            title: cell.props.title ?? lateTooltip,
          });
        })
      : children;

  return (
    <TableRow className={className} {...props}>
      {rowChildren}
    </TableRow>
  );
}

export function EvalRecordRowActions({
  review,
  onViewAction,
  onEditAction,
  onDeleteAction,
  onAcceptAction,
  onRejectAction,
  currentUserId,
  draftOwnedByCurrentUser = false,
  allowPendingEditByCurrentUser = false,
  allowDraftEdit = false,
  deleting,
  accepting,
  rejecting,
}: {
  review: EvaluationRecordReview;
  onViewAction: () => void;
  onEditAction?: () => void;
  onDeleteAction?: () => void;
  onAcceptAction?: () => void;
  onRejectAction?: () => void;
  currentUserId?: string | number | null;
  /** When true on a draft row, show View + Edit instead of Accept/Reject. */
  draftOwnedByCurrentUser?: boolean;
  /** When true on a pending row, show Edit for the signed-in evaluator. */
  allowPendingEditByCurrentUser?: boolean;
  /** When true on a draft row, show Edit (e.g. HR may edit any draft). */
  allowDraftEdit?: boolean;
  deleting?: boolean;
  accepting?: boolean;
  rejecting?: boolean;
}) {
  const isDraft = isReviewDraft(review);
  const showDraftEdit =
    isDraft && (draftOwnedByCurrentUser || allowDraftEdit) && onEditAction != null;
  const showApproverReviewActions =
    isReviewApproverActionable(review, currentUserId) &&
    (onAcceptAction != null || onRejectAction != null);
  const showDraftOwnerActions = showDraftEdit;
  const showDraftReviewActions =
    isDraft &&
    !showDraftEdit &&
    (onAcceptAction != null || onRejectAction != null);
  const canDelete = isReviewDeletable(review) && onDeleteAction != null;
  const editDisabledForEvaluator = isReviewEditDisabledForEvaluator(
    review,
    currentUserId
  );
  const canEdit =
    onEditAction != null &&
    !editDisabledForEvaluator &&
    (isReviewEditable(review, currentUserId) ||
      allowPendingEditByCurrentUser ||
      showDraftEdit);
  const showDisabledEdit =
    onEditAction != null &&
    editDisabledForEvaluator;
  const editButtonTitle = editDisabledForEvaluator
    ? isEvaluationStatusRejected(review.status)
      ? "Editing is disabled while this evaluation is rejected"
      : "Editing is disabled for this evaluation status"
    : showDraftEdit
      ? "Edit this draft evaluation"
      : allowPendingEditByCurrentUser ||
          (isEvaluationStatusPending(review.status) && reviewHasApprover(review))
        ? "Edit this pending evaluation"
        : "Edit this evaluation";

  if (showApproverReviewActions) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:justify-end lg:flex-wrap lg:justify-start lg:gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onViewAction}
          aria-label="View evaluation"
          className="h-8 w-8 shrink-0 cursor-pointer border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
        >
          <Eye className="h-4 w-4 lg:hidden" />
          <span className="hidden lg:inline">☰ View</span>
        </Button>
        {onAcceptAction ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onAcceptAction}
            disabled={accepting || rejecting}
            aria-label="Accept evaluation approval"
            title="Accept this evaluation"
            className="h-8 w-8 shrink-0 cursor-pointer border-green-300 bg-green-600 text-white hover:bg-green-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
          >
            {accepting ? (
              <span className="text-xs lg:hidden">…</span>
            ) : (
              <Check className="h-4 w-4 lg:hidden" />
            )}
            <span className="hidden lg:inline">
              {accepting ? "Accepting…" : "✓ Accept"}
            </span>
          </Button>
        ) : null}
        {onRejectAction ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRejectAction}
            disabled={accepting || rejecting}
            aria-label="Reject evaluation approval"
            title="Reject this evaluation"
            className="h-8 w-8 shrink-0 cursor-pointer border-red-300 bg-red-600 text-white hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
          >
            {rejecting ? (
              <span className="text-xs lg:hidden">…</span>
            ) : (
              <X className="h-4 w-4 lg:hidden" />
            )}
            <span className="hidden lg:inline">
              {rejecting ? "Rejecting…" : "✕ Reject"}
            </span>
          </Button>
        ) : null}
      </div>
    );
  }

  if (showDraftOwnerActions) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:justify-end lg:flex-wrap lg:justify-start lg:gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onViewAction}
          aria-label="View evaluation"
          className="h-8 w-8 shrink-0 cursor-pointer border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
        >
          <Eye className="h-4 w-4 lg:hidden" />
          <span className="hidden lg:inline">☰ View</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onEditAction}
          aria-label="Edit evaluation"
          title="Edit this draft evaluation"
          className="h-8 w-8 shrink-0 cursor-pointer border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-500 hover:text-white lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
        >
          <Pencil className="h-4 w-4 lg:hidden" />
          <span className="hidden lg:inline">✏️ Edit</span>
        </Button>
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onDeleteAction}
            disabled={deleting}
            aria-label="Delete evaluation"
            title="Delete this draft evaluation"
            className="h-8 w-8 shrink-0 cursor-pointer border-red-200 bg-red-100 text-red-700 hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
          >
            {deleting ? (
              <span className="text-xs lg:hidden">…</span>
            ) : (
              <Trash2 className="h-4 w-4 lg:hidden" />
            )}
            <span className="hidden lg:inline">
              {deleting ? "Deleting…" : "❌ Delete"}
            </span>
          </Button>
        ) : null}
      </div>
    );
  }

  if (showDraftReviewActions) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:justify-end lg:flex-wrap lg:justify-start lg:gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onViewAction}
          aria-label="View evaluation"
          className="h-8 w-8 shrink-0 cursor-pointer border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
        >
          <Eye className="h-4 w-4 lg:hidden" />
          <span className="hidden lg:inline">☰ View</span>
        </Button>
        {onAcceptAction ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onAcceptAction}
            disabled={accepting || rejecting}
            aria-label="Accept draft evaluation"
            title="Accept this draft evaluation"
            className="h-8 w-8 shrink-0 cursor-pointer border-green-300 bg-green-600 text-white hover:bg-green-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
          >
            {accepting ? (
              <span className="text-xs lg:hidden">…</span>
            ) : (
              <Check className="h-4 w-4 lg:hidden" />
            )}
            <span className="hidden lg:inline">
              {accepting ? "Accepting…" : "✓ Accept"}
            </span>
          </Button>
        ) : null}
        {onRejectAction ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRejectAction}
            disabled={accepting || rejecting}
            aria-label="Reject draft evaluation"
            title="Reject this draft evaluation"
            className="h-8 w-8 shrink-0 cursor-pointer border-red-300 bg-red-600 text-white hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
          >
            {rejecting ? (
              <span className="text-xs lg:hidden">…</span>
            ) : (
              <X className="h-4 w-4 lg:hidden" />
            )}
            <span className="hidden lg:inline">
              {rejecting ? "Rejecting…" : "✕ Reject"}
            </span>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:justify-end lg:flex-wrap lg:justify-start lg:gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onViewAction}
        aria-label="View evaluation"
        className="h-8 w-8 shrink-0 cursor-pointer border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
      >
        <Eye className="h-4 w-4 lg:hidden" />
        <span className="hidden lg:inline">☰ View</span>
      </Button>
      {canEdit || showDisabledEdit ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={showDisabledEdit ? undefined : onEditAction}
          disabled={showDisabledEdit}
          aria-label="Edit evaluation"
          title={editButtonTitle}
          className="h-8 w-8 shrink-0 cursor-pointer border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100 disabled:hover:text-slate-400 lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0 disabled:lg:hover:translate-y-0 disabled:lg:hover:shadow-none"
        >
          <Pencil className="h-4 w-4 lg:hidden" />
          <span className="hidden lg:inline">✏️ Edit</span>
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onDeleteAction}
          disabled={deleting}
          aria-label="Delete evaluation"
          title="Delete this evaluation record"
          className="h-8 w-8 shrink-0 cursor-pointer border-red-200 bg-red-100 text-red-700 hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:w-auto lg:px-2 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
        >
          {deleting ? (
            <span className="text-xs lg:hidden">…</span>
          ) : (
            <Trash2 className="h-4 w-4 lg:hidden" />
          )}
          <span className="hidden lg:inline">
            {deleting ? "Deleting…" : "❌ Delete"}
          </span>
        </Button>
      ) : null}
    </div>
  );
}
