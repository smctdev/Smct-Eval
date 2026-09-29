/**
 * Review-period label stored on evaluation payloads and shown in tables.
 * Others always serializes as "Others", never the custom free-text note.
 */
export function getEvaluationQuarterLabel(form: {
  reviewTypeRegular?: string | number | null;
  reviewTypeProbationary?: string | number | null;
  reviewTypeOthersImprovement?: boolean | number | null;
  reviewTypeOthersCustom?: string | null;
}): string {
  const hasRegular =
    form.reviewTypeRegular != null &&
    form.reviewTypeRegular !== "" &&
    form.reviewTypeRegular !== "null" &&
    String(form.reviewTypeRegular).trim() !== "" &&
    form.reviewTypeRegular !== 0;

  if (hasRegular) return String(form.reviewTypeRegular).trim();

  const hasProbationary =
    form.reviewTypeProbationary != null &&
    form.reviewTypeProbationary !== "" &&
    form.reviewTypeProbationary !== "null" &&
    String(form.reviewTypeProbationary).trim() !== "";

  if (hasProbationary) return "M" + String(form.reviewTypeProbationary).trim();

  return "Others";
}
