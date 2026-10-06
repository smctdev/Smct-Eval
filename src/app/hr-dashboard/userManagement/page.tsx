"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Eye,
  FileText,
  FileWarning,
  Pencil,
  Plus,
  Trash2,
  BarChart2,
  X,
  Download,
  RefreshCw,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import EditUserModal from "@/components/EditUserModal";
import AddEmployeeModal from "@/components/AddEmployeeModal";
import { toastMessages } from "@/lib/toastMessages";
import apiService from "@/lib/apiService";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  getCachedPositions,
  getCachedBranches,
  getCachedDepartments,
  getCachedRoles,
} from "@/lib/referenceDataCache";
import { useDialogAnimation } from "@/hooks/useDialogAnimation";
import EvaluationsPagination from "@/components/paginationComponent";
import ViewEmployeeModal from "@/components/ViewEmployeeModal";
import { User, useAuth } from "@/contexts/UserContext";
import {
  dedupeUsersById,
  sortUsersAlphabeticallyByName,
} from "@/lib/sortUsersByName";
import { Combobox } from "@/components/ui/combobox";
import EvaluationForm from "@/components/evaluation";
import EvaluationTypeModal from "@/components/EvaluationTypeModal";
import BranchEvaluationForm from "@/components/evaluation/BranchEvaluationForm";
import BranchRankNfileEvaluationForm from "@/components/evaluation/BranchRankNfileEvaluationForm";
import BranchManagerEvaluationForm from "@/components/evaluation/BranchManagerEvaluationForm";
import AreaManagerEvaluationForm from "@/components/evaluation/AreaManagerEvaluationForm";
import RankNfileHo from "@/components/evaluation/RankNfileHo";
import BasicHo from "@/components/evaluation/BasicHo";
import { getEmployeeBranchCodeDisplay } from "@/components/evaluation/employeeBranchLabel";
import MemorandumViolationModal from "@/components/MemorandumViolationModal";
import ViewEvaluationMobileWarningModal from "@/components/evaluation/ViewEvaluationMobileWarningModal";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { cn } from "@/lib/utils";

/** Evaluation ratings use a 0–5 scale (same as the Employee Average chart axes). */
const PERFORMANCE_RATING_MAX = 5;

function performanceScorePercent(rating: number): string {
  if (rating <= 0 || Number.isNaN(rating)) return "—";
  return `${((rating / PERFORMANCE_RATING_MAX) * 100).toFixed(1)}%`;
}

function normalizePerformanceScore(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed =
    typeof raw === "string"
      ? Number.parseFloat(raw.replace("%", "").trim())
      : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  // Backward-compatible: if payload sends 0-5 instead of 0-100, convert it.
  return parsed <= PERFORMANCE_RATING_MAX ? (parsed / PERFORMANCE_RATING_MAX) * 100 : parsed;
}

function formatScoreWithPercent(
  score: number | null,
  explicitPercent?: number | null
): string {
  if (score == null || Number.isNaN(score)) return "—";
  const percentText =
    explicitPercent != null && Number.isFinite(explicitPercent)
      ? `${explicitPercent.toFixed(1)}%`
      : performanceScorePercent(score);
  return `${score.toFixed(2)} (${percentText})`;
}

function SmctLoadingOverlay({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-[70] flex items-center justify-center rounded-lg bg-white/55 backdrop-blur-[1px]",
        className
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-none flex flex-col items-center gap-3 rounded-lg bg-white/90 px-8 py-6 shadow-lg ring-1 ring-gray-200/80">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src="/smct.png"
              alt=""
              className="h-10 w-10 object-contain"
              width={40}
              height={40}
              decoding="async"
            />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-600">{label ?? "Loading..."}</p>
      </div>
    </div>
  );
}

interface Employee {
  id: number;
  fname: string;
  lname: string;
  emp_id: number;
  email: string;
  positions: any;
  departments: any;
  branches: any;
  hireDate: Date;
  roles: any;
  username: string;
  password: string;
  is_active: string;
  avatar?: string | null;
  bio?: string | null;
  contact?: string;
  created_at: string;
  updated_at?: string;
}

interface RoleType {
  id: string;
  name: string;
}

export default function UserManagementTab() {
  const { user } = useAuth();
  const isMobileViewport = useMobileViewport();
  
  // Hide admin users in HR dashboard (only show in admin dashboard)
  const shouldHideAdminUsers = true; // Set to true for HR dashboard

  /** True if any role is admin (do not rely on roles[0] — order varies). */
  const userHasAdminRole = (u: User | null | undefined): boolean => {
    if (!u?.roles || !Array.isArray(u.roles)) return false;
    return u.roles.some(
      (r: { name?: string }) =>
        String(r?.name ?? "").toLowerCase() === "admin"
    );
  };

  /** Role label for table/badge: prefer a non-admin role when multiple exist. */
  const getDisplayRoleName = (u: User | null | undefined): string | undefined => {
    if (!u?.roles || !Array.isArray(u.roles) || u.roles.length === 0)
      return undefined;
    const nonAdmin = u.roles.find(
      (r: { name?: string }) =>
        String(r?.name ?? "").toLowerCase() !== "admin"
    );
    return (nonAdmin ?? u.roles[0])?.name;
  };

  // NOTE: Filtering admins only on the client breaks pagination (sparse pages, wrong totals).
  // Prefer excluding admins in GET /getAllActiveUsers when the caller is HR, if the API supports it.

  // Helper function to check if employee is HO (Head Office)
  // This determines the evaluationType based on the employee being evaluated, not the evaluator
  const isEmployeeHO = (employee: User | null): boolean => {
    if (!employee) return false;

    const isHoBranchObj = (branchObj: unknown): boolean => {
      if (!branchObj || typeof branchObj !== "object") return false;
      const b = branchObj as any;
      const branchName = String(b.branch_name ?? b.name ?? "").toUpperCase().trim();
      const branchCode = String(b.branch_code ?? b.code ?? b.acronym ?? "").toUpperCase().trim();
      return (
        branchName === "HO" ||
        branchCode === "HO" ||
        branchCode === "126" ||
        branchName === "HEAD OFFICE" ||
        branchCode === "HEAD OFFICE" ||
        branchName.includes("HEAD OFFICE") ||
        branchCode.includes("HEAD OFFICE")
      );
    };

    // 1) Prefer direct `employee.branch`
    const branchVal = (employee as any).branch;
    if (branchVal !== undefined && branchVal !== null && branchVal !== "") {
      if (isHoBranchObj(branchVal)) return true;
      const s = String(branchVal).toUpperCase().trim();
      return s === "HO" || s === "126" || s === "HEAD OFFICE" || s.includes("HEAD OFFICE");
    }

    // 2) Scan `employee.branches` for an HO entry
    const branchesVal = (employee as any).branches;
    if (Array.isArray(branchesVal)) {
      return branchesVal.some((b: any) => isHoBranchObj(b));
    }
    if (branchesVal && typeof branchesVal === "object") {
      return isHoBranchObj(branchesVal);
    }

    // 3) Legacy: branch_id / branchId
    const branchIdOrValue = (employee as any).branch_id ?? (employee as any).branchId;
    if (branchIdOrValue !== undefined && branchIdOrValue !== null && branchIdOrValue !== "") {
      const s = String(branchIdOrValue).toUpperCase().trim();
      return s === "HO" || s === "126" || s === "HEAD OFFICE" || s.includes("HEAD OFFICE");
    }

    return false;
  };
  
  const [activeRegistrations, setActiveRegistrations] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [activeTotalItems, setActiveTotalItems] = useState(0);

  //data
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [positionsData, setPositionData] = useState<any[]>([]);
  const [branchesData, setBranchesData] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);

  // Helper function to get branch code from branch data
  const getBranchCode = (branch: any): string => {
    if (!branch) return "N/A";
    
    // If branch has branch_code directly
    if (branch.branch_code) {
      return branch.branch_code;
    }
    
    // If branch has branch_name, try to find matching branch in branchesData
    if (branch.branch_name && branchesData.length > 0) {
      // branchesData comes from getBranches which returns { label: "branch_name / branch_code", value: "id" }
      const foundBranch = branchesData.find((b: any) => {
        if (b.label) {
          const labelParts = b.label.split(" /");
          return labelParts[0] === branch.branch_name;
        }
        return false;
      });
      
      if (foundBranch?.label) {
        const labelParts = foundBranch.label.split(" /");
        return labelParts[1] || labelParts[0] || branch.branch_name;
      }
    }
    
    // If branch is an ID, find branch in branchesData
    const branchId = Number(branch);
    if (!Number.isNaN(branchId) && branchesData.length > 0) {
      const foundBranch = branchesData.find(
        (b: any) => Number(b?.value) === branchId
      );
      if (foundBranch?.label) {
        const labelParts = String(foundBranch.label).split(" /");
        return (labelParts[1] || labelParts[0] || "N/A").trim();
      }
    }

    // Fallback to branch_name if code not found
    return branch.branch_name || "N/A";
  };

  const getUserBranchCode = (employee: User | null): string => {
    if (!employee) return "N/A";

    if (employee.branches) {
      const branchData = Array.isArray(employee.branches)
        ? employee.branches[0]
        : employee.branches;
      const codeFromBranches = getBranchCode(branchData);
      if (codeFromBranches !== "N/A") return codeFromBranches;
    }

    const employeeAny = employee as any;
    const branchIdOrValue = employeeAny.branch_id ?? employeeAny.branch;
    if (branchIdOrValue !== undefined && branchIdOrValue !== null && branchIdOrValue !== "") {
      return getBranchCode(branchIdOrValue);
    }

    return "N/A";
  };

  const getEmployeeBranchDisplay = (emp: User | null): string => {
    if (!emp) return "N/A";

    if (emp.branches) {
      const b = Array.isArray(emp.branches)
        ? emp.branches[0]
        : (emp.branches as any);
      if (b) {
        const name = b.branch_name || b.name || "";
        const code = b.branch_code || b.code || getBranchCode(b);
        return code ? `${name || code} (${code})` : name || "N/A";
      }
    }

    // Fallback for payloads that only include branch_id/branch
    const code = getUserBranchCode(emp as any);
    return code !== "N/A" ? code : "N/A";
  };

  const isHOBranchSelected = (branchId: string): boolean => {
    if (!branchId) return false;
    const label =
      branchesData?.find((b: any) => String(b.value) === String(branchId))
        ?.label || "";
    const upper = String(label).toUpperCase();
    const parts = upper.split(" /");
    const name = (parts[0] || "").trim();
    const code = (parts[1] || "").trim();
    return (
      name === "HO" ||
      code === "HO" ||
      name === "HEAD OFFICE" ||
      code === "HEAD OFFICE" ||
      name.includes("HEAD OFFICE") ||
      code.includes("HEAD OFFICE")
    );
  };

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEvaluationTypeModalOpen, setIsEvaluationTypeModalOpen] =
    useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [bypassEvaluationMobileWarning, setBypassEvaluationMobileWarning] =
    useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [evaluationType, setEvaluationType] = useState<
    "employee" | "manager" | "areaManager" | null
  >(null);

  useEffect(() => {
    if (!isEvaluationModalOpen) {
      setBypassEvaluationMobileWarning(false);
    }
  }, [isEvaluationModalOpen]);

  const closeEvaluationModal = () => {
    setIsEvaluationModalOpen(false);
    setSelectedEmployee(null);
    setEvaluationType(null);
  };

  // Use dialog animation hook (0.4s to match EditUserModal speed)
  const dialogAnimationClass = useDialogAnimation({ duration: 0.4 });
  const [userToEdit, setUserToEdit] = useState<any>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [isEvaluationDeleteAlertOpen, setIsEvaluationDeleteAlertOpen] =
    useState(false);
  const [evaluationDeleteAlertMessage, setEvaluationDeleteAlertMessage] =
    useState("");
  const [evaluationDeleteEmployeeName, setEvaluationDeleteEmployeeName] =
    useState("");
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<number>>(new Set());

  //filters for active users
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [debouncedActiveSearchTerm, setDebouncedActiveSearchTerm] =
    useState(activeSearchTerm);
  const [roleFilter, setRoleFilter] = useState("0"); // Default to "All Roles"
  const [debouncedRoleFilter, setDebouncedRoleFilter] = useState(roleFilter);
  const [activeBranchFilter, setActiveBranchFilter] = useState("all"); // Active table only
  const [debouncedActiveBranchFilter, setDebouncedActiveBranchFilter] =
    useState(activeBranchFilter);
  const [showActiveFilterHighlight, setShowActiveFilterHighlight] = useState(false);
  //pagination
  const [currentPageActive, setCurrentPageActive] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [totalItems, setTotalItems] = useState(0);
  const [totalActivePages, setTotalActivePages] = useState(1);
  const [perPage, setPerPage] = useState(0);
  //data to view
  const [employeeToView, setEmployeeToView] = useState<User | null>(null);
  const [isViewEmployeeModalOpen, setIsViewEmployeeModalOpen] = useState(false);
  const [employeeForAverage, setEmployeeForAverage] = useState<User | null>(null);
  const [isAverageModalOpen, setIsAverageModalOpen] = useState(false);
  const [showNoDataAlert, setShowNoDataAlert] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  /** Shown after Employee Average → Export CSV completes successfully (separate from branch-quarter export). */
  const [showAverageExportSuccess, setShowAverageExportSuccess] = useState(false);
  /** Shown after Branch / Quarter summary → Export CSV completes successfully. */
  const [showBranchQuarterExportSuccess, setShowBranchQuarterExportSuccess] =
    useState(false);
  const [showExportError, setShowExportError] = useState(false);
  const [isBulkUploadSuccessModalOpen, setIsBulkUploadSuccessModalOpen] = useState(false);
  const [isBulkUploadProcessing, setIsBulkUploadProcessing] = useState(false);
  const [recordedYearsForAverage, setRecordedYearsForAverage] = useState<{ year: number }[]>([]);
  const [loadingRecordedYears, setLoadingRecordedYears] = useState(false);
  const [averageModalYear, setAverageModalYear] = useState<string>("");
  const [averageTableData, setAverageTableData] = useState<{ rows: { quarter: string; rating: number }[]; average: number } | null>(null);
  const [loadingAverageTable, setLoadingAverageTable] = useState(false);
  const [isBranchQuarterModalOpen, setIsBranchQuarterModalOpen] = useState(false);
  const [recordedYearsForBranchQuarter, setRecordedYearsForBranchQuarter] = useState<{ year: number }[]>([]);
  const [loadingRecordedYearsForBranchQuarter, setLoadingRecordedYearsForBranchQuarter] = useState(false);
  const [branchQuarterYear, setBranchQuarterYear] = useState<string>("");
  const [branchQuarterBranchId, setBranchQuarterBranchId] = useState<string>("");
  const [branchQuarterDepartmentId, setBranchQuarterDepartmentId] = useState<string>("");
  const [showExportMissingDataWarning, setShowExportMissingDataWarning] = useState(false);
  const [loadingBranchQuarterTable, setLoadingBranchQuarterTable] = useState(false);
  const [branchQuarterTableRows, setBranchQuarterTableRows] = useState<
    | {
        employeeId: number;
        name: string;
        branch: string;
        position: string;
        department: string;
        q1: number | null;
        q2: number | null;
        q3: number | null;
        q4: number | null;
        average: number | null;
        q1Performance?: number | null;
        q2Performance?: number | null;
        q3Performance?: number | null;
        q4Performance?: number | null;
        averagePerformance?: number | null;
      }[]
    | null
  >(null);

  const branchQuarterItemsPerPage = 10;
  /** Minimum time to show branch-quarter loading UI (ms). */
  const branchQuarterLoadingDurationMs = 2500;
  const [branchQuarterCurrentPage, setBranchQuarterCurrentPage] = useState(1);
  const [loadingBranchQuarterPage, setLoadingBranchQuarterPage] = useState(false);
  const branchQuarterPagingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const handleBranchQuarterPageChange = (page: number) => {
    if (page === branchQuarterCurrentPage) return;
    setBranchQuarterCurrentPage(page);
    setLoadingBranchQuarterPage(true);
    if (branchQuarterPagingTimerRef.current) {
      clearTimeout(branchQuarterPagingTimerRef.current);
    }
    branchQuarterPagingTimerRef.current = setTimeout(() => {
      setLoadingBranchQuarterPage(false);
      branchQuarterPagingTimerRef.current = null;
    }, branchQuarterLoadingDurationMs);
  };

  const branchQuarterPageSkeletonRows = useMemo(() => {
    if (!branchQuarterTableRows?.length) return branchQuarterItemsPerPage;
    const sliceStart =
      (branchQuarterCurrentPage - 1) * branchQuarterItemsPerPage;
    const n = Math.min(
      branchQuarterItemsPerPage,
      Math.max(0, branchQuarterTableRows.length - sliceStart)
    );
    return Math.max(1, n);
  }, [
    branchQuarterTableRows,
    branchQuarterCurrentPage,
    branchQuarterItemsPerPage,
  ]);

  const [selectedEmployeeForEvaluation, setSelectedEmployeeForEvaluation] =
    useState<User | null>(null);
  const [isMemorandumViolationModalOpen, setIsMemorandumViolationModalOpen] =
    useState(false);
  const [employeeForMemorandumViolation, setEmployeeForMemorandumViolation] =
    useState<User | null>(null);
  const [memorandumPickerBranchId, setMemorandumPickerBranchId] = useState<
    string | undefined
  >(undefined);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);
  const activeFilterHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track when page change started for active users
  const activePageChangeStartTimeRef = useRef<number | null>(null);
  const activeUsersInFlightKeyRef = useRef<string | null>(null);
  const activeUsersInFlightPromiseRef = useRef<Promise<void> | null>(null);

  const loadActiveUsers = async (
    searchValue: string,
    roleFilterValue: string,
    branchFilterValue: string
  ) => {
    const normalizedBranch = branchFilterValue === "all" ? "" : branchFilterValue;
    const requestKey = JSON.stringify({
      searchValue,
      roleFilterValue,
      normalizedBranch,
      currentPageActive,
      itemsPerPage,
    });

    // Deduplicate identical concurrent requests (same query params + pagination).
    if (
      activeUsersInFlightKeyRef.current === requestKey &&
      activeUsersInFlightPromiseRef.current
    ) {
      await activeUsersInFlightPromiseRef.current;
      return;
    }

    const requestPromise = (async () => {
      try {
        const response = await apiService.getActiveRegistrations(
          searchValue,
          roleFilterValue,
          currentPageActive,
          itemsPerPage,
          normalizedBranch
        );

        setActiveRegistrations(
          dedupeUsersById(Array.isArray(response.data) ? response.data : [])
        );
        setActiveTotalItems(response.total);
        setTotalActivePages(response.last_page);
        setPerPage(response.per_page);
      } catch (error) {
        console.error("Error loading active users:", error);
      } finally {
        // If this was a page change, ensure minimum display time (2 seconds)
        if (activePageChangeStartTimeRef.current !== null) {
          const elapsed = Date.now() - activePageChangeStartTimeRef.current;
          const minDisplayTime = 2000; // 2 seconds
          const remainingTime = Math.max(0, minDisplayTime - elapsed);

          setTimeout(() => {
            setIsPageLoading(false);
            activePageChangeStartTimeRef.current = null;
          }, remainingTime);
        }

        if (activeUsersInFlightKeyRef.current === requestKey) {
          activeUsersInFlightKeyRef.current = null;
          activeUsersInFlightPromiseRef.current = null;
        }
      }
    })();

    activeUsersInFlightKeyRef.current = requestKey;
    activeUsersInFlightPromiseRef.current = requestPromise;
    await requestPromise;
  };

  const refreshReferenceData = async (options?: { force?: boolean }) => {
    const [positions, branches, departments] = await Promise.all([
      getCachedPositions(options),
      getCachedBranches(options),
      getCachedDepartments(options),
    ]);
    setPositionData(positions);
    setBranchesData(branches);
    setDepartmentData(departments);
  };

  //render when page reload not loading not everySearch or Filters
  useEffect(() => {
    const mountData = async () => {
      setRefresh(true);
      try {
        await refreshReferenceData();
        const roles = await getCachedRoles();
        setRoles(roles);
      } catch (error) {
        console.error("Error refreshing data:", error);
        setRefresh(false);
      } finally {
        setRefresh(false);
      }
    };
    mountData();
  }, []);

  //mount every activeSearchTerm, roleFilter, or branchFilter changes
  useEffect(() => {
    const handler = setTimeout(() => {
      if (activeSearchTerm.trim() !== "") {
        setCurrentPageActive(1);
      }
      setDebouncedActiveSearchTerm(activeSearchTerm);
      setDebouncedRoleFilter(roleFilter);
      setDebouncedActiveBranchFilter(activeBranchFilter);
    }, 500);

    return () => clearTimeout(handler);
  }, [activeSearchTerm, roleFilter, activeBranchFilter]);

  // Briefly highlight Active Users table when a non-default filter is applied.
  useEffect(() => {
    const hasActiveFilter = roleFilter !== "0" || activeBranchFilter !== "all";

    if (activeFilterHighlightTimeoutRef.current) {
      clearTimeout(activeFilterHighlightTimeoutRef.current);
      activeFilterHighlightTimeoutRef.current = null;
    }

    if (!hasActiveFilter) {
      setShowActiveFilterHighlight(false);
      return;
    }

    setShowActiveFilterHighlight(true);
    activeFilterHighlightTimeoutRef.current = setTimeout(() => {
      setShowActiveFilterHighlight(false);
      activeFilterHighlightTimeoutRef.current = null;
    }, 5000);

    return () => {
      if (activeFilterHighlightTimeoutRef.current) {
        clearTimeout(activeFilterHighlightTimeoutRef.current);
        activeFilterHighlightTimeoutRef.current = null;
      }
    };
  }, [roleFilter, activeBranchFilter]);

  // Fetch API whenever debounced active search term changes
  useEffect(() => {
    const fetchData = async () => {
      await loadActiveUsers(
        debouncedActiveSearchTerm,
        debouncedRoleFilter,
        debouncedActiveBranchFilter
      );
    };

    fetchData();
  }, [
    debouncedActiveSearchTerm,
    debouncedRoleFilter,
    debouncedActiveBranchFilter,
    currentPageActive,
  ]);

  // Function to refresh user data
  const refreshUserData = async (showLoading = false) => {
    try {
      setRefresh(true);
      await loadActiveUsers(activeSearchTerm, roleFilter, activeBranchFilter);

      if (showLoading) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } catch (error) {
      console.error("❌ Error refreshing user data:", error);
      toastMessages.generic.error(
        "Refresh Failed",
        "Failed to refresh user data. Please try again."
      );
    } finally {
      setRefresh(false);
    }
  };

  // Handlers
  const openEditModal = async (user: any) => {
    try {
      setUserToEdit(user);
      setIsEditModalOpen(true);
    } catch (error) {
      console.log(error);
    }
  };

  const openDeleteModal = (employee: User) => {
    setEmployeeToDelete(employee);
    setIsDeleteModalOpen(true);
  };

  const loadAverageTableForYear = async (year?: string) => {
    const targetYear = year || averageModalYear;
    if (!employeeForAverage?.id || !targetYear) return;
    setLoadingAverageTable(true);
    setAverageTableData(null);
    try {
      const employeeName = `${employeeForAverage.fname || ""} ${employeeForAverage.lname || ""}`.trim();
      const response = await apiService.getSubmissions(
        employeeName,
        1,
        100,
        "",
        "",
        targetYear,
        "",
        ""
      );
      const list: any[] = response?.data || [];
      const employeeId = Number(employeeForAverage.id);
      const forEmployee = list.filter((ev: any) => {
        const evEmpId = ev.employee?.id != null ? Number(ev.employee.id) : null;
        return evEmpId === employeeId || (ev.employee?.fname && ev.employee?.lname && `${ev.employee.fname} ${ev.employee.lname}`.trim() === employeeName);
      });
      const getQuarter = (ev: any): string => {
        if (ev.reviewTypeOthersImprovement || (ev.reviewTypeOthersCustom && String(ev.reviewTypeOthersCustom).trim())) return "Others";
        if (ev.reviewTypeProbationary != null && ev.reviewTypeProbationary !== "" && ev.reviewTypeProbationary !== "null") return `M${ev.reviewTypeProbationary}`;
        if (ev.reviewTypeRegular) return String(ev.reviewTypeRegular);
        const d = new Date(ev.created_at || ev.submittedAt);
        const m = d.getMonth() + 1;
        return `Q${Math.ceil(m / 3)}`;
      };
      const rows = forEmployee.map((ev: any) => ({
        quarter: getQuarter(ev),
        rating: Number(ev.rating) || 0,
      }));
      const sum = rows.reduce((acc: number, r: { quarter: string; rating: number }) => acc + r.rating, 0);
      const average = rows.length > 0 ? sum / rows.length : 0;
      setAverageTableData({ rows, average });
    } catch {
      setAverageTableData({ rows: [], average: 0 });
    } finally {
      setLoadingAverageTable(false);
    }
  };

  const showDepartmentInBranchQuarter = isHOBranchSelected(branchQuarterBranchId);

  // Load branch quarterly data for all employees in that branch+year.
  // Table shows Q1-Q4 and an average over only the quarters that exist.
  const loadBranchQuarterTable = async () => {
    const targetYear = branchQuarterYear;
    const targetBranchId = branchQuarterBranchId;
    const targetDepartmentId = branchQuarterDepartmentId;

    if (!targetYear || !targetBranchId) return;

    const loadStartedAt = Date.now();
    setLoadingBranchQuarterTable(true);
    setLoadingBranchQuarterPage(false);
    if (branchQuarterPagingTimerRef.current) {
      clearTimeout(branchQuarterPagingTimerRef.current);
      branchQuarterPagingTimerRef.current = null;
    }
    setBranchQuarterTableRows(null);

    try {
      // Fetch all active users in this branch, then keep only HR/Evaluator/Employee roles.
      const userResp = await apiService.getActiveRegistrations(
        "",
        "0",
        1,
        2000,
        targetBranchId,
        // Department filter should only apply for HO; otherwise ignore.
        showDepartmentInBranchQuarter ? targetDepartmentId : ""
      );

      const usersList: any[] = Array.isArray(userResp)
        ? userResp
        : userResp?.data || userResp?.users || [];

      const allowedRoleNames = new Set(["employee", "hr", "evaluator"]);
      const employeesList = sortUsersAlphabeticallyByName(
        usersList.filter((u: any) => {
          if (shouldHideAdminUsers && userHasAdminRole(u)) return false;
          const rolesArr = u?.roles && Array.isArray(u.roles) ? u.roles : [];
          return rolesArr.some((r: { name?: string }) =>
            allowedRoleNames.has(String(r?.name || "").toLowerCase())
          );
        })
      );

      // 2) Fetch all evaluations for this branch+year.
      const evalResp = await apiService.getSubmissions(
        "",
        1,
        5000,
        "",
        "",
        targetYear,
        "",
        targetBranchId
      );

      const evaluationsList: any[] = Array.isArray(evalResp)
        ? evalResp
        : evalResp?.data || [];

      const quarterMap: Record<
        number,
        {
          q1: number | null;
          q2: number | null;
          q3: number | null;
          q4: number | null;
          q1Performance: number | null;
          q2Performance: number | null;
          q3Performance: number | null;
          q4Performance: number | null;
        }
      > = {};

      const getQuarter = (ev: any): "Q1" | "Q2" | "Q3" | "Q4" | null => {
        const regular = ev?.reviewTypeRegular;
        if (typeof regular === "string") {
          if (regular.includes("Q1")) return "Q1";
          if (regular.includes("Q2")) return "Q2";
          if (regular.includes("Q3")) return "Q3";
          if (regular.includes("Q4")) return "Q4";
        }

        const dt = ev?.created_at || ev?.submittedAt || ev?.createdAt;
        if (!dt) return null;
        const d = new Date(dt);
        if (isNaN(d.getTime())) return null;
        const month = d.getMonth() + 1;

        if (month >= 1 && month <= 3) return "Q1";
        if (month >= 4 && month <= 6) return "Q2";
        if (month >= 7 && month <= 9) return "Q3";
        return "Q4";
      };

      const ensureBucket = (employeeId: number) => {
        if (!quarterMap[employeeId]) {
          quarterMap[employeeId] = {
            q1: null,
            q2: null,
            q3: null,
            q4: null,
            q1Performance: null,
            q2Performance: null,
            q3Performance: null,
            q4Performance: null,
          };
        }
        return quarterMap[employeeId];
      };

      const allowedEmployeeIds = new Set(
        employeesList
          .map((u: any) => (u?.id != null ? Number(u.id) : NaN))
          .filter((id: number) => Number.isFinite(id))
      );

      evaluationsList.forEach((ev: any) => {
        const emp = ev?.employee || {};
        const idRaw =
          emp?.id ?? ev?.employee_id ?? ev?.employeeId ?? ev?.emp_id;
        const employeeId = idRaw != null ? Number(idRaw) : NaN;
        if (!Number.isFinite(employeeId)) return;
        if (!allowedEmployeeIds.has(employeeId)) return;

        const quarter = getQuarter(ev);
        if (!quarter) return;

        const ratingVal = Number(ev?.rating);
        // Treat missing/0 as no rating => render as "-"
        if (!Number.isFinite(ratingVal) || ratingVal <= 0) return;
        const performanceVal = normalizePerformanceScore(
          ev?.performanceScore ?? ev?.performance_score
        );

        const bucket = ensureBucket(employeeId);
        if (quarter === "Q1") {
          bucket.q1 = ratingVal;
          bucket.q1Performance = performanceVal;
        }
        if (quarter === "Q2") {
          bucket.q2 = ratingVal;
          bucket.q2Performance = performanceVal;
        }
        if (quarter === "Q3") {
          bucket.q3 = ratingVal;
          bucket.q3Performance = performanceVal;
        }
        if (quarter === "Q4") {
          bucket.q4 = ratingVal;
          bucket.q4Performance = performanceVal;
        }
      });

      const rows = employeesList.map((emp: any) => {
        const employeeId = emp?.id != null ? Number(emp.id) : NaN;
        const bucket =
          quarterMap[Number.isFinite(employeeId) ? employeeId : -1] || {
            q1: null,
            q2: null,
            q3: null,
            q4: null,
            q1Performance: null,
            q2Performance: null,
            q3Performance: null,
            q4Performance: null,
          };

        const ratings = [bucket.q1, bucket.q2, bucket.q3, bucket.q4].filter(
          (v): v is number => typeof v === "number" && !isNaN(v)
        );
        const averageVal =
          ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        const availablePerformance = [
          bucket.q1Performance,
          bucket.q2Performance,
          bucket.q3Performance,
          bucket.q4Performance,
        ].filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
        const averagePerformanceVal =
          availablePerformance.length > 0
            ? availablePerformance.reduce((a, b) => a + b, 0) /
              availablePerformance.length
            : averageVal != null
            ? Number.parseFloat(performanceScorePercent(averageVal).replace("%", ""))
            : null;

        return {
          employeeId,
          name: `${emp?.fname || ""} ${emp?.lname || ""}`.trim(),
          branch: getEmployeeBranchDisplay(emp as any),
          position:
            emp?.positions?.label ||
            emp?.position ||
            emp?.positions?.name ||
            "N/A",
          department:
            emp?.departments?.department_name ||
            emp?.departments?.label ||
            emp?.department ||
            "N/A",
          q1: bucket.q1,
          q2: bucket.q2,
          q3: bucket.q3,
          q4: bucket.q4,
          average:
            averageVal != null ? Number(averageVal.toFixed(2)) : null,
          q1Performance: bucket.q1Performance,
          q2Performance: bucket.q2Performance,
          q3Performance: bucket.q3Performance,
          q4Performance: bucket.q4Performance,
          averagePerformance:
            averagePerformanceVal != null
              ? Number(averagePerformanceVal.toFixed(1))
              : null,
        };
      });

      setBranchQuarterTableRows(rows);
    } catch (error) {
      console.error("Error loading branch quarter table:", error);
      setBranchQuarterTableRows([]);
    } finally {
      const elapsed = Date.now() - loadStartedAt;
      await new Promise((r) =>
        setTimeout(r, Math.max(0, branchQuarterLoadingDurationMs - elapsed))
      );
      setLoadingBranchQuarterTable(false);
    }
  };

  // Load recorded years for the branch quarterly report modal.
  useEffect(() => {
    if (!isBranchQuarterModalOpen) {
      setRecordedYearsForBranchQuarter([]);
      setBranchQuarterYear("");
      setBranchQuarterBranchId("");
      setBranchQuarterDepartmentId("");
      setBranchQuarterTableRows(null);
      setShowBranchQuarterExportSuccess(false);
      return;
    }

    let cancelled = false;
    setLoadingRecordedYearsForBranchQuarter(true);
    apiService
      .getAllYears()
      .then((years: { year: number }[]) => {
        if (cancelled || !Array.isArray(years)) return;
        const sorted = [...years].sort((a, b) => b.year - a.year);
        setRecordedYearsForBranchQuarter(sorted);

        const currentYear = new Date().getFullYear();
        const match = sorted.find((y) => Number(y.year) === currentYear);
        setBranchQuarterYear(match ? String(match.year) : "");
      })
      .catch(() => {
        if (!cancelled) setRecordedYearsForBranchQuarter([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecordedYearsForBranchQuarter(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBranchQuarterModalOpen]);

  // If user switches away from HO branch, clear Department filter.
  useEffect(() => {
    if (!showDepartmentInBranchQuarter && branchQuarterDepartmentId) {
      setBranchQuarterDepartmentId("");
    }
  }, [showDepartmentInBranchQuarter, branchQuarterDepartmentId]);

  // Reset branch-quarter table pagination when filters change.
  useEffect(() => {
    if (!isBranchQuarterModalOpen) return;
    setBranchQuarterCurrentPage(1);
  }, [
    isBranchQuarterModalOpen,
    branchQuarterYear,
    branchQuarterBranchId,
    branchQuarterDepartmentId,
    showDepartmentInBranchQuarter,
  ]);

  // Clamp page if the row count shrinks (e.g., switching year/branch).
  useEffect(() => {
    if (!isBranchQuarterModalOpen) return;
    const totalRows = branchQuarterTableRows?.length ?? 0;
    const totalPages = Math.max(
      1,
      Math.ceil(totalRows / branchQuarterItemsPerPage)
    );
    setBranchQuarterCurrentPage((p) => Math.min(p, totalPages));
  }, [branchQuarterTableRows?.length, isBranchQuarterModalOpen]);

  // Clear pagination loading when branch-quarter modal closes.
  useEffect(() => {
    if (isBranchQuarterModalOpen) return;
    if (branchQuarterPagingTimerRef.current) {
      clearTimeout(branchQuarterPagingTimerRef.current);
      branchQuarterPagingTimerRef.current = null;
    }
    setLoadingBranchQuarterPage(false);
  }, [isBranchQuarterModalOpen]);

  // Load the quarterly table when Year+Branch are selected.
  useEffect(() => {
    if (!isBranchQuarterModalOpen) return;
    if (!branchQuarterYear || !branchQuarterBranchId) return;
    void loadBranchQuarterTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isBranchQuarterModalOpen,
    branchQuarterYear,
    branchQuarterBranchId,
    branchQuarterDepartmentId,
    showDepartmentInBranchQuarter,
  ]);

  const performBranchQuarterExport = async () => {
    if (!branchQuarterTableRows || branchQuarterTableRows.length === 0) return;
    setShowExportMissingDataWarning(false);
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const branchLabel =
        branchesData?.find(
          (b: any) => String(b.value) === String(branchQuarterBranchId)
        )?.label || branchQuarterBranchId || "Branch";
      const safeYear = branchQuarterYear || "Year";
      const csvRows: string[][] = [
        showDepartmentInBranchQuarter
          ? ["Name", "Branch", "Department", "Position", "Q1", "Q2", "Q3", "Q4", "Average"]
          : ["Name", "Branch", "Position", "Q1", "Q2", "Q3", "Q4", "Average"],
        ...branchQuarterTableRows.map((row) =>
          showDepartmentInBranchQuarter
            ? [
                row.name,
                row.branch,
                row.department,
                row.position,
                row.q1 != null
                  ? formatScoreWithPercent(row.q1, row.q1Performance)
                  : "-",
                row.q2 != null
                  ? formatScoreWithPercent(row.q2, row.q2Performance)
                  : "-",
                row.q3 != null
                  ? formatScoreWithPercent(row.q3, row.q3Performance)
                  : "-",
                row.q4 != null
                  ? formatScoreWithPercent(row.q4, row.q4Performance)
                  : "-",
                row.average != null
                  ? formatScoreWithPercent(
                      row.average,
                      row.averagePerformance
                    )
                  : "-",
              ]
            : [
                row.name,
                row.branch,
                row.position,
                row.q1 != null
                  ? formatScoreWithPercent(row.q1, row.q1Performance)
                  : "-",
                row.q2 != null
                  ? formatScoreWithPercent(row.q2, row.q2Performance)
                  : "-",
                row.q3 != null
                  ? formatScoreWithPercent(row.q3, row.q3Performance)
                  : "-",
                row.q4 != null
                  ? formatScoreWithPercent(row.q4, row.q4Performance)
                  : "-",
                row.average != null
                  ? formatScoreWithPercent(
                      row.average,
                      row.averagePerformance
                    )
                  : "-",
              ]
        ),
      ];
      const escapeCell = (cell: string) => {
        const str = String(cell ?? "");
        return `"${str.replace(/"/g, '""')}"`;
      };
      const csvContent = csvRows
        .map((row) => row.map(escapeCell).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filenameSafe = `${branchLabel.replace(/\s+/g, "_")}_QuarterSummary_${safeYear}`.replace(
        /[<>:"/\\|?*]+/g,
        ""
      );
      link.download = `${filenameSafe}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setShowBranchQuarterExportSuccess(true);
    } catch (error) {
      console.error("Error exporting branch quarter CSV:", error);
      setShowExportError(true);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBranchQuarterCSV = () => {
    if (!branchQuarterTableRows || branchQuarterTableRows.length === 0) {
      setShowNoDataAlert(true);
      return;
    }
    const hasEmployeesWithMissingData = branchQuarterTableRows.some(
      (row) =>
        row.q1 == null || row.q2 == null || row.q3 == null || row.q4 == null
    );
    if (hasEmployeesWithMissingData) {
      setShowExportMissingDataWarning(true);
      return;
    }
    performBranchQuarterExport();
  };

  // Load recorded years when Average modal opens (years that have evaluation data)
  useEffect(() => {
    if (!isAverageModalOpen) {
      setRecordedYearsForAverage([]);
      setAverageModalYear("");
      setAverageTableData(null);
      setShowAverageExportSuccess(false);
      return;
    }
    let cancelled = false;
    setLoadingRecordedYears(true);
    apiService
      .getAllYears()
      .then((years: { year: number }[]) => {
        if (cancelled || !Array.isArray(years)) return;
        const sorted = [...years].sort((a, b) => b.year - a.year);
        setRecordedYearsForAverage(sorted);
        setAverageModalYear("");
      })
      .catch(() => {
        if (!cancelled) setRecordedYearsForAverage([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecordedYears(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAverageModalOpen]);

  useEffect(() => {
    if (!showAverageExportSuccess) return;
    const id = window.setTimeout(() => setShowAverageExportSuccess(false), 3000);
    return () => window.clearTimeout(id);
  }, [showAverageExportSuccess]);

  useEffect(() => {
    if (!showBranchQuarterExportSuccess) return;
    const id = window.setTimeout(() => setShowBranchQuarterExportSuccess(false), 3000);
    return () => window.clearTimeout(id);
  }, [showBranchQuarterExportSuccess]);

  const handleSaveUser = async (updatedUser: any) => {
    try {
      // Convert user object to FormData for API
      const formData = new FormData();
      Object.keys(updatedUser).forEach((key) => {
        if (updatedUser[key] !== undefined && updatedUser[key] !== null) {
          // Skip these keys - we'll append them with _id suffix separately
          if (
            key === "position" ||
            key === "branch" ||
            key === "role" ||
            key === "department" ||
            key === "employeeId"
          ) {
            return;
          }
          if (key === "avatar" && updatedUser[key] instanceof File) {
            formData.append(key, updatedUser[key]);
          } else {
            formData.append(key, String(updatedUser[key]));
          }
        }
      });

      // Append position as position_id if it exists
      if (updatedUser.position !== undefined && updatedUser.position !== null) {
        formData.append("position_id", String(updatedUser.position));
      }

      // Append branch as branch_id if it exists
      if (updatedUser.branch !== undefined && updatedUser.branch !== null) {
        formData.append("branch_id", String(updatedUser.branch));
      }

      // Append role as roles if it exists
      if (updatedUser.role !== undefined && updatedUser.role !== null) {
        formData.append("roles", String(updatedUser.role));
      }

      // Append department as department_id if it exists
      if (
        updatedUser.department !== undefined &&
        updatedUser.department !== null
      ) {
        formData.append("department_id", String(updatedUser.department));
      }

      if (
        updatedUser.employeeId !== undefined &&
        updatedUser.employeeId !== null &&
        String(updatedUser.employeeId).trim() !== ""
      ) {
        formData.append("employee_id", String(updatedUser.employeeId).trim());
      }

      await apiService.updateEmployee(formData, updatedUser.id);

      // Add user to recently updated list for 10 second highlight
      const userId = Number(updatedUser.id);
      setRecentlyUpdatedIds(prev => new Set(prev).add(userId));
      
      // Remove highlight after 10 seconds with fade out
      setTimeout(() => {
        setRecentlyUpdatedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }, 10000);

      // Refresh user data to update the table immediately
      await refreshUserData(false);

      // Refresh dashboard data to get updated information

      // Show success toast
      toastMessages.user.updated(updatedUser.name);
    } catch (error: any) {
      if (error.response?.data?.errors) {
        Object.keys(error.response.data.errors).forEach((field) => {
          toastMessages.generic.error(
            "Update Failed",
            error.response.data.errors[field][0]
          );
        });
      }
    }
  };

  const handleDeleteEmployee = async (employee: any) => {
    try {
      // Set deleting state to show skeleton animation
      setDeletingUserId(employee.id);

      // Close modal immediately
      setIsDeleteModalOpen(false);

      // Wait 2 seconds to show skeleton animation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Actually delete the user
      await apiService.deleteUser(employee.id);

      // Refresh data first, then reset deleting state after data loads
      await loadActiveUsers(activeSearchTerm, roleFilter, activeBranchFilter);
      setDeletingUserId(null);

      toastMessages.user.deleted(employee.fname);
    } catch (error: any) {
      console.error("Error deleting user:", error);
      setDeletingUserId(null);

      const backendMessage = String(
        error?.response?.data?.message ??
          error?.response?.data?.error ??
          error?.message ??
          ""
      ).trim();

      const isBlockedByEvaluations =
        /cannot delete user due to user has\/have evaluation/i.test(
          backendMessage
        ) ||
        /has\/have evaluation/i.test(backendMessage) ||
        /evaluation\/s/i.test(backendMessage);

      if (isBlockedByEvaluations) {
        const fullName = [employee?.fname, employee?.lname]
          .filter(Boolean)
          .join(" ")
          .trim();
        setEvaluationDeleteEmployeeName(fullName || "this employee");
        setEvaluationDeleteAlertMessage(
          backendMessage ||
            "Cannot delete user due to user has/have evaluation/s"
        );
        setIsEvaluationDeleteAlertOpen(true);
      } else {
        toastMessages.generic.error(
          "Error",
          backendMessage || "Failed to delete user. Please try again."
        );
      }
    } finally {
      setEmployeeToDelete(null);
    }
  };

  const handleAddUser = async (newUser: any) => {
    try {
      // Convert plain object to FormData - matching register page pattern
      const formDataToUpload = new FormData();
      formDataToUpload.append("fname", newUser.fname);
      formDataToUpload.append("lname", newUser.lname);
      formDataToUpload.append("username", newUser.username);
      formDataToUpload.append(
        "employee_id",
        String(newUser.employee_id ?? "").trim()
      );
      formDataToUpload.append("email", newUser.email);
      formDataToUpload.append("contact", newUser.contact);
      if (newUser.date_hired) {
        formDataToUpload.append("date_hired", newUser.date_hired);
      }
      formDataToUpload.append("position_id", String(newUser.position_id));
      formDataToUpload.append("branch_id", String(newUser.branch_id));
      formDataToUpload.append("department_id", String(newUser.department_id));
      formDataToUpload.append("password", newUser.password);
      // role_id is only for admin/HR adding users (not in register)
      formDataToUpload.append("role_id", String(newUser.role_id));

      const addUser = await apiService.addUser(formDataToUpload);

      await refreshUserData();

      toastMessages.user.created(newUser.fname);
      setIsAddUserModalOpen(false);
    } catch (error: any) {
      console.error("Error adding user:", error);
      console.error("Error response:", error.response?.data);
      toastMessages.generic.error(
        "Add Failed",
        error.response?.data?.message || "Failed to add user. Please try again."
      );
      throw error;
    }
  };

  // Handle page change for active users
  const handleActivePageChange = (page: number) => {
    setIsPageLoading(true);
    activePageChangeStartTimeRef.current = Date.now();
    setCurrentPageActive(page);
  };

  // Get role color based on role name
  const getRoleColor = (roleName: string | undefined): string => {
    if (!roleName)
      return "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300";

    const role = roleName.toLowerCase();
    if (role === "admin") {
      return "bg-red-100 text-red-800 hover:bg-red-200 border-red-300";
    } else if (role === "hr") {
      return "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300";
    } else if (role === "evaluator") {
      return "bg-green-100 text-green-800 hover:bg-green-200 border-green-300";
    } else {
      return "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300";
    }
  };

  const userTableBusy = refresh || isPageLoading;

  return (
    <div className="relative min-h-[400px] overflow-y-auto pr-0 sm:pr-2">
      {/* Active Users */}
      <Card className="mt-0">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage active system users and permissions ({activeTotalItems}{" "}
              active)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
                <div className="flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="relative min-w-0 w-full sm:min-w-[12rem] sm:flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    </span>
                    <Input
                      placeholder="Search users..."
                      className="w-full min-w-0 pl-10 pr-10"
                      value={activeSearchTerm}
                      onChange={(e) => setActiveSearchTerm(e.target.value)}
                    />
                    {activeSearchTerm && (
                      <button
                        onClick={() => setActiveSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 transition-colors"
                        aria-label="Clear search"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="w-full min-w-0 sm:w-auto cursor-pointer">
                    <Combobox
                      options={[
                        { value: "0", label: "All Roles" },
                        ...roles
                          .filter((role) => {
                            // Hide admin role in HR dashboard
                            if (shouldHideAdminUsers) {
                              return role.name !== "admin";
                            }
                            return true;
                          })
                          .map((role) => ({
                            value: String(role.id),
                            label: role.name,
                          })),
                      ]}
                      value={roleFilter}
                      onValueChangeAction={(value) => {
                        setRoleFilter(String(value));
                      }}
                      placeholder="All Roles"
                      searchPlaceholder="Search roles..."
                      emptyText="No roles found."
                      className="w-full min-w-[10rem] sm:w-[180px]"
                    />
                  </div>
                  <div className="w-full min-w-0 sm:w-auto cursor-pointer">
                    <Combobox
                      options={[
                        { value: "all", label: "All Branches" },
                        ...branchesData.map((b: any) => ({
                          value: String(b.value),
                          label: String(b.label),
                        })),
                      ]}
                      value={activeBranchFilter}
                      onValueChangeAction={(value) => {
                        setActiveBranchFilter(String(value));
                      }}
                      placeholder="All Branches"
                      searchPlaceholder="Search branches..."
                      emptyText="No branches found."
                      className="w-full min-w-0 sm:w-[220px]"
                    />
                  </div>
                  <div className="w-full sm:w-auto">
                    {(roleFilter !== "0" || activeBranchFilter !== "all") && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRoleFilter("0");
                          setActiveBranchFilter("all");
                        }}
                        className="text-red-500 bg-amber-50"
                      >
                        Clear Filter
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end lg:shrink-0">
                    <Button
                      variant="outline"
                      onClick={() => refreshUserData(true)}
                      disabled={userTableBusy}
                      className="flex items-center gap-2 whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 hover:text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0"
                    >
                      {userTableBusy ? (
                        <span className="flex items-center gap-2">
                          <span className="relative h-8 w-8 shrink-0">
                            <span className="absolute inset-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span className="absolute inset-0 flex items-center justify-center">
                              <img
                                src="/smct.png"
                                alt=""
                                className="h-4 w-4 object-contain opacity-95"
                                width={16}
                                height={16}
                                decoding="async"
                              />
                            </span>
                          </span>
                          <span>
                            {refresh
                              ? "Refreshing..."
                              : "Loading page..."}
                          </span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-5 w-5 shrink-0" aria-hidden />
                          Refresh
                        </span>
                      )}
                    </Button>
                    <Button
                      onClick={() => setIsAddUserModalOpen(true)}
                      className="flex items-center gap-2 whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 hover:text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                    >
                      <Plus className="h-5 w-5 font-bold " />
                      Add User
                    </Button>
                    <Button
                      onClick={() => {
                        setIsBranchQuarterModalOpen(true);
                        setBranchQuarterTableRows(null);
                        setBranchQuarterYear("");
                        setBranchQuarterBranchId(
                          branchesData && branchesData.length > 0
                            ? String(branchesData[0].value)
                            : ""
                        );
                      }}
                      className="flex items-center gap-2 whitespace-nowrap bg-green-600 text-white hover:bg-green-700 hover:text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                    >
                      <Download className="h-5 w-5 font-bold" />
                      Export Users
                    </Button>
                </div>
              </div>

              {/* Role and Status Color Indicators */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    Role Indicators:
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    
                    <Badge
                      variant="outline"
                      className="bg-blue-700 text-white hover:bg-blue-700 border-blue-300"
                    >
                      HR
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-green-700 text-white hover:bg-green-700 border-green-300"
                    >
                      Evaluator
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-gray-700 text-gray-100 hover:bg-gray-700 border-gray-300"
                    >
                      Employee
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    Status Indicators:
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge
                      variant="outline"
                      className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300"
                    >
                      🔄 Recently Updated
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-green-700 text-white hover:bg-green-700 border-green-300"
                      >
                      ✨ New Added 
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-blue-700 text-white hover:bg-blue-700 border-blue-300"
                    >
                      🕐 Recently Added
                    </Badge>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "relative overflow-y-auto rounded-lg border scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100",
                  userTableBusy &&
                    "min-h-[280px] border-blue-100 bg-gray-50/40"
                )}
              >
                {userTableBusy ? (
                  <SmctLoadingOverlay
                    label={
                      isPageLoading && !refresh
                        ? "Loading page..."
                        : "Updating users..."
                    }
                  />
                ) : null}
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white shadow-sm [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-600">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userTableBusy ? (
                      Array.from({ length: itemsPerPage }).map((_, index) => (
                        <TableRow key={`skeleton-${index}`}>
                          <TableCell className="px-6 py-3">
                            <Skeleton className="h-6 w-24" />
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <Skeleton className="h-6 w-24" />
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <Skeleton className="h-6 w-24" />
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <Skeleton className="h-6 w-24" />
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <Skeleton className="h-6 w-24" />
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <Skeleton className="h-6 w-24" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : activeRegistrations &&
                      Array.isArray(activeRegistrations) &&
                      activeRegistrations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-gray-500"
                        >
                          <div className="flex flex-col items-center justify-center gap-4">
                            <img
                              src="/not-found.gif"
                              alt="No data"
                              className="w-25 h-25 object-contain"
                              style={{
                                imageRendering: "auto",
                                willChange: "auto",
                                transform: "translateZ(0)",
                                backfaceVisibility: "hidden",
                                WebkitBackfaceVisibility: "hidden",
                              }}
                            />
                            <div className="text-gray-500">
                              {activeSearchTerm ? (
                                <>
                                  <p className="text-base font-medium mb-1">
                                    No results found
                                  </p>
                                  <p className="text-sm text-gray-400">
                                    Try adjusting your search or filters
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-base font-medium mb-1">
                                    No employees to display
                                  </p>
                                  <p className="text-sm text-gray-400">
                                    Active employees will appear here when they
                                    exist for the current filters
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : activeRegistrations &&
                      Array.isArray(activeRegistrations) &&
                      activeRegistrations.length > 0 ? (
                      activeRegistrations
                        ?.filter((employee) => {
                          if (shouldHideAdminUsers && userHasAdminRole(employee)) {
                            return false;
                          }
                          return true;
                        })
                        .map((employee) => {
                       const isDeleting = deletingUserId === employee.id;
                       const createdDate = employee.created_at
                         ? new Date(employee.created_at)
                         : null;
                       let isNew = false;
                       let isRecentlyAdded = false;
                       let isRecentlyUpdated = false;

                       if (createdDate !== null) {
                         const now = new Date();
                         const minutesDiff =
                           (now.getTime() - createdDate.getTime()) /
                           (1000 * 60);
                         const hoursDiff = minutesDiff / 60;
                         isNew = hoursDiff <= 30;
                         isRecentlyAdded = hoursDiff > 30 && hoursDiff <= 40;
                       }

                       // Check if user is in the recently updated set (explicit front-end edit)
                       // This is only set when saving from the Edit User modal, so approving
                       // a new registration will not mistakenly show as "Updated".
                       const isJustUpdated = employee.id
                         ? recentlyUpdatedIds.has(Number(employee.id))
                         : false;
                       if (isJustUpdated) {
                         isRecentlyUpdated = true;
                       }

                        return (
                          <TableRow
                            key={employee.id}
                            className={
                              isDeleting
                                ? "animate-slide-out-right bg-red-100 border-l-4 border-l-red-600"
                                : showActiveFilterHighlight
                                ? "bg-green-50 border-l-4 border-l-green-600 hover:bg-green-100 animate-pulse transition-all duration-500 shadow-md"
                                : isRecentlyUpdated
                                ? "bg-yellow-100 border-l-4 border-l-yellow-600 hover:bg-yellow-200 animate-pulse transition-all duration-500 shadow-md"
                                : isNew
                                ? "bg-green-100 border-l-4 border-l-green-600 hover:bg-green-200 animate-pulse transition-all duration-300 shadow-md"
                                : isRecentlyAdded
                                ? "bg-blue-100 border-l-4 border-l-blue-600 hover:bg-blue-200 transition-all duration-300"
                                : "hover:bg-gray-50"
                            }
                          >
                            {isDeleting ? (
                              <>
                                <TableCell className="font-medium bg-red-300">
                                  <Skeleton className="h-4 w-32" />
                                </TableCell>
                                <TableCell className="bg-red-300">
                                  <Skeleton className="h-4 w-40" />
                                </TableCell>
                                <TableCell className="bg-red-300">
                                  <Skeleton className="h-4 w-24" />
                                </TableCell>
                                <TableCell className="bg-red-300">
                                  <Skeleton className="h-4 w-24" />
                                </TableCell>
                                <TableCell className="bg-red-300">
                                  <Skeleton className="h-5 w-16 rounded-full" />
                                </TableCell>
                                <TableCell className="bg-red-300">
                                  <div className="flex space-x-2">
                                    <Skeleton className="h-8 w-16" />
                                    <Skeleton className="h-8 w-16" />
                                    <Skeleton className="h-8 w-16" />
                                  </div>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <span>
                                      {employee.fname + " " + employee.lname}
                                    </span>
                                    {isRecentlyUpdated && (
                                      <Badge className="bg-yellow-500 text-white text-xs px-2 py-0.5 font-semibold">
                                        🔄 Updated
                                      </Badge>
                                    )}
                                    {isNew && !isRecentlyUpdated && (
                                      <Badge className="bg-green-500 text-white text-xs px-2 py-0.5 font-semibold">
                                        ✨ New
                                      </Badge>
                                    )}
                                    {isRecentlyAdded && !isNew && !isRecentlyUpdated && (
                                      <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5 font-semibold">
                                        🕐 Recent
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{employee.email}</TableCell>
                                <TableCell>
                                  {employee.positions?.label || "N/A"}
                                </TableCell>
                                <TableCell>
                                  {getEmployeeBranchCodeDisplay(
                                    employee,
                                    branchesData,
                                    branchesData.length === 0
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={getRoleColor(getDisplayRoleName(employee))}
                                  >
                                    {getDisplayRoleName(employee) || "N/A"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-green-600 hover:text-green-700 hover:bg-green-200 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
                                      onClick={() => {
                                        setEmployeeToView(employee);
                                        setIsViewEmployeeModalOpen(true);
                                      }}
                                      disabled={deletingUserId !== null}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-green-600 hover:text-green-700 hover:bg-green-200 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
                                      onClick={() => {
                                        setIsEvaluationTypeModalOpen(true);
                                        setSelectedEmployeeForEvaluation(
                                          employee
                                        );
                                      }}
                                      title="Evaluate employee performance"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
                                      onClick={() => {
                                        setEmployeeForMemorandumViolation(
                                          employee
                                        );
                                        setMemorandumPickerBranchId(undefined);
                                        setIsMemorandumViolationModalOpen(true);
                                      }}
                                      disabled={deletingUserId !== null}
                                      title="Add memorandum violation"
                                    >
                                      <FileWarning className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-200 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
                                      onClick={() => {
                                        setEmployeeForAverage(employee);
                                        setIsAverageModalOpen(true);
                                      }}
                                      disabled={deletingUserId !== null}
                                      title="View employee average"
                                    >
                                      <BarChart2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-200 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
                                      onClick={() => openEditModal(employee)}
                                      disabled={deletingUserId !== null}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-200 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
                                      onClick={() => openDeleteModal(employee)}
                                      disabled={deletingUserId !== null}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })
                    ) : null}
                  </TableBody>
                </Table>
              </div>
              <div>
                {!userTableBusy && (
                  <div>
                    <EvaluationsPagination
                      currentPage={currentPageActive}
                      totalPages={totalActivePages}
                      total={activeTotalItems}
                      perPage={perPage}
                      onPageChange={handleActivePageChange}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={userToEdit}
        onSave={handleSaveUser}
        departments={departmentData}
        branches={branchesData}
        positions={positionsData}
      />

      {/* Delete Confirmation Modal */}
      <Dialog
        open={isDeleteModalOpen}
        onOpenChangeAction={(open) => {
          setIsDeleteModalOpen(open);
          if (!open) {
            setEmployeeToDelete(null);
          }
        }}
      >
        <DialogContent className={`max-w-md p-6 ${dialogAnimationClass}`}>
          <DialogHeader className="pb-4 bg-red-50 rounded-lg ">
            <DialogTitle className="text-red-800 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              Delete Employee
            </DialogTitle>
            <DialogDescription className="text-red-700">
              This action cannot be undone. Are you sure you want to permanently
              delete {employeeToDelete?.fname}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-2 mt-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-sm text-red-700">
                  <p className="font-medium">
                    Warning: This will permanently delete:
                  </p>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>Employee profile and data</li>
                    <li>All evaluation records</li>
                    <li>Access permissions</li>
                    <li>Associated files and documents</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm text-gray-700">
                <p className="font-medium">Employee Details:</p>
                <div className="mt-2 space-y-1">
                  <p>
                    <span className="font-medium">Name:</span>{" "}
                    {employeeToDelete?.fname + " " + employeeToDelete?.lname}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span>{" "}
                    {employeeToDelete?.email}
                  </p>
                  <p>
                    <span className="font-medium">Position:</span>{" "}
                    {employeeToDelete?.positions.label}
                  </p>
                  <p>
                    <span className="font-medium">Branch:</span>{" "}
                    {getEmployeeBranchCodeDisplay(
                      employeeToDelete,
                      branchesData,
                      branchesData.length === 0
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-6 px-2">
            <div className="flex justify-end space-x-4 w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setEmployeeToDelete(null);
                }}
                className="text-white bg-red-600 hover:text-white hover:bg-red-700 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Cancel
              </Button>
              <Button
                disabled={isDeletingEmployee}
                className={`bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${isDeletingEmployee ? "opacity-70 cursor-not-allowed hover:translate-y-0 hover:shadow-none" : ""}`}
                onClick={async () => {
                  if (!employeeToDelete) return;

                  setIsDeletingEmployee(true);

                  try {
                    await handleDeleteEmployee(employeeToDelete);
                  } finally {
                    setIsDeletingEmployee(false);
                  }
                }}
              >
                {isDeletingEmployee ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>❌ Delete Permanently</>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isEvaluationDeleteAlertOpen}
        onOpenChangeAction={(open) => {
          setIsEvaluationDeleteAlertOpen(open);
          if (!open) {
            setEvaluationDeleteAlertMessage("");
            setEvaluationDeleteEmployeeName("");
          }
        }}
        title="Cannot Delete Employee"
        description={
          evaluationDeleteAlertMessage
            ? `${evaluationDeleteAlertMessage}${
                evaluationDeleteEmployeeName
                  ? ` (${evaluationDeleteEmployeeName})`
                  : ""
              }`
            : "Cannot delete user due to user has/have evaluation/s"
        }
        type="warning"
        confirmText="OK"
        showCancel={false}
        backgroundImage="/smct.png"
        size="lg"
        logoSize="cover"
        logoOpacity={10}
        onConfirm={() => {
          setIsEvaluationDeleteAlertOpen(false);
          setEvaluationDeleteAlertMessage("");
          setEvaluationDeleteEmployeeName("");
        }}
      />

      <MemorandumViolationModal
        open={isMemorandumViolationModalOpen}
        onOpenChangeAction={(next) => {
          if (!next) {
            setIsMemorandumViolationModalOpen(false);
            setEmployeeForMemorandumViolation(null);
            setMemorandumPickerBranchId(undefined);
          }
        }}
        dialogAnimationClass={dialogAnimationClass}
        employee={employeeForMemorandumViolation}
        branchFilterForEmployeePicker={memorandumPickerBranchId}
        allowDeleteViolation
      />

      {/* Employee Average Modal */}
      <Dialog
        open={isAverageModalOpen}
        onOpenChangeAction={(open) => {
          if (!open) {
            setIsAverageModalOpen(false);
            setEmployeeForAverage(null);
          }
        }}
      >
        <DialogContent className={`p-0 ${dialogAnimationClass} ${averageTableData ? "max-w-3xl" : "max-w-md"} relative overflow-hidden`}>
          {/* Header — same pattern as notification modal (DashboardShell) */}
          <div
            className="relative overflow-hidden px-6 py-5"
            style={{
              backgroundImage: "url(/smct.png)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 to-blue-700/90 backdrop-blur-[1px]" />
            <div className="absolute top-3 right-3 z-20">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsAverageModalOpen(false);
                  setEmployeeForAverage(null);
                }}
                className="cursor-pointer hover:bg-red-500 hover:text-white text-white h-8 w-8 rounded-full shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative z-10 pr-12 sm:pr-14">
              <DialogHeader className="pb-0 text-left">
                <DialogTitle className="flex items-center gap-3 text-xl text-white drop-shadow-md">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm shadow-lg">
                    <BarChart2 className="h-5 w-5 text-white" />
                  </div>
                  <span>Employee Average</span>
                </DialogTitle>
                <p className="mt-4 text-xl font-bold text-white/90 leading-snug">
                  {employeeForAverage
                    ? `${employeeForAverage.fname || ""} ${employeeForAverage.lname || ""}`.trim()
                    : "Select a year to view averages"}
                </p>
              </DialogHeader>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6 space-y-4">
            {/* Year Selector */}
            <div className="flex items-center gap-4">
              <Label htmlFor="average-year" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Select Year:
              </Label>
              {loadingRecordedYears ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : recordedYearsForAverage.length === 0 ? (
                <p className="text-sm text-gray-500">No recorded years available.</p>
              ) : (
                <Select
                  value={averageModalYear}
                  onValueChange={(val) => {
                    setAverageModalYear(val);
                    loadAverageTableForYear(val);
                  }}
                >
                  <SelectTrigger id="average-year" className="w-32 cursor-pointer border-gray-300 focus:ring-blue-500">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {recordedYearsForAverage.map((y) => (
                      <SelectItem key={y.year} value={String(y.year)}>
                        {y.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {averageTableData && !loadingAverageTable && (
              <div className="flex justify-end">
                <Button
                  onClick={async () => {
                    if (!averageTableData || !employeeForAverage) return;
                    if (averageTableData.rows.length === 0) {
                      setShowNoDataAlert(true);
                      return;
                    }
                    setIsExporting(true);
                    try {
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      const employeeName = `${employeeForAverage.fname || ""} ${employeeForAverage.lname || ""}`.trim();
                      const branch = getEmployeeBranchDisplay(employeeForAverage);
                      const csvRows = [
                        [
                          "Name",
                          "Branch",
                          "Quarters",
                          "Rating",
                          "Performance score (%)",
                        ],
                        ...averageTableData.rows.map((row) => [
                          employeeName,
                          branch,
                          row.quarter,
                          row.rating > 0 ? row.rating.toString() : "—",
                          row.rating > 0
                            ? performanceScorePercent(row.rating)
                            : "—",
                        ]),
                        [
                          "",
                          "",
                          "Overall average",
                          averageTableData.average.toFixed(2),
                          performanceScorePercent(averageTableData.average),
                        ],
                      ];
                      const csvContent = csvRows.map((row) => row.join(",")).join("\n");
                      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `${employeeName.replace(/\s+/g, "_")}_Average_${averageModalYear}.csv`;
                      link.click();
                      URL.revokeObjectURL(url);
                      setShowAverageExportSuccess(true);
                    } catch {
                      setShowExportError(true);
                    } finally {
                      setIsExporting(false);
                    }
                  }}
                  disabled={isExporting}
                  className="cursor-pointer bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export to xlsx
                </Button>
              </div>
            )}

            {/* Empty State */}
            {!averageModalYear && !loadingAverageTable && !averageTableData && (
              <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">Select a year to view averages</p>
                <p className="text-xs mt-1">Choose from the dropdown above</p>
              </div>
            )}

            {loadingAverageTable && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium">Loading evaluations...</p>
              </div>
            )}

            {averageTableData && !loadingAverageTable && (
              <div className="mt-4 space-y-3">
                {/* Table */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-50 to-blue-100">
                        <TableHead className="font-semibold text-blue-800">Name</TableHead>
                        <TableHead className="font-semibold text-blue-800">Branch</TableHead>
                        <TableHead className="font-semibold text-blue-800">Quarter</TableHead>
                        <TableHead className="font-semibold text-blue-800">Rating</TableHead>
                        <TableHead
                          className="font-semibold text-blue-800 whitespace-nowrap"
                          title="Rating ÷ 5 × 100 (same scale as the chart)"
                        >
                          Performance score
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {averageTableData.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                            <p className="font-medium">No evaluations recorded</p>
                            <p className="text-xs mt-1">No data available for {averageModalYear}</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {averageTableData.rows.map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="font-medium text-gray-800">
                                {employeeForAverage
                                  ? `${employeeForAverage.fname || ""} ${employeeForAverage.lname || ""}`.trim()
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-gray-600">{employeeForAverage ? getEmployeeBranchDisplay(employeeForAverage) : "—"}</TableCell>
                              <TableCell>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {row.quarter}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  row.rating >= 4 ? "bg-green-100 text-green-800" :
                                  row.rating >= 3 ? "bg-blue-100 text-blue-800" :
                                  row.rating >= 2.5 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                                }`}>
                                  {row.rating > 0 ? row.rating.toFixed(2) : "—"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  row.rating <= 0 ? "bg-gray-100 text-gray-600" :
                                  row.rating >= 4 ? "bg-green-100 text-green-800" :
                                  row.rating >= 3 ? "bg-blue-100 text-blue-800" :
                                  row.rating >= 2.5 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                                }`}>
                                  {performanceScorePercent(row.rating)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold">
                            <TableCell colSpan={3} className="text-right">Overall Average</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-white/20">
                                {averageTableData.average.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-white/20">
                                {performanceScorePercent(averageTableData.average)}
                              </span>
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Rating Chart - Below Table */}
                {averageTableData.rows.length > 0 && (
                  <div className="border rounded-lg p-4 bg-white">
                    <h4 className="text-sm font-semibold mb-2 text-gray-700">Rating by Quarter</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart
                        data={averageTableData.rows.map((row) => ({
                          quarter: row.quarter,
                          rating: row.rating,
                        }))}
                        margin={{ left: 0, right: 10, top: 10, bottom: 5 }}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e5e7eb"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="quarter"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                          interval={0}
                        />
                        <YAxis
                          domain={[0, 5]}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                          ticks={[0, 1, 2, 3, 4, 5]}
                          width={20}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(2)}`, "Rating"]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                          cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                        />
                        <Bar dataKey="rating" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {averageTableData.rows.map((row, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                row.rating >= 4 ? "#22c55e" :
                                row.rating >= 3 ? "#3b82f6" :
                                row.rating >= 2.5 ? "#f59e0b" : "#ef4444"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 px-3 py-2 bg-gray-50 rounded-md border">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-500"></span><span className="text-xs text-gray-600">≥4</span></span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500"></span><span className="text-xs text-gray-600">3-3.9</span></span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span><span className="text-xs text-gray-600">2.5-2.9</span></span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500"></span><span className="text-xs text-gray-600">&lt;2.5</span></span>
                        </div>
                        <div className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded border">
                          <span className="font-semibold">{averageTableData.rows.length}</span> eval{averageTableData.rows.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Branch Quarterly Report Modal */}
      <Dialog
        open={isBranchQuarterModalOpen}
        onOpenChangeAction={(open) => {
          if (!open) {
            setIsBranchQuarterModalOpen(false);
            setBranchQuarterTableRows(null);
            setBranchQuarterYear("");
            setBranchQuarterBranchId("");
            setBranchQuarterDepartmentId("");
            setBranchQuarterCurrentPage(1);
          }
        }}
      >
        <DialogContent className={`p-0 ${dialogAnimationClass} max-w-5xl max-h-[95vh] overflow-hidden relative`}>
          {/* Header — same pattern as notification modal (DashboardShell) */}
          <div
            className="relative overflow-hidden px-6 py-5"
            style={{
              backgroundImage: "url(/smct.png)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 to-blue-700/90 backdrop-blur-[1px]" />
            <div className="absolute top-3 right-3 z-20">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsBranchQuarterModalOpen(false);
                  setBranchQuarterTableRows(null);
                  setBranchQuarterYear("");
                  setBranchQuarterBranchId("");
                  setBranchQuarterDepartmentId("");
                  setBranchQuarterCurrentPage(1);
                }}
                className="cursor-pointer hover:bg-white/20 text-white h-8 w-8 rounded-full shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative z-10 pr-12 sm:pr-14">
              <DialogHeader className="pb-0 text-left">
                <DialogTitle className="flex items-center gap-3 text-xl text-white drop-shadow-md">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm shadow-lg">
                    <BarChart2 className="h-5 w-5 text-white" />
                  </div>
                  <span>Branch Quarterly Report</span>
                </DialogTitle>
                <p className="mt-2 text-sm text-white/90 leading-snug">
                  Select Year and Branch to export
                </p>
              </DialogHeader>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="relative overflow-y-auto p-6 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-4">
                <Label
                  htmlFor="branch-quarter-year"
                  className="text-sm font-medium cursor-pointer text-gray-700 whitespace-nowrap"
                >
                  Year:
                </Label>
                {loadingRecordedYearsForBranchQuarter ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <Combobox
                    options={recordedYearsForBranchQuarter.map((y) => ({
                      value: String(y.year),
                      label: String(y.year),
                    }))}
                    value={branchQuarterYear}
                    onValueChangeAction={(value) => {
                      setBranchQuarterYear(String(value));
                    }}
                    placeholder="Select year"
                    searchPlaceholder="Search years..."
                    emptyText="No years found."
                    className="w-32"
                  />
                )}
              </div>

              <div className="flex items-center gap-4">
                <Label
                  htmlFor="branch-quarter-branch"
                  className="text-sm font-medium text-gray-700 whitespace-nowrap"
                >
                  Branch:
                </Label>
                <Combobox
                  options={branchesData.map((b: any) => ({
                    value: String(b.value),
                    label: b.label,
                  }))}
                  value={branchQuarterBranchId}
                  onValueChangeAction={(value) => {
                    setBranchQuarterBranchId(String(value));
                  }}
                  placeholder="Select branch"
                  searchPlaceholder="Search branches..."
                  emptyText="No branches found."
                  className="w-64"
                />
              </div>

              {showDepartmentInBranchQuarter && (
                <div className="flex items-center gap-4">
                  <Label
                    htmlFor="branch-quarter-department"
                    className="text-sm font-medium text-gray-700 whitespace-nowrap"
                  >
                    Department:
                  </Label>
                  <Combobox
                    options={departmentData.map((d: any) => ({
                      value: String(d.value),
                      label: d.label,
                    }))}
                    value={branchQuarterDepartmentId}
                    onValueChangeAction={(value) => {
                      setBranchQuarterDepartmentId(String(value));
                    }}
                    placeholder="All departments"
                    searchPlaceholder="Search departments..."
                    emptyText="No departments found."
                    className="w-64"
                  />
                </div>
              )}
            </div>

            {/* Indicators */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex-wrap">
              <span className="text-sm font-medium text-gray-700">
                Indicators:
              </span>
              <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600">
                <span className="inline-flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-white border border-gray-200 font-mono text-gray-800">
                    —
                  </span>
                  No evaluation for that quarter
                </span>
                <span className="text-gray-300">|</span>
                <span>Average is computed from available quarters only</span>
              </div>
            </div>

            {branchQuarterTableRows &&
              !loadingBranchQuarterTable &&
              !loadingBranchQuarterPage && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleExportBranchQuarterCSV}
                  disabled={isExporting}
                  className="cursor-pointer bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export to xlsx
                </Button>
              </div>
            )}

            {/* Empty state */}
            {!branchQuarterYear || !branchQuarterBranchId ? (
              <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">Select a year and branch</p>
                <p className="text-xs mt-1">Then the table will load automatically</p>
              </div>
            ) : null}

            {/* Loading — skeleton table (spinner: overlay below) */}
            {loadingBranchQuarterTable ? (
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-50 to-blue-100">
                        <TableHead className="font-semibold text-blue-800">
                          Name
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Position
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Branch
                        </TableHead>
                        {showDepartmentInBranchQuarter && (
                          <TableHead className="font-semibold text-blue-800">
                            Department
                          </TableHead>
                        )}
                        <TableHead className="font-semibold text-blue-800">
                          Q1
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Q2
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Q3
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Q4
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Average
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="hover:bg-transparent">
                          <TableCell>
                            <Skeleton className="h-4 w-36 max-w-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-28 max-w-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24 max-w-full" />
                          </TableCell>
                          {showDepartmentInBranchQuarter && (
                            <TableCell>
                              <Skeleton className="h-4 w-28 max-w-full" />
                            </TableCell>
                          )}
                          <TableCell>
                            <Skeleton className="h-4 w-10" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-10" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-10" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-10" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-12" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {/* Table */}
            {branchQuarterTableRows && !loadingBranchQuarterTable ? (
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-50 to-blue-100">
                        <TableHead className="font-semibold text-blue-800">
                          Name
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Position
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Branch
                        </TableHead>
                        {showDepartmentInBranchQuarter && (
                          <TableHead className="font-semibold text-blue-800">
                            Department
                          </TableHead>
                        )}
                        <TableHead className="font-semibold text-blue-800">
                          Q1
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Q2
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Q3
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Q4
                        </TableHead>
                        <TableHead className="font-semibold text-blue-800">
                          Average
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {branchQuarterTableRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={showDepartmentInBranchQuarter ? 9 : 8}
                            className="text-center text-gray-500 py-8"
                          >
                            No employees found for this branch/year.
                          </TableCell>
                        </TableRow>
                      ) : loadingBranchQuarterPage ? (
                        Array.from({ length: branchQuarterPageSkeletonRows }).map(
                          (_, i) => (
                            <TableRow
                              key={`bq-skel-${i}`}
                              className="hover:bg-transparent"
                            >
                              <TableCell>
                                <Skeleton className="h-4 w-36 max-w-full" />
                              </TableCell>
                              <TableCell>
                                <Skeleton className="h-4 w-28 max-w-full" />
                              </TableCell>
                              <TableCell>
                                <Skeleton className="h-4 w-24 max-w-full" />
                              </TableCell>
                              {showDepartmentInBranchQuarter && (
                                <TableCell>
                                  <Skeleton className="h-4 w-28 max-w-full" />
                                </TableCell>
                              )}
                              <TableCell>
                                <Skeleton className="h-4 w-10" />
                              </TableCell>
                              <TableCell>
                                <Skeleton className="h-4 w-10" />
                              </TableCell>
                              <TableCell>
                                <Skeleton className="h-4 w-10" />
                              </TableCell>
                              <TableCell>
                                <Skeleton className="h-4 w-10" />
                              </TableCell>
                              <TableCell>
                                <Skeleton className="h-4 w-12" />
                              </TableCell>
                            </TableRow>
                          )
                        )
                      ) : (
                        branchQuarterTableRows
                          .slice(
                            (branchQuarterCurrentPage - 1) *
                              branchQuarterItemsPerPage,
                            branchQuarterCurrentPage * branchQuarterItemsPerPage
                          )
                          .map((row) => (
                          <TableRow
                            key={row.employeeId}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <TableCell className="font-medium text-gray-800">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-gray-700">
                              {row.position}
                            </TableCell>
                            <TableCell className="text-gray-700">
                              {row.branch}
                            </TableCell>
                            {showDepartmentInBranchQuarter && (
                              <TableCell className="text-gray-700">
                                {row.department}
                              </TableCell>
                            )}
                            <TableCell>
                              {row.q1 != null
                                ? formatScoreWithPercent(
                                    row.q1,
                                    row.q1Performance
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {row.q2 != null
                                ? formatScoreWithPercent(
                                    row.q2,
                                    row.q2Performance
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {row.q3 != null
                                ? formatScoreWithPercent(
                                    row.q3,
                                    row.q3Performance
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {row.q4 != null
                                ? formatScoreWithPercent(
                                    row.q4,
                                    row.q4Performance
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {row.average != null
                                ? formatScoreWithPercent(
                                    row.average,
                                    row.averagePerformance
                                  )
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {branchQuarterTableRows.length >
                  branchQuarterItemsPerPage && (
                  <div
                    className={
                      loadingBranchQuarterPage
                        ? "pointer-events-none opacity-60"
                        : ""
                    }
                  >
                    <EvaluationsPagination
                      currentPage={branchQuarterCurrentPage}
                      totalPages={Math.max(
                        1,
                        Math.ceil(
                          branchQuarterTableRows.length / branchQuarterItemsPerPage
                        )
                      )}
                      total={branchQuarterTableRows.length}
                      perPage={branchQuarterItemsPerPage}
                      onPageChange={handleBranchQuarterPageChange}
                    />
                  </div>
                )}
              </div>
            ) : null}

            {/* Loading overlay — dialog-style spinner (must be last child to sit above content) */}
            {(loadingBranchQuarterTable || loadingBranchQuarterPage) && (
              <div
                className="absolute inset-0 z-50 flex items-center justify-center rounded-b-lg bg-white/75 backdrop-blur-[2px]"
                aria-busy="true"
                aria-live="polite"
              >
                <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-8 py-6 shadow-lg">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-gray-700">
                    {loadingBranchQuarterTable
                      ? "Loading quarterly data..."
                      : "Loading page..."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export warning: some employees have no quarter data */}
      <Dialog
        open={showExportMissingDataWarning}
        onOpenChangeAction={(open) => {
          if (!open) setShowExportMissingDataWarning(false);
        }}
      >
        <DialogContent className="max-w-md p-8 text-center">
          <div className="flex flex-col  items-center space-y-4">
            <div className="mb-2">
              <img src="/no%20expo.gif" alt="Missing data" className="w-40 h-40 object-contain" />
            </div>
            <h2 className="text-lg font-bold text-red-800">
              Missing data
            </h2>
            <p className="text-gray-600 text-sm">
              Will you wish to proceed with export? Some of your employees are
              missing their data or evaluations.
            </p>
            <div className="flex gap-3 w-full justify-center">
              <Button
                variant="outline"
                onClick={() => setShowExportMissingDataWarning(false)}
                className="cursor-pointer bg-red-600 hover:bg-red-700 hover:text-white text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={() => performBranchQuarterExport()}
                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
              >
                Proceed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* No Data Alert Dialog */}
      <Dialog
        open={showNoDataAlert}
        onOpenChangeAction={(open) => {
          if (!open) setShowNoDataAlert(false);
        }}
      >
        <DialogContent className="max-w-md p-8 text-center">
          <div className="flex flex-col items-center">
            {/* GIF */}
            <div className="mb-4">
              <img
                src="/no-data.gif"
                alt="No data"
                className="w-40 h-40 object-contain"
              />                                                                                                                                                                                                                                                                                                                                              
            </div>
            
            {/* Title */}
            <h2 className="text-xl font-bold text-red-600 mb-2">
              No Data to Export
            </h2>
            
            {/* Description */}
            <p className="text-gray-600 text-sm mb-6 max-w-xs">
              There are no evaluations recorded for the selected year and branch. Please select a different year/branch with available data.
            </p>
                                                                                                                                                                                            
            {/* Button */}
            <Button
              onClick={() => setShowNoDataAlert(false)}
              className="px-8 py-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exporting Dialog */}
      <Dialog open={isExporting} onOpenChangeAction={() => {}}>
        <DialogContent className="max-w-xs p-8 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-4">
              <img
                src="/smct.png"
                alt="SMCT Logo"
                className="w-24 h-auto object-contain"
              />
            </div>
            <div className="mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Exporting Data
            </h2>
            <p className="text-gray-500 text-sm">
              Please wait while we prepare your file...
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Average: CSV export success (same check animation as Add Position / bulk upload) */}
      <Dialog
        open={showAverageExportSuccess}
        onOpenChangeAction={setShowAverageExportSuccess}
      >
        <DialogContent className="max-w-sm w-[90vw] px-6 py-6 text-center">
          <DialogHeader className="border-0 pb-0 text-center sm:text-center">
            <div className="relative mx-auto mb-5 flex h-[5.75rem] w-[5.75rem] items-center justify-center">
              <span
                className="absolute inset-0 rounded-full bg-emerald-400/30 motion-safe:animate-ping"
                style={{ animationDuration: "2.4s" }}
                aria-hidden
              />
              <div
                className="absolute inset-[3px] rounded-full bg-gradient-to-br from-emerald-100/90 to-green-50 blur-[1px]"
                aria-hidden
              />
              <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-700 shadow-[0_12px_40px_-8px_rgba(16,185,129,0.55)] ring-4 ring-white animate-success-badge-pop">
                <svg
                  className="h-11 w-11 text-white drop-shadow-sm"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    className="animate-success-check-draw"
                    d="M6.5 12.5l3.8 3.8L17.8 8.8"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Export Successful
            </DialogTitle>
            <DialogDescription className="text-gray-700">
              Your average report CSV has been downloaded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-gray-200 pt-4 sm:justify-center">
            <Button
              type="button"
              onClick={() => setShowAverageExportSuccess(false)}
              className="cursor-pointer rounded-lg bg-green-600 px-8 py-2 font-medium text-white transition-colors hover:bg-green-700"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch / Quarter summary: CSV export success */}
      <Dialog
        open={showBranchQuarterExportSuccess}
        onOpenChangeAction={setShowBranchQuarterExportSuccess}
      >
        <DialogContent className="max-w-sm w-[90vw] px-6 py-6 text-center">
          <DialogHeader className="border-0 pb-0 text-center sm:text-center">
            <div className="relative mx-auto mb-5 flex h-[5.75rem] w-[5.75rem] items-center justify-center">
              <span
                className="absolute inset-0 rounded-full bg-emerald-400/30 motion-safe:animate-ping"
                style={{ animationDuration: "2.4s" }}
                aria-hidden
              />
              <div
                className="absolute inset-[3px] rounded-full bg-gradient-to-br from-emerald-100/90 to-green-50 blur-[1px]"
                aria-hidden
              />
              <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-700 shadow-[0_12px_40px_-8px_rgba(16,185,129,0.55)] ring-4 ring-white animate-success-badge-pop">
                <svg
                  className="h-11 w-11 text-white drop-shadow-sm"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    className="animate-success-check-draw"
                    d="M6.5 12.5l3.8 3.8L17.8 8.8"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Export Successful
            </DialogTitle>
            <DialogDescription className="text-gray-700">
              Your branch quarter summary CSV has been downloaded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-gray-200 pt-4 sm:justify-center">
            <Button
              type="button"
              onClick={() => setShowBranchQuarterExportSuccess(false)}
              className="cursor-pointer rounded-lg bg-green-600 px-8 py-2 font-medium text-white transition-colors hover:bg-green-700"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Error Dialog */}
      <Dialog
        open={showExportError}
        onOpenChangeAction={(open) => {
          if (!open) setShowExportError(false);
        }}
      >
        <DialogContent className="max-w-sm w-[90vw] px-6 py-6 text-center">
          <DialogHeader className="border-0 pb-0 text-center sm:text-center">
            <div className="mb-4 flex justify-center">
              <img
                src="/no-data2.gif"
                alt=""
                className="h-32 w-32 object-contain"
              />
            </div>
            <DialogTitle className="text-xl font-bold text-red-600">
              Something Went Wrong
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              We encountered an error while exporting your data. Please try again
              later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-gray-200 pt-4 sm:justify-center">
            <Button
              type="button"
              onClick={() => setShowExportError(false)}
              className="cursor-pointer rounded-lg bg-blue-600 px-8 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddUserModalOpen}
        onClose={() => {
          setIsAddUserModalOpen(false);
        }}
        onSave={handleAddUser}
        departments={departmentData}
        branches={branchesData}
        positions={positionsData}
        roles={roles}
        onBulkUploadStart={() => {
          setIsAddUserModalOpen(false);
          setIsBulkUploadSuccessModalOpen(true);
          setIsBulkUploadProcessing(true);
        }}
        onBulkUploadSuccess={async () => {
          setIsBulkUploadProcessing(false);
          setIsBulkUploadSuccessModalOpen(true);
          try {
            await Promise.all([
              refreshUserData(false),
              refreshReferenceData({ force: true }),
            ]);
          } catch (error) {
            console.error("Error refreshing data after bulk upload:", error);
          }
        }}
        onBulkUploadError={() => {
          setIsBulkUploadProcessing(false);
          setIsBulkUploadSuccessModalOpen(false);
          setIsAddUserModalOpen(true);
        }}
      />

      {/* Bulk Upload Success Modal */}
      <Dialog
        open={isBulkUploadSuccessModalOpen}
        onOpenChangeAction={(open) => {
          if (!isBulkUploadProcessing) {
            setIsBulkUploadSuccessModalOpen(open);
          }
        }}
      >
        <DialogContent
          className={
            isBulkUploadProcessing
              ? `max-w-md p-8 text-center ${dialogAnimationClass}`
              : `max-w-sm w-[90vw] px-6 py-6 text-center ${dialogAnimationClass}`
          }
        >
          {isBulkUploadProcessing ? (
            <DialogHeader className="border-0 pb-0 text-center sm:text-center">
              <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-blue-200 bg-blue-50 shadow-md">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-blue-700">
                Uploading Users...
              </DialogTitle>
              <DialogDescription className="max-w-xs text-gray-600">
                Please wait while your bulk upload is being processed.
              </DialogDescription>
            </DialogHeader>
          ) : (
            <>
              <DialogHeader className="border-0 pb-0 text-center sm:text-center">
                <div className="relative mx-auto mb-5 flex h-[5.75rem] w-[5.75rem] items-center justify-center">
                  <span
                    className="absolute inset-0 rounded-full bg-emerald-400/30 motion-safe:animate-ping"
                    style={{ animationDuration: "2.4s" }}
                    aria-hidden
                  />
                  <div
                    className="absolute inset-[3px] rounded-full bg-gradient-to-br from-emerald-100/90 to-green-50 blur-[1px]"
                    aria-hidden
                  />
                  <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-700 shadow-[0_12px_40px_-8px_rgba(16,185,129,0.55)] ring-4 ring-white animate-success-badge-pop">
                    <svg
                      className="h-11 w-11 text-white drop-shadow-sm"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path
                        className="animate-success-check-draw"
                        d="M6.5 12.5l3.8 3.8L17.8 8.8"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Upload Successful
                </DialogTitle>
                <DialogDescription className="text-gray-700">
                  Bulk user upload completed successfully. Users, branches, positions, and
                  departments have been refreshed.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="border-t border-gray-200 pt-4 sm:justify-center">
                <Button
                  type="button"
                  onClick={() => setIsBulkUploadSuccessModalOpen(false)}
                  className="cursor-pointer rounded-lg bg-green-600 px-8 py-2 font-medium text-white transition-colors hover:bg-green-700"
                >
                  OK
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {employeeToView && (
        <ViewEmployeeModal
          isOpen={isViewEmployeeModalOpen}
          onCloseAction={() => {
            setIsViewEmployeeModalOpen(false);
            setEmployeeToView(null);
          }}
          employee={employeeToView}
          onStartEvaluationAction={() => {
            // Not used in admin, but required by component
            setIsViewEmployeeModalOpen(false);
            setEmployeeToView(null);
          }}
          onViewSubmissionAction={() => {
            // Not used in admin, but required by component
          }}
          designVariant="admin"
        />
      )}
      <EvaluationTypeModal
        isOpen={isEvaluationTypeModalOpen}
        onCloseAction={() => {
          setIsEvaluationTypeModalOpen(false);
          if (!evaluationType) {
            setSelectedEmployee(null);
          }
        }}
        onSelectEmployeeAction={() => {
          const employee = selectedEmployeeForEvaluation;
          if (!employee) {
            console.error("No employee selected!");
            return;
          }
          setEvaluationType("employee");
          setIsEvaluationTypeModalOpen(false);

          setIsEvaluationModalOpen(true);
        }}
        onSelectManagerAction={() => {
          const employee = selectedEmployeeForEvaluation;
          if (!employee) {
            console.error("No employee selected!");
            return;
          }
          setEvaluationType("manager");
          setIsEvaluationTypeModalOpen(false);

          setIsEvaluationModalOpen(true);
        }}
        onSelectAreaManagerAction={() => {
          const employee = selectedEmployeeForEvaluation;
          if (!employee) {
            console.error("No employee selected!");
            return;
          }
          setEvaluationType("areaManager");
          setIsEvaluationTypeModalOpen(false);

          setIsEvaluationModalOpen(true);
        }}
        employeeName={
          selectedEmployeeForEvaluation
            ? `${selectedEmployeeForEvaluation?.fname || ""} ${selectedEmployeeForEvaluation?.lname || ""}`.trim()
            : ""
        }
        employee={selectedEmployeeForEvaluation}
      />

      {isEvaluationModalOpen &&
      isMobileViewport &&
      !bypassEvaluationMobileWarning ? (
        <ViewEvaluationMobileWarningModal
          isOpen={isEvaluationModalOpen}
          onCloseAction={closeEvaluationModal}
          onViewAnywayAction={() => setBypassEvaluationMobileWarning(true)}
        />
      ) : (
        <Dialog
          open={isEvaluationModalOpen}
          onOpenChangeAction={(open) => {
            if (!open) {
              closeEvaluationModal();
            }
          }}
        >
          <DialogContent className="max-w-7xl max-h-[101vh] overflow-hidden p-0 evaluation-container">
            {selectedEmployeeForEvaluation && evaluationType === "employee" && (
              <>
                {/* If employee is HO, use HO evaluation forms (RankNfileHo) */}
                {/* If employee is NOT HO, use BranchEvaluationForm which routes correctly */}
                {isEmployeeHO(selectedEmployeeForEvaluation) ? (
                  <RankNfileHo
                    employee={selectedEmployeeForEvaluation}
                    onCloseAction={closeEvaluationModal}
                  />
                ) : (
                  <BranchEvaluationForm
                    employee={selectedEmployeeForEvaluation}
                    onCloseAction={closeEvaluationModal}
                    evaluationType="rankNfile"
                  />
                )}
              </>
            )}
            {selectedEmployeeForEvaluation && evaluationType === "manager" && (
              <>
                {/* If employee is HO, use HO evaluation forms (BasicHo) */}
                {/* If employee is NOT HO (Branch), use BranchManagerEvaluationForm directly */}
                {isEmployeeHO(selectedEmployeeForEvaluation) ? (
                  <BasicHo
                    employee={selectedEmployeeForEvaluation}
                    onCloseAction={closeEvaluationModal}
                  />
                ) : (
                  <BranchManagerEvaluationForm
                    employee={selectedEmployeeForEvaluation}
                    onCloseAction={closeEvaluationModal}
                    evaluationType="basic"
                  />
                )}
              </>
            )}
            {selectedEmployeeForEvaluation && evaluationType === "areaManager" && (
              <AreaManagerEvaluationForm
                employee={selectedEmployeeForEvaluation}
                onCloseAction={closeEvaluationModal}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
