/**
 * Normalize API / form dates for `<input type="date" />` (YYYY-MM-DD).
 * Avoids UTC day/month shifts from `toISOString()` on local midnights.
 * Does not invent day 01 from month-only values like "2026-07".
 */
export function toDateInputValue(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return "";
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    // PHP/Carbon-style { date: "2026-07-15 00:00:00.000000", ... }
    if (obj.date != null) return toDateInputValue(obj.date);
  }

  const s = String(raw).trim();
  if (!s || s === "null" || s === "undefined" || s === "[object Object]") {
    return "";
  }

  // Full calendar date prefix: "2026-07-15", "2026-07-15 00:00:00", ISO timestamps.
  const ymdMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymdMatch) return ymdMatch[1];

  // Month-only ("2026-07") would parse as day 01 — reject so callers can try another field.
  if (/^\d{4}-\d{2}$/.test(s)) return "";

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Pick the best YYYY-MM-DD from several API field variants.
 * Prefers a full day that is not the 1st when another candidate has a real day
 * (guards against DB columns that got coerced to start-of-month).
 */
export function pickBestDateInputValue(
  ...candidates: unknown[]
): string {
  const normalized = candidates
    .map((c) => toDateInputValue(c))
    .filter((v): v is string => Boolean(v));

  if (normalized.length === 0) return "";

  const withRealDay = normalized.find((v) => !v.endsWith("-01"));
  return withRealDay ?? normalized[0];
}
