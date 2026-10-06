"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastMessages } from "@/lib/toastMessages";
import { useDialogAnimation } from "@/hooks/useDialogAnimation";
import apiService from "@/lib/apiService";
import { parseSubordinateEmployeesAndEvaluators } from "@/lib/subordinateLists";
import EvaluationsPagination from "@/components/paginationComponent";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import SmctLoadingOverlay from "@/components/SmctLoadingOverlay";
import BranchEmployeesModal, {
  BranchEmployee,
} from "@/components/hr/BranchEmployeesModal";
import BranchManagersModal, {
  BranchManager,
} from "@/components/hr/BranchManagersModal";

interface Branches {
  id: number;
  branch_code: string;
  branch_name: string;
  branch: string;
  acronym: string;
  managers_count: string;
  employees_count: string;
}
interface newBranch {
  branch_code: string;
  branch_name: string;
  branch: string;
  acronym: string;
}

function parseCount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value).trim();
  if (!raw) return 0;

  // Handles formats like "1,234", "10 employees", or "5.5"
  const normalized = raw.replace(/,/g, "");
  const direct = Number(normalized);
  if (!Number.isNaN(direct)) return direct;

  const match = normalized.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function getEmployeesCount(branch: Partial<Branches> & Record<string, any>): number {
  // Backend should provide `employees_count`, but be defensive in case it returns alternate keys.
  return (
    parseCount(branch.employees_count) ||
    parseCount(branch.employeesCount) ||
    parseCount(branch.employee_count) ||
    parseCount(branch.employees)
  );
}

function getManagersCount(branch: Partial<Branches> & Record<string, any>): number {
  return (
    parseCount(branch.managers_count) ||
    parseCount(branch.managersCount) ||
    parseCount(branch.manager_count) ||
    parseCount(branch.managers)
  );
}

type CachedBranchUsers = {
  employees: BranchEmployee[];
  evaluators: BranchManager[];
};

function getBranchHeadcounts(branch: Branches) {
  const employees = getEmployeesCount(branch);
  const evaluators = getManagersCount(branch);
  return { employees, evaluators, total: employees + evaluators };
}

const BRANCH_STAT_TILE_CLASS =
  "flex min-h-[7.5rem] flex-col items-center justify-between rounded-xl border p-3 text-center transition-all duration-200 sm:min-h-[8rem] sm:p-4";

const BRANCH_STAT_ACTION_BTN_CLASS =
  "mt-2 flex h-10 w-full min-h-[2.75rem] cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] sm:text-sm";

export default function DepartmentsTab() {
  const [branches, setBranches] = useState<Branches[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [branchToEdit, setBranchToEdit] = useState<Branches | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [branchesToDelete, setBranchesToDelete] = useState<Branches | null>(
    null
  );
  const [deletingBranchId, setDeletingBranchId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(0);
  const [isDeletingBranches, setIsDeletingBranches] = useState(false);
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [isUpdatingBranch, setIsUpdatingBranch] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [branchWithEmployees, setBranchWithEmployees] = useState<Branches | null>(null);
  const [isEmployeesModalOpen, setIsEmployeesModalOpen] = useState(false);
  const [selectedBranchForEmployees, setSelectedBranchForEmployees] =
    useState<Branches | null>(null);
  const [branchEmployees, setBranchEmployees] = useState<BranchEmployee[]>([]);
  const [isBranchEmployeesLoading, setIsBranchEmployeesLoading] = useState(false);
  const [isManagersModalOpen, setIsManagersModalOpen] = useState(false);
  const [selectedBranchForManagers, setSelectedBranchForManagers] =
    useState<Branches | null>(null);
  const [branchManagers, setBranchManagers] = useState<BranchManager[]>([]);
  const [isBranchManagersLoading, setIsBranchManagersLoading] = useState(false);

  //add inputs
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<newBranch>({
    branch_code: "",
    branch_name: "",
    branch: "",
    acronym: "",
  });

  useEffect(() => {
    if (!isAddModalOpen && !isEditModalOpen) {
      setFormData({
        branch_code: "",
        branch_name: "",
        branch: "",
        acronym: "",
      });
      setErrors({});
      setBranchToEdit(null);
    }
  }, [isAddModalOpen, isEditModalOpen]);

  const openEditBranch = (branch: Branches) => {
    setBranchToEdit(branch);
    setFormData({
      branch_code: branch.branch_code ?? "",
      branch_name: branch.branch_name ?? "",
      branch: branch.branch ?? "",
      acronym: branch.acronym ?? "",
    });
    setErrors({});
    setIsEditModalOpen(true);
  };

  const validation = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.branch_code) {
      newErrors.branch_code = "Branch code required";
    }
    if (!formData.branch_name) {
      newErrors.branch_name = "Branch name required";
    }
    if (!formData.branch) {
      newErrors.branch = "Branch required";
    }
    if (!formData.acronym) {
      newErrors.acronym = "Branch acronym required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    field: keyof newBranch,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  // Use dialog animation hook (0.4s to match EditUserModal speed)
  const dialogAnimationClass = useDialogAnimation({ duration: 0.4 });

  const branchesInFlightKeyRef = useRef<string | null>(null);
  const branchesInFlightPromiseRef = useRef<Promise<void> | null>(null);
  const prevSearchTermForDebounceRef = useRef<string | null>(null);
  const branchUsersCacheRef = useRef<Map<number, CachedBranchUsers>>(new Map());
  const fetchGenerationRef = useRef(0);

  const clearBranchUsersCache = useCallback(() => {
    branchUsersCacheRef.current.clear();
  }, []);

  const loadData = useCallback(
    async (search: string, page: number, perPage: number) => {
    const requestKey = JSON.stringify({ search, page, perPage });

    if (
      branchesInFlightKeyRef.current === requestKey &&
      branchesInFlightPromiseRef.current
    ) {
      await branchesInFlightPromiseRef.current;
      return;
    }

    const requestPromise = (async () => {
      try {
        const response = await apiService.getTotalEmployeesBranch(
          search,
          page,
          perPage
        );

        let branchesData: Branches[] = [];
        let total = 0;
        let lastPage = 1;
        let perPageValue = perPage;

        if (response) {
          if (response.data && Array.isArray(response.data)) {
            branchesData = response.data;
            total = response.total || 0;
            lastPage = response.last_page || 1;
            perPageValue = response.per_page || perPage;
          } else if (Array.isArray(response)) {
            branchesData = response;
            total = response.length;
            lastPage = 1;
            perPageValue = response.length;
          } else if (response.branches && Array.isArray(response.branches)) {
            branchesData = response.branches;
            total = response.total || response.branches.length;
            lastPage = response.last_page || 1;
            perPageValue = response.per_page || perPage;
          }
        }

        setBranches(branchesData);
        setOverviewTotal(total);
        setTotalPages(lastPage);
        setPerPage(perPageValue);
      } catch (error) {
        console.error("Error loading branches:", error);
        setBranches([]);
        setOverviewTotal(0);
        setTotalPages(1);
        setPerPage(perPage);
      } finally {
        if (branchesInFlightKeyRef.current === requestKey) {
          branchesInFlightKeyRef.current = null;
          branchesInFlightPromiseRef.current = null;
        }
      }
    })();

    branchesInFlightKeyRef.current = requestKey;
    branchesInFlightPromiseRef.current = requestPromise;
    await requestPromise;
  },
    []
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      if (
        prevSearchTermForDebounceRef.current !== null &&
        prevSearchTermForDebounceRef.current !== searchTerm
      ) {
        setCurrentPage(1);
      }
      prevSearchTermForDebounceRef.current = searchTerm;
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const generation = ++fetchGenerationRef.current;

    const fetchData = async () => {
      setIsRefreshing(true);
      try {
        await loadData(debouncedSearchTerm, currentPage, itemsPerPage);
      } catch (error) {
        console.error("Error fetching branches:", error);
      } finally {
        if (fetchGenerationRef.current === generation) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void fetchData();
    return () => {
      fetchGenerationRef.current += 1;
    };
  }, [debouncedSearchTerm, currentPage, itemsPerPage, loadData]);

  const refreshData = async () => {
    clearBranchUsersCache();
    setIsRefreshing(true);
    try {
      await loadData(debouncedSearchTerm, currentPage, itemsPerPage);
    } catch (error) {
      console.error("Error refreshing branches:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to handle adding a new department
  const handleAddBranch = async () => {
    if (!validation()) {
      return;
    }
    if (validation()) {
      try {
        await apiService.addBranch(formData);
        clearBranchUsersCache();
        await loadData(debouncedSearchTerm, currentPage, itemsPerPage);
        toastMessages.generic.success(
          "Success " + formData.branch_name + " has been added",
          "A new department has been save."
        );
        setErrors({});
        setIsAddModalOpen(false);
      } catch (error: any) {
        if (error.response?.data?.errors) {
          const backendErrors: Record<string, string> = {};

          Object.keys(error.response.data.errors).forEach((field) => {
            backendErrors[field] = error.response.data.errors[field][0];
          });
          setErrors(backendErrors);
        }
      }
    }
  };

  const handleUpdateBranch = async () => {
    if (!branchToEdit) return;
    if (!validation()) return;

    try {
      await apiService.updateBranch(branchToEdit.id, formData);
      clearBranchUsersCache();
      await loadData(debouncedSearchTerm, currentPage, itemsPerPage);
      toastMessages.generic.success(
        "Branch Updated",
        `"${formData.branch_name}" has been updated.`
      );
      setErrors({});
      setIsEditModalOpen(false);
    } catch (error: any) {
      if (error.response?.data?.errors) {
        const backendErrors: Record<string, string> = {};
        Object.keys(error.response.data.errors).forEach((field) => {
          backendErrors[field] = error.response.data.errors[field][0];
        });
        setErrors(backendErrors);
        return;
      }

      const backendMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to update branch.";
      toastMessages.generic.error("Error", String(backendMsg));
    }
  };

  // Function to handle deleting a department
  const handleDeleteBranches = async () => {
    if (!branchesToDelete) return;

    try {
      // Set deleting state to show skeleton animation
      setDeletingBranchId(branchesToDelete.id);

      // Close modal immediately
      setIsDeleteModalOpen(false);

      // Wait 2 seconds to show skeleton animation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Actually delete the branch
      await apiService.deleteBranches(branchesToDelete.id);
      branchUsersCacheRef.current.delete(branchesToDelete.id);

      await loadData(debouncedSearchTerm, currentPage, itemsPerPage);
      setDeletingBranchId(null);

      toastMessages.generic.success(
        "Department Deleted",
        `"${
          branchesToDelete.branch_name + "/ " + branchesToDelete.branch_code
        }" has been deleted successfully.`
      );
    } catch (error) {
      console.error("Error deleting department:", error);
      setDeletingBranchId(null);
      toastMessages.generic.error(
        "Error",
        "Failed to delete department. Please try again."
      );
    } finally {
      setBranchesToDelete(null);
    }
  };

  const getDisplayRole = (roles: any): string => {
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return "N/A";
    }
    const nonAdminRole = roles.find(
      (role: { name?: string }) =>
        String(role?.name ?? "").toLowerCase() !== "admin"
    );
    return String((nonAdminRole ?? roles[0])?.name ?? "N/A");
  };

  const normalizeBranchUser = (user: any) => {
    const firstName = String(user?.fname ?? "").trim();
    const lastName = String(user?.lname ?? "").trim();
    const fullName =
      String(user?.full_name ?? "").trim() || `${firstName} ${lastName}`.trim() || "N/A";
    const role = getDisplayRole(user?.roles);

    return {
      id: user?.id ?? user?.user_id ?? `${fullName}-${user?.email ?? "unknown"}`,
      fullName,
      email: String(user?.email ?? "N/A"),
      role,
      position: String(user?.positions?.label ?? user?.position ?? "N/A"),
      section: String(
        user?.section?.name ??
          user?.sections?.name ??
          user?.section_name ??
          user?.section ??
          "Unassigned"
      ),
    };
  };

  const loadBranchUsers = useCallback(
    async (branchId: number): Promise<CachedBranchUsers> => {
      const cached = branchUsersCacheRef.current.get(branchId);
      if (cached) return cached;

      const response = await apiService.getSubordinate({
        branch_id: branchId,
        page: 1,
        per_page: 1000,
      });
      const { employees, evaluators } =
        parseSubordinateEmployeesAndEvaluators(response);

      const result: CachedBranchUsers = {
        employees: (employees as any[]).map((user) => normalizeBranchUser(user)),
        evaluators: (evaluators as any[]).map((user) =>
          normalizeBranchUser(user)
        ),
      };

      branchUsersCacheRef.current.set(branchId, result);
      return result;
    },
    []
  );

  const openBranchEmployeesModal = async (branch: Branches) => {
    setSelectedBranchForEmployees(branch);
    setIsEmployeesModalOpen(true);
    setIsBranchEmployeesLoading(true);
    setBranchEmployees([]);

    try {
      const { employees } = await loadBranchUsers(branch.id);
      setBranchEmployees(employees);
    } catch (error) {
      console.error("Error loading branch employees:", error);
      toastMessages.generic.error(
        "Error",
        "Failed to load branch employees. Please try again."
      );
      setBranchEmployees([]);
    } finally {
      setIsBranchEmployeesLoading(false);
    }
  };

  const openBranchManagersModal = async (branch: Branches) => {
    setSelectedBranchForManagers(branch);
    setIsManagersModalOpen(true);
    setIsBranchManagersLoading(true);
    setBranchManagers([]);

    try {
      const { evaluators } = await loadBranchUsers(branch.id);
      setBranchManagers(evaluators);
    } catch (error) {
      console.error("Error loading branch managers:", error);
      toastMessages.generic.error(
        "Error",
        "Failed to load branch managers. Please try again."
      );
      setBranchManagers([]);
    } finally {
      setIsBranchManagersLoading(false);
    }
  };

  const listBusy = loading || isRefreshing;

  return (
    <div className="relative  overflow-y-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="w-1/2">
              <CardTitle>Branches</CardTitle>
              <CardDescription>
                View and manage branches information
              </CardDescription>
              <div className="relative flex-1 mt-5">
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
                  placeholder="Search by branch, branch code, branch name, acronym"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 pl-10"
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
            <div className="flex space-x-2">
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 hover:text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                <Plus className="h-5 w-5" />
                Add Branch
              </Button>
              <Button
                variant="outline"
                onClick={refreshData}
                disabled={isRefreshing}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 hover:text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                {isRefreshing ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-5 w-5 font-bold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {listBusy ? (
            <SmctLoadingOverlay
              label={
                isRefreshing && !loading
                  ? "Refreshing branches…"
                  : "Loading branches…"
              }
            />
          ) : null}

          <div
            className={cn(
              listBusy && "pointer-events-none opacity-40",
              listBusy && "min-h-[420px]"
            )}
          >
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
              {loading ? (
                Array.from({ length: itemsPerPage }).map((_, index) => (
                  <Card key={`skeleton-branch-${index}`} className="animate-pulse">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-40 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-gray-100 rounded-lg">
                          <Skeleton className="h-6 w-12 mx-auto mb-2" />
                          <Skeleton className="h-3 w-16 mx-auto" />
                        </div>
                        <div className="text-center p-3 bg-gray-100 rounded-lg">
                          <Skeleton className="h-6 w-12 mx-auto mb-2" />
                          <Skeleton className="h-3 w-16 mx-auto" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : branches && Array.isArray(branches) && branches.length > 0 ? (
                branches.map((branch) => {
                    const headcounts = getBranchHeadcounts(branch);
                    const isDeleting = deletingBranchId === branch.id;
                    return (
                      <Card
                        key={branch.id}
                        className={cn(
                          "overflow-hidden transition-shadow duration-200 hover:shadow-md",
                          isDeleting &&
                            "animate-slide-out-right border-red-200 bg-red-50"
                        )}
                      >
                        {isDeleting ? (
                          <>
                            <CardHeader>
                              <div className="flex justify-between items-center">
                                <Skeleton className="h-6 w-32" />
                                <div className="flex items-center gap-2">
                                  <Skeleton className="h-5 w-24 rounded-full" />
                                  <Skeleton className="h-8 w-8 rounded" />
                                </div>
                              </div>
                              <Skeleton className="h-4 w-40 mt-2" />
                              <Skeleton className="h-4 w-32 mt-2" />
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-3 bg-gray-100 rounded-lg">
                                  <Skeleton className="h-6 w-12 mx-auto mb-2" />
                                  <Skeleton className="h-3 w-16 mx-auto" />
                                </div>
                                <div className="text-center p-3 bg-gray-100 rounded-lg">
                                  <Skeleton className="h-6 w-12 mx-auto mb-2" />
                                  <Skeleton className="h-3 w-16 mx-auto" />
                                </div>
                              </div>
                            </CardContent>
                          </>
                        ) : (
                          <>
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-start justify-between gap-2 text-base sm:text-lg">
                                <span className="min-w-0 flex-1 truncate pr-1">
                                  {branch.branch_name} / {branch.branch_code}
                                </span>
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditBranch(branch)}
                                    disabled={
                                      deletingBranchId !== null ||
                                      isUpdatingBranch
                                    }
                                    aria-label={`Edit ${branch.branch_name}`}
                                    className="h-9 w-9 touch-manipulation p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      if (headcounts.total > 0) {
                                        setBranchWithEmployees(branch);
                                        setIsAlertDialogOpen(true);
                                      } else {
                                        setBranchesToDelete(branch);
                                        setIsDeleteModalOpen(true);
                                      }
                                    }}
                                    disabled={deletingBranchId !== null}
                                    aria-label={`Delete ${branch.branch_name}`}
                                    className="h-9 w-9 touch-manipulation p-0 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardTitle>
                              <CardDescription className="truncate text-xs sm:text-sm">
                                {branch.branch} · {branch.acronym}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-0 sm:space-y-4">
                              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:gap-4">
                                <div
                                  className={cn(
                                    BRANCH_STAT_TILE_CLASS,
                                    "border-blue-100/80 bg-blue-50 hover:border-blue-200 hover:shadow-sm"
                                  )}
                                >
                                  <div>
                                    <div className="text-2xl font-bold tabular-nums text-blue-600 sm:text-3xl">
                                      {headcounts.employees}
                                    </div>
                                    <div className="mt-0.5 text-xs font-medium text-gray-600 sm:text-sm">
                                      Employees
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      void openBranchEmployeesModal(branch)
                                    }
                                    className={cn(
                                      BRANCH_STAT_ACTION_BTN_CLASS,
                                      "border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                    )}
                                  >
                                    <Users className="h-4 w-4 shrink-0" />
                                    View employees
                                  </Button>
                                </div>
                                <div
                                  className={cn(
                                    BRANCH_STAT_TILE_CLASS,
                                    "border-green-100/80 bg-green-50 hover:border-green-200 hover:shadow-sm"
                                  )}
                                >
                                  <div>
                                    <div className="text-2xl font-bold tabular-nums text-green-600 sm:text-3xl">
                                      {headcounts.evaluators}
                                    </div>
                                    <div className="mt-0.5 text-xs font-medium text-gray-600 sm:text-sm">
                                      Evaluators
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      void openBranchManagersModal(branch)
                                    }
                                    className={cn(
                                      BRANCH_STAT_ACTION_BTN_CLASS,
                                      "border-green-700 bg-green-600 text-white hover:bg-green-700 hover:text-white"
                                    )}
                                  >
                                    <Users className="h-4 w-4 shrink-0" />
                                    View evaluators
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </>
                        )}
                      </Card>
                    );
                  })
              ) : null}
            </div>
          </div>
          {!listBusy &&
            branches &&
            Array.isArray(branches) &&
            branches.length === 0 && (
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
              <div className="text-gray-500 text-center">
                {debouncedSearchTerm.trim() ? (
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
                      No branches to display
                    </p>
                    <p className="text-sm text-gray-400">
                      Add a branch or check back after data is synced
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Pagination Controls */}
          {!listBusy && totalPages > 1 && (
            <EvaluationsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={overviewTotal}
              perPage={perPage}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Add Branch Modal */}
      <Dialog open={isAddModalOpen} onOpenChangeAction={setIsAddModalOpen}>
        <DialogContent className={`max-w-md p-6 ${dialogAnimationClass}`}>
          <DialogHeader className="pb-4">
            <DialogTitle>Add New Branch</DialogTitle>
            <DialogDescription>
              Create a new branch in the system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-2">
            <div className="space-y-2">
              <Label htmlFor="branchName" className="text-sm font-medium">
                Branch Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="branchName"
                placeholder="Enter branch name"
                value={formData.branch_name}
                onChange={(e) =>
                  handleInputChange(
                    "branch_name",
                    e.target.value.toLocaleUpperCase()
                  )
                }
                style={{ textTransform: "uppercase" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddBranch();
                  }
                }}
                autoFocus
              />
              {errors?.branch_name && (
                <p className="text-sm text-red-500">{errors?.branch_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchCode" className="text-sm font-medium">
                Branch Code
              </Label>
              <Input
                id="branchCode"
                placeholder="Enter branch code (optional)"
                value={formData.branch_code}
                onChange={(e) =>
                  handleInputChange("branch_code", e.target.value.toUpperCase())
                }
                style={{ textTransform: "uppercase" }}
              />
              {errors?.branch_code && (
                <p className="text-sm text-red-500">{errors?.branch_code}</p>
              )}
            </div>
            <div className="w-full md:w-48 space-y-2">
              <Label
                htmlFor="records-approval-status"
                className="text-sm font-medium"
              >
                Branch
              </Label>
              <Select
                value={formData.branch}
                onValueChange={(value) => handleInputChange("branch", value)}
              >
                <SelectTrigger className="w-48 cursor-pointer">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Des Appliance Plaza, Inc.">
                    Des Appliance Plaza, Inc.
                  </SelectItem>
                  <SelectItem value="Des Strong Motors, Inc.">
                    Des Strong Motors, Inc.
                  </SelectItem>
                  <SelectItem value="Honda Des, Inc.">
                    Honda Des, Inc.
                  </SelectItem>
                  <SelectItem value="Head Office">Head Office</SelectItem>
                  <SelectItem value="Strong Moto Centrum, Inc.">
                    Strong Moto Centrum, Inc.
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors?.branch && (
                <p className="text-sm text-red-500">{errors?.branch}</p>
              )}
            </div>
            <div className="w-full md:w-48 space-y-2 mb-2">
              <Label
                htmlFor="records-approval-status"
                className="text-sm font-medium"
              >
                Acronym
              </Label>
              <Select
                value={formData.acronym}
                onValueChange={(value) => handleInputChange("acronym", value)}
              >
                <SelectTrigger className="w-48 cursor-pointer">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAP">DAP</SelectItem>
                  <SelectItem value="DSM">DSM</SelectItem>
                  <SelectItem value="HD">HD</SelectItem>
                  <SelectItem value="HO">HO</SelectItem>
                  <SelectItem value="KIA">KIA</SelectItem>
                  <SelectItem value="SMCT">SMCT</SelectItem>
                </SelectContent>
              </Select>
              {errors?.acronym && (
                <p className="text-sm text-red-500">{errors?.acronym}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-6 px-2">
            <div className="flex justify-end space-x-4 w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setErrors({});
                  setIsAddModalOpen(false);
                }}
                className="cursor-pointer text-white bg-blue-600 hover:text-white hover:bg-blue-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Cancel
              </Button>
              <Button
                disabled={isAddingBranch}
                className={`bg-green-600 hover:bg-green-700 text-white flex items-center gap-2
    cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0
    ${isAddingBranch ? "opacity-70 cursor-not-allowed hover:scale-100" : ""}
  `}
                onClick={async () => {
                  setIsAddingBranch(true);

                  try {
                    await handleAddBranch();
                  } finally {
                    setIsAddingBranch(false);
                  }
                }}
              >
                {isAddingBranch ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Branch"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Modal */}
      <Dialog
        open={isEditModalOpen}
        onOpenChangeAction={(open) => {
          setIsEditModalOpen(open);
          if (!open) setBranchToEdit(null);
        }}
      >
        <DialogContent className={`max-w-md p-6 ${dialogAnimationClass}`}>
          <DialogHeader className="pb-4">
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch details for{" "}
              {branchToEdit
                ? `${branchToEdit.branch_name} / ${branchToEdit.branch_code}`
                : "this branch"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-2">
            <div className="space-y-2">
              <Label htmlFor="editBranchName" className="text-sm font-medium">
                Branch Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editBranchName"
                placeholder="Enter branch name"
                value={formData.branch_name}
                onChange={(e) =>
                  handleInputChange(
                    "branch_name",
                    e.target.value.toLocaleUpperCase()
                  )
                }
                style={{ textTransform: "uppercase" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleUpdateBranch();
                  }
                }}
                autoFocus
              />
              {errors?.branch_name && (
                <p className="text-sm text-red-500">{errors?.branch_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editBranchCode" className="text-sm font-medium">
                Branch Code
              </Label>
              <Input
                id="editBranchCode"
                placeholder="Enter branch code (optional)"
                value={formData.branch_code}
                onChange={(e) =>
                  handleInputChange("branch_code", e.target.value.toUpperCase())
                }
                style={{ textTransform: "uppercase" }}
              />
              {errors?.branch_code && (
                <p className="text-sm text-red-500">{errors?.branch_code}</p>
              )}
            </div>
            <div className="w-full md:w-48 space-y-2">
              <Label htmlFor="editBranchCompany" className="text-sm font-medium">
                Branch
              </Label>
              <Select
                value={formData.branch}
                onValueChange={(value) => handleInputChange("branch", value)}
              >
                <SelectTrigger
                  id="editBranchCompany"
                  className="w-48 cursor-pointer"
                >
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Des Appliance Plaza, Inc.">
                    Des Appliance Plaza, Inc.
                  </SelectItem>
                  <SelectItem value="Des Strong Motors, Inc.">
                    Des Strong Motors, Inc.
                  </SelectItem>
                  <SelectItem value="Honda Des, Inc.">
                    Honda Des, Inc.
                  </SelectItem>
                  <SelectItem value="Head Office">Head Office</SelectItem>
                  <SelectItem value="Strong Moto Centrum, Inc.">
                    Strong Moto Centrum, Inc.
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors?.branch && (
                <p className="text-sm text-red-500">{errors?.branch}</p>
              )}
            </div>
            <div className="w-full md:w-48 space-y-2 mb-2">
              <Label htmlFor="editBranchAcronym" className="text-sm font-medium">
                Acronym
              </Label>
              <Select
                value={formData.acronym}
                onValueChange={(value) => handleInputChange("acronym", value)}
              >
                <SelectTrigger
                  id="editBranchAcronym"
                  className="w-48 cursor-pointer"
                >
                  <SelectValue placeholder="Select acronym" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAP">DAP</SelectItem>
                  <SelectItem value="DSM">DSM</SelectItem>
                  <SelectItem value="HD">HD</SelectItem>
                  <SelectItem value="HO">HO</SelectItem>
                  <SelectItem value="KIA">KIA</SelectItem>
                  <SelectItem value="SMCT">SMCT</SelectItem>
                </SelectContent>
              </Select>
              {errors?.acronym && (
                <p className="text-sm text-red-500">{errors?.acronym}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-6 px-2">
            <div className="flex justify-end space-x-4 w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setErrors({});
                  setIsEditModalOpen(false);
                }}
                disabled={isUpdatingBranch}
                className="cursor-pointer text-white bg-blue-600 hover:text-white hover:bg-blue-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Cancel
              </Button>
              <Button
                disabled={isUpdatingBranch || !branchToEdit}
                className={`bg-green-600 hover:bg-green-700 text-white flex items-center gap-2
    cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0
    ${isUpdatingBranch ? "opacity-70 cursor-not-allowed hover:scale-100" : ""}
  `}
                onClick={async () => {
                  setIsUpdatingBranch(true);
                  try {
                    await handleUpdateBranch();
                  } finally {
                    setIsUpdatingBranch(false);
                  }
                }}
              >
                {isUpdatingBranch ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={isDeleteModalOpen}
        onOpenChangeAction={(open) => {
          setIsDeleteModalOpen(open);
          if (!open) {
            setBranchesToDelete(null);
          }
        }}
      >
        <DialogContent className={`max-w-md p-6 ${dialogAnimationClass}`}>
          <DialogHeader className="pb-4 bg-red-50 rounded-lg ">
            <DialogTitle className="text-red-800 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              Delete {branchesToDelete?.branch_name} Branch
            </DialogTitle>
            <DialogDescription className="text-red-700">
              This action cannot be undone. Are you sure you want to permanently
              delete this department?
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
                    <li>This branch record</li>
                    <li>All users under this branch</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm text-gray-700">
                <p className="font-medium">Branch Details:</p>
                <div className="mt-2 space-y-1">
                  <p>
                    <span className="font-medium">Branch Name:</span>{" "}
                    {branchesToDelete?.branch_name}
                  </p>
                  <p>
                    <span className="font-medium">No. of employees:</span>{" "}
                    {getEmployeesCount(branchesToDelete ?? {}) +
                      getManagersCount(branchesToDelete ?? {})}
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
                  setBranchesToDelete(null);
                }}
                className="text-white bg-red-600 hover:text-white hover:bg-red-700 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Cancel
              </Button>
              <Button
                disabled={isDeletingBranches}
                className={`bg-blue-600 hover:bg-red-700 text-white cursor-pointer
    transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0
    ${isDeletingBranches ? "opacity-70 cursor-not-allowed hover:scale-100" : ""}
  `}
                onClick={async () => {
                  if (!branchesToDelete) return;

                  // Proceed with deletion if no employees
                  setIsDeletingBranches(true);

                  try {
                    await handleDeleteBranches();
                  } finally {
                    setIsDeletingBranches(false);
                  }
                }}
              >
                {isDeletingBranches ? (
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

      {/* Alert Dialog for Branches with Employees */}
      <AlertDialog
        open={isAlertDialogOpen}
        onOpenChangeAction={(open) => {
          setIsAlertDialogOpen(open);
          if (!open) {
            setBranchWithEmployees(null);
          }
        }}
        title="Cannot Delete Branch"
        description={`The branch "${branchWithEmployees?.branch_name} / ${branchWithEmployees?.branch_code}" cannot be deleted because it has ${
          branchWithEmployees
            ? getBranchHeadcounts(branchWithEmployees).total
            : 0
        } employee(s) assigned to it. Please remove or reassign all employees before deleting this branch.`}
        type="warning"
        confirmText="OK"
        showCancel={false}
        backgroundImage="/smct.png"
        size="lg"
        logoSize="cover"
        logoOpacity={10}
        onConfirm={() => {
          setIsAlertDialogOpen(false);
          setBranchWithEmployees(null);
        }}
      />

      <BranchEmployeesModal
        open={isEmployeesModalOpen}
        onOpenChange={(open) => {
          setIsEmployeesModalOpen(open);
          if (!open) {
            setSelectedBranchForEmployees(null);
            setBranchEmployees([]);
          }
        }}
        selectedBranch={selectedBranchForEmployees}
        employees={branchEmployees}
        isLoading={isBranchEmployeesLoading}
        dialogAnimationClass={dialogAnimationClass}
      />

      <BranchManagersModal
        open={isManagersModalOpen}
        onOpenChange={(open) => {
          setIsManagersModalOpen(open);
          if (!open) {
            setSelectedBranchForManagers(null);
            setBranchManagers([]);
          }
        }}
        selectedBranch={selectedBranchForManagers}
        managers={branchManagers}
        isLoading={isBranchManagersLoading}
        dialogAnimationClass={dialogAnimationClass}
      />
    </div>
  );
}
