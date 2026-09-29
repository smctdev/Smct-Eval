import { apiService } from "@/lib/apiService";
import { getEvaluationQuarterLabel } from "@/lib/evaluationQuarterLabel";
import { toDateInputValue } from "@/lib/dateInputValue";
import {
  type EvaluationEditSession,
  type EvaluationResubmitType,
  isEditSession,
} from "@/lib/evaluationEditTypes";
import { EvaluationPayload } from "@/components/evaluation/types";

export function buildEvaluationSavePayload(
  form: EvaluationPayload,
  extras?: Partial<EvaluationPayload>
): EvaluationPayload {
  const merged = {
    ...form,
    ...extras,
  };

  const hireDate = toDateInputValue(merged.hireDate);
  const coverageFrom = toDateInputValue(merged.coverageFrom);
  const coverageTo = toDateInputValue(merged.coverageTo);

  // Match the original submit body: camelCase only. `quarter` and snake_case
  // date aliases are added only on the draft POST below.
  const payload: Record<string, unknown> = { ...merged };
  delete payload.hire_date;
  delete payload.coverage_from;
  delete payload.coverage_to;
  delete payload.quarter;

  if (hireDate) payload.hireDate = hireDate;
  else delete payload.hireDate;
  if (coverageFrom) payload.coverageFrom = coverageFrom;
  else delete payload.coverageFrom;
  if (coverageTo) payload.coverageTo = coverageTo;
  else delete payload.coverageTo;
  if (payload.created_at === "") delete payload.created_at;

  return payload as unknown as EvaluationPayload;
}

/** Draft endpoints also read snake_case date columns. Omit blanks so MySQL date columns don't 500. */
function withDraftDateAliases(
  payload: EvaluationPayload | Record<string, unknown>
): Record<string, unknown> {
  const source = payload as Record<string, unknown>;
  const hireDate = toDateInputValue(source.hireDate);
  const coverageFrom = toDateInputValue(source.coverageFrom);
  const coverageTo = toDateInputValue(source.coverageTo);

  return {
    ...source,
    quarter: getEvaluationQuarterLabel(source),
    ...(hireDate ? { hire_date: hireDate } : {}),
    ...(coverageFrom ? { coverage_from: coverageFrom } : {}),
    ...(coverageTo ? { coverage_to: coverageTo } : {}),
  };
}

/** Create/new flows and draft edits save on Next. Pending resubmits skip draft POST. */
export function shouldSaveDraftOnNext(
  editSession: EvaluationEditSession | undefined
): boolean {
  if (!isEditSession(editSession)) return true;
  return String(editSession.sourceRecord.status ?? "").toLowerCase() === "draft";
}

export async function saveEvaluationStepDraft(options: {
  employeeId: number | string | null | undefined;
  draftType: EvaluationResubmitType;
  payload: EvaluationPayload | Record<string, unknown>;
  editSession?: EvaluationEditSession;
}): Promise<"saved" | "skipped"> {
  if (!shouldSaveDraftOnNext(options.editSession)) {
    return "skipped";
  }

  if (options.employeeId == null || options.employeeId === "") {
    throw new Error(
      "Missing employee ID. Cannot save this evaluation step as a draft."
    );
  }

  await apiService.postEvaluationDraft(
    options.draftType,
    options.employeeId,
    withDraftDateAliases(options.payload)
  );
  return "saved";
}
