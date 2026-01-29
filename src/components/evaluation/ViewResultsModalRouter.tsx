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
  evaluationType?: string; // API evaluation type (e.g., "BranchRankNFile", "HoRankNFile", "BranchBasic", "HoBasic")

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

// Helper function to check if employee is HO (Head Office)
const isEmployeeHO = (submission: Submission | null): boolean => {
  if (!submission?.employee) return false;
  
  // Handle branches as array
  if (Array.isArray(submission.employee.branches)) {
    const branch = submission.employee.branches[0];
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
  if (typeof submission.employee.branches === 'object') {
    const branchName = (submission.employee.branches as any)?.branch_name?.toUpperCase() || "";
    const branchCode = (submission.employee.branches as any)?.branch_code?.toUpperCase() || "";
    return (
      branchName === "HO" || 
      branchCode === "HO" || 
      branchName.includes("HEAD OFFICE") ||
      branchCode.includes("HEAD OFFICE") ||
      branchName === "HEAD OFFICE" ||
      branchCode === "HEAD OFFICE"
    );
  }
  
  // Fallback: check if branch field exists directly
  if ((submission.employee as any).branch) {
    const branchName = String((submission.employee as any).branch).toUpperCase();
    return (
      branchName === "HO" || 
      branchName === "HEAD OFFICE" ||
      branchName.includes("HEAD OFFICE") ||
      branchName.includes("/HO")
    );
  }
  
  return false;
};

// Helper function to check if employee is branch (not HO)
const isEmployeeBranch = (submission: Submission | null): boolean => {
  return !isEmployeeHO(submission);
};

// Helper function to check if employee is Area Manager
const isEmployeeAreaManager = (submission: Submission | null): boolean => {
  if (!submission?.employee?.positions) return false;
  
  const positionName = (
    submission.employee.positions?.label || 
    submission.employee.positions?.name || 
    submission.employee.position ||
    ""
  ).toUpperCase().trim();
  
  return (
    positionName === 'AREA MANAGER' ||
    positionName.includes('AREA MANAGER')
  );
};

// Helper function to check if employee is a Manager or Supervisor (any manager position in branch)
const isEmployeeBranchManagerOrSupervisor = (submission: Submission | null): boolean => {
  if (!submission?.employee?.positions) return false;
  
  const position = submission.employee.positions;
  const positionLabel = typeof position === 'string' 
    ? position.toUpperCase() 
    : (position as any)?.label?.toUpperCase() || '';
  
  // Check for any manager position (excluding Area Manager which is handled separately)
  const isManager = positionLabel.includes('MANAGER') && !positionLabel.includes('AREA MANAGER');
  const isSupervisor = positionLabel.includes('SUPERVISOR');
  
  return isManager || isSupervisor;
};

// Helper function to normalize evaluationType from API
const normalizeEvaluationType = (evaluationType?: string): string | null => {
  if (!evaluationType) return null;
  return evaluationType.trim();
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

  // Get evaluationType from API response (primary routing method)
  const apiEvaluationType = normalizeEvaluationType(submission.evaluationType);

  // Check employee's branch and position (not evaluator)
  const isHOEmp = isEmployeeHO(submission);
  const isBranchEmp = isEmployeeBranch(submission);
  const isEmployeeAreaMgr = isEmployeeAreaManager(submission);
  const isEmployeeBranchMgrOrSup = isEmployeeBranchManagerOrSupervisor(submission);

  // Fallback: Determine evaluation type based on submission data (if evaluationType not available)
  const hasCustomerService = submission.customer_services && 
    Array.isArray(submission.customer_services) && 
    submission.customer_services.length > 0;
  const hasManagerialSkills = submission.managerial_skills && 
    Array.isArray(submission.managerial_skills) && 
    submission.managerial_skills.length > 0;

  // Route to appropriate component based on evaluationType from API
  // Priority 1: Area Managers (from HO or branch) - route to BranchManager view
  // Area Managers have both Customer Service AND Managerial Skills, so they need the BranchManager view
  if (isEmployeeAreaMgr) {
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

  // Priority 2: Branch Manager/Supervisor (any manager position, excluding Area Manager) - route to BranchManager view
  // This takes priority over evaluation type to ensure managers always get the manager view
  if (isBranchEmp && isEmployeeBranchMgrOrSup) {
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

  // Priority 3: Route based on evaluationType from API response
  if (apiEvaluationType) {
    const evalTypeUpper = apiEvaluationType.toUpperCase();
    
    // BranchRankNFile → ViewResultsModalBranchRankNfile
    if (evalTypeUpper === "BRANCHRANKNFILE" || evalTypeUpper.includes("BRANCHRANKNFILE")) {
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
    
    // HoBasic or Basic HO → ViewResultsModalBasic
    if (evalTypeUpper === "HOBASIC" || evalTypeUpper.includes("HOBASIC") || (evalTypeUpper.includes("BASIC") && isHOEmp)) {
      // Only route to Basic if it's HO
      if (isHOEmp) {
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
    }
    
    // HoRankNFile or RankNFile HO → ViewResultsModalDefault (HO rankNfile)
    if (evalTypeUpper === "HORANKNFILE" || evalTypeUpper.includes("HORANKNFILE")) {
      if (isHOEmp) {
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
    }
    
    // BranchBasic → ViewResultsModalBranchManager (branch manager evaluations)
    if (evalTypeUpper === "BRANCHBASIC" || evalTypeUpper.includes("BRANCHBASIC")) {
      if (isBranchEmp) {
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
    }
    
    // BranchDefault → ViewResultsModalBranchRankNfile (branch rank and file evaluations)
    if (evalTypeUpper === "BRANCHDEFAULT" || evalTypeUpper.includes("BRANCHDEFAULT")) {
      if (isBranchEmp) {
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
    }
  }

  // Fallback Priority 4: HO Employees (if evaluationType not available)
  // If HO employee has Managerial Skills → Basic HO → ViewResultsModalBasic
  // If HO employee has NO Managerial Skills → RankNfile HO → ViewResultsModalDefault
  if (isHOEmp) {
    if (hasManagerialSkills) {
      // Basic HO - has Managerial Skills, no Customer Service
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
    } else {
      // RankNfile HO - no Managerial Skills, no Customer Service
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
  }

  // Fallback Priority 5: Branch evaluations (if evaluationType not available)
  // Branch employees with Customer Service → BranchDefault → ViewResultsModalBranchRankNfile
  // Branch employees with Managerial Skills → BranchBasic → ViewResultsModalBranchManager
  if (isBranchEmp) {
    if (hasManagerialSkills) {
      // BranchBasic - has Managerial Skills (branch manager)
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
    } else if (hasCustomerService) {
      // BranchDefault - has Customer Service (branch rank and file)
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
    } else {
      // BranchRankNfile - no Customer Service, no Managerial Skills
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
  }

  // Default fallback: Should only be reached for HO evaluations without evaluationType
  // This is a safety fallback
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

