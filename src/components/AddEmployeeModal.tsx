import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import LoadingAnimation from "@/components/LoadingAnimation";
import { useDialogAnimation } from "@/hooks/useDialogAnimation";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { apiService } from "@/lib/apiService";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
interface User {
  employee_id: string;
  fname: string;
  lname: string;
  email: string;
  position_id: number;
  department_id?: number | string;
  branch_id: number;
  role_id: number;
  username: string;
  password: string;
  contact: string;
  date_hired?: string;
}

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newUser: User) => void;
  departments: any;
  branches: any;
  positions: any;
  roles: any;
  onBulkUploadClick?: () => void;
  onBulkUploadStart?: () => void;
  onBulkUploadSuccess?: () => void;
  onBulkUploadError?: () => void;
}

const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  departments,
  branches,
  positions,
  roles,
  onBulkUploadClick,
  onBulkUploadStart,
  onBulkUploadSuccess,
  onBulkUploadError,
}) => {
  const [formData, setFormData] = useState<User>({
    employee_id: "",
    fname: "",
    lname: "",
    email: "",
    position_id: 0,
    department_id: "",
    branch_id: 0,
    role_id: 0,
    username: "",
    password: "",
    contact: "",
    date_hired: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkFileError, setBulkFileError] = useState<string>("");
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(0);
  const [isBulkErrorDialogOpen, setIsBulkErrorDialogOpen] = useState(false);
  const [bulkErrorMessage, setBulkErrorMessage] = useState<string>("");
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const dialogAnimationClass = useDialogAnimation({ duration: 0.4 });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        employee_id: "",
        fname: "",
        lname: "",
        email: "",
        position_id: 0,
        department_id: "",
        branch_id: 0,
        role_id: 0,
        username: "",
        password: "",
        contact: "",
        date_hired: "",
      });
      setErrors({});
      setShowPassword(false);
      setIsBulkUploadOpen(false);
      setBulkFile(null);
      setBulkFileError("");
    }
  }, [isOpen]);

  const handleBulkUploadClick = () => {
    if (onBulkUploadClick) {
      onBulkUploadClick();
      return;
    }
    setIsBulkUploadOpen(true);
  };

  const validateBulkFile = (file: File | null) => {
    if (!file) {
      const message = "Please choose an Excel file to upload.";
      setBulkFileError(message);
      setBulkErrorMessage(message);
      setIsBulkErrorDialogOpen(true);
      return false;
    }

    const name = file.name.toLowerCase();
    const isExcel =
      name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");

    if (!isExcel) {
      const message = "Unsupported file type. Supported files: .xlsx, .xls, .csv";
      setBulkFileError(message);
      setBulkErrorMessage(message);
      setIsBulkErrorDialogOpen(true);
      return false;
    }

    setBulkFileError("");
    return true;
  };

  // Since upload progress from the backend isn't available here, simulate a smooth progress UI
  // while the upload request is in-flight.
  useEffect(() => {
    if (!isBulkUploading) return;

    setBulkUploadProgress(5);
    const start = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      // Ramp to ~90% quickly, then stop short until the request resolves.
      const simulated = Math.min(90, Math.round((elapsed / 1800) * 90));
      setBulkUploadProgress(simulated);
    }, 150);

    return () => window.clearInterval(interval);
  }, [isBulkUploading]);

  const submitBulkUpload = async () => {
    if (!validateBulkFile(bulkFile)) return;
    if (!bulkFile) return;

    onBulkUploadStart?.();
    if (onBulkUploadStart) {
      setIsBulkUploadOpen(false);
    }
    setIsBulkUploading(true);
    setBulkUploadProgress(5);

    try {
      // Give React a moment to paint the progress UI before heavy parsing starts.
      await new Promise((resolve) => setTimeout(resolve, 300));

      const arrayBuffer = await bulkFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
      });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("The selected file does not contain any sheets.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: "",
      });

      const normalizeKey = (key: string) =>
        String(key || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

      const getValue = (row: Record<string, any>, candidates: string[]) => {
        for (const candidate of candidates) {
          const value = row[candidate];
          if (value !== undefined && value !== null && String(value).trim() !== "") {
            return String(value).trim();
          }
        }
        return "";
      };

      const parsedUsers = rawRows
        .map((row, index) => {
          const normalizedRow: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            normalizedRow[normalizeKey(k)] = row[k];
          });

          const dateHiredItem = new Date(
            getValue(normalizedRow, [
              "date_hired",
              "datehired",
              "hired_date",
            ]),
          );

          const dateHired = String(dateHiredItem) !== "Invalid Date" ? dateHiredItem : "";

          return {
            employee_id: getValue(normalizedRow, ["employee_id", "employeeid", "id"]),
            fname: getValue(normalizedRow, ["fname", "first_name", "firstname"]),
            lname: getValue(normalizedRow, ["lname", "last_name", "lastname"]),
            email: getValue(normalizedRow, ["email", "email_address"]),
            position_id: getValue(normalizedRow, ["position_id", "positionid", "position"]),
            department_id: getValue(normalizedRow, ["department_id", "departmentid", "department"]),
            branch_id: getValue(normalizedRow, ["branch_id", "branchid", "branch"]),
            role_id: getValue(normalizedRow, ["role_id", "roleid", "role"]),
            username: getValue(normalizedRow, ["username", "user_name"]),
            password: getValue(normalizedRow, ["password"]),
            contact: getValue(normalizedRow, ["contact", "contact_number", "mobile", "phone"]),
            date_hired: dateHired,
          };
        })
        .filter((row) =>
          Object.values(row).some((value) => String(value || "").trim() !== "")
        );

      if (parsedUsers.length === 0) {
        throw new Error(
          "No valid rows were found. Please check your file headers and data."
        );
      }

      // Optional small pause so the UI doesn't feel "instant" under load.
      await new Promise((resolve) => setTimeout(resolve, 250));

      await apiService.bulkRegisterUser({
        users: parsedUsers,
      } as any);

      setIsBulkUploadOpen(false);
      setBulkFile(null);
      setBulkFileError("");
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
      onBulkUploadSuccess?.();
    } catch (err: any) {
      onBulkUploadError?.();
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "An unexpected server error occurred during upload. Please try again later.";
      setBulkErrorMessage(message);
      setIsBulkErrorDialogOpen(true);
      console.error(err)
    } finally {
      setIsBulkUploading(false);
      setBulkUploadProgress(100);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fname.trim()) {
      newErrors.fname = "First name is required";
    }
    if (!formData.lname.trim()) {
      newErrors.lname = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.position_id) {
      newErrors.position_id = "Position is required";
    }

    if (formData.branch_id === 126 && !formData.department_id) {
      newErrors.department_id = "Department is required";
    }

    if (!formData.branch_id) {
      newErrors.branch_id = "Branch is required";
    }

    if (!formData.role_id) {
      newErrors.role_id = "Role is required";
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username cannot be empty if provided";
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof User, value: string | boolean) => {
    if (formData.branch_id !== 126) {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
        department_id: "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleSave = async () => {
    if (validateForm()) {
      setIsSaving(true);
      try {
        await onSave(formData);
        onClose();
        setIsSaving(false);
      } catch (error: any) {
        setIsSaving(false); // Reset loading state on error
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

  const handleCancel = () => {
    setErrors({});
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChangeAction={onClose}>
        <DialogContent
          className={`max-w-3xl max-h-[90vh] overflow-hidden p-0 ${dialogAnimationClass}`}
          style={{
            backgroundImage: 'url(/smct.png)',
            backgroundSize: '85%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Faded overlay for better content readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-100/95 to-indigo-100/95 pointer-events-none"></div>

          {/* Content wrapper with relative positioning */}
          <div className="relative z-10 max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-xl font-semibold">
                Add New Employee
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Create a new employee account. All fields marked with * are
                required.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-2 ">
                <Label htmlFor="employee_id">Employee ID</Label>
                <Input
                  id="employee_id"
                  type="text"
                  placeholder="Enter employee ID"
                  value={formData.employee_id}
                  onChange={(e) =>
                    handleInputChange("employee_id", e.target.value)
                  }
                  className={errors?.employee_id ? "border-red-500" : "bg-white"}
                />
                {errors?.employee_id && (
                  <p className="text-sm text-red-500">{errors?.employee_id}</p>
                )}
              </div>
              {/* fName */}
              <div className="space-y-2">
                <Label htmlFor="fname">First Name *</Label>
                <Input
                  id="fname"
                  value={formData.fname}
                  onChange={(e) => handleInputChange("fname", e.target.value)}
                  className={errors.fname ? "border-red-500 " : "bg-white"}
                  placeholder="Enter first name"
                />
                {errors.fname && (
                  <p className="text-sm text-red-500">{errors.fname}</p>
                )}
              </div>

              {/* lName */}
              <div className="space-y-2">
                <Label htmlFor="lname">Last Name *</Label>
                <Input
                  id="lname"
                  value={formData.lname}
                  onChange={(e) => handleInputChange("lname", e.target.value)}
                  className={errors.lname ? "border-red-500 " : "bg-white"}
                  placeholder="Enter last name"
                />
                {errors.lname && (
                  <p className="text-sm text-red-500">{errors.lname}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={errors.email ? "border-red-500" : "bg-white"}
                  placeholder="Enter email address"
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username || ""}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  className={errors.username ? "border-red-500" : "bg-white"}
                  placeholder="Enter username"
                />
                {errors.username && (
                  <p className="text-sm text-red-500">{errors.username}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password || ""}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    className={
                      errors.password ? "border-red-500 pr-10" : "pr-10 bg-white"
                    }
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  >
                    {showPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
                <p className="text-xs text-gray-500">
                  Password must be at least 8 characters
                </p>
              </div>

              {/* Contact */}
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input
                  id="contact"
                  type="text"
                  value={formData.contact || ""}
                  onChange={(e) => handleInputChange("contact", e.target.value)}
                  className={errors.contact ? "border-red-500" : "bg-white"}
                  placeholder="Enter contact number"
                />
                {errors.contact && (
                  <p className="text-sm text-red-500">{errors.contact}</p>
                )}
              </div>

              {/* Date Hired */}
              <div className="space-y-2 w-1/2">
                <Label htmlFor="date_hired">Date Hired</Label>
                <Input
                  id="date_hired"
                  type="date"
                  value={formData.date_hired || ""}
                  onChange={(e) =>
                    handleInputChange("date_hired", e.target.value)
                  }
                  className={
                    errors.date_hired
                      ? "border-red-500 cursor-pointer"
                      : "bg-white cursor-pointer"
                  }
                />
                {errors.date_hired && (
                  <p className="text-sm text-red-500">{errors.date_hired}</p>
                )}
              </div>

              {/* Position */}
              <div className="space-y-2 w-1/2">
                <Label htmlFor="position_id">Position *</Label>
                <Combobox
                  options={positions}
                  value={formData.position_id}
                  onValueChangeAction={(value) =>
                    handleInputChange("position_id", value as string)
                  }
                  placeholder="Select position"
                  searchPlaceholder="Search positions..."
                  emptyText="No positions found."
                  className={errors.position_id ? "border-red-500" : "bg-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"}
                />
                {errors.position_id && (
                  <p className="text-sm text-red-500">{errors.position_id}</p>
                )}
              </div>

              {/* Branch */}
              <div className="space-y-2 w-1/2">
                <Label htmlFor="branch_id">Branch *</Label>
                <Combobox
                  options={branches}
                  value={formData.branch_id || ""}
                  onValueChangeAction={(value) =>
                    handleInputChange("branch_id", value as string)
                  }
                  placeholder="Select branch"
                  searchPlaceholder="Search branches..."
                  emptyText="No branches found."
                  className={errors.branch_id ? "border-red-500 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0" : "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"}
                />
                {errors.branch_id && (
                  <p className="text-sm text-red-500">{errors.branch_id}</p>
                )}
              </div>

              {/* Department - Show only if branch is HO, Head Office, or none */}
              {formData.branch_id === 126 && (
                <div className="space-y-2 w-1/2">
                  <Label htmlFor="department">Department *</Label>
                  <Combobox
                    options={departments}
                    value={String(formData.department_id)}
                    onValueChangeAction={(value) =>
                      handleInputChange("department_id", value as string)
                    }
                    placeholder="Select department"
                    searchPlaceholder="Search departments..."
                    emptyText="No departments found."
                    className={
                      errors.department_id ? "border-red-500" : "bg-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
                    }
                  />
                  {errors.department_id && (
                    <p className="text-sm text-red-500">{errors.department_id}</p>
                  )}
                </div>
              )}

              {/* Role */}
              <div className="space-y-2 w-1/2">
                <Label htmlFor="role_id">Role *</Label>
                <Select
                  onValueChange={(value) => handleInputChange("role_id", value)}
                >
                  <SelectTrigger className="w-48 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role: any) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role_id && (
                  <p className="text-sm text-red-500">{errors.role_id}</p>
                )}
              </div>
            </div>

            <DialogFooter className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
              {/* Primary actions */}
              <div className="flex flex-wrap justify-end gap-3 w-full md:w-auto">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="px-6 bg-red-600 hover:bg-red-700 text-white hover:text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBulkUploadClick}
                  className="px-4 bg-blue-600 text-white hover:bg-blue-700 hover:text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                  disabled={isSaving}
                >
                  Upload User
                </Button>
                <Button
                  onClick={handleSave}
                  className={`bg-green-600 hover:bg-green-700 text-white px-6 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${isSaving ? "opacity-70 cursor-not-allowed hover:translate-y-0 hover:shadow-none" : ""}`}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="flex items-center space-x-2">
                      <LoadingAnimation size="sm" variant="spinner" color="green" />
                      <span>Adding...</span>
                    </div>
                  ) : (
                    "Add Employee"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal (UI only; backend route can be added later) */}
      <Dialog
        open={isBulkUploadOpen}
        onOpenChangeAction={(open) => {
          setIsBulkUploadOpen(open);
          if (!open) {
            setBulkFile(null);
            setBulkFileError("");
          }
        }}
      >
        <DialogContent className={`max-w-xl p-0 overflow-hidden ${dialogAnimationClass}`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-6 py-5 text-white">
            <DialogHeader>
              <div className="flex items-start gap-4">
                <div className="bg-white/15 p-3 rounded-xl">
                  <FileSpreadsheet className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl">Bulk Upload Accounts</DialogTitle>
                  <DialogDescription className="text-blue-100">
                    Upload an Excel/CSV file to create multiple employee accounts.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="rounded-lg border border-blue-200 bg-white/80 p-4">
              <p className="text-sm font-semibold text-gray-900">Before you upload</p>
              <ul className="mt-2 text-sm text-gray-700 space-y-1">
                <li>1) Prepare your file using the required columns.</li>
                <li>2) Choose the file below.</li>
                <li>3) Click <span className="font-bold">Continue</span>.</li>
              </ul>
              <p className="mt-2 text-xs text-gray-500">
                Supported formats: <span className="font-medium">.xlsx</span>, <span className="font-medium">.xls</span>, <span className="font-medium">.csv</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk_upload_file">Upload file</Label>

              {/* Hidden input + styled picker */}
              <Input
                ref={bulkFileInputRef}
                id="bulk_upload_file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setBulkFile(file);
                  validateBulkFile(file);
                }}
              />

              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                className={`w-full cursor-pointer rounded-xl border-2 border-dashed p-5 text-left transition-all
                  ${bulkFileError ? "border-red-400 bg-red-50" : "border-blue-300 bg-white hover:bg-blue-50/50"}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`${bulkFileError ? "bg-red-100" : "bg-blue-100"} p-2 rounded-lg`}>
                    <Upload className={`${bulkFileError ? "text-red-600" : "text-blue-700"} h-5 w-5`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {bulkFile ? "Change file" : "Choose a file to upload"}
                    </p>
                    <p className="text-xs text-gray-600">
                      {bulkFile ? "Click to select a different file" : "Click to browse (.xlsx, .xls, .csv)"}
                    </p>
                  </div>
                </div>
              </button>

              {bulkFileError && <p className="text-sm text-red-600">{bulkFileError}</p>}

              {bulkFile && !bulkFileError && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-white px-3 py-2">
                  <p className="text-sm text-gray-800 truncate">
                    Selected: <span className="font-medium">{bulkFile.name}</span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-blue-50"
                    onClick={() => {
                      setBulkFile(null);
                      setBulkFileError("");
                      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4 text-gray-600" />
                  </Button>
                </div>
              )}

              {isBulkUploading && (
                <div className="pt-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>Uploading & processing...</span>
                    <span className="font-medium text-gray-800">
                      {bulkUploadProgress}%
                    </span>
                  </div>
                  <Progress value={bulkUploadProgress} />
                  <p className="mt-2 text-xs text-gray-500">
                    This can take a few moments depending on file size.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkUploadOpen(false)}
              className="px-6 cursor-pointer bg-red-600 hover:bg-red-700 text-white hover:text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              disabled={isSaving || isBulkUploading}
            >
              Close
            </Button>
            <Button
              type="button"
              className="px-6 bg-blue-600 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 hover:bg-blue-700 text-white"
              onClick={() => {
                submitBulkUpload();
              }}
              disabled={isSaving || isBulkUploading || !bulkFile || !!bulkFileError}
            >
              {isBulkUploading ? "Uploading..." : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading Modal Overlay */}
      {isSaving && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl max-w-sm w-full mx-4">
            <div className="flex flex-col items-center space-y-4">
              <LoadingAnimation
                size="lg"
                variant="spinner"
                color="green"
                showText={true}
                text="Adding employee..."
              />
              <p className="text-sm text-gray-600 text-center">
                Please wait while we add the new employee. This may take a few
                moments.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Error Dialog with GIF */}
      <Dialog open={isBulkErrorDialogOpen} onOpenChangeAction={setIsBulkErrorDialogOpen}>
        <DialogContent className={`max-w-md ${dialogAnimationClass}`}>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-red-600">
              Upload Failed
            </DialogTitle>
            <DialogDescription>
              Something went wrong with the upload.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            {/* Replace src with your own GIF path */}
            <img
              src="/error2.gif"
              alt="Upload error"
              className="max-h-40 w-auto object-contain rounded-md"
            />
            <p className="text-sm text-gray-700 text-center">
              {bulkErrorMessage}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="px-6 bg-red-600 hover:bg-red-700 text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              onClick={() => setIsBulkErrorDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddEmployeeModal;
