export const PRIORITY_AREA_MIN_CHARS = 20;
/** Started typing, but not yet a complete area. Empty fields do not lock Previous. */
export const PRIORITY_AREA_STARTED_CHARS = 2;

export type PriorityAreaFields = {
  priorityArea1?: string | null;
  priorityArea2?: string | null;
  priorityArea3?: string | null;
};

export type PriorityAreaFieldErrors = {
  priorityArea1: boolean;
  priorityArea2: boolean;
  priorityArea3: boolean;
};

export type PriorityAreaValidationResult = {
  fieldErrors: PriorityAreaFieldErrors;
  /** True when at least one area has 20+ chars and no filled area is under 20. */
  isValid: boolean;
  /** True when all fields are empty (nothing to highlight per-field). */
  showGeneralError: boolean;
};

function getTrimmedLength(value?: string | null): number {
  return (value || "").trim().length;
}

function fieldHasInput(value?: string | null): boolean {
  return getTrimmedLength(value) > 0;
}

function isTooShort(value?: string | null): boolean {
  return fieldHasInput(value) && getTrimmedLength(value) < PRIORITY_AREA_MIN_CHARS;
}

function isStartedButIncomplete(value?: string | null): boolean {
  const length = getTrimmedLength(value);
  return (
    length >= PRIORITY_AREA_STARTED_CHARS &&
    length < PRIORITY_AREA_MIN_CHARS
  );
}

/**
 * True when any priority area has 2+ characters but is still under the
 * 20-character minimum. Empty fields do not disable Previous.
 */
export function shouldDisablePreviousForPriorityAreas(
  data: PriorityAreaFields
): boolean {
  return (
    isStartedButIncomplete(data.priorityArea1) ||
    isStartedButIncomplete(data.priorityArea2) ||
    isStartedButIncomplete(data.priorityArea3)
  );
}

/** At least one priority area must reach the minimum character count. */
export function hasValidPriorityArea(data: PriorityAreaFields): boolean {
  return (
    getTrimmedLength(data.priorityArea1) >= PRIORITY_AREA_MIN_CHARS ||
    getTrimmedLength(data.priorityArea2) >= PRIORITY_AREA_MIN_CHARS ||
    getTrimmedLength(data.priorityArea3) >= PRIORITY_AREA_MIN_CHARS
  );
}

/**
 * Per-field errors when the user typed in that area but it is still under
 * 20 characters. Empty fields are fine. Having one valid area does not
 * clear errors on other short fields.
 */
export function getPriorityAreaFieldErrors(
  data: PriorityAreaFields
): PriorityAreaFieldErrors {
  return {
    priorityArea1: isTooShort(data.priorityArea1),
    priorityArea2: isTooShort(data.priorityArea2),
    priorityArea3: isTooShort(data.priorityArea3),
  };
}

export function hasAnyPriorityAreaError(
  errors: PriorityAreaFieldErrors
): boolean {
  return (
    errors.priorityArea1 || errors.priorityArea2 || errors.priorityArea3
  );
}

export function getPriorityAreaValidationResult(
  data: PriorityAreaFields
): PriorityAreaValidationResult {
  const fieldErrors = getPriorityAreaFieldErrors(data);
  const hasShortFields = hasAnyPriorityAreaError(fieldErrors);
  const hasOneValid = hasValidPriorityArea(data);
  const isValid = hasOneValid && !hasShortFields;

  return {
    fieldErrors,
    isValid,
    showGeneralError: !hasOneValid && !hasShortFields,
  };
}

export const PRIORITY_AREAS_VALIDATION_MESSAGE = `Please enter at least ${PRIORITY_AREA_MIN_CHARS} characters in at least one priority area. Any filled area must also have at least ${PRIORITY_AREA_MIN_CHARS} characters.`;

export const PRIORITY_AREA_FIELD_ERROR_MESSAGE = `Enter at least ${PRIORITY_AREA_MIN_CHARS} characters in this area.`;

export const PRIORITY_AREA_INPUT_PLACEHOLDER = `Enter priority area (min. ${PRIORITY_AREA_MIN_CHARS} characters if filled)`;

export const PRIORITY_AREA_PREVIOUS_SAFETY_MESSAGE = `Finish any started priority area (at least ${PRIORITY_AREA_MIN_CHARS} characters) or clear it before going back.`;
