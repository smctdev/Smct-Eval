"use client";

import EvaluationForm from "./index";
import BranchRankNfileEvaluationForm from "./BranchRankNfileEvaluationForm";
import BranchManagerEvaluationForm from "./BranchManagerEvaluationForm";
import { User, useAuth } from "../../contexts/UserContext";

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

// Helper function to check if user is HO (Head Office)
const isEvaluatorHO = (user: User | null | undefined): boolean => {
  if (!user?.branches) return false;
  
  // Handle branches as array
  if (Array.isArray(user.branches)) {
    const branch = user.branches[0];
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
  if (typeof user.branches === 'object') {
    const branchName = (user.branches as any)?.branch_name?.toUpperCase() || "";
    const branchCode = (user.branches as any)?.branch_code?.toUpperCase() || "";
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

// Helper function to check if user is Branch Manager or Supervisor
const isEvaluatorBranchManagerOrSupervisor = (user: User | null | undefined): boolean => {
  if (!user?.positions) return false;
  
  const positionLabel = (
    user.positions?.label || 
    user.positions?.name || 
    (user as any).position ||
    ""
  ).toUpperCase().trim();
  
  return (
    positionLabel.includes('BRANCH MANAGER') ||
    positionLabel.includes('BRANCH SUPERVISOR')
  );
};

// Helper function to check if employee is Branch Manager or Supervisor
const isEmployeeBranchManagerOrSupervisor = (employee: User | null | undefined): boolean => {
  if (!employee?.positions) return false;
  
  const positionLabel = (
    employee.positions?.label || 
    employee.positions?.name || 
    (employee as any).position ||
    ""
  ).toUpperCase().trim();
  
  return (
    positionLabel.includes('BRANCH MANAGER') ||
    positionLabel.includes('BRANCH SUPERVISOR')
  );
};

export default function BranchEvaluationForm({
  branch,
  employee,
  onCloseAction,
  onCancelAction,
  evaluationType = 'default',
}: BranchEvaluationFormProps) {
  const { user } = useAuth();
  
  // Route to dedicated BranchRankNfileEvaluationForm for rankNfile evaluations
  // This provides cleaner, more maintainable code with specific validation logic
  if (evaluationType === 'rankNfile') {
    return (
      <BranchRankNfileEvaluationForm
        employee={employee}
        onCloseAction={onCloseAction}
        onCancelAction={onCancelAction}
      />
    );
  }

  // Route to BranchManagerEvaluationForm if:
  // - Evaluator is Branch Manager/Supervisor (not HO)
  // - Employee being evaluated is also Branch Manager/Supervisor
  const isHO = isEvaluatorHO(user);
  const isEvaluatorBranchMgrOrSup = isEvaluatorBranchManagerOrSupervisor(user);
  const isEmployeeBranchMgrOrSup = isEmployeeBranchManagerOrSupervisor(employee);
  
  if (!isHO && isEvaluatorBranchMgrOrSup && isEmployeeBranchMgrOrSup) {
    return (
      <BranchManagerEvaluationForm
        employee={employee}
        onCloseAction={onCloseAction}
        onCancelAction={onCancelAction}
        evaluationType={evaluationType}
      />
    );
  }

  // For other evaluation types, use the main EvaluationForm
  return (
    <EvaluationForm
      employee={employee}
      onCloseAction={onCloseAction}
      onCancelAction={onCancelAction}
      evaluationType={evaluationType}
    />
  );
}

