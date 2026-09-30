"use client";

import { Skeleton } from "@/components/ui/skeleton";
import clientDataService, { apiService } from "@/lib/apiService";
import EvaluationsPagination from "@/components/paginationComponent";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import ViewResultsModal from "@/components/evaluation/ViewResultsModal";
import EvaluationEditRouter from "@/components/evaluation/EvaluationEditRouter";
import ViewEvaluationMobileWarningModal from "@/components/evaluation/ViewEvaluationMobileWarningModal";
import { useAuth } from "@/contexts/UserContext";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { useDialogAnimation } from "@/hooks/useDialogAnimation";
import { toastMessages } from "@/lib/toastMessages";
import { Loader2, X } from "lucide-react";
import {
  EVALUATION_STATUS_FILTER_OPTIONS,
  getEvaluationStatusBadgeClass,
  normalizeEvaluationStatus,
} from "@/lib/evaluationStatus";
import { getCachedYears } from "@/lib/referenceDataCache";
import { cn } from "@/lib/utils";
import { getMyEvalAsEvaluatorCount } from "@/lib/evaluatorEvalListResponse";
import { isSubmissionResubmitAllowed } from "@/lib/evaluationSubmissionRecord";
import {
  type EvaluationRecordReview,
  EVAL_RECORDS_TABLE_CLASS,
  EVAL_TABLE_ACTIONS_HEAD_CLASS,
  EvalRecordRowActions,
  EvalRecordSignBadge,
  EvalRecordRejectedHoverHintBanner,
  EvalRecordStatusBadge,
  EvalRecordStatusTableHead,
  EvaluationApiErrorDialog,
  RATING_DISPLAY_BANDS,
  hasEmployeeSigned,
  shouldShowEmployeeSignPending,
  evalTableActionsCellClass,
  formatRatingDisplay,
  formatReviewListDate,
  getQuarterColor,
  getRatingBadgeClassFromBands,
  getReviewListRating,
  getReviewQuarterDisplay,
  getReviewRowClassName,
  hasEvaluatorSigned,
  canEvaluatorOpenEvaluationEdit,
  isReviewDraft,
  isReviewDraftEditableByEvaluator,
  isReviewApproverActionable,
  isReviewEvaluatorCurrentUser,
  getViewEvaluationErrorMessage,
  getEvaluationApiErrorMessage,
  ratingPillClass,
} from "@/components/evaluation/evaluationRecordsShared";

type Review = EvaluationRecordReview & {
  employee_branch_code?: string | null;
};

const EVALUATION_RECORDS_TABS = [
  { id: "all", label: "All Records" },
  { id: "approvals", label: "Pending Approval" },
] as const;

type EvaluationRecordsTabId =
  (typeof EVALUATION_RECORDS_TABS)[number]["id"];

const PENDING_APPROVAL_TAB_STATUSES = new Set([
  "pending_approval_1",
  "pending_approval_2",
  "rejected",
]);

/** Statuses that belong on Pending Approval — never plain `pending`. */
const PENDING_APPROVAL_COUNT_STATUSES = [
  "pending_approval_1",
  "pending_approval_2",
  "rejected",
] as const;

function isAllStatusFilter(value: string): boolean {
  return value === "" || value === "0";
}

function isStatusOnPendingApprovalTab(status: unknown): boolean {
  return PENDING_APPROVAL_TAB_STATUSES.has(normalizeEvaluationStatus(status));
}

function isStatusOnAllRecordsTab(status: unknown): boolean {
  return !isStatusOnPendingApprovalTab(status);
}

function isStatusAllowedOnTab(
  status: string,
  tab: EvaluationRecordsTabId
): boolean {
  if (isAllStatusFilter(status)) return true;
  const normalized = normalizeEvaluationStatus(status);
  return tab === "approvals"
    ? isStatusOnPendingApprovalTab(normalized)
    : isStatusOnAllRecordsTab(normalized);
}

function matchesDisplayedEvaluation(
  review: Review,
  tab: EvaluationRecordsTabId,
  statusFilter: string
): boolean {
  const status = normalizeEvaluationStatus(review.status);

  if (!isAllStatusFilter(statusFilter)) {
    return status === normalizeEvaluationStatus(statusFilter);
  }

  return tab === "approvals"
    ? isStatusOnPendingApprovalTab(status)
    : isStatusOnAllRecordsTab(status);
}

function getEvaluatorRecordsPaginator(response: unknown): {
  data: Review[];
  total: number;
  lastPage: number;
  perPage: number;
} | null {
  if (!response || typeof response !== "object") return null;

  const root = response as Record<string, unknown>;
  const paginator =
    (root.pending_approvals as Record<string, unknown> | undefined) ??
    (root.pendingApprovals as Record<string, unknown> | undefined) ??
    (root.myEval_as_Evaluator as Record<string, unknown> | undefined);

  if (!paginator || typeof paginator !== "object") return null;

  const data = Array.isArray(paginator.data) ? (paginator.data as Review[]) : [];
  const total = Number(paginator.total);
  const lastPage = Number(paginator.last_page);
  const perPage = Number(paginator.per_page);

  return {
    data,
    total: Number.isFinite(total) && total > 0 ? total : 0,
    lastPage: Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1,
    perPage: Number.isFinite(perPage) && perPage > 0 ? perPage : 0,
  };
}

function getEvaluatorRecordsTotal(response: unknown): number {
  return getEvaluatorRecordsPaginator(response)?.total ?? 0;
}

async function sumTotalsByStatuses(
  fetchForStatus: (status: string) => Promise<unknown>,
  statuses: readonly string[]
): Promise<number> {
  const responses = await Promise.all(
    statuses.map((status) => fetchForStatus(status))
  );
  return responses.reduce<number>(
    (sum, response) => sum + getEvaluatorRecordsTotal(response),
    0
  );
}

/**
 * Tab badge counts from GET `/getPendingApprovalEvaluations`.
 * Pending Approval badge → `pending_approvals.total`
 * All Records badge → `myEval_as_Evaluator_count` (all-records-only; never approval-tab rows)
 */
async function fetchTabCountsFromPendingApprovalApi(
  searchValue: string,
  quarter: string,
  yearNum: number
): Promise<{ approvals: number; all: number | null } | null> {
  try {
    const response = await apiService.getPendingApprovalEvaluations(
      searchValue,
      1,
      1,
      "",
      quarter,
      yearNum
    );

    const approvals = getEvaluatorRecordsTotal(response);
    const apiAllCount = getMyEvalAsEvaluatorCount(response);

    // If backend still mirrors the pending total into myEval_as_Evaluator_count,
    // treat it as missing so we can derive All Records from getEvalAuthEvaluator.
    const all =
      apiAllCount !== null && apiAllCount !== approvals ? apiAllCount : null;

    return { approvals, all };
  } catch {
    return null;
  }
}

/**
 * Pending Approval badge fallback when the dedicated endpoint is unavailable.
 */
async function fetchPendingApprovalTabTotal(
  searchValue: string,
  quarter: string,
  yearNum: number
): Promise<number> {
  return sumTotalsByStatuses(
    (status) =>
      apiService.getEvalAuthEvaluator(
        searchValue,
        1,
        1,
        status,
        quarter,
        yearNum
      ),
    PENDING_APPROVAL_COUNT_STATUSES
  );
}

/**
 * All Records badge: evaluator evaluations excluding approval-tab statuses.
 * Plain `pending` stays here (not on Pending Approval).
 */
async function fetchAllRecordsTabTotal(
  searchValue: string,
  quarter: string,
  yearNum: number,
  knownGrandTotal?: number
): Promise<{ all: number; grandTotal: number }> {
  let grandTotal = knownGrandTotal;
  if (grandTotal === undefined) {
    const allRes = await apiService.getEvalAuthEvaluator(
      searchValue,
      1,
      1,
      "",
      quarter,
      yearNum
    );
    grandTotal = getEvaluatorRecordsTotal(allRes);
  }

  const approvalStatusesOnEvaluatorApi = await sumTotalsByStatuses(
    (status) =>
      apiService.getEvalAuthEvaluator(
        searchValue,
        1,
        1,
        status,
        quarter,
        yearNum
      ),
    PENDING_APPROVAL_COUNT_STATUSES
  );

  return {
    grandTotal,
    all: Math.max(0, grandTotal - approvalStatusesOnEvaluatorApi),
  };
}

function getGrandTotalCacheKey(
  searchValue: string,
  quarter: string,
  year: string | number
): string {
  return JSON.stringify({
    searchValue,
    quarter,
    year: Number(year) || 0,
  });
}

type EvaluationsCacheEntry = {
  evaluations: Review[];
  overviewTotal: number;
  totalPages: number;
  perPage: number;
};

const REJECT_DRAFT_NOTE_MAX_LENGTH = 20;

export default function OverviewTab() {
  const { user } = useAuth();
  const isMobileViewport = useMobileViewport();

  const [evaluations, setEvaluations] = useState<Review[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  //filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [quarterFilter, setQuarterFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  //debounce filters
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [debouncedStatusFilter, setDebouncedStatusFilter] =
    useState(statusFilter);
  const [debouncedQuarterFilter, setDebouncedQuarterFilter] =
    useState(quarterFilter);
  const [debouncedYearFilter, setDebouncedYearFilter] = useState(yearFilter);

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
  const [itemsPerPage] = useState(5);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(0);
  const [evaluationActionError, setEvaluationActionError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [acceptingReviewId, setAcceptingReviewId] = useState<number | null>(null);
  const [rejectingReviewId, setRejectingReviewId] = useState<number | null>(null);
  const [isRejectDraftModalOpen, setIsRejectDraftModalOpen] = useState(false);
  const [reviewToReject, setReviewToReject] = useState<Review | null>(null);
  const [rejectDraftNote, setRejectDraftNote] = useState("");
  const [rejectModalKind, setRejectModalKind] = useState<"draft" | "approval">(
    "draft"
  );
  const [activeRecordsTab, setActiveRecordsTab] =
    useState<EvaluationRecordsTabId>("all");
  const [tabRecordCounts, setTabRecordCounts] = useState({
    all: 0,
    approvals: 0,
  });
  const dialogAnimationClass = useDialogAnimation({ duration: 0.4 });
  const [years, setYears] = useState<any[]>([]);
  const evaluationsInFlightKeyRef = useRef<string | null>(null);
  const evaluationsInFlightPromiseRef = useRef<Promise<number> | null>(null);
  const evaluationsCacheRef = useRef<Map<string, EvaluationsCacheEntry>>(
    new Map()
  );
  const tabCountsCacheRef = useRef<
    Map<string, { all: number; approvals: number }>
  >(new Map());
  const tabCountsInFlightKeyRef = useRef<string | null>(null);
  const tabCountsInFlightPromiseRef = useRef<Promise<void> | null>(null);
  const grandTotalCacheRef = useRef<Map<string, number>>(new Map());
  const prevTabCountFilterKeyRef = useRef<string | null>(null);
  const prevFilterSnapshotForPageRef = useRef<string | null>(null);
  const prevActiveRecordsTabRef = useRef<EvaluationRecordsTabId>("all");

  const statusFilterOptionsForTab = useMemo(() => {
    if (activeRecordsTab === "approvals") {
      return EVALUATION_STATUS_FILTER_OPTIONS.filter((option) =>
        isStatusOnPendingApprovalTab(option.value)
      );
    }

    return EVALUATION_STATUS_FILTER_OPTIONS.filter((option) =>
      isStatusOnAllRecordsTab(option.value)
    );
  }, [activeRecordsTab]);

  const displayedEvaluations = useMemo(
    () =>
      evaluations.filter((review) =>
        matchesDisplayedEvaluation(
          review,
          activeRecordsTab,
          debouncedStatusFilter
        )
      ),
    [evaluations, activeRecordsTab, debouncedStatusFilter]
  );

  const hasActiveDebouncedFilters = useMemo(() => {
    if (debouncedSearchTerm.trim() !== "") return true;
    const isAll = (v: string) => v === "" || v === "0";
    if (!isAll(debouncedStatusFilter)) return true;
    if (!isAll(debouncedQuarterFilter)) return true;
    if (!isAll(debouncedYearFilter)) return true;
    return false;
  }, [
    debouncedSearchTerm,
    debouncedStatusFilter,
    debouncedQuarterFilter,
    debouncedYearFilter,
  ]);

  const loadEvaluations = async (
    searchValue: string,
    status: string,
    quarter: string,
    year: string,
    options?: { force?: boolean }
  ): Promise<number> => {
    const isApprovalsTab = activeRecordsTab === "approvals";
    const requestKey = JSON.stringify({
      tab: activeRecordsTab,
      searchValue,
      currentPage,
      itemsPerPage,
      status,
      quarter,
      year: Number(year) || 0,
    });

    if (!options?.force) {
      const cached = evaluationsCacheRef.current.get(requestKey);
      if (cached) {
        setEvaluations(cached.evaluations);
        setOverviewTotal(cached.overviewTotal);
        setTotalPages(cached.totalPages);
        setPerPage(cached.perPage);

        if (!isApprovalsTab && isAllStatusFilter(status)) {
          grandTotalCacheRef.current.set(
            getGrandTotalCacheKey(searchValue, quarter, year),
            cached.overviewTotal
          );
        }

        return cached.overviewTotal;
      }
    }

    if (
      evaluationsInFlightKeyRef.current === requestKey &&
      evaluationsInFlightPromiseRef.current
    ) {
      await evaluationsInFlightPromiseRef.current;
      const cached = evaluationsCacheRef.current.get(requestKey);
      return cached?.overviewTotal ?? 0;
    }

    const requestPromise = (async () => {
      setIsLoadingEvaluations(true);
      try {
        const yearNum = Number(year) || 0;
        const statusParam = isAllStatusFilter(status) ? "" : status;

        let response: unknown;
        if (isApprovalsTab) {
          try {
            response = await apiService.getPendingApprovalEvaluations(
              searchValue,
              currentPage,
              itemsPerPage,
              statusParam,
              quarter,
              yearNum
            );
          } catch (pendingError) {
            console.warn(
              "getPendingApprovalEvaluations unavailable; falling back to getEvalAuthEvaluator",
              pendingError
            );
            response = await apiService.getEvalAuthEvaluator(
              searchValue,
              currentPage,
              itemsPerPage,
              statusParam,
              quarter,
              yearNum
            );
          }
        } else {
          response = await apiService.getEvalAuthEvaluator(
            searchValue,
            currentPage,
            itemsPerPage,
            statusParam,
            quarter,
            yearNum
          );
        }

        const paginator = getEvaluatorRecordsPaginator(response);
        if (!paginator) {
          console.error(
            isApprovalsTab
              ? "API response is missing pending_approvals / myEval_as_Evaluator"
              : "API response is undefined or missing myEval_as_Evaluator"
          );
          setEvaluations([]);
          setOverviewTotal(0);
          setTotalPages(1);
          setPerPage(itemsPerPage);
          return 0;
        }

        const nextEvaluations = isApprovalsTab
          ? paginator.data.filter((review) =>
              isStatusOnPendingApprovalTab(review.status)
            )
          : paginator.data.filter((review) =>
              isStatusOnAllRecordsTab(review.status)
            );
        // Keep page totals aligned with the tab: drop cross-tab statuses the API
        // may still include (e.g. plain `pending` on approvals, or approval rows on all).
        const removedCrossTabRows = Math.max(
          0,
          paginator.data.length - nextEvaluations.length
        );
        const nextOverviewTotal = Math.max(
          0,
          paginator.total - removedCrossTabRows
        );
        const nextTotalPages = paginator.lastPage;
        const nextPerPage = paginator.perPage || itemsPerPage;

        setEvaluations(nextEvaluations);
        setOverviewTotal(nextOverviewTotal);
        setTotalPages(nextTotalPages);
        setPerPage(nextPerPage);

        evaluationsCacheRef.current.set(requestKey, {
          evaluations: nextEvaluations,
          overviewTotal: nextOverviewTotal,
          totalPages: nextTotalPages,
          perPage: nextPerPage,
        });

        if (!isApprovalsTab && isAllStatusFilter(status)) {
          const countKey = JSON.stringify({
            searchValue,
            quarter,
            year: yearNum,
          });
          grandTotalCacheRef.current.set(
            getGrandTotalCacheKey(searchValue, quarter, year),
            nextOverviewTotal
          );
          // Keep All Records badge aligned with the filtered All Records list total.
          setTabRecordCounts((prev) => {
            const next = { ...prev, all: nextOverviewTotal };
            tabCountsCacheRef.current.set(countKey, {
              approvals: prev.approvals,
              all: nextOverviewTotal,
            });
            return next;
          });
        }

        if (isApprovalsTab && isAllStatusFilter(status)) {
          const countKey = JSON.stringify({
            searchValue,
            quarter,
            year: yearNum,
          });
          setTabRecordCounts((prev) => {
            const next = { ...prev, approvals: nextOverviewTotal };
            tabCountsCacheRef.current.set(countKey, {
              approvals: nextOverviewTotal,
              all: prev.all,
            });
            return next;
          });
        }

        return nextOverviewTotal;
      } catch (error) {
        console.error("Error loading evaluations:", error);
        setEvaluations([]);
        setOverviewTotal(0);
        setTotalPages(1);
        setPerPage(itemsPerPage);
        return 0;
      } finally {
        setIsLoadingEvaluations(false);
        if (evaluationsInFlightKeyRef.current === requestKey) {
          evaluationsInFlightKeyRef.current = null;
          evaluationsInFlightPromiseRef.current = null;
        }
      }
    })();

    evaluationsInFlightKeyRef.current = requestKey;
    evaluationsInFlightPromiseRef.current = requestPromise;
    return requestPromise;
  };

  const loadTabRecordCounts = useCallback(
    async (
      searchValue: string,
      quarter: string,
      year: string,
      options?: { force?: boolean; allRecordsTotal?: number }
    ) => {
      const yearNum = Number(year) || 0;
      const cacheKey = JSON.stringify({
        searchValue,
        quarter,
        year: yearNum,
      });

      if (!options?.force) {
        const cached = tabCountsCacheRef.current.get(cacheKey);
        if (cached) {
          setTabRecordCounts(cached);
          return;
        }
      }

      if (
        tabCountsInFlightKeyRef.current === cacheKey &&
        tabCountsInFlightPromiseRef.current
      ) {
        await tabCountsInFlightPromiseRef.current;
        return;
      }

      const requestPromise = (async () => {
        try {
          const pendingApiCounts = await fetchTabCountsFromPendingApprovalApi(
            searchValue,
            quarter,
            yearNum
          );

          let approvalsCount = pendingApiCounts?.approvals;
          if (approvalsCount === undefined) {
            approvalsCount = await fetchPendingApprovalTabTotal(
              searchValue,
              quarter,
              yearNum
            );
          }

          // All Records badge priority:
          // 1) filtered All Records list total (matches the table)
          // 2) myEval_as_Evaluator_count when it is not just a copy of pending total
          // 3) derive from getEvalAuthEvaluator minus approval statuses
          let allCount =
            options?.allRecordsTotal ?? pendingApiCounts?.all ?? null;

          if (allCount === null) {
            const allRecords = await fetchAllRecordsTabTotal(
              searchValue,
              quarter,
              yearNum
            );
            allCount = allRecords.all;
            grandTotalCacheRef.current.set(
              getGrandTotalCacheKey(searchValue, quarter, year),
              allRecords.grandTotal
            );
          }

          const nextCounts = {
            approvals: approvalsCount ?? 0,
            all: allCount ?? 0,
          };

          tabCountsCacheRef.current.set(cacheKey, nextCounts);
          setTabRecordCounts(nextCounts);
        } catch (error) {
          console.error("Error loading tab record counts:", error);
        } finally {
          if (tabCountsInFlightKeyRef.current === cacheKey) {
            tabCountsInFlightKeyRef.current = null;
            tabCountsInFlightPromiseRef.current = null;
          }
        }
      })();

      tabCountsInFlightKeyRef.current = cacheKey;
      tabCountsInFlightPromiseRef.current = requestPromise;
      await requestPromise;
    },
    []
  );

  const clearRecordsCaches = useCallback(() => {
    evaluationsCacheRef.current.clear();
    tabCountsCacheRef.current.clear();
    grandTotalCacheRef.current.clear();
  }, []);

  useEffect(() => {
    const mount = async () => {
      try {
        const years = await getCachedYears();
        setYears(years);
      } catch (error) {
        console.log(error);
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
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm, statusFilter, quarterFilter, yearFilter]);

  useEffect(() => {
    if (prevActiveRecordsTabRef.current === activeRecordsTab) return;

    prevActiveRecordsTabRef.current = activeRecordsTab;
    setCurrentPage(1);

    if (!isStatusAllowedOnTab(statusFilter, activeRecordsTab)) {
      setStatusFilter("0");
    }
  }, [activeRecordsTab, statusFilter]);

  // Track when page change started
  const pageChangeStartTimeRef = useRef<number | null>(null);

  // Fetch API whenever debounced search term changes
  useEffect(() => {
    const fetchData = async () => {
      const tabCountFilterKey = JSON.stringify({
        debouncedSearchTerm,
        debouncedQuarterFilter,
        debouncedYearFilter,
      });
      const shouldRefreshTabCounts =
        prevTabCountFilterKeyRef.current !== tabCountFilterKey;

      try {
        const loadedTotal = await loadEvaluations(
          debouncedSearchTerm,
          debouncedStatusFilter,
          debouncedQuarterFilter,
          debouncedYearFilter
        );

        if (shouldRefreshTabCounts) {
          prevTabCountFilterKeyRef.current = tabCountFilterKey;

          const allRecordsTotal =
            activeRecordsTab === "all" &&
            isAllStatusFilter(debouncedStatusFilter)
              ? loadedTotal
              : undefined;

          const scheduleTabCounts = () => {
            void loadTabRecordCounts(
              debouncedSearchTerm,
              debouncedQuarterFilter,
              debouncedYearFilter,
              { allRecordsTotal }
            );
          };

          if (
            typeof window !== "undefined" &&
            "requestIdleCallback" in window
          ) {
            window.requestIdleCallback(() => scheduleTabCounts(), {
              timeout: 1500,
            });
          } else {
            setTimeout(scheduleTabCounts, 100);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        // Always reset page loading state
        setIsPageLoading(false);
        // If this was a page change, ensure minimum display time (2 seconds)
        if (pageChangeStartTimeRef.current !== null) {
          const elapsed = Date.now() - pageChangeStartTimeRef.current;
          const minDisplayTime = 2000; // 2 seconds
          const remainingTime = Math.max(0, minDisplayTime - elapsed);

          setTimeout(() => {
            pageChangeStartTimeRef.current = null;
          }, remainingTime);
        }
      }
    };

    fetchData();
  }, [
    activeRecordsTab,
    debouncedSearchTerm,
    currentPage,
    debouncedStatusFilter,
    debouncedQuarterFilter,
    debouncedYearFilter,
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      clearRecordsCaches();
      prevTabCountFilterKeyRef.current = null;

      const loadedTotal = await loadEvaluations(
        debouncedSearchTerm,
        debouncedStatusFilter,
        debouncedQuarterFilter,
        debouncedYearFilter,
        { force: true }
      );

      prevTabCountFilterKeyRef.current = JSON.stringify({
        debouncedSearchTerm,
        debouncedQuarterFilter,
        debouncedYearFilter,
      });

      const allRecordsTotal =
        activeRecordsTab === "all" &&
        isAllStatusFilter(debouncedStatusFilter)
          ? loadedTotal
          : undefined;

      await loadTabRecordCounts(
        debouncedSearchTerm,
        debouncedQuarterFilter,
        debouncedYearFilter,
        { force: true, allRecordsTotal }
      );
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleViewEvaluation = (review: Review) => {
    setViewSubmissionId(review.id);
    setIsViewResultsModalOpen(true);
  };

  const closeEditEvaluationModal = async () => {
    setIsEditEvaluationModalOpen(false);
    setSelectedSubmissionForEdit(null);
    setBypassEditMobileWarning(false);
    await handleRefresh();
  };

  const handleEditEvaluation = async (review: Review) => {
    if (!canEvaluatorOpenEvaluationEdit(review, user?.id)) return;

    setIsLoadingEditEvaluation(true);
    try {
      const submission = await clientDataService.getSubmissionById(review.id);

      if (submission) {
        const draftEdit = isReviewDraftEditableByEvaluator(review, user?.id);
        const stillEditable =
          draftEdit ||
          (canEvaluatorOpenEvaluationEdit(review, user?.id) &&
            isSubmissionResubmitAllowed(submission));

        if (!stillEditable) {
          setEvaluationActionError({
            title: "Unable to Edit Evaluation",
            message:
              "This evaluation can no longer be edited in its current status. Please refresh to view the latest updates.",
          });
          return;
        }

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

  const handleAcceptDraft = async (review: Review) => {
    if (!isReviewDraft(review) || acceptingReviewId != null || rejectingReviewId != null) {
      return;
    }

    setAcceptingReviewId(review.id);
    try {
      await apiService.acceptDraftEvaluation(review.id);
      await handleRefresh();
      toastMessages.generic.success(
        "Draft accepted",
        "The evaluation has been accepted and moved forward."
      );
    } catch (error) {
      setEvaluationActionError({
        title: "Unable to Accept Draft",
        message: getEvaluationApiErrorMessage(
          error,
          "Failed to accept draft evaluation. Please try again."
        ),
      });
    } finally {
      setAcceptingReviewId(null);
    }
  };

  const openRejectDraftModal = (review: Review) => {
    if (!isReviewDraft(review)) return;
    setRejectModalKind("draft");
    setRejectDraftNote("");
    setReviewToReject(review);
    setIsRejectDraftModalOpen(true);
  };

  const openRejectApprovalModal = (review: Review) => {
    if (!isReviewApproverActionable(review, user?.id)) return;
    setRejectModalKind("approval");
    setRejectDraftNote("");
    setReviewToReject(review);
    setIsRejectDraftModalOpen(true);
  };

  const closeRejectDraftModal = () => {
    setIsRejectDraftModalOpen(false);
    setReviewToReject(null);
    setRejectDraftNote("");
    setRejectModalKind("draft");
  };

  const handleAcceptApproval = async (review: Review) => {
    if (
      !isReviewApproverActionable(review, user?.id) ||
      acceptingReviewId != null ||
      rejectingReviewId != null
    ) {
      return;
    }

    setAcceptingReviewId(review.id);
    try {
      await apiService.acceptApprovalEvaluation(review.id);
      await handleRefresh();
      toastMessages.generic.success(
        "Evaluation accepted",
        "The evaluation has been approved for this step."
      );
    } catch (error) {
      setEvaluationActionError({
        title: "Unable to Accept Evaluation",
        message: getEvaluationApiErrorMessage(
          error,
          "Failed to accept evaluation. Please try again."
        ),
      });
    } finally {
      setAcceptingReviewId(null);
    }
  };

  const handleRejectDraft = async () => {
    const note = rejectDraftNote.trim();
    if (
      !reviewToReject ||
      note.length === 0 ||
      note.length > REJECT_DRAFT_NOTE_MAX_LENGTH ||
      rejectingReviewId != null ||
      acceptingReviewId != null
    ) {
      return;
    }

    setRejectingReviewId(reviewToReject.id);
    try {
      if (rejectModalKind === "approval") {
        await apiService.rejectApprovalEvaluation(reviewToReject.id, note);
        await handleRefresh();
        toastMessages.generic.success(
          "Evaluation rejected",
          "The evaluation has been rejected at this approval step."
        );
      } else {
        await apiService.rejectDraftEvaluation(reviewToReject.id, note);
        await handleRefresh();
        toastMessages.generic.success(
          "Draft rejected",
          "The draft evaluation has been rejected."
        );
      }
      closeRejectDraftModal();
    } catch (error) {
      setEvaluationActionError({
        title:
          rejectModalKind === "approval"
            ? "Unable to Reject Evaluation"
            : "Unable to Reject Draft",
        message: getEvaluationApiErrorMessage(
          error,
          rejectModalKind === "approval"
            ? "Failed to reject evaluation. Please try again."
            : "Failed to reject draft evaluation. Please try again."
        ),
      });
      closeRejectDraftModal();
    } finally {
      setRejectingReviewId(null);
    }
  };
  // const groupedByYear = evaluations.reduce((acc: any, item) => {
  //   const year = new Date(item.created_at).getFullYear();
  //   acc[year] = acc[year] || [];
  //   acc[year].push(item);
  //   return acc;
  // }, {});

  return (
    <div className="relative ">
      <div className="relative  overflow-y-auto">
        <Card className="">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
              All Evaluation Records
              <Badge variant="outline" className="text-[0.65rem] font-normal sm:text-xs">
                {displayedEvaluations.length} Records on this page
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Complete evaluation history with advanced filtering
            </CardDescription>
            <div
              className="mt-4 flex flex-wrap gap-2"
              role="tablist"
              aria-label="Evaluation records views"
            >
              {EVALUATION_RECORDS_TABS.map((tab) => {
                const isActive = activeRecordsTab === tab.id;
                const tabCount =
                  tab.id === "approvals"
                    ? tabRecordCounts.approvals
                    : tabRecordCounts.all;
                return (
                  <Button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
                      isActive
                        ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    )}
                    onClick={() => setActiveRecordsTab(tab.id)}
                  >
                    <span className="flex items-center gap-2">
                      {tab.label}
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-700"
                        )}
                        aria-label={`${tabCount} records`}
                      >
                        {tabCount}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
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
                  value={statusFilter || "0"}
                  onValueChange={(value) => setStatusFilter(value)}
                >
                  <SelectTrigger
                    id="records-approval-status"
                    className="w-full cursor-pointer"
                  >
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Status</SelectItem>
                    {statusFilterOptionsForTab.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
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
                    <SelectItem value="Others">Others</SelectItem>
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

              {/* Refresh Button */}
              <div className="flex w-full min-w-0 gap-2 sm:w-auto">
                <div className="w-full min-w-[8rem] sm:w-32">
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
                const newCount = displayedEvaluations?.filter((review) => {
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
            {activeRecordsTab === "approvals" ? (
              <EvalRecordRejectedHoverHintBanner />
            ) : null}
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
                <div className="w-2 h-2 bg-orange-50 border-l-2 border-l-orange-500 rounded"></div>
                <Badge className="bg-yellow-200 text-yellow-800 text-xs">
                  Pending
                </Badge>
              </div>
              {activeRecordsTab === "approvals" ? (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-50 border-l-2 border-l-amber-500 rounded"></div>
                    <Badge
                      className={cn(
                        "text-xs",
                        getEvaluationStatusBadgeClass("pending_approval_1")
                      )}
                    >
                      Pending Approval 1
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-50 border-l-2 border-l-blue-500 rounded"></div>
                    <Badge
                      className={cn(
                        "text-xs",
                        getEvaluationStatusBadgeClass("pending_approval_2")
                      )}
                    >
                      Pending Approval 2
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-50 border-l-2 border-l-gray-500 rounded"></div>
                    <Badge
                      className={cn(
                        "text-xs",
                        getEvaluationStatusBadgeClass("rejected")
                      )}
                    >
                      Rejected
                    </Badge>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-50 border-l-2 border-l-green-500 rounded"></div>
                  <Badge
                    className={cn(
                      "text-xs",
                      getEvaluationStatusBadgeClass("completed")
                    )}
                  >
                    Completed
                  </Badge>
                </div>
              )}
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
              {(refreshing || isPageLoading || isLoadingEvaluations) && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-3 rounded-lg bg-white/95 px-8 py-6 shadow-lg">
                    <div className="relative">
                      <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img
                          src="/smct.png"
                          alt="SMCT Logo"
                          className="h-10 w-10 object-contain"
                        />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-600">
                      {refreshing ? "Refreshing..." : "Loading records..."}
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
                      <EvalRecordStatusTableHead />
                    </TableHead>
                    <TableHead className="hidden min-w-[4.5rem] lg:table-cell xl:min-w-[5.5rem]">
                      <span className="xl:hidden">Emp. Sign</span>
                      <span className="hidden xl:inline">Employee Sign</span>
                    </TableHead>
                    <TableHead className="hidden min-w-[4.5rem] xl:table-cell">
                      Evaluator Sign
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
                  {refreshing || isPageLoading || isLoadingEvaluations ? (
                    Array.from({ length: itemsPerPage }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16 rounded-full" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Skeleton className="h-5 w-14" />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Skeleton className="h-5 w-14" />
                        </TableCell>
                        <TableCell className={evalTableActionsCellClass("")}>
                          <Skeleton className="mx-auto h-8 w-8 rounded-md bg-gray-200 sm:mx-0" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : displayedEvaluations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center sm:py-12">
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
                                  {activeRecordsTab === "approvals"
                                    ? "Pending approval records will appear here when assigned to you"
                                    : "Records will appear here when evaluations are submitted"}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedEvaluations.map((review) => {
                      const rowClassName = getReviewRowClassName(review);
                      const reviewDate = formatReviewListDate(review.created_at);
                      const quarterDisplay = getReviewQuarterDisplay(review);

                      return (
                        <TableRow key={review.id} className={rowClassName}>
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
                              {review.employee_branch_code || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "max-w-[5.5rem] truncate text-[0.65rem] sm:max-w-none sm:text-xs",
                                getQuarterColor(quarterDisplay)
                              )}
                            >
                              {quarterDisplay}
                            </Badge>
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
                            <EvalRecordStatusBadge review={review} />
                          </TableCell>
                          <TableCell className="hidden text-gray-600 lg:table-cell">
                            <EvalRecordSignBadge
                              signed={hasEmployeeSigned(review)}
                              pending={shouldShowEmployeeSignPending(review)}
                            />
                          </TableCell>
                          <TableCell className="hidden text-gray-600 xl:table-cell">
                            <EvalRecordSignBadge
                              signed={hasEvaluatorSigned(review, {
                                evaluatorOwnRecords: true,
                              })}
                            />
                          </TableCell>

                          <TableCell className={evalTableActionsCellClass(rowClassName)}>
                            {(() => {
                              const isOwnDraft =
                                isReviewDraft(review) &&
                                isReviewEvaluatorCurrentUser(review, user?.id);
                              const showApproverActions = isReviewApproverActionable(
                                review,
                                user?.id
                              );

                              return (
                                <EvalRecordRowActions
                                  review={review}
                                  currentUserId={user?.id}
                                  draftOwnedByCurrentUser={isOwnDraft}
                                  onViewAction={() => handleViewEvaluation(review)}
                                  onEditAction={() => handleEditEvaluation(review)}
                                  onAcceptAction={
                                    showApproverActions
                                      ? () => void handleAcceptApproval(review)
                                      : isReviewDraft(review) && !isOwnDraft
                                        ? () => void handleAcceptDraft(review)
                                        : undefined
                                  }
                                  onRejectAction={
                                    showApproverActions
                                      ? () => openRejectApprovalModal(review)
                                      : isReviewDraft(review) && !isOwnDraft
                                        ? () => openRejectDraftModal(review)
                                        : undefined
                                  }
                                  accepting={acceptingReviewId === review.id}
                                  rejecting={rejectingReviewId === review.id}
                                />
                              );
                            })()}
                          </TableCell>
                        </TableRow>
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

        {/* Reject Draft Confirmation Modal */}
        <Dialog
          open={isRejectDraftModalOpen}
          onOpenChangeAction={(open) => {
            if (!open) {
              closeRejectDraftModal();
            } else {
              setIsRejectDraftModalOpen(true);
            }
          }}
        >
          <DialogContent className={`max-w-md p-6 ${dialogAnimationClass}`}>
            <DialogHeader className="rounded-lg bg-red-50 pb-4">
              <DialogTitle className="flex items-center gap-2 text-red-800">
                <span className="text-xl">⚠️</span>
                {rejectModalKind === "approval"
                  ? "Reject Evaluation Approval"
                  : "Reject Draft Evaluation"}
              </DialogTitle>
              <DialogDescription className="text-red-700">
                Are you sure you want to reject this{" "}
                {rejectModalKind === "approval" ? "evaluation" : "draft evaluation"}{" "}
                for{" "}
                {[
                  reviewToReject?.employee?.fname,
                  reviewToReject?.employee?.lname,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || "this employee"}
                ?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 px-1 pt-2">
              <Label htmlFor="reject-draft-note" className="text-sm font-medium">
                Rejection note <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="reject-draft-note"
                value={rejectDraftNote}
                onChange={(e) =>
                  setRejectDraftNote(
                    e.target.value.slice(0, REJECT_DRAFT_NOTE_MAX_LENGTH)
                  )
                }
                placeholder={
                  rejectModalKind === "approval"
                    ? "Explain why this evaluation is being rejected (max 20 characters)..."
                    : "Explain why this draft is being rejected (max 20 characters)..."
                }
                rows={4}
                maxLength={REJECT_DRAFT_NOTE_MAX_LENGTH}
                className="resize-y min-h-[6rem]"
              />
              <p
                className={cn(
                  "text-xs",
                  rejectDraftNote.trim().length === 0
                    ? "text-amber-700"
                    : rejectDraftNote.length >= REJECT_DRAFT_NOTE_MAX_LENGTH
                      ? "text-red-600"
                      : "text-muted-foreground"
                )}
              >
                {rejectDraftNote.length}/                {REJECT_DRAFT_NOTE_MAX_LENGTH}{" "}
                characters maximum. A note is required to reject this{" "}
                {rejectModalKind === "approval" ? "evaluation" : "draft"}.
              </p>
            </div>

            <DialogFooter className="pt-4">
              <div className="flex w-full justify-end space-x-4">
                <Button
                  variant="outline"
                  onClick={closeRejectDraftModal}
                  className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  className="cursor-pointer bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void handleRejectDraft()}
                  disabled={
                    rejectingReviewId !== null ||
                    rejectDraftNote.trim().length === 0 ||
                    rejectDraftNote.length > REJECT_DRAFT_NOTE_MAX_LENGTH
                  }
                >
                  {rejectingReviewId === reviewToReject?.id ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Rejecting...</span>
                    </div>
                  ) : (
                    "Reject Draft"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

        {/* View Results Modal */}
        <ViewResultsModal
          isOpen={isViewResultsModalOpen}
          submissionId={viewSubmissionId}
          submission={null}
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
            <DialogContent className="relative max-w-7xl max-h-[101vh] overflow-hidden p-0 evaluation-container">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void closeEditEvaluationModal()}
                aria-label="Close evaluation edit"
                title="Close"
                className="absolute right-3 top-3 z-50 h-9 w-9 rounded-full cursor-pointer border-slate-200 bg-white/95 text-slate-700 shadow-md hover:bg-slate-100 hover:text-slate-900 sm:right-4 sm:top-4"
              >
                <X className="h-4 w-4" />
              </Button>
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
