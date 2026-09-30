import type { User } from "@/contexts/UserContext";

/** Matches apiService.getBranches(): { label, value } */
export type BranchOption = { label: string; value: string | number };

function findBranchLabel(
  id: unknown,
  branchOptions?: BranchOption[] | null
): string | null {
  if (branchOptions == null || branchOptions.length === 0) return null;
  const idStr = String(id).trim();
  const found = branchOptions.find((b) => String(b.value) === idStr);
  const label = found?.label?.trim();
  return label ? label : null;
}

function getBranchCodeFromObj(branchObj: unknown): string | null {
  if (branchObj == null || typeof branchObj !== "object") return null;
  const rec = branchObj as Record<string, unknown>;
  const code = String(rec.branch_code || rec.code || rec.acronym || "").trim();
  return code ? code : null;
}

function getBranchNameFromObj(branchObj: unknown): string | null {
  if (branchObj == null || typeof branchObj !== "object") return null;
  const rec = branchObj as Record<string, unknown>;
  const name = String(rec.branch_name || rec.name || "").trim();
  return name ? name : null;
}

function parseCodeFromLabel(label: string): string | null {
  const s = label.trim();
  if (!s) return null;

  // Prefer parentheses code: "ALANO (ALAD)"
  const paren = s.match(/\(([^)]+)\)\s*$/);
  if (paren?.[1]) return paren[1].trim();

  // Prefer last part after slash: "Makati / MK"
  if (s.includes("/")) {
    const parts = s.split("/");
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }

  return null;
}

/**
 * Human-readable branch for welcome / summary UIs.
 * Supports nested branches, branch_id-only payloads, and optional branch list
 * to turn numeric IDs into labels (e.g. "Makati / MK").
 */
export function getEmployeeBranchLabel(
  employee: User | null | undefined,
  branchOptions?: BranchOption[] | null
): string {
  if (!employee) return "N/A";

  const anyEmp = employee as unknown as Record<string, unknown>;

  if (employee.branches) {
    const b = Array.isArray(employee.branches)
      ? employee.branches[0]
      : (employee.branches as unknown as Record<string, unknown>);
    if (b && typeof b === "object") {
      const rec = b as Record<string, unknown>;
      const name = String(
        rec.branch_name || rec.name || ""
      ).trim();
      const code = String(
        rec.branch_code || rec.code || ""
      ).trim();

      if (name && code) return `${name} (${code})`;
      if (name) return name;
      if (code) return code;

      const nestedId = rec.id ?? rec.branch_id;
      if (nestedId !== undefined && nestedId !== null && String(nestedId).trim() !== "") {
        const fromList = findBranchLabel(nestedId, branchOptions);
        if (fromList) return fromList;
        return String(nestedId);
      }
    }
  }

  const branchId = anyEmp.branch_id ?? anyEmp.branchId;
  if (branchId !== undefined && branchId !== null && String(branchId).trim() !== "") {
    const fromList = findBranchLabel(branchId, branchOptions);
    if (fromList) return fromList;
    return String(branchId);
  }

  // Prefer full branch object if provided by API.
  const branchObj = anyEmp.branch;
  if (branchObj !== undefined && branchObj !== null) {
    if (typeof branchObj === "object") {
      const name = getBranchNameFromObj(branchObj);
      const code = getBranchCodeFromObj(branchObj);
      if (name && code) return `${name} (${code})`;
      if (name) return name;
      if (code) return code;

      const nestedId = (branchObj as Record<string, unknown>).id ?? (branchObj as Record<string, unknown>).branch_id;
      if (nestedId !== undefined && nestedId !== null && String(nestedId).trim() !== "") {
        const fromList = findBranchLabel(nestedId, branchOptions);
        if (fromList) return fromList;
        return String(nestedId);
      }
    } else {
      const s = String(branchObj).trim();
      if (s) {
        if (/^\d+$/.test(s)) {
          const fromList = findBranchLabel(s, branchOptions);
          if (fromList) return fromList;
        }
        return s;
      }
    }
  }

  const branchName = anyEmp.branch_name;
  if (branchName !== undefined && branchName !== null && String(branchName).trim() !== "") {
    return String(branchName);
  }

  return "N/A";
}

/**
 * True when branch text depends on getBranches() (ID-only payload).
 * In that case we should not show raw IDs while the list is still loading.
 */
export function employeeBranchNeedsLookup(
  employee: User | null | undefined
): boolean {
  if (!employee) return false;

  const anyEmp = employee as unknown as Record<string, unknown>;

  if (anyEmp.branch_name != null && String(anyEmp.branch_name).trim() !== "") {
    return false;
  }

  if (employee.branches) {
    const b = Array.isArray(employee.branches)
      ? employee.branches[0]
      : (employee.branches as unknown as Record<string, unknown>);
    if (b && typeof b === "object") {
      const rec = b as Record<string, unknown>;
      const name = String(rec.branch_name || rec.name || "").trim();
      const code = String(rec.branch_code || rec.code || "").trim();
      if (name || code) return false;
      const nestedId = rec.id ?? rec.branch_id;
      if (nestedId != null && String(nestedId).trim() !== "") {
        return true;
      }
    }
  }

  const branchId = anyEmp.branch_id ?? anyEmp.branchId;
  if (branchId != null && String(branchId).trim() !== "") {
    return true;
  }

  const branchObj = anyEmp.branch;
  if (branchObj != null) {
    if (typeof branchObj === "object") {
      const name = getBranchNameFromObj(branchObj);
      const code = getBranchCodeFromObj(branchObj);
      if (name || code) return false;

      const nestedId =
        (branchObj as Record<string, unknown>).id ??
        (branchObj as Record<string, unknown>).branch_id;
      if (nestedId != null && String(nestedId).trim() !== "") {
        return true;
      }
    } else {
      const s = String(branchObj).trim();
      if (s && /^\d+$/.test(s)) return true;
    }
  }

  return false;
}

/** Branch line for welcome modals: avoids flashing raw branch_id before options load */
export function getEmployeeBranchWelcomeDisplay(
  employee: User | null | undefined,
  branchOptions: BranchOption[] | undefined | null,
  branchListLoading: boolean
): string {
  if (!employee) return "N/A";
  if (branchListLoading && employeeBranchNeedsLookup(employee)) {
    return "Loading\u2026";
  }
  return getEmployeeBranchLabel(employee, branchOptions);
}

/** Branch code stored on an evaluation record (`employee_branch_code`). */
export function getRecordEmployeeBranchCode(
  record:
    | {
        employee_branch_code?: unknown;
        employee?: { employee_branch_code?: unknown } | null;
      }
    | null
    | undefined
): string {
  const raw =
    record?.employee_branch_code ?? record?.employee?.employee_branch_code;
  const text = raw == null ? "" : String(raw).trim();
  return text || "Not specified";
}

/** Branch column display: prefer branch_code (e.g. "ALAD"), fallback to resolved labels. */
export function getEmployeeBranchCodeDisplay(
  employee: User | null | undefined,
  branchOptions: BranchOption[] | undefined | null,
  branchListLoading: boolean
): string {
  if (!employee) return "N/A";
  if (branchListLoading && employeeBranchNeedsLookup(employee)) return "Loading\u2026";

  const anyEmp = employee as unknown as Record<string, unknown>;

  // 1) Full branch object from API
  const branchObj = anyEmp.branch;
  if (branchObj && typeof branchObj === "object") {
    const code = getBranchCodeFromObj(branchObj);
    if (code) return code;

    const nestedId =
      (branchObj as Record<string, unknown>).id ??
      (branchObj as Record<string, unknown>).branch_id;
    if (nestedId != null && String(nestedId).trim() !== "") {
      const fromList = findBranchLabel(nestedId, branchOptions);
      if (fromList) return parseCodeFromLabel(fromList) || fromList;
      return String(nestedId);
    }
  }

  // 2) Legacy nested branches shape
  if (employee.branches) {
    const b = Array.isArray(employee.branches)
      ? employee.branches[0]
      : (employee.branches as unknown as Record<string, unknown>);
    if (b && typeof b === "object") {
      const rec = b as Record<string, unknown>;
      const code = String(rec.branch_code || rec.code || "").trim();
      if (code) return code;

      const nestedId = rec.id ?? rec.branch_id;
      if (nestedId != null && String(nestedId).trim() !== "") {
        const fromList = findBranchLabel(nestedId, branchOptions);
        if (fromList) return parseCodeFromLabel(fromList) || fromList;
        return String(nestedId);
      }
    }
  }

  // 3) branch_id / branchId
  const branchId = anyEmp.branch_id ?? anyEmp.branchId;
  if (branchId != null && String(branchId).trim() !== "") {
    const fromList = findBranchLabel(branchId, branchOptions);
    if (fromList) return parseCodeFromLabel(fromList) || fromList;
    return String(branchId);
  }

  // 4) primitive branch value
  const primitiveBranch = anyEmp.branch;
  if (primitiveBranch != null && typeof primitiveBranch !== "object") {
    const s = String(primitiveBranch).trim();
    if (s) {
      if (/^\d+$/.test(s)) {
        const fromList = findBranchLabel(s, branchOptions);
        if (fromList) return parseCodeFromLabel(fromList) || fromList;
      }
      return s;
    }
  }

  // Final fallback
  const directCode = anyEmp.branch_code ?? anyEmp.branchCode;
  if (directCode != null && String(directCode).trim() !== "") return String(directCode);

  return "N/A";
}

function isHoBranchObject(branchObj: unknown): boolean {
  if (branchObj == null || typeof branchObj !== "object") return false;
  const b = branchObj as Record<string, unknown>;
  const branchName = String(b.branch_name ?? b.name ?? "")
    .toUpperCase()
    .trim();
  const branchCode = String(b.branch_code ?? b.code ?? b.acronym ?? "")
    .toUpperCase()
    .trim();
  return (
    branchName === "HO" ||
    branchCode === "HO" ||
    branchCode === "126" ||
    branchName === "HEAD OFFICE" ||
    branchCode === "HEAD OFFICE" ||
    branchName.includes("HEAD OFFICE") ||
    branchCode.includes("HEAD OFFICE")
  );
}

/**
 * True when the employee being evaluated belongs to Head Office (HO).
 * Does not use evaluationType — branch rank-and-file uses evaluationType "rankNfile" too.
 */
export function isEmployeeHeadOffice(
  employee: User | null | undefined
): boolean {
  if (!employee) return false;

  const anyEmp = employee as unknown as Record<string, unknown>;
  const branchVal = anyEmp.branch;
  if (branchVal !== undefined && branchVal !== null && branchVal !== "") {
    if (isHoBranchObject(branchVal)) return true;
    const s = String(branchVal).toUpperCase().trim();
    if (
      s === "HO" ||
      s === "126" ||
      s === "HEAD OFFICE" ||
      s.includes("HEAD OFFICE")
    ) {
      return true;
    }
  }

  const branchesVal = anyEmp.branches;
  if (Array.isArray(branchesVal)) {
    return branchesVal.some((b) => isHoBranchObject(b));
  }
  if (branchesVal && typeof branchesVal === "object") {
    return isHoBranchObject(branchesVal);
  }

  const branchIdOrValue = anyEmp.branch_id ?? anyEmp.branchId;
  if (
    branchIdOrValue !== undefined &&
    branchIdOrValue !== null &&
    String(branchIdOrValue).trim() !== ""
  ) {
    const s = String(branchIdOrValue).toUpperCase().trim();
    return (
      s === "HO" ||
      s === "126" ||
      s === "HEAD OFFICE" ||
      s.includes("HEAD OFFICE")
    );
  }

  return false;
}
