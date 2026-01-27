"use client";

import React from "react";
import ViewResultsModalBranchRankNfile from "./ViewResultsModalBranchRankNfile";
import ViewResultsModalBranchManager from "./ViewResultsModalBranchManager";
import ViewResultsModalDefault from "./ViewResultsModalDefault";
import ViewResultsModalBasic from "./ViewResultsModalBasic";

export type Submission = {
  id: number;
  employee: any;
  evaluator: any;
  category?: string;
  rating?: number;
  status: string;
  coverageFrom: string;
  coverageTo: string;
  reviewTypeProbationary: number;
  reviewTypeRegular: string;
  reviewTypeOthersImprovement: boolean | number;
  reviewTypeOthersCustom: string;
  priorityArea1: string;
  priorityArea2: string;
  priorityArea3: string;
  remarks: string;
  overallComments: string;
  evaluatorApprovedAt: string;
  employeeApprovedAt: string;
  created_at: string;

  //relations
  job_knowledge: any;
  adaptability: any;
  quality_of_works: any;
  teamworks: any;
  reliabilities: any;
  ethicals: any;
  customer_services: any;
  managerial_skills?: any;
};

export interface ApprovalData {
  id: string;
  approvedAt: string;
  employeeSignature: string;
  employeeName: string;
  employeeEmail: string;
}

export interface ViewResultsModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  submission: Submission | null;
  onApprove?: (submissionId: number) => void;
  isApproved?: boolean;
  approvalData?: ApprovalData | null;
  currentUserName?: string;
  currentUserSignature?: string;
  showApprovalButton?: boolean;
}

// Helper function to check if employee is branch (not HO)
const isEmployeeBranch = (submission: Submission | null): boolean => {
  if (!submission?.employee) return false;
  
  // Handle branches as array
  if (Array.isArray(submission.employee.branches)) {
    const branch = submission.employee.branches[0];
    if (branch) {
      const branchName = branch.branch_name?.toUpperCase() || "";
      const branchCode = branch.branch_code?.toUpperCase() || "";
      const isHO = (
        branchName === "HO" || 
        branchCode === "HO" || 
        branchName.includes("HEAD OFFICE") ||
        branchCode.includes("HEAD OFFICE") ||
        branchName === "HEAD OFFICE" ||
        branchCode === "HEAD OFFICE"
      );
      return !isHO;
    }
  }
  
  // Handle branches as object
  if (typeof submission.employee.branches === 'object') {
    const branchName = (submission.employee.branches as any)?.branch_name?.toUpperCase() || "";
    const branchCode = (submission.employee.branches as any)?.branch_code?.toUpperCase() || "";
    const isHO = (
      branchName === "HO" || 
      branchCode === "HO" || 
      branchName.includes("HEAD OFFICE") ||
      branchCode.includes("HEAD OFFICE") ||
      branchName === "HEAD OFFICE" ||
      branchCode === "HEAD OFFICE"
    );
    return !isHO;
  }
  
  // Fallback: check if branch field exists directly
  if ((submission.employee as any).branch) {
    const branchName = String((submission.employee as any).branch).toUpperCase();
    const isHO = (
      branchName === "HO" || 
      branchName === "HEAD OFFICE" ||
      branchName.includes("HEAD OFFICE") ||
      branchName.includes("/HO")
    );
    return !isHO;
  }
  
  return false;
};

// Helper function to check if evaluator is Area Manager
const isEvaluatorAreaManager = (submission: Submission | null): boolean => {
  if (!submission?.evaluator?.positions) return false;
  
  const positionName = (
    submission.evaluator.positions?.label || 
    submission.evaluator.positions?.name || 
    submission.evaluator.position ||
    ""
  ).toLowerCase().trim();
  
  return (
    positionName === "area manager" ||
    positionName.includes("area manager")
  );
};

// Helper function to check if evaluator is Branch Manager or Supervisor
const isEvaluatorBranchManagerOrSupervisor = (submission: Submission | null): boolean => {
  if (!submission?.evaluator?.positions) return false;
  
  const position = submission.evaluator.positions;
  const positionLabel = typeof position === 'string' 
    ? position.toUpperCase() 
    : (position as any)?.label?.toUpperCase() || '';
    
  return (
    positionLabel === 'BRANCH MANAGER' || 
    positionLabel.includes('BRANCH MANAGER') ||
    positionLabel === 'BRANCH SUPERVISOR' || 
    positionLabel.includes('BRANCH SUPERVISOR')
  );
};

// Determine evaluation type and route to appropriate component
export default function ViewResultsModalRouter({
  isOpen,
  onCloseAction,
  submission,
  onApprove,
  isApproved = false,
  approvalData = null,
  currentUserName,
  currentUserSignature,
  showApprovalButton = false,
}: ViewResultsModalProps) {
  if (!submission) return null;

  const isBranchEmp = isEmployeeBranch(submission);
  const isAreaMgr = isEvaluatorAreaManager(submission);
  const isBranchMgrOrSup = isEvaluatorBranchManagerOrSupervisor(submission);

  // Determine evaluation type based on submission data
  const hasCustomerService = submission.customer_services && 
    Array.isArray(submission.customer_services) && 
    submission.customer_services.length > 0;
  const hasManagerialSkills = submission.managerial_skills && 
    Array.isArray(submission.managerial_skills) && 
    submission.managerial_skills.length > 0;
  
  let evaluationType: 'rankNfile' | 'basic' | 'default' = 'default';
  
  // If evaluator is Area Manager, always treat as branch evaluation (default)
  if (isAreaMgr) {
    evaluationType = 'default'; // Area Managers use branch evaluation format
  } else if (!hasCustomerService && hasManagerialSkills) {
    evaluationType = 'basic'; // Basic HO - has Managerial Skills, no Customer Service
  } else if (!hasCustomerService && !hasManagerialSkills) {
    evaluationType = 'rankNfile'; // RankNfile HO - no Customer Service, no Managerial Skills
  } else {
    evaluationType = 'default'; // Default - has Customer Service
  }

  // Route to appropriate component
  // BranchRankNfile: branch employee + rankNfile type
  if (isBranchEmp && evaluationType === 'rankNfile') {
    return (
      <ViewResultsModalBranchRankNfile
        isOpen={isOpen}
        onCloseAction={onCloseAction}
        submission={submission}
        onApprove={onApprove}
        isApproved={isApproved}
        approvalData={approvalData}
        currentUserName={currentUserName}
        currentUserSignature={currentUserSignature}
        showApprovalButton={showApprovalButton}
      />
    );
  }

  // Branch Manager/Supervisor: branch employee + (default or basic) + evaluator is Branch Manager/Supervisor
  if (isBranchEmp && isBranchMgrOrSup && (evaluationType === 'default' || evaluationType === 'basic')) {
    return (
      <ViewResultsModalBranchManager
        isOpen={isOpen}
        onCloseAction={onCloseAction}
        submission={submission}
        onApprove={onApprove}
        isApproved={isApproved}
        approvalData={approvalData}
        currentUserName={currentUserName}
        currentUserSignature={currentUserSignature}
        showApprovalButton={showApprovalButton}
      />
    );
  }

  // Basic HO: has Managerial Skills, no Customer Service, not branch
  if (evaluationType === 'basic') {
    return (
      <ViewResultsModalBasic
        isOpen={isOpen}
        onCloseAction={onCloseAction}
        submission={submission}
        onApprove={onApprove}
        isApproved={isApproved}
        approvalData={approvalData}
        currentUserName={currentUserName}
        currentUserSignature={currentUserSignature}
        showApprovalButton={showApprovalButton}
      />
    );
  }

  // Default: everything else (Area Manager evaluations, branch default, etc.)
  return (
    <ViewResultsModalDefault
      isOpen={isOpen}
      onCloseAction={onCloseAction}
      submission={submission}
      onApprove={onApprove}
      isApproved={isApproved}
      approvalData={approvalData}
      currentUserName={currentUserName}
      currentUserSignature={currentUserSignature}
      showApprovalButton={showApprovalButton}
    />
  );
}

