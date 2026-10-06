"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { RefreshCw, Eye } from "lucide-react";
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
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getQuarterColor } from "@/lib/quarterUtils";
import apiService from "@/lib/apiService";
import {
  formatRatingDisplay,
  getPerformanceRatingBand,
  normalizeRatingOnFiveScale,
} from "@/lib/performanceRatingDisplay";
import { Progress } from "@/components/ui/progress";
import EvaluationsPagination from "@/components/paginationComponent";
import ViewResultsModal from "@/components/evaluation/ViewResultsModal";
import {
  EvaluationApiErrorDialog,
  EvalRecordStatusBadge,
  getReviewQuarterDisplay,
  getReviewRowClassName,
} from "@/components/evaluation/evaluationRecordsShared";
import {
  EVALUATION_STATUS_FILTER_OPTIONS,
  getEvaluationStatusBadgeClass,
} from "@/lib/evaluationStatus";
import { cn } from "@/lib/utils";

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

type DashboardStatCardProps = {
  title: string;
  value: number | string | null | undefined;
  subtitle: string;
  valueClassName: string;
  cardClassName: string;
  trailing?: React.ReactNode;
};

function DashboardStatCard({
  title,
  value,
  subtitle,
  valueClassName,
  cardClassName,
  trailing,
}: DashboardStatCardProps) {
  return (
    <Card
      className={cn(
        "min-h-[6.75rem] overflow-hidden border shadow-sm transition-shadow duration-200 hover:shadow-md sm:min-h-[7.25rem]",
        cardClassName
      )}
    >
      <CardHeader className="space-y-0 px-3 pb-1 pt-3 sm:px-4 sm:pt-4">
        <CardTitle className="min-w-0 truncate text-[0.7rem] font-medium leading-snug text-gray-600 sm:text-sm">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
              valueClassName
            )}
          >
            {value ?? 0}
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>
        <p className="mt-1 text-[0.65rem] leading-snug text-gray-500 sm:text-xs">
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}

const EVALUATOR_TABLE_CLASS =
  "min-w-[34rem] sm:min-w-[42rem] md:min-w-[52rem] lg:min-w-0 lg:w-full [&_th]:h-auto [&_th]:min-h-8 [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-2 [&_th]:align-middle [&_th]:text-[0.6rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-600 sm:[&_th]:px-2.5 sm:[&_th]:py-2.5 sm:[&_th]:text-[0.65rem] lg:[&_th]:px-3 lg:[&_th]:text-xs [&_td]:min-w-0 [&_td]:px-2 [&_td]:py-2.5 [&_td]:align-middle [&_td]:text-[0.7rem] [&_td]:leading-snug sm:[&_td]:px-2.5 sm:[&_td]:py-2.5 sm:[&_td]:text-xs lg:[&_td]:px-3 lg:[&_td]:text-sm";

const EVALUATOR_ACTIONS_HEAD_CLASS =
  "min-w-[7.5rem] p-1 text-center align-middle sm:min-w-[8.5rem] sm:p-2 lg:sticky lg:right-0 lg:z-[4] lg:min-w-[12rem] lg:bg-white lg:text-left lg:shadow-[-6px_0_12px_-4px_rgba(15,23,42,0.12)]";

function evaluatorActionsCellClass(rowClassName: string) {
  return cn(
    "w-auto min-w-[7.5rem] p-1 align-middle sm:min-w-[8.5rem] sm:p-2",
    "lg:sticky lg:right-0 lg:z-[3] lg:min-w-[12rem] lg:w-auto lg:shadow-[-6px_0_12px_-4px_rgba(15,23,42,0.12)]",
    rowClassName.includes("bg-green-50") && "lg:bg-green-50",
    rowClassName.includes("bg-yellow-50") && "lg:bg-yellow-50",
    rowClassName.includes("bg-blue-50") && "lg:bg-blue-50",
    rowClassName.includes("bg-orange-50") && "lg:bg-orange-50",
    rowClassName.includes("bg-violet-50") && "lg:bg-violet-50",
    !rowClassName.includes("bg-green-50") &&
      !rowClassName.includes("bg-yellow-50") &&
      !rowClassName.includes("bg-blue-50") &&
      !rowClassName.includes("bg-orange-50") &&
      !rowClassName.includes("bg-violet-50") &&
      "lg:bg-white"
  );
}

function formatListDate(createdAt: string): { short: string; full: string } {
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

function EvaluationStatusLegendBadges() {
  return (
    <>
      {EVALUATION_STATUS_FILTER_OPTIONS.map((option) => (
        <div key={option.value} className="flex items-center gap-1">
          <Badge
            className={cn(
              "text-xs",
              getEvaluationStatusBadgeClass(option.value)
            )}
          >
            {option.label}
          </Badge>
        </div>
      ))}
    </>
  );
}

export default function OverviewTab() {
  //data
  const [data, setData] = useState<any | null>(null);
  const [totalEvaluations, setTotalEvaluations] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [teamAverage, setTeamAverage] = useState<number | null>(null);

  //filters
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  //pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(0);

  //view data
  const [viewSubmissionId, setViewSubmissionId] = useState<
    number | string | null
  >(null);

  //modal
  const [isViewResultsModalOpen, setIsViewResultsModalOpen] = useState(false);
  const [evaluationActionError, setEvaluationActionError] = useState<{
    title: string;
    message: string;
  } | null>(null);

  //refreshing state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaginate, setIsPaginate] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const dashboardInFlightKeyRef = useRef<string | null>(null);
  const dashboardInFlightPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const requestKey = JSON.stringify({
        debouncedSearchTerm,
        currentPage,
        itemsPerPage,
      });
      if (
        dashboardInFlightKeyRef.current === requestKey &&
        dashboardInFlightPromiseRef.current
      ) {
        await dashboardInFlightPromiseRef.current;
        return;
      }

      const requestPromise = (async () => {
        try {
          setIsPaginate(true);
          const response = await apiService.evaluatorDashboard(
            debouncedSearchTerm,
            currentPage,
            itemsPerPage
          );

          setData(response.myEval_as_Evaluator?.data ?? []);
          setTotalEvaluations(response.total_evaluations ?? 0);
          setTotalPending(response.total_pending ?? 0);
          setTotalApproved(response.total_approved ?? 0);
          setTotalEmployees(response.total_employees ?? 0);
          setTeamAverage(normalizeRatingOnFiveScale(response.team_average));

          setOverviewTotal(response.myEval_as_Evaluator?.total ?? 0);
          setTotalPages(response.myEval_as_Evaluator?.last_page ?? 1);
          setPerPage(response.myEval_as_Evaluator?.per_page ?? itemsPerPage);
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          setIsPaginate(false);
          setIsRefreshing(false);
          if (dashboardInFlightKeyRef.current === requestKey) {
            dashboardInFlightKeyRef.current = null;
            dashboardInFlightPromiseRef.current = null;
          }
        }
      })();

      dashboardInFlightKeyRef.current = requestKey;
      dashboardInFlightPromiseRef.current = requestPromise;
      await requestPromise;
    };
    fetchData();
  }, [currentPage, debouncedSearchTerm, refreshNonce]);

  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      // Reset to page 1 when search term changes (if there's a value)
      if (searchTerm.trim() !== "") {
        setCurrentPage(1);
      }
    }, 500);
    return () => clearTimeout(debounceTimeout);
  }, [searchTerm]);

  const handleViewEvaluation = (review: Review) => {
    setViewSubmissionId(review.id);
    setIsViewResultsModalOpen(true);
  };

  const handleClose = () => {
    setIsViewResultsModalOpen(false);
    setViewSubmissionId(null);
    // Refresh the overview list after closing; the fetch effect clears isRefreshing.
    setIsRefreshing(true);
    setRefreshNonce((prev) => prev + 1);
  };

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const getTimeAgo = (submittedAt: string) => {
    const diffSeconds = Math.floor(
      (Date.now() - new Date(submittedAt).getTime()) / 1000
    );

    if (diffSeconds < 60) return rtf.format(-diffSeconds, "second");
    if (diffSeconds < 3600)
      return rtf.format(-Math.floor(diffSeconds / 60), "minute");
    if (diffSeconds < 86400)
      return rtf.format(-Math.floor(diffSeconds / 3600), "hour");
    if (diffSeconds < 604800)
      return rtf.format(-Math.floor(diffSeconds / 86400), "day");

    return;
  };

  // Filter submissions for overview table

  return (
    <div className="grid grid-cols-1 gap-6">
      <>
        {isRefreshing ? (
          // Skeleton cards for overview
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-3 w-16 mt-1" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-3 w-16 mt-1" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-22" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-16 mt-1" />
                <Skeleton className="h-1.5 w-full mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-3 w-20 mt-1" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-3 w-20 mt-1" />
              </CardContent>
            </Card>
          </div>
        ) : (
          // Actual cards with real data
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <DashboardStatCard
              title="Total Evaluations"
              value={totalEvaluations}
              subtitle="Conducted by you"
              valueClassName="text-gray-900"
              cardClassName="border-gray-200 bg-white"
            />
            <DashboardStatCard
              title="Team Average"
              value={
                teamAverage !== null ? formatRatingDisplay(teamAverage) : "—"
              }
              subtitle="Average team rating"
              valueClassName="text-indigo-600"
              cardClassName="border-indigo-200/90 bg-indigo-50/90"
            />
            <DashboardStatCard
              title="Pending Approvals"
              value={totalPending}
              subtitle="Awaiting approval"
              valueClassName="text-yellow-600"
              cardClassName="border-yellow-200/90 bg-yellow-50/90"
              trailing={
                <span className="hidden sm:block">
                  <Progress
                    value={
                      totalPending > 0
                        ? (totalPending / Math.max(1, totalEvaluations)) * 100
                        : 0
                    }
                    className="w-20"
                  />
                </span>
              }
            />
            <DashboardStatCard
              title="Fully Approved"
              value={totalApproved}
              subtitle="Completed & signed"
              valueClassName="text-green-600"
              cardClassName="border-green-200/90 bg-green-50/90"
            />
            <DashboardStatCard
              title="Total Employees"
              value={totalEmployees}
              subtitle="Assigned to you"
              valueClassName="text-blue-600"
              cardClassName="border-blue-200/90 bg-blue-50/90"
            />
          </div>
        )}
      </>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
            Recent Submissions
            {(() => {
              const newCount =
                data?.filter((sub: any) => {
                  const hoursDiff =
                    (Date.now() - new Date(sub.created_at).getTime()) /
                    (1000 * 60 * 60);
                  return hoursDiff <= 24;
                }).length ?? 0;

              return newCount > 0 ? (
                <Badge className="bg-yellow-500 text-white animate-pulse">
                  {newCount} NEW
                </Badge>
              ) : null;
            })()}
          </CardTitle>

          <CardDescription>
            Latest evaluation submissions ({overviewTotal} in list)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Search and Filter Controls */}
          <div className="border-b border-gray-200 px-3 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search submissions by employee name ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-w-0 bg-gray-100 sm:flex-1"
            />
            {searchTerm && (
              <Button
                size="sm"
                onClick={() => setSearchTerm("")}
                className="w-full bg-blue-400 px-3 py-2 text-white hover:bg-blue-500 hover:text-white sm:w-auto"
              >
                 Clear
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setIsRefreshing(true);
                setRefreshNonce((prev) => prev + 1);
              }}
              disabled={isRefreshing || isPaginate}
              className="w-full cursor-pointer bg-blue-600 px-3 py-2 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:translate-y-0 disabled:bg-gray-400 sm:w-auto"
              title="Refresh submissions data"
            >
              {isRefreshing || isPaginate ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 "></div>
                  Refreshing...
                </>
              ) : (
                <>
                  {" "}
                  Refresh{" "}
                  <span>
                    <RefreshCw className="h-3 w-3" />
                  </span>{" "}
                </>
              )}
            </Button>
            </div>
          </div>
          {isRefreshing || isPaginate ? (
            <div className="relative max-h-[min(70vh,32rem)] overflow-y-auto overflow-x-auto scrollable-table overview-table">
              {/* Centered Loading Spinner */}
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
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
                    Loading submissions...
                  </p>
                </div>
              </div>

              {/* Simple Legend */}
              <div className="m-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="text-sm font-medium text-gray-700 mr-2">
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
                  <EvaluationStatusLegendBadges />
                </div>
              </div>
              {/* Table structure visible in background */}
              <Table className={EVALUATOR_TABLE_CLASS} wrapperClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
                  <TableRow className="border-0 hover:bg-transparent" key="overview-header">
                    <TableHead className="min-w-[7.5rem] text-left sm:min-w-[9rem]">
                      Employee
                    </TableHead>
                    <TableHead className="hidden min-w-[4rem] text-center sm:table-cell">
                      Rating
                    </TableHead>
                    <TableHead className="hidden min-w-[5rem] text-center sm:table-cell">
                      Date
                    </TableHead>
                    <TableHead className="hidden min-w-[3.5rem] text-center md:table-cell">
                      Quarter
                    </TableHead>
                    <TableHead className={EVALUATOR_ACTIONS_HEAD_CLASS}>
                      <span className="lg:hidden" aria-hidden>
                        ⋮
                      </span>
                      <span className="hidden lg:inline">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: itemsPerPage }).map((_, index) => (
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
                      <TableCell className="hidden sm:table-cell">
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </TableCell>
                      <TableCell className={evaluatorActionsCellClass("")}>
                        <Skeleton className="mx-auto h-8 w-8 rounded-md bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <>
              {/* Simple Legend */}
              <div className="m-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="text-sm font-medium text-gray-700 mr-2">
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
                  <EvaluationStatusLegendBadges />
                </div>
              </div>

              {/* Scrollable Table */}
              <p className="px-3 py-2 text-[0.65rem] text-muted-foreground lg:hidden">
                Swipe horizontally to view all columns.
              </p>
              <div className="max-h-[min(70vh,32rem)] overflow-y-auto overflow-x-auto scrollable-table overview-table [-webkit-overflow-scrolling:touch]">
                <Table className={EVALUATOR_TABLE_CLASS} wrapperClassName="overflow-visible">
                  <TableHeader className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
                    <TableRow className="border-0 hover:bg-transparent" key="overview-header">
                      <TableHead className="min-w-[7.5rem] text-left sm:min-w-[9rem]">
                        Employee
                      </TableHead>
                      <TableHead className="hidden min-w-[4rem] text-center sm:table-cell">
                        Rating
                      </TableHead>
                      <TableHead className="hidden min-w-[5rem] text-center sm:table-cell">
                        Date
                      </TableHead>
                      <TableHead className="hidden min-w-[3.5rem] text-center md:table-cell">
                        Quarter
                      </TableHead>
                      <TableHead className={EVALUATOR_ACTIONS_HEAD_CLASS}>
                        <span className="lg:hidden" aria-hidden>
                          ⋮
                        </span>
                        <span className="hidden lg:inline">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!data || data.length === 0) ? (
                      <TableRow key="no-submissions">
                        <TableCell
                          colSpan={5}
                          className="px-6 py-12 text-center"
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
                              {searchTerm.trim() ? (
                                <>
                                  <p className="text-base font-medium mb-1">
                                    No submissions found
                                  </p>
                                  <p className="text-sm">
                                    Try adjusting your search criteria
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-base font-medium mb-1">
                                    No recent submissions
                                  </p>
                                  <p className="text-sm">
                                    Start evaluating employees to see
                                    submissions here
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.map((review: any) => {
                        const submittedDate = new Date(review.created_at);
                        const now = new Date();
                        const hoursDiff =
                          (now.getTime() - submittedDate.getTime()) /
                          (1000 * 60 * 60);
                        const isNew = hoursDiff <= 24;
                        const isRecent = hoursDiff > 24 && hoursDiff <= 168;
                        const rowClassName = getReviewRowClassName(review);
                        const ratingBand = getPerformanceRatingBand(review.rating);
                        const {
                          label: ratingLabel,
                          badgeClassName,
                          textClassName,
                        } = ratingBand;
                        const reviewDate = formatListDate(review.created_at);
                        const quarterDisplay = getReviewQuarterDisplay(review);

                        return (
                          <TableRow key={review.id} className={rowClassName}>
                            <TableCell className="text-left align-middle">
                              <div className="min-w-0">
                                <div className="mb-1 flex flex-wrap items-center gap-1">
                                  <span className="max-w-[10rem] truncate text-sm font-medium text-gray-900 sm:max-w-none">
                                    {[
                                      review.employee?.fname,
                                      review.employee?.lname,
                                    ]
                                      .filter(Boolean)
                                      .join(" ")
                                      .trim() || "—"}
                                  </span>
                                  {isNew && (
                                    <Badge className="bg-yellow-100 px-1 py-0 text-[0.6rem] font-semibold text-yellow-800 sm:text-xs">
                                      ⚡ New
                                    </Badge>
                                  )}
                                  {!isNew && isRecent && (
                                    <Badge className="bg-blue-100 px-1 py-0 text-[0.6rem] font-semibold text-blue-800 sm:text-xs">
                                      🕐 Recent
                                    </Badge>
                                  )}
                                  <span className="hidden sm:inline-flex">
                                    <EvalRecordStatusBadge review={review} />
                                  </span>
                                </div>

                                <div className="mt-1.5 flex flex-wrap items-center gap-1 lg:hidden">
                                  <div
                                    className={cn(
                                      "flex items-center justify-center gap-1.5",
                                      textClassName
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-[0.6rem] font-medium sm:text-xs",
                                        badgeClassName
                                      )}
                                    >
                                      {ratingLabel}
                                    </span>
                                    <span className="text-[0.65rem] font-bold sm:text-xs">
                                      {formatRatingDisplay(review.rating)}
                                    </span>
                                  </div>
                                  <Badge
                                    className={cn(
                                      "max-w-[5rem] truncate text-[0.6rem] sm:max-w-none sm:text-xs",
                                      getQuarterColor(quarterDisplay)
                                    )}
                                  >
                                    {quarterDisplay}
                                  </Badge>
                                  <span className="text-[0.65rem] text-gray-600 sm:hidden">
                                    {reviewDate.short}
                                  </span>
                                  <EvalRecordStatusBadge review={review} />
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="hidden text-center align-middle sm:table-cell">
                              <div
                                className={cn(
                                  "inline-flex items-center justify-center gap-2",
                                  textClassName
                                )}
                              >
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-1 text-xs font-medium",
                                    badgeClassName
                                  )}
                                >
                                  {ratingLabel}
                                </span>
                                <span className="font-bold">
                                  {formatRatingDisplay(review.rating)}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="hidden text-center align-middle sm:table-cell">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span className="font-medium whitespace-nowrap">
                                  {reviewDate.short}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {getTimeAgo(String(review.created_at))}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="hidden text-center align-middle md:table-cell">
                              <Badge
                                className={cn(
                                  "mx-auto max-w-[5.5rem] truncate text-[0.65rem] sm:max-w-none sm:text-xs",
                                  getQuarterColor(quarterDisplay)
                                )}
                              >
                                {quarterDisplay}
                              </Badge>
                            </TableCell>

                            <TableCell
                              className={cn(
                                "align-middle",
                                evaluatorActionsCellClass(rowClassName)
                              )}
                            >
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => handleViewEvaluation(review)}
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

              {/* Pagination Controls */}
              {overviewTotal > itemsPerPage && (
                <EvaluationsPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  total={overviewTotal}
                  perPage={perPage}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    setIsPaginate(true);
                  }}
                />
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
                  handleClose();
                }}
                showApprovalButton={false}
              />
            </>
          )}
        </CardContent>
      </Card>

      <EvaluationApiErrorDialog
        open={evaluationActionError != null}
        title={evaluationActionError?.title ?? ""}
        message={evaluationActionError?.message ?? null}
        onCloseAction={() => {
          setEvaluationActionError(null);
          void handleClose();
        }}
      />
    </div>
  );
}
