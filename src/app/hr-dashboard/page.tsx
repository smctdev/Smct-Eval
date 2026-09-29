"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { getEvaluationQuarterLabel } from "@/lib/evaluationQuarterLabel";
import { getQuarterColor } from "@/lib/quarterUtils";
import apiService from "@/lib/apiService";
import { formatRatingDisplay } from "@/lib/performanceRatingDisplay";
import ViewResultsModal from "@/components/evaluation/ViewResultsModal";
import {
  EvaluationApiErrorDialog,
} from "@/components/evaluation/evaluationRecordsShared";
import EvaluationsPagination from "@/components/paginationComponent";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HiringRateTooltipContent } from "@/components/hr/HiringRateTooltipContent";
import { ApprovalStatusTooltipContent } from "@/components/hr/ApprovalStatusTooltipContent";
import { LateSubmissionTooltipContent } from "@/components/hr/LateSubmissionTooltipContent";
import {
  resolveHiringRateStats,
  type HiringRateStats,
} from "@/lib/employeeHiringRate";
import {
  resolveApprovalStatusStats,
  type ApprovalStatusStats,
} from "@/lib/evaluationApprovalStats";
import {
  resolveLateSubmissionStats,
  type LateSubmissionStats,
} from "@/lib/lateSubmissionStats";

const HR_OVERVIEW_TABLE_CLASS =
  "min-w-[34rem] sm:min-w-[42rem] md:min-w-[52rem] lg:min-w-0 lg:w-full [&_th]:h-auto [&_th]:min-h-8 [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-2 [&_th]:align-middle [&_th]:text-[0.6rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-600 sm:[&_th]:px-2.5 sm:[&_th]:py-2.5 sm:[&_th]:text-[0.65rem] lg:[&_th]:px-3 lg:[&_th]:text-xs [&_td]:min-w-0 [&_td]:px-2 [&_td]:py-2 [&_td]:align-top [&_td]:text-[0.7rem] [&_td]:leading-snug sm:[&_td]:px-2.5 sm:[&_td]:py-2.5 sm:[&_td]:text-xs lg:[&_td]:px-3 lg:[&_td]:text-sm";

const HR_OVERVIEW_ACTIONS_HEAD = cn(
  "w-[3.25rem] min-w-[3.25rem] p-1 text-center lg:sticky lg:right-0 lg:z-[4] lg:min-w-[6.5rem] lg:bg-white lg:text-left lg:shadow-[-6px_0_12px_-4px_rgba(15,23,42,0.12)]"
);

function hrOverviewActionsCellClass(rowClassName: string) {
  return cn(
    "w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] p-1 sm:max-w-none sm:p-2",
    "lg:sticky lg:right-0 lg:z-[3] lg:min-w-[6.5rem] lg:w-auto lg:shadow-[-6px_0_12px_-4px_rgba(15,23,42,0.12)]",
    rowClassName.includes("bg-green-50") && "lg:bg-green-50",
    rowClassName.includes("bg-yellow-50") && "lg:bg-yellow-50",
    rowClassName.includes("bg-blue-50") && "lg:bg-blue-50",
    !rowClassName.includes("bg-green-50") &&
      !rowClassName.includes("bg-yellow-50") &&
      !rowClassName.includes("bg-blue-50") &&
      "lg:bg-white"
  );
}

function formatSubmissionDate(createdAt: string): { short: string; full: string } {
  const d = new Date(createdAt);
  return {
    short: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit",
    }),
    full: d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  };
}

function formatApprovalStatus(status: string): { short: string; full: string } {
  if (status === "completed") return { short: "✓ Done", full: "✓ Fully Approved" };
  if (status === "pending") return { short: "⏳ Pend.", full: "⏳ Pending" };
  return { short: status, full: status };
}

function getSubmissionQuarterDisplay(submission: any): string {
  return getEvaluationQuarterLabel(submission);
}

function getSubmissionRowClassName(
  isNew: boolean,
  isRecent: boolean,
  status: string
): string {
  if (status === "completed") {
    return "border-l-4 border-l-green-500 bg-green-50 transition-colors hover:bg-green-100";
  }
  if (isNew) {
    return "border-l-4 border-l-yellow-500 bg-yellow-50 transition-colors hover:bg-yellow-100";
  }
  if (isRecent) {
    return "border-l-4 border-l-blue-500 bg-blue-50 transition-colors hover:bg-blue-100";
  }
  return "transition-colors hover:bg-gray-100";
}

type DashboardStatCardProps = {
  emoji: string;
  title: string;
  value: number | string | null | undefined;
  subtitle: string;
  valueClassName: string;
  cardClassName: string;
  tooltip?: React.ReactNode;
};

function DashboardStatCard({
  emoji,
  title,
  value,
  subtitle,
  valueClassName,
  cardClassName,
  tooltip,
}: DashboardStatCardProps) {
  const card = (
    <Card
      className={cn(
        "min-h-[6.75rem] overflow-hidden border shadow-sm transition-shadow duration-200 hover:shadow-md sm:min-h-[7.25rem]",
        tooltip && "cursor-help",
        cardClassName
      )}
    >
      <CardHeader className="space-y-0 px-3 pb-1 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="flex items-center gap-1.5 text-[0.7rem] font-medium leading-snug text-gray-600 sm:text-sm">
          <span className="shrink-0 text-base sm:text-lg" aria-hidden>
            {emoji}
          </span>
          <span className="min-w-0 truncate">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
        <div
          className={cn(
            "text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
            valueClassName
          )}
        >
          {value ?? 0}
        </div>
        <p className="mt-1 text-[0.65rem] leading-snug text-gray-500 sm:text-xs">
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );

  if (!tooltip) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="center"
        sideOffset={8}
        className="border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-lg"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export default function OverviewTab() {
  //data
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [newEval, setNewEval] = useState<any | null>(null);
  const [pendingEval, setPendingEval] = useState<any | null>(null);
  const [completedEval, setCompletedEval] = useState<any | null>(null);
  const [totalEmployees, setTotalEmployees] = useState<any | null>(null);
  const [hiringRateStats, setHiringRateStats] = useState<HiringRateStats | null>(
    null
  );
  const [approvalStatusStats, setApprovalStatusStats] =
    useState<ApprovalStatusStats | null>(null);
  const [lateSubmissionStats, setLateSubmissionStats] =
    useState<LateSubmissionStats | null>(null);
  //filters
  const [overviewSearchTerm, setOverviewSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] =
    useState(overviewSearchTerm);

  //pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(0);
  const [viewSubmissionId, setViewSubmissionId] = useState<
    number | string | null
  >(null);
  //modal
  const [isViewResultsModalOpen, setIsViewResultsModalOpen] = useState(false);
  const [evaluationActionError, setEvaluationActionError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  //refresh state
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const submissionsInFlightKeyRef = useRef<string | null>(null);
  const submissionsInFlightPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const loadSubmissions = async () => {
      const requestKey = JSON.stringify({
        debouncedSearchTerm,
        currentPage,
        itemsPerPage,
      });

      if (
        submissionsInFlightKeyRef.current === requestKey &&
        submissionsInFlightPromiseRef.current
      ) {
        await submissionsInFlightPromiseRef.current;
        return;
      }

      const requestPromise = (async () => {
        setIsRefreshing(true);
        try {
          const res = await apiService.getSubmissions(
            debouncedSearchTerm,
            currentPage,
            itemsPerPage
          );
          setSubmissions(res.data);
          setOverviewTotal(res.total);
          setTotalPages(res.last_page);
          setPerPage(res.per_page);

          const dashboard = await apiService.hrDashboard();
          setNewEval(dashboard.new_eval);
          setPendingEval(dashboard.pending_eval);
          setCompletedEval(dashboard.completed_eval);
          const employeeTotal = Number(dashboard.total_users ?? 0);
          setTotalEmployees(employeeTotal);

          const hiringStats = await resolveHiringRateStats(dashboard, () =>
            apiService.getActiveRegistrations("", "", 1, 5000)
          );
          setHiringRateStats(hiringStats);
          setApprovalStatusStats(resolveApprovalStatusStats(dashboard));
          const lateStats = await resolveLateSubmissionStats(dashboard, () =>
            apiService.getSubmissions("", 1, 5000)
          );
          setLateSubmissionStats(lateStats);
        } catch (error) {
          console.log(error);
        } finally {
          setIsRefreshing(false);
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
    loadSubmissions();
  }, [debouncedSearchTerm, currentPage, refreshNonce]);

  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      setDebouncedSearchTerm(overviewSearchTerm);
      // Reset to page 1 when search term changes (if there's a value)
      if (overviewSearchTerm.trim() !== "") {
        setCurrentPage(1);
      }
    }, 500);
    return () => clearTimeout(debounceTimeout);
  }, [overviewSearchTerm]);

  // Helper function to get rating color (legacy bands for badge background)
  const getRatingColor = (rating: number | string) => {
    const score = Number(rating);
    if (!Number.isFinite(score)) return "bg-gray-100 text-gray-800";
    if (score >= 4.5) return "bg-green-100 text-green-800";
    if (score >= 4.0) return "bg-blue-100 text-blue-800";
    if (score >= 3.5) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const handleViewEvaluation = (submission: { id: number | string }) => {
    setViewSubmissionId(submission.id);
    setIsViewResultsModalOpen(true);
  };

  const pendingApprovalTooltip = useMemo(
    () => (
      <ApprovalStatusTooltipContent
        stats={approvalStatusStats}
        variant="pending"
      />
    ),
    [approvalStatusStats]
  );

  const approvedStatusTooltip = useMemo(
    () => (
      <ApprovalStatusTooltipContent
        stats={approvalStatusStats}
        variant="approved"
      />
    ),
    [approvalStatusStats]
  );

  const newSubmissionsTooltip = useMemo(
    () => <LateSubmissionTooltipContent stats={lateSubmissionStats} />,
    [lateSubmissionStats]
  );

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-5 sm:gap-4 lg:grid-cols-4">
        <DashboardStatCard
          emoji="🆕"
          title="New Submissions"
          value={newEval}
          subtitle="Last 24 hours"
          valueClassName="text-yellow-600"
          cardClassName="border-yellow-200/90 bg-yellow-50/90"
          tooltip={newSubmissionsTooltip}
        />
        <DashboardStatCard
          emoji="⏳"
          title="Pending Approvals"
          value={pendingEval}
          subtitle="Needs review"
          valueClassName="text-orange-600"
          cardClassName="border-orange-200/90 bg-orange-50/90"
          tooltip={pendingApprovalTooltip}
        />
        <DashboardStatCard
          emoji="✅"
          title="Approved"
          value={completedEval}
          subtitle="Completed reviews"
          valueClassName="text-green-600"
          cardClassName="border-green-200/90 bg-green-50/90"
          tooltip={approvedStatusTooltip}
        />
        <DashboardStatCard
          emoji="👥"
          title="Total Employees"
          value={totalEmployees}
          subtitle="All registered employees"
          valueClassName="text-blue-600"
          cardClassName="border-blue-200/90 bg-blue-50/90"
          tooltip={<HiringRateTooltipContent stats={hiringRateStats} />}
        />
      </div>
      <div className="relative space-y-6 pr-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
              Recent Evaluation Records
              {(() => {
                const now = new Date();
                const newCount = submissions.filter((sub) => {
                  if (!sub.created_at) return false;
                  const hoursDiff =
                    (now.getTime() - new Date(sub.created_at).getTime()) /
                    (1000 * 60 * 60);
                  return hoursDiff <= 24;
                }).length;
                return newCount > 0 ? (
                  <Badge className="bg-yellow-500 text-white animate-pulse">
                    {newCount} NEW
                  </Badge>
                ) : null;
              })()}
              <Badge variant="outline" className="text-xs font-normal">
                📅 Sorted: Newest First
              </Badge>
            </CardTitle>
            <CardDescription>
              Latest performance evaluations and reviews (most recent at the
              top)
            </CardDescription>
            {/* Search Bar and Refresh Button */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-md">
                <Input
                  placeholder="Search employee, status..."
                  value={overviewSearchTerm}
                  onChange={(e) => setOverviewSearchTerm(e.target.value)}
                  className="w-full pr-10 text-sm"
                />
                {overviewSearchTerm && (
                  <button
                    onClick={() => setOverviewSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 transition-all duration-200 hover:-translate-y-1 hover:shadow-sm active:translate-y-0"
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
              {/* Refresh Button */}
              <Button
                onClick={() => setRefreshNonce((prev) => prev + 1)}
                disabled={isRefreshing}
                className="w-full shrink-0 bg-blue-600 px-4 py-2 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:translate-y-0 sm:w-auto"
                title="Refresh evaluation records"
              >
                {isRefreshing ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Refreshing...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 cursor-pointer ">
                    <span>🔄</span>
                    <span>Refresh</span>
                  </div>
                )}
              </Button>
            </div>
            {/* Indicator Legend */}
            <div className="mt-3 md:mt-4 p-2 md:p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm">
                <span className="font-medium text-gray-700 mr-2">
                  Indicators:
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-yellow-100 border-l-2 border-l-yellow-500 rounded"></div>
                  <Badge className="bg-yellow-200 text-yellow-800 text-xs md:text-sm px-1.5 md:px-2 py-0.5">
                    New
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-blue-50 border-l-2 border-l-blue-500 rounded"></div>
                  <Badge className="bg-blue-300 text-blue-800 text-xs md:text-sm px-1.5 md:px-2 py-0.5">
                    Recent
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-green-50 border-l-2 border-l-green-500 rounded"></div>
                  <Badge className="bg-green-500 text-white text-xs md:text-sm px-1.5 md:px-2 py-0.5">
                    Approved
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <p className="border-b px-3 py-2 text-[0.65rem] text-muted-foreground lg:hidden">
              Swipe horizontally to view all columns.
            </p>
            <div
              className="relative max-h-[min(70vh,28rem)] w-full overflow-x-auto overflow-y-auto sm:max-h-[min(75vh,32rem)] lg:max-h-[28rem] [-webkit-overflow-scrolling:touch]"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#cbd5e1 #f1f5f9",
              }}
            >
              {isRefreshing && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-white/60">
                  <div className="flex flex-col items-center gap-3 bg-white/95 px-6 md:px-8 py-4 md:py-6 rounded-lg shadow-lg">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-12 md:h-16 w-12 md:w-16 border-4 border-blue-500 border-t-transparent"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img
                          src="/smct.png"
                          alt="SMCT Logo"
                          className="h-8 md:h-10 w-8 md:w-10 object-contain"
                        />
                      </div>
                    </div>
                    <p className="text-xs md:text-sm text-gray-600 font-medium">
                      Loading evaluation records...
                    </p>
                  </div>
                </div>
              )}

              <Table
                className={HR_OVERVIEW_TABLE_CLASS}
                wrapperClassName="overflow-visible"
              >
                <TableHeader className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="min-w-[7.5rem] sm:min-w-[9rem]">
                      Employee
                    </TableHead>
                    <TableHead className="hidden min-w-[4rem] sm:table-cell">
                      Rating
                    </TableHead>
                    <TableHead className="hidden min-w-[3.5rem] md:table-cell">
                      Quarter
                    </TableHead>
                    <TableHead className="hidden min-w-[5rem] sm:table-cell">
                      Date
                    </TableHead>
                    <TableHead className="hidden min-w-[5.5rem] lg:table-cell">
                      Status
                    </TableHead>
                    <TableHead className={HR_OVERVIEW_ACTIONS_HEAD}>
                      <span className="lg:hidden" aria-hidden>
                        ⋮
                      </span>
                      <span className="hidden lg:inline">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200">
                  {isRefreshing ? (
                    Array.from({ length: 8 }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                            <div className="h-2.5 w-24 animate-pulse rounded bg-gray-200" />
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="h-5 w-14 animate-pulse rounded-full bg-gray-200" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="h-5 w-12 animate-pulse rounded-full bg-gray-200" />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
                        </TableCell>
                        <TableCell className={hrOverviewActionsCellClass("")}>
                          <div className="mx-auto h-8 w-8 animate-pulse rounded-md bg-gray-200 lg:mx-0 lg:h-6 lg:w-16" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !submissions || submissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center sm:py-12">
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
                            {overviewSearchTerm ? (
                              <>
                                <p className="text-base font-medium mb-1">
                                  No results found for "{overviewSearchTerm}"
                                </p>
                                <p className="text-sm text-gray-400">
                                  Try adjusting your search term
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-base font-medium mb-1">
                                  No evaluation records to display
                                </p>
                                <p className="text-sm text-gray-400">
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
                    submissions.map((submission: any) => {
                      const now = new Date();
                      const createdAt = String(submission.created_at ?? "");
                      const hoursDiff = createdAt
                        ? (now.getTime() - new Date(createdAt).getTime()) /
                          (1000 * 60 * 60)
                        : 0;
                      const isNew = hoursDiff <= 24;
                      const isRecent = hoursDiff > 24 && hoursDiff <= 168;
                      const rowClassName = getSubmissionRowClassName(
                        isNew,
                        isRecent,
                        String(submission.status ?? "")
                      );
                      const reviewDate = createdAt
                        ? formatSubmissionDate(createdAt)
                        : { short: "—", full: "—" };
                      const statusLabels = formatApprovalStatus(
                        String(submission.status ?? "")
                      );
                      const quarterValue = getSubmissionQuarterDisplay(
                        submission
                      );

                      return (
                        <TableRow key={submission.id} className={rowClassName}>
                          <TableCell>
                            <div className="min-w-0">
                              <div className="mb-1 flex flex-wrap items-center gap-1">
                                <span className="max-w-[10rem] truncate text-sm font-medium text-gray-900 sm:max-w-none">
                                  {submission.employee?.fname &&
                                  submission.employee?.lname
                                    ? `${submission.employee.fname} ${submission.employee.lname}`
                                    : "Unknown Employee"}
                                </span>
                                {isNew && (
                                  <Badge className="px-1 py-0 text-[0.6rem] font-semibold text-yellow-800 bg-yellow-200 sm:text-xs">
                                    ⚡ NEW
                                  </Badge>
                                )}
                                {!isNew && isRecent && (
                                  <Badge className="px-1 py-0 text-[0.6rem] font-semibold bg-blue-200 text-blue-800 sm:text-xs">
                                    ⏳ RECENT
                                  </Badge>
                                )}
                              </div>
                              {submission.employee?.email ? (
                                <div className="truncate text-[0.65rem] text-gray-500 sm:text-xs">
                                  {submission.employee.email}
                                </div>
                              ) : null}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1 lg:hidden">
                                {submission.rating ? (
                                  <Badge
                                    className={cn(
                                      "text-[0.6rem] font-semibold sm:text-xs",
                                      getRatingColor(submission.rating)
                                    )}
                                  >
                                    {submission.rating != null &&
                                    Number(submission.rating) > 0
                                      ? formatRatingDisplay(submission.rating)
                                      : "N/A"}
                                  </Badge>
                                ) : null}
                                <Badge
                                  className={cn(
                                    "max-w-[5rem] truncate text-[0.6rem] sm:max-w-none sm:text-xs",
                                    getQuarterColor(quarterValue)
                                  )}
                                >
                                  {quarterValue}
                                </Badge>
                                <span className="text-[0.65rem] text-gray-600 sm:hidden">
                                  {reviewDate.short}
                                </span>
                                <Badge
                                  className={cn(
                                    "text-[0.6rem] sm:text-xs lg:hidden",
                                    submission.status === "completed"
                                      ? "bg-green-100 text-green-800"
                                      : submission.status === "pending"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                  )}
                                >
                                  {statusLabels.short}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {submission.rating ? (
                              <Badge
                                className={cn(
                                  "text-xs font-semibold",
                                  getRatingColor(submission.rating)
                                )}
                              >
                                {submission.rating != null &&
                                Number(submission.rating) > 0
                                  ? formatRatingDisplay(submission.rating)
                                  : "N/A"}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge
                              className={cn(
                                "max-w-[5.5rem] truncate text-xs",
                                getQuarterColor(quarterValue)
                              )}
                            >
                              {quarterValue}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-gray-600 sm:table-cell">
                            <span className="lg:hidden">{reviewDate.short}</span>
                            <span className="hidden lg:inline">{reviewDate.full}</span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge
                              className={cn(
                                "text-xs",
                                submission.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : submission.status === "pending"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                              )}
                            >
                              {statusLabels.full}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={hrOverviewActionsCellClass(rowClassName)}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleViewEvaluation(submission)}
                              aria-label="View evaluation"
                              className="mx-auto h-8 w-8 shrink-0 cursor-pointer border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white lg:mx-0 lg:h-9 lg:w-auto lg:px-3 lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-md lg:active:translate-y-0"
                            >
                              <Eye className="h-4 w-4 lg:hidden" />
                              <span className="hidden lg:inline">☰ View</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {overviewTotal > itemsPerPage && (
              <div className="border-t px-3 py-3 sm:px-4">
              <EvaluationsPagination
                currentPage={currentPage}
                totalPages={totalPages}
                total={overviewTotal}
                perPage={perPage}
                onPageChange={(page) => {
                  setCurrentPage(page);
                }}
              />
              </div>
            )}
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
          </CardContent>
        </Card>
      </div>

      <EvaluationApiErrorDialog
        open={evaluationActionError != null}
        title={evaluationActionError?.title ?? ""}
        message={evaluationActionError?.message ?? null}
        onCloseAction={() => {
          setEvaluationActionError(null);
          setRefreshNonce((n) => n + 1);
        }}
      />
    </>
  );
}
