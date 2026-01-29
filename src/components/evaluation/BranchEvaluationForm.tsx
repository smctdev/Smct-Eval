"use client";

import BranchRankNfileEvaluationForm from "./BranchRankNfileEvaluationForm";
import BranchManagerEvaluationForm from "./BranchManagerEvaluationForm";
import { User } from "../../contexts/UserContext";

interface BranchEvaluationFormProps {
  branch?: {
    id: number;
    name: string;
    branchCode?: string;
    location?: string;
  } | null;
  employee?: User | null;
  onCloseAction?: () => void;
  onCancelAction?: () => void;
  evaluationType?: 'rankNfile' | 'basic' | 'default';
}

// Helper function to check if employee is HO (Head Office)
const isEmployeeHO = (employee: User | null | undefined): boolean => {
  if (!employee?.branches) return false;
  
  // Handle branches as array
  if (Array.isArray(employee.branches)) {
    const branch = employee.branches[0];
    if (branch) {
      const branchName = branch.branch_name?.toUpperCase() || "";
      const branchCode = branch.branch_code?.toUpperCase() || "";
      return (
        branchName === "HO" || 
        branchCode === "HO" || 
        branchName.includes("HEAD OFFICE") ||
        branchCode.includes("HEAD OFFICE") ||
        branchName === "HEAD OFFICE" ||
        branchCode === "HEAD OFFICE"
      );
    }
  }
  
  // Handle branches as object
  if (typeof employee.branches === 'object') {
    const branchName = (employee.branches as any)?.branch_name?.toUpperCase() || "";
    const branchCode = (employee.branches as any)?.branch_code?.toUpperCase() || "";
    return (
      branchName === "HO" || 
      branchCode === "HO" || 
      branchName.includes("HEAD OFFICE") ||
      branchCode.includes("HEAD OFFICE") ||
      branchName === "HEAD OFFICE" ||
      branchCode === "HEAD OFFICE"
    );
  }
  
  return false;
};

export default function BranchEvaluationForm({
  branch,
  employee,
  onCloseAction,
  onCancelAction,
  evaluationType = 'default',
}: BranchEvaluationFormProps) {
  // Check if employee is Branch (not HO)
  const isBranch = !isEmployeeHO(employee);
  
  // If employee is HO, this component shouldn't be used (HO forms are handled separately)
  if (!isBranch) {
    console.warn("BranchEvaluationForm: Employee is HO, should use HO-specific forms");
    return null;
  }
  
  // For Branch employees, route based on evaluationType:
  // - rankNfile → BranchRankNfileEvaluationForm (branch employees)
  // - default or basic → BranchManagerEvaluationForm (branch managers)
  if (evaluationType === 'rankNfile') {
    return (
      <BranchRankNfileEvaluationForm
        employee={employee}
        onCloseAction={onCloseAction}
        onCancelAction={onCancelAction}
      />
    );
  }
  
  // For default or basic evaluation types, use BranchManagerEvaluationForm
  return (
    <BranchManagerEvaluationForm
      employee={employee}
      onCloseAction={onCloseAction}
      onCancelAction={onCancelAction}
      evaluationType={evaluationType}
    />
  );
}

