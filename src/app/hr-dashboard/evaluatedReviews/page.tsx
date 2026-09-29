"use client";

import { Skeleton } from "@/components/ui/skeleton";
import clientDataService, { apiService } from "@/lib/apiService";
import { getCachedYears, getCachedBranches } from "@/lib/referenceDataCache";
import EvaluationsPagination from "@/components/paginationComponent";
import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import ViewResultsModal from "@/components/evaluation/ViewResultsModal";
import EvaluationEditRouter from "@/components/evaluation/EvaluationEditRouter";
import ViewEvaluationMobileWarningModal from "@/components/evaluation/ViewEvaluationMobileWarningModal";
import { useAuth } from "@/contexts/UserContext";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { useDialogAnimation } from "@/hooks/useDialogAnimation";
import { cn } from "@/lib/utils";
import { toastMessages } from "@/lib/toastMessages";
import { getEmployeeBranchCodeDisplay } from "@/components/evaluation/employeeBranchLabel";
import {
  EvalRecordSignBadge,
  hasEmployeeSigned,
  hasEvaluatorSigned,
  hasHrSigned,
  shouldShowEmployeeSignPending,
  shouldShowEvaluatorSignPending,
  shouldShowHrSignPending,
  getReviewQuarterBadgeClass,
  getReviewQuarterDisplay,
  EvalRecordRowActions,
  EvalRecordTableRow,
  EvaluationApiErrorDialog,
  type EvaluationRecordReview,
  getReviewRowClassName,
  getViewEvaluationErrorMessage,
  getDeleteEvaluationErrorMessage,
  isReviewDraft,
  QUARTER_LATE_LEGEND_LABEL,
} from "@/components/evaluation/evaluationRecordsShared";

interface Review {
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
}

/** Single source of truth for rating colors + legend (matches filter: poor / low / good / excellent). */
const RATING_DISPLAY_BANDS = [
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

function parseRatingNumber(
  rating: number | string | null | undefined
): number | null {
  if (rating === null || rating === undefined || rating === "") return null;
  const n = typeof rating === "string" ? parseFloat(rating) : Number(rating);
  return Number.isNaN(n) ? null : n;
}

function getRatingBadgeClassFromBands(
  rating: number | string | null | undefined
): string {
  const n = parseRatingNumber(rating);
  if (n === null) return "bg-gray-100 text-gray-600";
  for (const band of RATING_DISPLAY_BANDS) {
    if (n < band.maxExclusive) return band.badgeClass;
  }
  return RATING_DISPLAY_BANDS[RATING_DISPLAY_BANDS.length - 1].badgeClass;
}

/** List rows may use `rating`, snake_case, or omit until scored — 0 is treated as not rated (same as other HR screens). */
function getReviewListRating(review: Review | null | undefined): number | null {
  if (!review) return null;
  const extended = review as Review & {
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

const ratingPillClass =
  "inline-flex items-center justify-center rounded-md border border-transparent px-1.5 py-0.5 text-[0.65rem] font-medium whitespace-nowrap sm:px-2 sm:text-xs";

/** Responsive density for the wide evaluation records grid. */
const EVAL_RECORDS_TABLE_CLASS =
  "min-w-[38rem] sm:min-w-[48rem] md:min-w-[56rem] lg:min-w-[68rem] xl:min-w-0 xl:w-full [&_th]:h-auto [&_th]:min-h-8 [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-2 [&_th]:align-middle [&_th]:text-[0.6rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-600 sm:[&_th]:min-h-9 sm:[&_th]:px-2.5 sm:[&_th]:py-2.5 sm:[&_th]:text-[0.65rem] lg:[&_th]:px-3 lg:[&_th]:text-xs xl:[&_th]:px-4 [&_td]:min-w-0 [&_td]:px-2 [&_td]:py-2 [&_td]:align-top [&_td]:text-[0.7rem] [&_td]:leading-snug sm:[&_td]:px-2.5 sm:[&_td]:py-2.5 sm:[&_td]:text-xs lg:[&_td]:px-3 lg:[&_td]:text-sm lg:[&_td]:leading-snug";

/** Sticky actions column only on large screens; mobile uses compact icon buttons. */
function evalTableActionsCellClass(rowClassName: string) {
  return cn(
    "w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] p-1 sm:w-auto sm:min-w-[4.5rem] sm:max-w-none sm:p-2",
    "lg:sticky lg:right-0 lg:z-[3] lg:min-w-[7rem] lg:w-auto lg:shadow-[-6px_0_12px_-4px_rgba(15,23,42,0.12)]",
    rowClassName.includes("bg-green-50") && "lg:bg-green-50",
    rowClassName.includes("bg-red-200") && "lg:bg-red-200",
    rowClassName.includes("bg-yellow-50") && "lg:bg-yellow-50",
    rowClassName.includes("bg-blue-50") && "lg:bg-blue-50",
    rowClassName.includes("bg-orange-50") && "lg:bg-orange-50",
    !rowClassName.includes("bg-green-50") &&
      !rowClassName.includes("bg-red-200") &&
      !rowClassName.includes("bg-yellow-50") &&
      !rowClassName.includes("bg-blue-50") &&
      !rowClassName.includes("bg-orange-50") &&
      "lg:bg-white"
  );
}

const EVAL_TABLE_ACTIONS_HEAD_CLASS = cn(
  "w-[3.25rem] min-w-[3.25rem] p-1 text-center sm:min-w-[4.5rem] sm:p-2 lg:sticky lg:right-0 lg:z-[4] lg:min-w-[7rem] lg:bg-white lg:text-left lg:shadow-[-6px_0_12px_-4px_rgba(15,23,42,0.12)]"
);

function formatReviewListDate(createdAt: string): { short: string; full: string } {
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

function formatReviewStatusLabel(status: string): { short: string; full: string } {
  const s = String(status ?? "");
  if (s === "completed") return { short: "✓ Done", full: `✓ ${s}` };
  if (s === "pending") return { short: "⏳ Pend.", full: `⏳ ${s}` };
  return { short: s, full: s };
}

export default function OverviewTab() {
  const { user } = useAuth();
  const isMobileViewport = useMobileViewport();
  const [evaluations, setEvaluations] = useState<Review[]>([]);
  /** True on open so the table refreshes whenever this page mounts. */
  const [refreshing, setRefreshing] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  //filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [quarterFilter, setQuarterFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  /** Selected branch ids (from `getBranches`); empty = all branches */
  const [branchFilterIds, setBranchFilterIds] = useState<string[]>([]);
  //debounce filters
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [debouncedStatusFilter, setDebouncedStatusFilter] =
    useState(statusFilter);
  const [debouncedQuarterFilter, setDebouncedQuarterFilter] =
    useState(quarterFilter);
  const [debouncedYearFilter, setDebouncedYearFilter] = useState(yearFilter);
  const [debouncedRatingFilter, setDebouncedRatingFilter] =
    useState(ratingFilter);
  const [debouncedBranchFilterIds, setDebouncedBranchFilterIds] = useState<
    string[]
  >(branchFilterIds);

  const hasActiveDebouncedFilters = useMemo(() => {
    if (debouncedSearchTerm.trim() !== "") return true;
    const isAll = (v: string) => v === "" || v === "0";
    if (!isAll(debouncedStatusFilter)) return true;
    if (!isAll(debouncedQuarterFilter)) return true;
    if (!isAll(debouncedYearFilter)) return true;
    if (!isAll(debouncedRatingFilter)) return true;
    if (debouncedBranchFilterIds.length > 0) return true;
    return false;
  }, [
    debouncedSearchTerm,
    debouncedStatusFilter,
    debouncedQuarterFilter,
    debouncedYearFilter,
    debouncedRatingFilter,
    debouncedBranchFilterIds,
  ]);

  const [isViewResultsModalOpen, setIsViewResultsModalOpen] = useState(false);
  const [viewSubmissionId, setViewSubmissionId] = useState<
    number | string | null
  >(null);
  const [isEditEvaluationModalOpen, setIsEditEvaluationModalOpen] =
    useState(false);
  const [selectedSubmissionForEdit, setSelectedSubmissionForEdit] =
    useState<any>(null);
  const [isLoadingEditEvaluation, setIsLoadingEditEvaluation] = useState(false);
  const [bypassEditMobileWarning, setBypassEditMobileWarning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(0);
  const [evaluationActionError, setEvaluationActionError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const dialogAnimationClass = useDialogAnimation({ duration: 0.4 });
  const [years, setYears] = useState<any[]>([]);
  const [branchesData, setBranchesData] = useState<any[]>([]);
  const [branchPopoverSearch, setBranchPopoverSearch] = useState("");
  const submissionsInFlightKeyRef = useRef<string | null>(null);
  const submissionsInFlightPromiseRef = useRef<Promise<void> | null>(null);
  const prevFilterSnapshotForPageRef = useRef<string | null>(null);

  const filteredBranchesForPopover = useMemo(() => {
    const q = branchPopoverSearch.trim().toLowerCase();
    if (!q) return branchesData;
    return branchesData.filter((b: { label?: string }) =>
      String(b.label ?? "").toLowerCase().includes(q)
    );
  }, [branchesData, branchPopoverSearch]);

  // Helper function to get branch code from branch data
  const getBranchCode = (branch: any): string => {
    if (!branch) return "N/A";
    
    // If branch has branch_code directly
    if (branch.branch_code) {
      return branch.branch_code;
    }
    
    // If branch has code directly
    if (branch.code) {
      return branch.code;
    }
    
    // Try to find matching branch in branchesData by id first
    if (branch.id && branchesData.length > 0) {
      const foundBranchById = branchesData.find((b: any) => {
        return String(b.value) === String(branch.id);
      });
      
      if (foundBranchById?.label) {
        const labelParts = foundBranchById.label.split(" /");
        // Return the code part (after " /") if it exists, otherwise return the name
        return labelParts[1]?.trim() || labelParts[0]?.trim() || "N/A";
      }
    }
    
    // If branch has branch_name, try to find matching branch in branchesData by name
    if (branch.branch_name && branchesData.length > 0) {
      // branchesData comes from getBranches which returns { label: "branch_name / branch_code", value: "id" }
      const foundBranch = branchesData.find((b: any) => {
        if (b.label) {
          const labelParts = b.label.split(" /");
          return labelParts[0]?.trim() === branch.branch_name.trim();
        }
        return false;
      });
      
      if (foundBranch?.label) {
        const labelParts = foundBranch.label.split(" /");
        // Return the code part (after " /") if it exists
        return labelParts[1]?.trim() || labelParts[0]?.trim() || branch.branch_name;
      }
    }
    
    // If branch has name property, try to match by name
    if (branch.name && branchesData.length > 0) {
      const foundBranch = branchesData.find((b: any) => {
        if (b.label) {
          const labelParts = b.label.split(" /");
          return labelParts[0]?.trim() === branch.name.trim();
        }
        return false;
      });
      
      if (foundBranch?.label) {
        const labelParts = foundBranch.label.split(" /");
        return labelParts[1]?.trim() || labelParts[0]?.trim() || branch.name;
      }
    }
    
    // If branch is an ID/value directly, match by branchesData value
    const branchId = String(branch).trim();
    if (branchId && branchesData.length > 0) {
      const foundBranchByValue = branchesData.find(
        (b: any) => String(b?.value) === branchId
      );
      if (foundBranchByValue?.label) {
        const labelParts = String(foundBranchByValue.label).split(" /");
        return labelParts[1]?.trim() || labelParts[0]?.trim() || "N/A";
      }
    }

    // Fallback to branch_name or name if code not found
    return branch.branch_name || branch.name || "N/A";
  };

  const getEmployeeBranchCode = (employee: any): string => {
    if (!employee) return "N/A";

    // 1) Prefer the direct `employee.branch` object (new API shape)
    if (employee.branch) {
      const branchVal = employee.branch;
      if (typeof branchVal === "object") {
        // Prefer branch_code (HO tends to be `branch_code: "HO"` or similar)
        const code =
          (branchVal as any).branch_code ??
          (branchVal as any).code ??
          (branchVal as any).acronym ??
          "";
        const codeStr = String(code).trim();
        if (codeStr) return codeStr;

        const fromObjName = String(
          (branchVal as any).branch_name ?? (branchVal as any).name ?? ""
        ).trim();
        if (fromObjName) return fromObjName;
      } else if (branchVal !== null && branchVal !== undefined && branchVal !== "") {
        return getBranchCode(branchVal);
      }
    }

    // 2) Legacy `employee.branches` (array or object)
    if (employee.branches) {
      const branchData = Array.isArray(employee.branches)
        ? employee.branches[0]
        : employee.branches;
      const codeFromBranches = getBranchCode(branchData);
      if (codeFromBranches !== "N/A") return codeFromBranches;
    }

    // 3) branch_id / branch
    const branchIdOrValue = employee.branch_id ?? employee.branch;
    if (
      branchIdOrValue !== undefined &&
      branchIdOrValue !== null &&
      branchIdOrValue !== ""
    ) {
      return getBranchCode(branchIdOrValue);
    }

    // 4) Fallback
    return employee.branch_name || "N/A";
  };

  const loadEvaluations = async (
    searchValue: string,
    status: string,
    quarter: string,
    year: string,
    rating: string,
    branchIds: string[]
  ) => {
    const normalizedStatus = status === "0" ? "" : status;
    const normalizedQuarter = quarter === "0" ? "" : quarter;
    const normalizedYear = year === "0" ? "" : year;
    const normalizedRating = rating === "0" ? "" : rating;
    const normalizedBranch =
      branchIds.length === 0 ? "" : [...branchIds].sort().join(",");

    const requestKey = JSON.stringify({
      searchValue,
      currentPage,
      itemsPerPage,
      normalizedStatus,
      normalizedQuarter,
      normalizedYear,
      normalizedRating,
      normalizedBranch,
    });

    if (
      submissionsInFlightKeyRef.current === requestKey &&
      submissionsInFlightPromiseRef.current
    ) {
      await submissionsInFlightPromiseRef.current;
      return;
    }

    const requestPromise = (async () => {
      try {
        const response = await clientDataService.getSubmissions(
          searchValue,
          currentPage,
          itemsPerPage,
          normalizedStatus,
          normalizedQuarter,
          normalizedYear,
          normalizedRating,
          normalizedBranch
        );
        const serverRows: Review[] = response?.data ?? [];
        const selectedBranchIds = new Set(
          branchIds.map((id) => String(id).trim()).filter(Boolean)
        );

        // Fallback: if API still treats `branch` as single value, apply client-side
        // filtering when multiple branches are selected so UI matches selection.
        const clientFilteredRows =
          selectedBranchIds.size > 1
            ? serverRows.filter((review) => {
                const employee: any = (review as any)?.employee ?? {};
                const directId = employee?.branch_id ?? employee?.branch?.id;
                if (
                  directId !== undefined &&
                  directId !== null &&
                  String(directId).trim() !== ""
                ) {
                  return selectedBranchIds.has(String(directId).trim());
                }

                const branchesValue = employee?.branches;
                if (Array.isArray(branchesValue) && branchesValue.length > 0) {
                  return branchesValue.some((b: any) => {
                    const idCandidate = b?.id ?? b?.value ?? b?.branch_id;
                    return (
                      idCandidate !== undefined &&
                      idCandidate !== null &&
                      selectedBranchIds.has(String(idCandidate).trim())
                    );
                  });
                }

                const singleBranchObj =
                  branchesValue && !Array.isArray(branchesValue)
                    ? branchesValue
                    : employee?.branch;
                const objIdCandidate =
                  singleBranchObj?.id ??
                  singleBranchObj?.value ??
                  singleBranchObj?.branch_id;
                if (
                  objIdCandidate !== undefined &&
                  objIdCandidate !== null &&
                  String(objIdCandidate).trim() !== ""
                ) {
                  return selectedBranchIds.has(String(objIdCandidate).trim());
                }

                const code = getEmployeeBranchCode(employee);
                if (code && code !== "N/A") {
                  const matchedByCode = branchesData.find((b: any) => {
                    const label = String(b?.label ?? "");
                    const labelParts = label.split(" /");
                    const codePart = labelParts[1]?.trim() || "";
                    return (
                      codePart !== "" &&
                      codePart.toLowerCase() === String(code).toLowerCase()
                    );
                  });
                  if (matchedByCode?.value !== undefined) {
                    return selectedBranchIds.has(String(matchedByCode.value));
                  }
                }

                return false;
              })
            : serverRows;

        setEvaluations(clientFilteredRows);
        if (selectedBranchIds.size > 1) {
          const localTotal = clientFilteredRows.length;
          setOverviewTotal(localTotal);
          setTotalPages(Math.max(1, Math.ceil(localTotal / itemsPerPage)));
          setPerPage(itemsPerPage);
        } else {
          setOverviewTotal(response?.total ?? 0);
          setTotalPages(response?.last_page ?? 1);
          setPerPage(response?.per_page ?? itemsPerPage);
        }
      } catch (error) {
        console.error("Error loading evaluations:", error);
        setEvaluations([]);
        setOverviewTotal(0);
        setTotalPages(1);
        setPerPage(itemsPerPage);
      } finally {
        if (submissionsInFlightKeyRef.current === requestKey) {
          submissionsInFlightKeyRef.current = null;
          submissionsInFlightPromiseRef.current = null;
        }
      }
    })();

    submissionsInFlightKeyRef.current = requestKey;
    submissionsInFlightPromiseRef.current = requestPromise;
    await requestPromise;
  };

  useEffect(() => {
    const mount = async () => {
      try {
        const [years, branches] = await Promise.all([
          getCachedYears(),
          getCachedBranches(),
        ]);
        setYears(years);
        setBranchesData(branches);
      } catch (error) {
        console.error("Error loading years/branches:", error);
      }
    };
    mount();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      const snapshot = JSON.stringify({
        searchTerm,
        statusFilter,
        quarterFilter,
        yearFilter,
        ratingFilter,
        branchFilterIds: [...branchFilterIds].sort(),
      });
      if (
        prevFilterSnapshotForPageRef.current !== null &&
        prevFilterSnapshotForPageRef.current !== snapshot
      ) {
        setCurrentPage(1);
      }
      prevFilterSnapshotForPageRef.current = snapshot;

      setDebouncedSearchTerm(searchTerm);
      setDebouncedStatusFilter(statusFilter);
      setDebouncedQuarterFilter(quarterFilter);
      setDebouncedYearFilter(yearFilter);
      setDebouncedRatingFilter(ratingFilter);
      setDebouncedBranchFilterIds([...branchFilterIds]);
    }, 500);

    return () => clearTimeout(handler);
  }, [
    searchTerm,
    statusFilter,
    quarterFilter,
    yearFilter,
    ratingFilter,
    branchFilterIds,
  ]);

  // Track when page change started
  const pageChangeStartTimeRef = useRef<number | null>(null);

  // Fetch API whenever debounced filters change, and on every page open (refreshing starts true)
  useEffect(() => {
    const fetchData = async () => {
      try {
        await loadEvaluations(
          debouncedSearchTerm,
          debouncedStatusFilter,
          debouncedQuarterFilter,
          debouncedYearFilter,
          debouncedRatingFilter,
          debouncedBranchFilterIds
        );
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setRefreshing(false);
        // If this was a page change, ensure minimum display time (2 seconds)
        if (pageChangeStartTimeRef.current !== null) {
          const elapsed = Date.now() - pageChangeStartTimeRef.current;
          const minDisplayTime = 2000; // 2 seconds
          const remainingTime = Math.max(0, minDisplayTime - elapsed);

          setTimeout(() => {
            setIsPageLoading(false);
            pageChangeStartTimeRef.current = null;
          }, remainingTime);
        }
      }
    };

    fetchData();
  }, [
    debouncedSearchTerm,
    currentPage,
    debouncedStatusFilter,
    debouncedQuarterFilter,
    debouncedYearFilter,
    debouncedRatingFilter,
    debouncedBranchFilterIds,
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await loadEvaluations(
        debouncedSearchTerm,
        debouncedStatusFilter,
        debouncedQuarterFilter,
        debouncedYearFilter,
        debouncedRatingFilter,
        debouncedBranchFilterIds
      );
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshRef = useRef(handleRefresh);
  handleRefreshRef.current = handleRefresh;

  // Sidebar re-click while already on this page (see hr-dashboard layout).
  useEffect(() => {
    const onSidebarRefresh = () => {
      void handleRefreshRef.current();
    };
    window.addEventListener("hr-evaluated-reviews-refresh", onSidebarRefresh);
    return () => {
      window.removeEventListener(
        "hr-evaluated-reviews-refresh",
        onSidebarRefresh
      );
    };
  }, []);

  const formatRatingDisplay = (rating: number | null): string => {
    if (rating === null) return "—";
    return rating % 1 === 0 ? String(rating) : rating.toFixed(2);
  };

  const handleViewEvaluation = (review: Review) => {
    setViewSubmissionId(review.id);
    setIsViewResultsModalOpen(true);
  };

  const openDeleteModal = (review: Review) => {
    setReviewToDelete(review);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteClick = async (submission: Review | null) => {
    if (!submission) return;
    setIsDeleting(true);
    try {
      await clientDataService.deleteSubmission(submission.id);
      await handleRefresh();
      toastMessages.evaluation.deleted(
        `${submission.employee?.fname ?? ""} ${submission.employee?.lname ?? ""}`.trim() ||
          "employee"
      );
      setReviewToDelete(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      setEvaluationActionError({
        title: "Unable to Delete Evaluation",
        message: getDeleteEvaluationErrorMessage(error),
      });
      setReviewToDelete(null);
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const closeEditEvaluationModal = async () => {
    setIsEditEvaluationModalOpen(false);
    setSelectedSubmissionForEdit(null);
    setBypassEditMobileWarning(false);
    await handleRefresh();
  };

  const handleEditEvaluation = async (review: Review) => {
    const asReview = review as EvaluationRecordReview;
    if (!isReviewDraft(asReview)) {
      return;
    }

    setIsLoadingEditEvaluation(true);
    try {
      const submission = await clientDataService.getSubmissionById(review.id);

      if (submission) {
        setSelectedSubmissionForEdit(submission);
        setIsEditEvaluationModalOpen(true);
      } else {
        setEvaluationActionError({
          title: "Unable to Edit Evaluation",
          message:
            "Evaluation record was not found. Please refresh to view the latest updates.",
        });
      }
    } catch (error) {
      setEvaluationActionError({
        title: "Unable to Edit Evaluation",
        message: getViewEvaluationErrorMessage(error),
      });
    } finally {
      setIsLoadingEditEvaluation(false);
    }
  };

  return (
    <div className="relative ">
      <div className="relative  overflow-y-auto">
        <Card className="">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
              All Evaluation Records
              <Badge variant="outline" className="text-[0.65rem] font-normal sm:text-xs">
                {overviewTotal} Total Records
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Complete evaluation history with advanced filtering
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-col flex-wrap gap-4 lg:flex-row lg:items-end">
              {/* Search */}
              <div className="min-w-0 w-full flex-1 lg:min-w-[min(100%,14rem)]">
                <Label htmlFor="records-search" className="text-sm font-medium">
                  Search
                </Label>
                <div className="relative">
                  <div className="relative w-full min-w-0">
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
                      id="records-search"
                      placeholder="Search by employee, evaluator"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full min-w-0 pl-10 pr-10"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
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
                </div>
              </div>

              {/* Approval Status Filter */}
              <div className="w-full min-w-0 sm:min-w-[10rem] sm:max-w-[12rem] lg:w-48 lg:max-w-none">
                <Label
                  htmlFor="records-approval-status"
                  className="text-sm font-medium"
                >
                  Approval Status
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value)}
                >
                  <SelectTrigger
                    id="records-approval-status"
                    className="w-full cursor-pointer"
                  >
                    <SelectValue placeholder="Filter by status " />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Status</SelectItem>
                    <SelectItem value="pending">
                      Pending Verification
                    </SelectItem>
                    <SelectItem value="completed">
                      All parties approved
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quarter Filter */}
              <div className="w-full min-w-0 sm:min-w-[10rem] sm:max-w-[12rem] lg:w-48 lg:max-w-none">
                <Label
                  htmlFor="records-quarter"
                  className="text-sm font-medium"
                >
                  Quarter
                </Label>
                <Select
                  value={quarterFilter}
                  onValueChange={(value) => setQuarterFilter(value)}
                >
                  <SelectTrigger
                    id="records-quarter"
                    className="w-full cursor-pointer"
                  >
                    <SelectValue placeholder="Filter by quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Quarter</SelectItem>
                    <SelectItem value="Q1">Q1</SelectItem>
                    <SelectItem value="Q2">Q2</SelectItem>
                    <SelectItem value="Q3">Q3</SelectItem>
                    <SelectItem value="Q4">Q4</SelectItem>
                    <SelectItem value="3">M3</SelectItem>
                    <SelectItem value="5">M5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Year Filter */}
              <div className="w-full min-w-0 sm:min-w-[10rem] sm:max-w-[12rem] lg:w-48 lg:max-w-none">
                <Label htmlFor="records-year" className="text-sm font-medium">
                  Year
                </Label>
                <Select
                  value={yearFilter}
                  onValueChange={(value) => setYearFilter(value)}
                >
                  <SelectTrigger
                    id="records-year"
                    className="mt-1 w-full cursor-pointer"
                  >
                    <SelectValue placeholder="Select a year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Years</SelectItem>
                    {years.map((year: any) => (
                      <SelectItem key={year.year} value={year.year}>
                        {year.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rating Filter */}
              <div className="w-full min-w-0 sm:min-w-[10rem] sm:max-w-[12rem] lg:w-48 lg:max-w-none">
                <Label
                  htmlFor="records-rating"
                  className="text-sm font-medium"
                >
                  Rating
                </Label>
                <Select
                  value={ratingFilter}
                  onValueChange={(value) => setRatingFilter(value)}
                >
                  <SelectTrigger
                    id="records-rating"
                    className="w-full cursor-pointer"
                  >
                    <SelectValue placeholder="Filter by rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Ratings</SelectItem>
                    <SelectItem value="poor">Poor (&lt;2.5)</SelectItem>
                    <SelectItem value="low">Low (&lt;3.0)</SelectItem>
                    <SelectItem value="good">Good (3.0-3.9)</SelectItem>
                    <SelectItem value="excellent">Excellent (≥4.0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Branch Filter (multi-select checkboxes) */}
              <div className="w-full min-w-0 sm:min-w-[12rem] sm:max-w-[14rem] lg:w-56 lg:max-w-none">
                <Label
                  htmlFor="records-branch-trigger"
                  className="text-sm font-medium"
                >
                  Branch
                </Label>
                <Popover
                  onOpenChange={(open) => {
                    if (!open) setBranchPopoverSearch("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="records-branch-trigger"
                      type="button"
                      variant="outline"
                      className="mt-1 h-9 w-full justify-between px-3 font-normal"
                    >
                      <span className="truncate text-left">
                        {branchFilterIds.length === 0
                          ? "All branches"
                          : `${branchFilterIds.length} branch${
                              branchFilterIds.length === 1 ? "" : "es"
                            } selected`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" align="start">
                    <div className="p-2 pb-1 border-b">
                      <Label htmlFor="branch-popover-search" className="sr-only">
                        Search branches
                      </Label>
                      <div className="relative">
                        <Search
                          className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none"
                          aria-hidden
                        />
                        <Input
                          id="branch-popover-search"
                          type="search"
                          value={branchPopoverSearch}
                          onChange={(e) => setBranchPopoverSearch(e.target.value)}
                          placeholder="Search branches..."
                          className="h-8 pl-8 text-sm"
                          autoComplete="off"
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setBranchFilterIds([])}
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => {
                          const source =
                            branchPopoverSearch.trim().length > 0
                              ? filteredBranchesForPopover
                              : branchesData;
                          setBranchFilterIds(
                            source.map((b: { value: string | number }) =>
                              String(b.value)
                            )
                          );
                        }}
                      >
                        Select all
                      </Button>
                    </div>
                    <div
                      className="max-h-64 overflow-y-auto p-2 space-y-2"
                      role="group"
                      aria-label="Branches"
                    >
                      {branchesData.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-1 py-2">
                          No branches loaded.
                        </p>
                      ) : filteredBranchesForPopover.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-1 py-2">
                          No branches match your search.
                        </p>
                      ) : (
                        filteredBranchesForPopover.map(
                          (b: { value: string | number; label: string }) => {
                            const id = String(b.value);
                            const checked = branchFilterIds.includes(id);
                            return (
                              <label
                                key={id}
                                className="flex items-start gap-2 cursor-pointer text-sm leading-tight rounded-sm px-1 py-0.5 hover:bg-muted/60"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 rounded border-input"
                                  checked={checked}
                                  onChange={() => {
                                    setBranchFilterIds((prev) =>
                                      checked
                                        ? prev.filter((v) => v !== id)
                                        : [...prev, id]
                                    );
                                  }}
                                />
                                <span className="break-words">{b.label}</span>
                              </label>
                            );
                          }
                        )
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Refresh Button */}
              <div className="flex w-full min-w-0 gap-2 lg:w-auto lg:shrink-0">
                <div className="w-full min-w-0 sm:w-auto sm:min-w-[8rem]">
                  <Label className="text-sm font-medium opacity-0">
                    Refresh
                  </Label>
                  {/* Refresh Button */}
                  <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="mt-1 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:cursor-not-allowed"
                    title="Refresh evaluation records"
                  >
                    {refreshing ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Refreshing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>🔄</span>
                        <span>Refresh</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6 mt-2">
        {/* Main Container Div (replacing Card) */}
        <div className="rounded-lg border bg-white p-4 sm:p-6">
          {/* Table Header Section */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
            <div className="flex items-center gap-2">
              {(() => {
                const now = new Date();
                const newCount = evaluations?.filter((review) => {
                  const hoursDiff =
                    (now.getTime() - new Date(review.created_at).getTime()) /
                    (1000 * 60 * 60);
                  return hoursDiff <= 24;
                }).length;
                return newCount > 0 ? (
                  <Badge className="bg-yellow-500 text-white animate-pulse">
                    {newCount} NEW
                  </Badge>
                ) : null;
              })()}
            </div>
            {/* Search Bar and Refresh Button */}
          </div>

          {/* Indicator Legend */}
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5 sm:mb-4 sm:p-3">
            <div className="flex flex-wrap gap-2 text-[0.65rem] sm:gap-3 sm:text-xs md:gap-4">
              <span className="mr-1 w-full text-xs font-medium text-gray-700 sm:mr-2 sm:w-auto sm:text-sm">
                Indicators:
              </span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-100 border-l-2 border-l-yellow-500 rounded"></div>
                <Badge className="bg-yellow-200 text-yellow-800 text-xs">
                  New
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-50 border-l-2 border-l-blue-500 rounded"></div>
                <Badge className="bg-blue-300 text-blue-800 text-xs">
                  Recent
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-50 border-l-2 border-l-red-500 rounded"></div>
                <Badge className="bg-orange-300 text-orange-800 text-xs">
                  Pending
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-50 border-l-2 border-l-green-500 rounded"></div>
                <Badge className="bg-green-500 text-white text-xs">
                  Completed
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded border-l-2 border-l-red-600 bg-red-200" />
                <Badge className="border border-red-500 bg-red-500 text-xs text-white">
                  {QUARTER_LATE_LEGEND_LABEL}
                </Badge>
              </div>
              <span className="mr-1 mt-1 w-full text-xs font-medium text-gray-700 sm:mr-2 sm:mt-0 sm:w-auto sm:text-sm">
                Quarter:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <Badge className="bg-blue-100 text-blue-800 text-xs">Q1</Badge>
                <Badge className="bg-green-100 text-green-800 text-xs">Q2</Badge>
                <Badge className="bg-yellow-100 text-yellow-800 text-xs">Q3</Badge>
                <Badge className="bg-purple-100 text-purple-800 text-xs">Q4</Badge>
              </div>
              <span className="mr-1 mt-1 w-full text-xs font-medium text-gray-700 sm:mr-2 sm:mt-0 sm:w-auto sm:text-sm">
                Rating:
              </span>
              {RATING_DISPLAY_BANDS.map((band) => (
                <div key={band.legend} className="flex items-center gap-1">
                  <span
                    className={cn(ratingPillClass, band.badgeClass, "text-xs")}
                  >
                    {band.legend}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="mb-2 text-[0.65rem] text-muted-foreground lg:hidden">
            Swipe horizontally to view all columns.
          </p>

          {/* Table Section */}
          <div className="overflow-hidden rounded-lg border">
            <div
              className="relative max-h-[min(70vh,32rem)] overflow-x-auto overflow-y-auto sm:max-h-[min(75vh,36rem)] lg:max-h-[600px] [-webkit-overflow-scrolling:touch]"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#cbd5e1 #f1f5f9",
              }}
            >
              {refreshing && ( // Only show spinner for initial refresh
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none bg-white/80">
                  <div className="flex flex-col items-center gap-3 bg-white/95 px-8 py-6 rounded-lg shadow-lg">
                    <div className="relative">
                      {/* Spinning ring */}
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
                      {/* Logo in center */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img
                          src="/smct.png"
                          alt="SMCT Logo"
                          className="h-10 w-10 object-contain"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      Refreshing...
                    </p>
                  </div>
                </div>
              )}
              <Table
                className={EVAL_RECORDS_TABLE_CLASS}
                wrapperClassName="overflow-visible"
              >
                <TableHeader className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 shadow-[inset_0_-1px_0_0_rgb(226_232_240)] backdrop-blur-sm">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="min-w-[6.5rem] sm:min-w-[7.5rem] lg:min-w-[8.5rem]">
                      Employee
                    </TableHead>
                    <TableHead className="min-w-[6.5rem] sm:min-w-[7.5rem] lg:min-w-[8.5rem]">
                      Evaluator
                    </TableHead>
                    <TableHead className="hidden min-w-[4rem] md:table-cell">
                      Branch
                    </TableHead>
                    <TableHead className="min-w-[3.5rem]">Quarter</TableHead>
                    <TableHead className="min-w-[5rem] sm:min-w-[6.5rem] lg:min-w-[8rem]">
                      Date
                    </TableHead>
                    <TableHead className="min-w-[3.25rem]">Rating</TableHead>
                    <TableHead className="min-w-[4.5rem] sm:min-w-[5rem]">
                      Status
                    </TableHead>
                    <TableHead className="hidden min-w-[4.5rem] lg:table-cell xl:min-w-[5.5rem]">
                      <span className="xl:hidden">Emp. Sign</span>
                      <span className="hidden xl:inline">Employee Sign</span>
                    </TableHead>
                    <TableHead className="hidden min-w-[4.5rem] xl:table-cell">
                      Evaluator Sign
                    </TableHead>
                    <TableHead className="hidden min-w-[4rem] xl:table-cell">
                      HR Sign
                    </TableHead>
                    <TableHead className={EVAL_TABLE_ACTIONS_HEAD_CLASS}>
                      <span className="lg:hidden" aria-hidden>
                        ⋮
                      </span>
                      <span className="hidden lg:inline">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200">
                  {refreshing || isPageLoading ? (
                    Array.from({ length: itemsPerPage }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        <TableCell>
                          <Skeleton className="h-5 w-20 sm:h-6 sm:w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-20 sm:h-6 sm:w-24" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Skeleton className="h-5 w-14 sm:h-6 sm:w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-12 sm:h-6 sm:w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-24 sm:h-6 sm:w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-12 sm:h-6 sm:w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16 sm:h-6 sm:w-20" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Skeleton className="h-5 w-14 sm:h-6 sm:w-20" />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Skeleton className="h-5 w-14 sm:h-6 sm:w-20" />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Skeleton className="h-5 w-14 sm:h-6 sm:w-20" />
                        </TableCell>
                        <TableCell className={evalTableActionsCellClass("")}>
                          <Skeleton className="mx-auto h-8 w-8 rounded-md sm:mx-0 sm:h-8 sm:w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : evaluations?.length === 0 || !evaluations ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-10 text-center sm:py-12">
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
                            {hasActiveDebouncedFilters ? (
                              <>
                                <p className="mb-1 text-sm font-medium sm:text-base">
                                  No results found
                                </p>
                                <p className="text-xs text-gray-400 sm:text-sm">
                                  Try adjusting your search or filters
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="mb-1 text-sm font-medium sm:text-base">
                                  No evaluation records to display
                                </p>
                                <p className="text-xs text-gray-400 sm:text-sm">
                                  Records will appear here when evaluations are
                                  submitted
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    evaluations?.map((review) => {
                      const rowClassName = getReviewRowClassName(
                        review as Parameters<typeof getReviewRowClassName>[0]
                      );
                      const reviewDate = formatReviewListDate(review.created_at);
                      const statusLabels = formatReviewStatusLabel(review.status);

                      return (
                        <EvalRecordTableRow
                          key={review.id}
                          review={
                            review as Parameters<typeof getReviewRowClassName>[0]
                          }
                          className={rowClassName}
                        >
                          <TableCell>
                            <span className="block max-w-[9rem] truncate font-medium text-gray-900 sm:max-w-[11rem] lg:max-w-none">
                              {[review.employee?.fname, review.employee?.lname]
                                .filter(Boolean)
                                .join(" ")
                                .trim() || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="block max-w-[9rem] truncate font-medium text-gray-900 sm:max-w-[11rem] lg:max-w-none">
                              {[review.evaluator?.fname, review.evaluator?.lname]
                                .filter(Boolean)
                                .join(" ")
                                .trim() || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="hidden text-gray-600 md:table-cell">
                            <span className="block max-w-[5rem] truncate sm:max-w-none">
                              {getEmployeeBranchCode(review.employee)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const displayValue = getReviewQuarterDisplay(review);
                              return (
                                <Badge
                                  className={cn(
                                    "max-w-[5.5rem] truncate text-[0.65rem] sm:max-w-none sm:text-xs",
                                    getReviewQuarterBadgeClass(review)
                                  )}
                                >
                                  {displayValue}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-gray-600">
                            <span className="sm:hidden">{reviewDate.short}</span>
                            <span className="hidden sm:inline">{reviewDate.full}</span>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const ratingValue = getReviewListRating(review);
                              return (
                                <span
                                  className={cn(
                                    ratingPillClass,
                                    getRatingBadgeClassFromBands(ratingValue)
                                  )}
                                >
                                  {formatRatingDisplay(ratingValue)}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-[0.65rem] sm:text-xs",
                                review.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : review.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-yellow-100 text-yellow-800"
                              )}
                            >
                              <span className="sm:hidden">{statusLabels.short}</span>
                              <span className="hidden sm:inline">
                                {statusLabels.full}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-gray-600 lg:table-cell">
                            <EvalRecordSignBadge
                              signed={hasEmployeeSigned(review)}
                              pending={shouldShowEmployeeSignPending(review)}
                            />
                          </TableCell>
                          <TableCell className="hidden text-gray-600 xl:table-cell">
                            <EvalRecordSignBadge
                              signed={hasEvaluatorSigned(review)}
                              pending={shouldShowEvaluatorSignPending(review)}
                            />
                          </TableCell>
                          <TableCell className="hidden text-gray-600 xl:table-cell">
                            <EvalRecordSignBadge
                              signed={hasHrSigned(review)}
                              pending={shouldShowHrSignPending(review)}
                            />
                          </TableCell>

                          <TableCell className={evalTableActionsCellClass(rowClassName)}>
                            <EvalRecordRowActions
                              review={review as EvaluationRecordReview}
                              onViewAction={() => handleViewEvaluation(review)}
                              onEditAction={() => handleEditEvaluation(review)}
                              onDeleteAction={() => openDeleteModal(review)}
                              deleting={
                                isDeleting && reviewToDelete?.id === review.id
                              }
                              allowDraftEdit={isReviewDraft(
                                review as EvaluationRecordReview
                              )}
                            />
                          </TableCell>
                        </EvalRecordTableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <EvaluationsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={overviewTotal}
              perPage={perPage}
              onPageChange={(page) => {
                setIsPageLoading(true);
                pageChangeStartTimeRef.current = Date.now();
                setCurrentPage(page);
              }}
            />
          )}
        </div>

        <EvaluationApiErrorDialog
          open={evaluationActionError != null}
          title={evaluationActionError?.title ?? ""}
          message={evaluationActionError?.message ?? null}
          dialogClassName={dialogAnimationClass}
          onCloseAction={() => {
            setEvaluationActionError(null);
            void handleRefresh();
          }}
        />

        {/* Delete Confirmation Modal */}
        <Dialog
          open={isDeleteModalOpen}
          onOpenChangeAction={(open) => {
            setIsDeleteModalOpen(open);
            if (!open) {
              setReviewToDelete(null);
            }
          }}
        >
          <DialogContent className={`max-w-md p-6 ${dialogAnimationClass}`}>
            <DialogHeader className="pb-4 bg-red-50 rounded-lg ">
              <DialogTitle className="text-red-800 flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                Delete Evaluation of{" "}
                {reviewToDelete?.employee?.fname +
                  " " +
                  reviewToDelete?.employee?.lname}
              </DialogTitle>
              <DialogDescription className="text-red-700">
                This action cannot be undone. Are you sure you want to
                permanently delete this evaluation?
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
                      <li>This evaluation record</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-700">
                  <p className="font-medium">Evaluation Details:</p>
                  <div className="mt-2 space-y-1">
                    <p>
                      <span className="font-medium">Employee Name:</span>{" "}
                      {reviewToDelete?.employee?.fname +
                        " " +
                        reviewToDelete?.employee?.lname}
                    </p>
                    <p>
                      <span className="font-medium">Evaluator Name:</span>{" "}
                      {reviewToDelete?.evaluator?.fname +
                        " " +
                        reviewToDelete?.evaluator?.lname}
                    </p>
                    <p>
                      <span className="font-medium">Branch:</span>{" "}
                      {reviewToDelete?.employee
                        ? getEmployeeBranchCodeDisplay(
                            reviewToDelete.employee,
                            branchesData,
                            refreshing
                          )
                        : "N/A"}
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
                    setReviewToDelete(null);
                  }}
                  className="text-white bg-red-600 hover:text-white hover:bg-red-500 cursor-pointer hover:scale-110 transition-transform duration-200 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-red-700 text-white cursor-pointer hover:scale-110 transition-transform duration-200 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  onClick={() => handleDeleteClick(reviewToDelete)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Deleting...
                    </>
                  ) : (
                    "❌ Delete Permanently"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Results Modal */}
        <ViewResultsModal
          isOpen={isViewResultsModalOpen}
          submissionId={viewSubmissionId}
          submission={null}
          loadTimeoutMs={4500}
          onLoadErrorAction={(message) => {
            setEvaluationActionError({
              title: "Unable to Open Evaluation",
              message,
            });
          }}
          onCloseAction={() => {
            setIsViewResultsModalOpen(false);
            setViewSubmissionId(null);
          }}
          showApprovalButton={false}
        />

        {isEditEvaluationModalOpen &&
        isMobileViewport &&
        !bypassEditMobileWarning ? (
          <ViewEvaluationMobileWarningModal
            isOpen={isEditEvaluationModalOpen}
            onCloseAction={closeEditEvaluationModal}
            onViewAnywayAction={() => setBypassEditMobileWarning(true)}
          />
        ) : (
          <Dialog
            open={isEditEvaluationModalOpen}
            onOpenChangeAction={(open) => {
              if (!open) {
                void closeEditEvaluationModal();
              }
            }}
          >
            <DialogContent className="max-w-7xl max-h-[101vh] overflow-hidden p-0 evaluation-container">
              {isLoadingEditEvaluation ? (
                <div className="flex min-h-[12rem] items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : selectedSubmissionForEdit ? (
                <EvaluationEditRouter
                  submission={selectedSubmissionForEdit}
                  onCloseAction={closeEditEvaluationModal}
                  onCancelAction={closeEditEvaluationModal}
                />
              ) : null}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
