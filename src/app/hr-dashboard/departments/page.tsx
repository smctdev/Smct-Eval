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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastMessages } from "@/lib/toastMessages";
import { useDialogAnimation } from "@/hooks/useDialogAnimation";
import apiService from "@/lib/apiService";
import EvaluationsPagination from "@/components/paginationComponent";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import SmctLoadingOverlay from "@/components/SmctLoadingOverlay";
import DepartmentEmployeesModal, {
  DepartmentEmployee,
} from "@/components/hr/DepartmentEmployeesModal";
import DepartmentManagersModal, {
  DepartmentManager,
} from "@/components/hr/DepartmentManagersModal";
import { parseSubordinateEmployeesAndEvaluators } from "@/lib/subordinateLists";

interface Department {
  id: number;
  department_name: string;
  managers_count: string;
  employees_count: string;
}

type CachedDepartmentUsers = {
  employees: DepartmentEmployee[];
  evaluators: DepartmentManager[];
};

function getDepartmentHeadcounts(dept: Department) {
  const employees = Number.isNaN(Number(dept.employees_count))
    ? 0
    : Number(dept.employees_count);
  const evaluators = Number.isNaN(Number(dept.managers_count))
    ? 0
    : Number(dept.managers_count);
  return { employees, evaluators, total: employees + evaluators };
}

const DEPT_STAT_TILE_CLASS =
  "flex min-h-[7.5rem] flex-col items-center justify-between rounded-xl border p-3 text-center transition-all duration-200 sm:min-h-[8rem] sm:p-4";

const DEPT_STAT_ACTION_BTN_CLASS =
  "mt-2 flex h-10 w-full min-h-[2.75rem] cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] sm:text-sm";

export default function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [departmentToEdit, setDepartmentToEdit] = useState<Department | null>(
    null
  );
  const [editDepartmentName, setEditDepartmentName] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] =
    useState<Department | null>(null);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<
    number | null
  >(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Use dialog animation hook (0.4s to match EditUserModal speed)
  const dialogAnimationClass = useDialogAnimation({ duration: 0.4 });
  const [isDeletingDepartment, setIsDeletingDepartment] = useState(false);
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [isUpdatingDepartment, setIsUpdatingDepartment] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [departmentWithEmployees, setDepartmentWithEmployees] = useState<Department | null>(null);
  const [isEmployeesModalOpen, setIsEmployeesModalOpen] = useState(false);
  const [selectedDepartmentForEmployees, setSelectedDepartmentForEmployees] =
    useState<Department | null>(null);
  const [departmentEmployees, setDepartmentEmployees] = useState<
    DepartmentEmployee[]
  >([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);
  const [isManagersModalOpen, setIsManagersModalOpen] = useState(false);
  const [selectedDepartmentForManagers, setSelectedDepartmentForManagers] =
    useState<Department | null>(null);
  const [departmentManagers, setDepartmentManagers] = useState<
    DepartmentManager[]
  >([]);
  const [isManagersLoading, setIsManagersLoading] = useState(false);

  const departmentsInFlightKeyRef = useRef<string | null>(null);
  const departmentsInFlightPromiseRef = useRef<Promise<void> | null>(null);
  const prevSearchTermForDebounceRef = useRef<string | null>(null);
  const departmentUsersCacheRef = useRef<Map<number, CachedDepartmentUsers>>(
    new Map()
  );
  const fetchGenerationRef = useRef(0);

  const clearDepartmentUsersCache = useCallback(() => {
    departmentUsersCacheRef.current.clear();
  }, []);

  const loadData = useCallback(
    async (search: string, page: number, perPage: number) => {
    const requestKey = JSON.stringify({ search, page, perPage });

    if (
      departmentsInFlightKeyRef.current === requestKey &&
      departmentsInFlightPromiseRef.current
    ) {
      await departmentsInFlightPromiseRef.current;
      return;
    }

    const requestPromise = (async () => {
      try {
        const response = await apiService.getTotalEmployeesDepartments(
          search,
          page,
          perPage
        );

        let departmentsData: Department[] = [];
        let total = 0;
        let lastPage = 1;
        let perPageValue = perPage;

        if (response) {
          if (response.data && Array.isArray(response.data)) {
            departmentsData = response.data;
            total = response.total || 0;
            lastPage = response.last_page || 1;
            perPageValue = response.per_page || perPage;
          } else if (Array.isArray(response)) {
            departmentsData = response;
            total = response.length;
            lastPage = 1;
            perPageValue = response.length;
          } else if (response.departments && Array.isArray(response.departments)) {
            departmentsData = response.departments;
            total = response.total || response.departments.length;
            lastPage = response.last_page || 1;
            perPageValue = response.per_page || perPage;
          }
        }

        setDepartments(departmentsData);
        setOverviewTotal(total);
        setTotalPages(lastPage);
        setPerPage(perPageValue);
      } catch (error) {
        console.error("Error loading departments:", error);
        setDepartments([]);
        setOverviewTotal(0);
        setTotalPages(1);
        setPerPage(perPage);
      } finally {
        if (departmentsInFlightKeyRef.current === requestKey) {
          departmentsInFlightKeyRef.current = null;
          departmentsInFlightPromiseRef.current = null;
        }
      }
    })();

    departmentsInFlightKeyRef.current = requestKey;
    departmentsInFlightPromiseRef.current = requestPromise;
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
        console.error("Error fetching departments:", error);
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
    clearDepartmentUsersCache();
    setIsRefreshing(true);
    try {
      await loadData(debouncedSearchTerm, currentPage, itemsPerPage);
    } catch (error) {
      console.error("Error refreshing departments:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to handle adding a new department
  const handleAddDepartment = async () => {
    try {
      await apiService.addDepartment(newDepartmentName);
      clearDepartmentUsersCache();
      await loadData(debouncedSearchTerm, currentPage, itemsPerPage);
      toastMessages.generic.success(
        "Success " + newDepartmentName + " has been added",
        "A new department has been save."
      );
      setNewDepartmentName("");
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
  };

  const openEditDepartment = (dept: Department) => {
    setDepartmentToEdit(dept);
    setEditDepartmentName(dept.department_name ?? "");
    setErrors({});
    setIsEditModalOpen(true);
  };

  const handleUpdateDepartment = async () => {
    if (!departmentToEdit) return;
    const trimmed = editDepartmentName.trim();
    if (!trimmed) {
      setErrors({ department_name: "Department name required" });
      return;
    }

    try {
      await apiService.updateDepartment(departmentToEdit.id, trimmed);
      clearDepartmentUsersCache();
      await loadData(debouncedSearchTerm, currentPage, itemsPerPage);
      toastMessages.generic.success(
        "Department Updated",
        `"${trimmed}" has been updated.`
      );
      setErrors({});
      setIsEditModalOpen(false);
      setDepartmentToEdit(null);
      setEditDepartmentName("");
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
        "Failed to update department.";
      toastMessages.generic.error("Error", String(backendMsg));
    }
  };

  // Function to handle deleting a department
  const handleDeleteDepartment = async () => {
    if (!departmentToDelete) return;

    try {
      // Set deleting state to show skeleton animation
      setDeletingDepartmentId(departmentToDelete.id);

      // Close modal immediately
      setIsDeleteModalOpen(false);

      // Wait 2 seconds to show skeleton animation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Actually delete the department
      await apiService.deleteDepartment(departmentToDelete.id);
      departmentUsersCacheRef.current.delete(departmentToDelete.id);

      await loadData(debouncedSearchTerm, currentPage, itemsPerPage);
      setDeletingDepartmentId(null);

      toastMessages.generic.success(
        "Department Deleted",
        `"${departmentToDelete.department_name}" has been deleted successfully.`
      );
    } catch (error) {
      console.error("Error deleting department:", error);
      setDeletingDepartmentId(null);
      toastMessages.generic.error(
        "Error",
        "Failed to delete department. Please try again."
      );
    } finally {
      setDepartmentToDelete(null);
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

  const normalizeDepartmentUser = (user: any) => {
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

  const loadDepartmentUsers = useCallback(
    async (departmentId: number): Promise<CachedDepartmentUsers> => {
      const cached = departmentUsersCacheRef.current.get(departmentId);
      if (cached) return cached;

      const response = await apiService.getSubordinate({
        department_id: departmentId,
        page: 1,
        per_page: 1000,
      });
      const { employees, evaluators } =
        parseSubordinateEmployeesAndEvaluators(response);

      const result: CachedDepartmentUsers = {
        employees: (employees as any[]).map((user) =>
          normalizeDepartmentUser(user)
        ),
        evaluators: (evaluators as any[]).map((user) =>
          normalizeDepartmentUser(user)
        ),
      };

      departmentUsersCacheRef.current.set(departmentId, result);
      return result;
    },
    []
  );

  const openDepartmentEmployeesModal = async (department: Department) => {
    setSelectedDepartmentForEmployees(department);
    setIsEmployeesModalOpen(true);
    setIsEmployeesLoading(true);
    setDepartmentEmployees([]);

    try {
      const { employees } = await loadDepartmentUsers(department.id);
      setDepartmentEmployees(employees);
    } catch (error) {
      console.error("Error loading department employees:", error);
      toastMessages.generic.error(
        "Error",
        "Failed to load department employees. Please try again."
      );
      setDepartmentEmployees([]);
    } finally {
      setIsEmployeesLoading(false);
    }
  };

  const openDepartmentManagersModal = async (department: Department) => {
    setSelectedDepartmentForManagers(department);
    setIsManagersModalOpen(true);
    setIsManagersLoading(true);
    setDepartmentManagers([]);

    try {
      const { evaluators } = await loadDepartmentUsers(department.id);
      setDepartmentManagers(evaluators);
    } catch (error) {
      console.error("Error loading department managers:", error);
      toastMessages.generic.error(
        "Error",
        "Failed to load department managers. Please try again."
      );
      setDepartmentManagers([]);
    } finally {
      setIsManagersLoading(false);
    }
  };

  const listBusy = loading || isRefreshing;

  return (
    <div className="relative  overflow-y-auto ">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="w-1/4">
              <CardTitle>Departments</CardTitle>
              <CardDescription>
                View and manage department information
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
                  placeholder="Search by department name"
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
                Add Department
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
                  ? "Refreshing departments…"
                  : "Loading departments…"
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
                  <Card key={`skeleton-dept-${index}`} className="animate-pulse">
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
              ) : departments &&
                Array.isArray(departments) &&
                departments.length > 0 ? (
                departments.map((dept) => {
                    const headcounts = getDepartmentHeadcounts(dept);
                    const isDeleting = deletingDepartmentId === dept.id;
                    return (
                      <Card
                        key={dept.id}
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
                                  {dept.department_name}
                                </span>
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDepartment(dept)}
                                    disabled={
                                      deletingDepartmentId !== null ||
                                      isUpdatingDepartment
                                    }
                                    aria-label={`Edit ${dept.department_name}`}
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
                                        setDepartmentWithEmployees(dept);
                                        setIsAlertDialogOpen(true);
                                      } else {
                                        setDepartmentToDelete(dept);
                                        setIsDeleteModalOpen(true);
                                      }
                                    }}
                                    disabled={deletingDepartmentId !== null}
                                    aria-label={`Delete ${dept.department_name}`}
                                    className="h-9 w-9 touch-manipulation p-0 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardTitle>
                              <CardDescription className="text-xs sm:text-sm">
                                View employees or evaluators below
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-0 sm:space-y-4">
                              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:gap-4">
                                <div
                                  className={cn(
                                    DEPT_STAT_TILE_CLASS,
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
                                      void openDepartmentEmployeesModal(dept)
                                    }
                                    className={cn(
                                      DEPT_STAT_ACTION_BTN_CLASS,
                                      "border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                    )}
                                  >
                                    <Users className="h-4 w-4 shrink-0" />
                                    View employees
                                  </Button>
                                </div>
                                <div
                                  className={cn(
                                    DEPT_STAT_TILE_CLASS,
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
                                      void openDepartmentManagersModal(dept)
                                    }
                                    className={cn(
                                      DEPT_STAT_ACTION_BTN_CLASS,
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
            departments &&
            Array.isArray(departments) &&
            departments.length === 0 && (
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
                        No departments to display
                      </p>
                      <p className="text-sm text-gray-400">
                        Add a department or check back after data is synced
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

      {/* Add Department Modal */}
      <Dialog open={isAddModalOpen} onOpenChangeAction={setIsAddModalOpen}>
        <DialogContent className={`max-w-md p-6 ${dialogAnimationClass}`}>
          <DialogHeader className="pb-4">
            <DialogTitle>Add New Department</DialogTitle>
            <DialogDescription>
              Create a new department in the system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-2 mt-2">
            <div className="space-y-2">
              <Label htmlFor="departmentName" className="text-sm font-medium">
                Department Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="departmentName"
                placeholder="Enter department name"
                value={newDepartmentName}
                onChange={(e) => setNewDepartmentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddDepartment();
                  }
                }}
                autoFocus
              />
              {errors.department_name && (
                <p className="text-red-500 text-sm">{errors.department_name}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-6 px-2">
            <div className="flex justify-end space-x-4 w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setNewDepartmentName("");
                  setIsAddModalOpen(false);
                }}
                className="cursor-pointer text-white bg-blue-600 hover:text-white hover:bg-blue-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Cancel
              </Button>
              <Button
                disabled={isAddingDepartment}
                className={`bg-green-600 hover:bg-green-700 text-white flex items-center gap-2
    cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0
    ${isAddingDepartment ? "opacity-70 cursor-not-allowed hover:scale-100" : ""}
  `}
                onClick={async () => {
                  setIsAddingDepartment(true);

                  try {
                    await handleAddDepartment();
                  } finally {
                    setIsAddingDepartment(false);
                  }
                }}
              >
                {isAddingDepartment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Department"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Modal */}
      <Dialog
        open={isEditModalOpen}
        onOpenChangeAction={(open) => {
          setIsEditModalOpen(open);
          if (!open) {
            setDepartmentToEdit(null);
            setEditDepartmentName("");
            setErrors({});
          }
        }}
      >
        <DialogContent className={`max-w-md p-6 ${dialogAnimationClass}`}>
          <DialogHeader className="pb-4">
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Update department name for{" "}
              {departmentToEdit?.department_name ?? "this department"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-2 mt-2">
            <div className="space-y-2">
              <Label htmlFor="editDepartmentName" className="text-sm font-medium">
                Department Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editDepartmentName"
                placeholder="Enter department name"
                value={editDepartmentName}
                onChange={(e) => {
                  setEditDepartmentName(e.target.value);
                  if (errors.department_name) {
                    setErrors((prev) => ({ ...prev, department_name: "" }));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleUpdateDepartment();
                  }
                }}
                autoFocus
              />
              {errors.department_name && (
                <p className="text-red-500 text-sm">{errors.department_name}</p>
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
                disabled={isUpdatingDepartment}
                className="cursor-pointer text-white bg-blue-600 hover:text-white hover:bg-blue-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Cancel
              </Button>
              <Button
                disabled={isUpdatingDepartment || !departmentToEdit}
                className={`bg-green-600 hover:bg-green-700 text-white flex items-center gap-2
    cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0
    ${isUpdatingDepartment ? "opacity-70 cursor-not-allowed hover:scale-100" : ""}
  `}
                onClick={async () => {
                  setIsUpdatingDepartment(true);
                  try {
                    await handleUpdateDepartment();
                  } finally {
                    setIsUpdatingDepartment(false);
                  }
                }}
              >
                {isUpdatingDepartment ? (
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
            setDepartmentToDelete(null);
          }
        }}
      >
        <DialogContent className={`max-w-md p-6 ${dialogAnimationClass}`}>
          <DialogHeader className="pb-4 bg-red-50 rounded-lg ">
            <DialogTitle className="text-red-800 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              Delete {departmentToDelete?.department_name} Department
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
                    <li>This department record</li>
                    <li>All users under this department</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm text-gray-700">
                <p className="font-medium">Department Details:</p>
                <div className="mt-2 space-y-1">
                  <p>
                    <span className="font-medium">Department Name:</span>{" "}
                    {departmentToDelete?.department_name}
                  </p>
                  <p>
                    <span className="font-medium">No. of employees:</span>{" "}
                    {(isNaN(Number(departmentToDelete?.employees_count)) ? 0 : Number(departmentToDelete?.employees_count)) +
                      (isNaN(Number(departmentToDelete?.managers_count)) ? 0 : Number(departmentToDelete?.managers_count))}
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
                  setDepartmentToDelete(null);
                }}
                className="text-white bg-red-600 hover:text-white hover:bg-red-700 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Cancel
              </Button>
              <Button
                disabled={isDeletingDepartment}
                className={`bg-blue-600 hover:bg-red-700 text-white cursor-pointer
    transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0
    ${
      isDeletingDepartment
        ? "opacity-70 cursor-not-allowed hover:scale-100"
        : ""
    }
  `}
                onClick={async () => {
                  if (!departmentToDelete) return;

                  // Proceed with deletion if no employees
                  setIsDeletingDepartment(true);

                  try {
                    await handleDeleteDepartment();
                  } finally {
                    setIsDeletingDepartment(false);
                  }
                }}
              >
                {isDeletingDepartment ? (
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

      {/* Alert Dialog for Departments with Employees */}
      <AlertDialog
        open={isAlertDialogOpen}
        onOpenChangeAction={(open) => {
          setIsAlertDialogOpen(open);
          if (!open) {
            setDepartmentWithEmployees(null);
          }
        }}
        title="Cannot Delete Department"
        description={`The department "${departmentWithEmployees?.department_name}" cannot be deleted because it has ${
          departmentWithEmployees
            ? getDepartmentHeadcounts(departmentWithEmployees).total
            : 0
        } employee(s) assigned to it. Please remove or reassign all employees before deleting this department.`}
        type="warning"
        confirmText="OK"
        showCancel={false}
        backgroundImage="/smct.png"
        size="md"
        logoSize="cover"
        logoOpacity={10}
        onConfirm={() => {
          setIsAlertDialogOpen(false);
          setDepartmentWithEmployees(null);
        }}
      />

      <DepartmentEmployeesModal
        open={isEmployeesModalOpen}
        onOpenChange={(open) => {
          setIsEmployeesModalOpen(open);
          if (!open) {
            setSelectedDepartmentForEmployees(null);
            setDepartmentEmployees([]);
          }
        }}
        selectedDepartment={selectedDepartmentForEmployees}
        employees={departmentEmployees}
        isLoading={isEmployeesLoading}
        dialogAnimationClass={dialogAnimationClass}
      />

      <DepartmentManagersModal
        open={isManagersModalOpen}
        onOpenChange={(open) => {
          setIsManagersModalOpen(open);
          if (!open) {
            setSelectedDepartmentForManagers(null);
            setDepartmentManagers([]);
          }
        }}
        selectedDepartment={selectedDepartmentForManagers}
        managers={departmentManagers}
        isLoading={isManagersLoading}
        dialogAnimationClass={dialogAnimationClass}
      />
    </div>
  );
}
