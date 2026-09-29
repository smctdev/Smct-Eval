"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import WelcomeStep from "./WelcomeStep";
import { EvaluationPayload, EvaluationStepConfig } from "./types";
import { apiService } from "@/lib/apiService";
import { User, useAuth } from "../../contexts/UserContext";
import { branchEvaluationSteps, branchRankNfileSteps } from "./configs";
import { isEmployeeHeadOffice } from "./employeeBranchLabel";
import { useBranchesForEvaluation } from "@/hooks/useBranchesForEvaluation";
import {
  EvaluationFormSessionProps,
  useApplyInitialFormData,
} from "./evaluationFormEdit";
import { submitEvaluationForm } from "@/lib/evaluationEditSubmit";
import { isEditSession } from "@/lib/evaluationEditTypes";
import { toastMessages } from "@/lib/toastMessages";
import { getEvaluationApiErrorMessage } from "@/components/evaluation/evaluationRecordsShared";
import EvaluationStepNavigation from "./EvaluationStepNavigation";
import EvaluationCancelDraftDialog from "./EvaluationCancelDraftDialog";
import { useEvaluationDraftOnNext } from "@/hooks/useEvaluationDraftOnNext";
import { buildEvaluationSavePayload } from "@/lib/evaluationDraftSave";
import { toDateInputValue } from "@/lib/dateInputValue";

// Default steps use branch evaluation configuration
const defaultSteps: EvaluationStepConfig[] = branchEvaluationSteps;

interface EvaluationFormProps extends EvaluationFormSessionProps {
  employee?: User | null;
  onCloseAction?: () => void;
  onCancelAction?: () => void;
  steps?: EvaluationStepConfig[]; // Optional: custom step configuration
  evaluationType?: 'rankNfile' | 'basic' | 'default'; // Optional: evaluation type
}

export default function EvaluationForm({
  employee,
  onCloseAction,
  onCancelAction,
  editSession,
  steps: customSteps,
  evaluationType = 'default',
}: EvaluationFormProps) {
  const isEditMode = isEditSession(editSession);
  const [currentStep, setCurrentStep] = useState(() => (isEditMode ? 1 : 0)); // 0 = welcome step, 1-N = actual steps
  const [welcomeAnimationKey, setWelcomeAnimationKey] = useState(0);
  const { user } = useAuth();
  const { branchOptions, isLoading: branchListLoading } =
    useBranchesForEvaluation();
  
  // Check if employee being evaluated is HO (Head Office)
  // This determines the evaluationType based on the employee being evaluated, not the evaluator
  const isEmployeeHO = () => {
    if (!employee) return false;

    const isHoBranchObj = (branchObj: unknown): boolean => {
      if (!branchObj || typeof branchObj !== "object") return false;
      const b = branchObj as any;
      const branchName = String(b.branch_name ?? b.name ?? "").toUpperCase().trim();
      const branchCode = String(b.branch_code ?? b.code ?? b.acronym ?? "")
        .toUpperCase()
        .trim();

      return (
        branchName === "HO" ||
        branchCode === "HO" ||
        branchCode === "126" ||
        branchName === "HEAD OFFICE" ||
        branchCode === "HEAD OFFICE" ||
        branchName.includes("HEAD OFFICE") ||
        branchCode.includes("HEAD OFFICE")
      );
    };

    // 1) Prefer direct `employee.branch` object/value
    const branchVal = (employee as any).branch;
    if (branchVal !== undefined && branchVal !== null && branchVal !== "") {
      if (isHoBranchObj(branchVal)) return true;
      const s = String(branchVal).toUpperCase().trim();
      return s === "HO" || s === "126" || s === "HEAD OFFICE" || s.includes("HEAD OFFICE");
    }

    // 2) If `employee.branches` exists, scan it for an HO entry
    const branchesVal = (employee as any).branches;
    if (Array.isArray(branchesVal)) {
      return branchesVal.some((b) => isHoBranchObj(b));
    }
    if (branchesVal && typeof branchesVal === "object") {
      return isHoBranchObj(branchesVal);
    }

    // 3) Legacy: `branch_id` / `branchId`
    const branchIdOrValue = (employee as any).branch_id ?? (employee as any).branchId;
    if (branchIdOrValue !== undefined && branchIdOrValue !== null && branchIdOrValue !== "") {
      const s = String(branchIdOrValue).toUpperCase().trim();
      return s === "HO" || s === "126" || s === "HEAD OFFICE" || s.includes("HEAD OFFICE");
    }

    return false;
  };

  // Check if employee is Area Manager
  const isEmployeeAreaManager = () => {
    if (!employee?.positions) return false;
    
    // Get position name from various possible fields
    const positionName = (
      employee.positions?.label || 
      employee.positions?.name || 
      (employee as any).position ||
      ""
    ).toUpperCase().trim();
    
    // Check if position is Area Manager
    return (
      positionName === "AREA MANAGER" ||
      positionName.includes("AREA MANAGER")
    );
  };

  const isHO = isEmployeeHO();
  const isAreaMgr = isEmployeeAreaManager();
  
  // Determine base steps based on employee's branch and evaluation type
  // - If employee is HO: evaluationType is for HO (rankNfile or basic) - no Customer Service
  // - If employee is NOT HO: evaluationType is for Branch (default) - with Customer Service
  // - Branch rankNfile: use branchRankNfileSteps (Step2 with only "Job Targets", Customer Service, NO Managerial Skills)
  const baseSteps = (() => {
    // Branch rankNfile evaluations use branchRankNfileSteps (Step2 with only "Job Targets", Customer Service, NO Managerial Skills)
    if (!isHO && evaluationType === 'rankNfile') {
      return branchRankNfileSteps;
    }
    
    // Use custom steps if provided, otherwise default steps
    return customSteps || defaultSteps;
  })();
  
  // Filter steps based on employee's branch and evaluation type
  // - If employee is HO: remove Step 7 (Customer Service) - HO evaluations don't have Customer Service
  // - If employee is NOT HO: keep Step 7 (Customer Service) - Branch evaluations have Customer Service
  // - Area Managers from HO still use branch evaluation steps (with Customer Service)
  const filteredSteps = (() => {
    // Area Managers from HO should use branch evaluation steps (includes Step 7)
    if (isHO && isAreaMgr) {
      return baseSteps; // Use branch evaluation steps, includes Step 7
    }
    
    // For other cases with custom steps, use them as-is
    if (customSteps) {
      return customSteps;
    }
    
    // Default behavior: 
    // - If employee is HO (and not Area Manager): remove Step 7 (Customer Service) - HO evaluations
    // - If employee is NOT HO: keep Step 7 (Customer Service) - Branch evaluations
    return isHO ? baseSteps.filter(step => step.id !== 7) : baseSteps;
  })();
  
  // Helper to get step by ID
  const getStepById = (id: number) => filteredSteps.find(step => step.id === id);
  
  // Helper to get step index by ID
  const getStepIndexById = (id: number) => filteredSteps.findIndex(step => step.id === id);
  
  // Helper to get current step ID from current step index
  const getCurrentStepId = () => {
    if (currentStep === 0) return 0;
    const stepIndex = currentStep - 1;
    return filteredSteps[stepIndex]?.id || currentStep;
  };
  
  const [form, setForm] = useState<EvaluationPayload>({
    hireDate: "",
    rating: 0,
    coverageFrom: "",
    coverageTo: "",
    reviewTypeProbationary: "",
    reviewTypeRegular: "",
    reviewTypeOthersImprovement: false,
    reviewTypeOthersCustom: "",
    priorityArea1: "",
    priorityArea2: "",
    priorityArea3: "",
    remarks: "",
    jobKnowledgeScore1: 0,
    jobKnowledgeScore2: 0,
    jobKnowledgeScore3: 0,
    jobKnowledgeComments1: "",
    jobKnowledgeComments2: "",
    jobKnowledgeComments3: "",
    qualityOfWorkScore1: 0,
    qualityOfWorkScore2: 0,
    qualityOfWorkScore3: 0,
    qualityOfWorkScore4: 0,
    qualityOfWorkScore5: 0,
    qualityOfWorkScore6: 0, // Branch Manager only
    qualityOfWorkScore7: 0, // Branch Manager only
    qualityOfWorkScore8: 0, // Branch Manager only
    qualityOfWorkScore9: 0, // Branch Manager only
    qualityOfWorkScore10: 0, // Branch Manager only
    qualityOfWorkScore11: 0, // Branch Manager only
    qualityOfWorkScore12: 0, // Branch Manager only - Shop Income Targets
    // Job Target scores (7 detailed job targets from newStep2)
    jobTargetMotorcyclesScore: 0,
    jobTargetAppliancesScore: 0,
    jobTargetCarsScore: 0,
    jobTargetTriWheelersScore: 0,
    jobTargetCollectionScore: 0,
    jobTargetSparepartsLubricantsScore: 0,
    jobTargetShopIncomeScore: 0,
    // Job Target comments
    jobTargetMotorcyclesComment: "",
    jobTargetAppliancesComment: "",
    jobTargetCarsComment: "",
    jobTargetTriWheelersComment: "",
    jobTargetCollectionComment: "",
    jobTargetSparepartsLubricantsComment: "",
    jobTargetShopIncomeComment: "",
    qualityOfWorkComments1: "",
    qualityOfWorkComments2: "",
    qualityOfWorkComments3: "",
    qualityOfWorkComments4: "",
    qualityOfWorkComments5: "",
    qualityOfWorkComments6: "", // Branch Manager only
    qualityOfWorkComments7: "", // Branch Manager only
    qualityOfWorkComments8: "", // Branch Manager only
    qualityOfWorkComments9: "", // Branch Manager only
    qualityOfWorkComments10: "", // Branch Manager only
    qualityOfWorkComments11: "", // Branch Manager only
    qualityOfWorkComments12: "", // Branch Manager only - Shop Income Targets
    adaptabilityScore1: 0,
    adaptabilityScore2: 0,
    adaptabilityScore3: 0,
    adaptabilityComments1: "",
    adaptabilityComments2: "",
    adaptabilityComments3: "",
    teamworkScore1: 0,
    teamworkScore2: 0,
    teamworkScore3: 0,
    teamworkComments1: "",
    teamworkComments2: "",
    teamworkComments3: "",
    reliabilityScore1: 0,
    reliabilityScore2: 0,
    reliabilityScore3: 0,
    reliabilityScore4: 0,
    reliabilityComments1: "",
    reliabilityComments2: "",
    reliabilityComments3: "",
    reliabilityComments4: "",
    ethicalScore1: 0,
    ethicalScore2: 0,
    ethicalScore3: 0,
    ethicalScore4: 0,
    ethicalExplanation1: "",
    ethicalExplanation2: "",
    ethicalExplanation3: "",
    ethicalExplanation4: "",
    customerServiceScore1: 0,
    customerServiceScore2: 0,
    customerServiceScore3: 0,
    customerServiceScore4: 0,
    customerServiceScore5: 0,
    customerServiceExplanation1: "",
    customerServiceExplanation2: "",
    customerServiceExplanation3: "",
    customerServiceExplanation4: "",
    customerServiceExplanation5: "",
    managerialSkillsScore1: 0,
    managerialSkillsScore2: 0,
    managerialSkillsScore3: 0,
    managerialSkillsScore4: 0,
    managerialSkillsScore5: 0,
    managerialSkillsScore6: 0,
    managerialSkillsExplanation1: "",
    managerialSkillsExplanation2: "",
    managerialSkillsExplanation3: "",
    managerialSkillsExplanation4: "",
    managerialSkillsExplanation5: "",
    managerialSkillsExplanation6: "",
    created_at: "",
  });

  useApplyInitialFormData(setForm, editSession);

  useEffect(() => {
    if (isEditMode && currentStep === 0) {
      setCurrentStep(1);
    }
  }, [isEditMode, currentStep]);

  const updateDataAction = (updates: Partial<EvaluationPayload>) => {
    setForm((prev: EvaluationPayload) => ({
      ...prev,
      ...updates,
    }));
  };

  // Reset animation when returning to welcome step or on initial mount
  useEffect(() => {
    if (currentStep === 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        setWelcomeAnimationKey((prev) => prev + 1);
      }, 10);
    }
  }, [currentStep]);

  // Trigger animation on initial mount
  useEffect(() => {
    setWelcomeAnimationKey((prev) => prev + 1);
  }, []);

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const startEvaluation = () => {
    setCurrentStep(1);
  };

  // Check if current step scores are complete
  const isCurrentStepComplete = () => {
    switch (currentStep) {
      case 1: // Employee Information & Job Knowledge
        // Check if at least one review type is selected
        const hasReviewType =
          form.reviewTypeProbationary ||
          form.reviewTypeRegular ||
          form.reviewTypeOthersImprovement ||
          (form.reviewTypeOthersCustom &&
            form.reviewTypeOthersCustom.trim() !== "");

        // Check if all job knowledge scores are filled
        const hasJobKnowledgeScores =
          form.jobKnowledgeScore1 &&
          form.jobKnowledgeScore1 !== 0 &&
          form.jobKnowledgeScore2 &&
          form.jobKnowledgeScore2 !== 0 &&
          form.jobKnowledgeScore3 &&
          form.jobKnowledgeScore3 !== 0;

        // Require comments for all Job Knowledge items before proceeding
        const hasJobKnowledgeComments =
          !!form.jobKnowledgeComments1?.trim() &&
          !!form.jobKnowledgeComments2?.trim() &&
          !!form.jobKnowledgeComments3?.trim();

        // Check if basic employee information is filled
        const hasBasicInfo =
          form.coverageFrom &&
          form.coverageFrom !== "" &&
          form.coverageTo &&
          form.coverageTo !== "";

        // Check if coverage dates are valid (coverageFrom must be before coverageTo and not before hireDate)
        const hasValidCoverageDates = (() => {
          if (!hasBasicInfo) return false;
          try {
            // Convert to date strings in YYYY-MM-DD format for reliable comparison
            const fromDateStr =
              typeof form.coverageFrom === "string"
                ? form.coverageFrom
                : new Date(form.coverageFrom).toISOString().split("T")[0];
            const toDateStr =
              typeof form.coverageTo === "string"
                ? form.coverageTo
                : new Date(form.coverageTo).toISOString().split("T")[0];

            // Validate date strings are in correct format
            if (
              !fromDateStr ||
              !toDateStr ||
              fromDateStr.length !== 10 ||
              toDateStr.length !== 10
            ) {
              return false;
            }

            // Check if fromDate is before toDate (string comparison works for YYYY-MM-DD format)
            if (fromDateStr >= toDateStr) {
              return false;
            }

            // Check if coverageFrom is not before date hired
            if (form.hireDate) {
              const hireDateStr =
                typeof form.hireDate === "string"
                  ? form.hireDate
                  : new Date(form.hireDate).toISOString().split("T")[0];
              if (
                hireDateStr &&
                hireDateStr.length === 10 &&
                fromDateStr < hireDateStr
              ) {
                return false;
              }
            }
            return true;
          } catch (error) {
            return false;
          }
        })();

        return (
          hasReviewType &&
          hasJobKnowledgeScores &&
          hasJobKnowledgeComments &&
          hasBasicInfo &&
          hasValidCoverageDates
        );
      case 2: // Quality of Work
        const isEmployeeAreaManagerForStep2 = () => {
          return isEmployeeAreaManager();
        };
        
        const isEmployeeBranchManagerOrSupervisorForStep2 = () => {
          if (!employee?.positions) return false;
          const position = employee.positions;
          const positionLabel = typeof position === 'string' 
            ? position.toUpperCase() 
            : (position as any)?.label?.toUpperCase() || '';
          return (
            positionLabel === 'BRANCH MANAGER' || 
            positionLabel.includes('BRANCH MANAGER') ||
            positionLabel === 'BRANCH SUPERVISOR' || 
            positionLabel.includes('BRANCH SUPERVISOR') ||
            (positionLabel.includes('MANAGER') && !positionLabel.includes('AREA MANAGER'))
          );
        };
        
        const isHO = isEmployeeHeadOffice(employee);
        const isAreaMgr = isEmployeeAreaManagerForStep2();
        const isBranchMgrOrSup = isEmployeeBranchManagerOrSupervisorForStep2();
        
        // Determine if job targets should be shown (same logic as newStep2.tsx)
        // For BranchRankNfile, showJobTargets is false (uses Step2, not newStep2)
        const showJobTargets = isAreaMgr || (isBranchMgrOrSup && !isHO);
        
        // Check if this is a BranchRankNfile evaluation (uses Step2, not newStep2)
        // BranchRankNfile: evaluationType === 'rankNfile' && !isHO (employee is NOT HO)
        const isBranchRankNfile = !isHO && evaluationType === 'rankNfile';
        
        // Base Quality of Work scores (always required)
        const hasBaseScores = (
          form.qualityOfWorkScore1 &&
          form.qualityOfWorkScore1 !== 0 &&
          form.qualityOfWorkScore2 &&
          form.qualityOfWorkScore2 !== 0 &&
          form.qualityOfWorkScore3 &&
          form.qualityOfWorkScore3 !== 0 &&
          form.qualityOfWorkScore4 &&
          form.qualityOfWorkScore4 !== 0
        );
        
        // Job Target scores are optional - user can choose to fill them or not
        // No validation required for the 7 job target scores
        
        // qualityOfWorkScore5 (single "Job Targets" row) is required if:
        // 1. Employee is HO (always skip - HO doesn't see this row in Step2)
        // 2. OR showJobTargets is true (skip - they use the 7 detailed job targets instead)
        // 3. OR for BranchRankNfile (employee NOT HO, rankNfile type) - REQUIRED (uses Step2 which shows qualityOfWorkScore5)
        // 4. OR for any non-HO employee not using the 7 detailed job targets - REQUIRED
        // For HO employees (rankNfile or basic evaluationType), qualityOfWorkScore5 is NOT required
        // const hasQualityOfWorkScore5 = isHO || showJobTargets || (form.qualityOfWorkScore5 && form.qualityOfWorkScore5 !== 0);
        
        // For BranchRankNfile specifically, ensure qualityOfWorkScore5 is filled
        // if (isBranchRankNfile && (!form.qualityOfWorkScore5 || form.qualityOfWorkScore5 === 0)) {
        //   return false; // Explicitly require qualityOfWorkScore5 for BranchRankNfile
        // }

        // Comments requirement
        // - Always require base comments (rows 1-4)
        // - Only require row-5 comment when row-5 score is required/visible (non-HO and not using detailed job targets)
        const hasBaseComments =
          !!form.qualityOfWorkComments1?.trim() &&
          !!form.qualityOfWorkComments2?.trim() &&
          !!form.qualityOfWorkComments3?.trim() &&
          !!form.qualityOfWorkComments4?.trim();

        // const requiresQualityOfWorkRow5 = !isHO && !showJobTargets;
        //const hasRow5Comment = !requiresQualityOfWorkRow5 || !!form.qualityOfWorkComments5?.trim();
        
        // Only require base scores and qualityOfWorkScore5 (if applicable)
        // Job targets are optional
        return hasBaseScores && hasBaseComments;
      case 3: // Adaptability
        return (
          form.adaptabilityScore1 &&
          form.adaptabilityScore1 !== 0 &&
          form.adaptabilityScore2 &&
          form.adaptabilityScore2 !== 0 &&
          form.adaptabilityScore3 &&
          form.adaptabilityScore3 !== 0 &&
          !!form.adaptabilityComments1?.trim() &&
          !!form.adaptabilityComments2?.trim() &&
          !!form.adaptabilityComments3?.trim()
        );
      case 4: // Teamwork
        return (
          form.teamworkScore1 &&
          form.teamworkScore1 !== 0 &&
          form.teamworkScore2 &&
          form.teamworkScore2 !== 0 &&
          form.teamworkScore3 &&
          form.teamworkScore3 !== 0 &&
          !!form.teamworkComments1?.trim() &&
          !!form.teamworkComments2?.trim() &&
          !!form.teamworkComments3?.trim()
        );
      case 5: // Reliability
        return (
          form.reliabilityScore1 &&
          form.reliabilityScore1 !== 0 &&
          form.reliabilityScore2 &&
          form.reliabilityScore2 !== 0 &&
          form.reliabilityScore3 &&
          form.reliabilityScore3 !== 0 &&
          form.reliabilityScore4 &&
          form.reliabilityScore4 !== 0 &&
          !!form.reliabilityComments1?.trim() &&
          !!form.reliabilityComments2?.trim() &&
          !!form.reliabilityComments3?.trim() &&
          !!form.reliabilityComments4?.trim()
        );
      case 6: // Ethical & Professional Behavior
        return (
          form.ethicalScore1 &&
          form.ethicalScore1 !== 0 &&
          form.ethicalScore2 &&
          form.ethicalScore2 !== 0 &&
          form.ethicalScore3 &&
          form.ethicalScore3 !== 0 &&
          form.ethicalScore4 &&
          form.ethicalScore4 !== 0 &&
          !!form.ethicalExplanation1?.trim() &&
          !!form.ethicalExplanation2?.trim() &&
          !!form.ethicalExplanation3?.trim() &&
          !!form.ethicalExplanation4?.trim()
        );
      case 7: // Could be Customer Service or Managerial Skills depending on evaluation type
        // Check the actual step ID and title to determine what step 7 is
        const currentStepId_Step7 = getCurrentStepId();
        const currentStepConfig_Step7 = filteredSteps[currentStep - 1];
        
        // If step 7 is Managerial Skills (for BasicHo: id: 7, title: "Managerial Skills"), validate all managerial skills scores
        if (currentStepId_Step7 === 7 && currentStepConfig_Step7?.title === "Managerial Skills") {
          return (
            form.managerialSkillsScore1 &&
            form.managerialSkillsScore1 !== 0 &&
            form.managerialSkillsScore2 &&
            form.managerialSkillsScore2 !== 0 &&
            form.managerialSkillsScore3 &&
            form.managerialSkillsScore3 !== 0 &&
            form.managerialSkillsScore4 &&
            form.managerialSkillsScore4 !== 0 &&
            form.managerialSkillsScore5 &&
            form.managerialSkillsScore5 !== 0 &&
            form.managerialSkillsScore6 &&
            form.managerialSkillsScore6 !== 0 &&
            !!form.managerialSkillsExplanation1?.trim() &&
            !!form.managerialSkillsExplanation2?.trim() &&
            !!form.managerialSkillsExplanation3?.trim() &&
            !!form.managerialSkillsExplanation4?.trim() &&
            !!form.managerialSkillsExplanation5?.trim() &&
            !!form.managerialSkillsExplanation6?.trim()
          );
        }
        
        // Customer Service applies to branch employees only (not HO), regardless of evaluator role (HR or evaluator)
        if (isEmployeeHeadOffice(employee) && !isAreaMgr) {
          return true;
        }

        // Branch employee: require all customer service scores
        return (
          form.customerServiceScore1 &&
          form.customerServiceScore1 !== 0 &&
          form.customerServiceScore2 &&
          form.customerServiceScore2 !== 0 &&
          form.customerServiceScore3 &&
          form.customerServiceScore3 !== 0 &&
          form.customerServiceScore4 &&
          form.customerServiceScore4 !== 0 &&
          form.customerServiceScore5 &&
          form.customerServiceScore5 !== 0 &&
          !!form.customerServiceExplanation1?.trim() &&
          !!form.customerServiceExplanation2?.trim() &&
          !!form.customerServiceExplanation3?.trim() &&
          !!form.customerServiceExplanation4?.trim() &&
          !!form.customerServiceExplanation5?.trim()
        );
      case 8: // Could be Managerial Skills or Overall Assessment depending on evaluation type
        // Check the actual step ID to determine what step 8 is
        const currentStepId = getCurrentStepId();
        const currentStepConfig = filteredSteps[currentStep - 1];
        
        // If step 8 is Managerial Skills (id: 8), validate all managerial skills scores
        if (currentStepId === 8 && currentStepConfig?.title === "Managerial Skills") {
          return (
            form.managerialSkillsScore1 &&
            form.managerialSkillsScore1 !== 0 &&
            form.managerialSkillsScore2 &&
            form.managerialSkillsScore2 !== 0 &&
            form.managerialSkillsScore3 &&
            form.managerialSkillsScore3 !== 0 &&
            form.managerialSkillsScore4 &&
            form.managerialSkillsScore4 !== 0 &&
            form.managerialSkillsScore5 &&
            form.managerialSkillsScore5 !== 0 &&
            form.managerialSkillsScore6 &&
            form.managerialSkillsScore6 !== 0 &&
            !!form.managerialSkillsExplanation1?.trim() &&
            !!form.managerialSkillsExplanation2?.trim() &&
            !!form.managerialSkillsExplanation3?.trim() &&
            !!form.managerialSkillsExplanation4?.trim() &&
            !!form.managerialSkillsExplanation5?.trim() &&
            !!form.managerialSkillsExplanation6?.trim()
          );
        }
        
        // If step 8 is Overall Assessment or any other step, no validation required
        return true;
      case 9: // Overall Assessment (for branch evaluations where Managerial Skills is step 8)
        return true; // No validation required for Overall Assessment
      default:
        return true; // For other steps, allow progression
    }
  };

  // Get step name for tooltip
  const getStepName = () => {
    // Get the actual step configuration to determine the correct name
    if (currentStep > 0 && currentStep <= filteredSteps.length) {
      const stepConfig = filteredSteps[currentStep - 1];
      if (stepConfig?.title) {
        return stepConfig.title;
      }
    }
    
    // Fallback to default names if step config is not available
    switch (currentStep) {
      case 1:
        return "Employee Information & Job Knowledge";
      case 2:
        return "Quality of Work";
      case 3:
        return "Adaptability";
      case 4:
        return "Teamwork";
      case 5:
        return "Reliability";
      case 6:
        return "Ethical & Professional Behavior";
      case 7:
        return "Customer Service";
      case 8:
        return "Managerial Skills";
      case 9:
        return "Overall Assessment";
      default:
        return "evaluation";
    }
  };

  // Get validation message for incomplete steps
  const getValidationMessage = () => {
    switch (currentStep) {
      case 1: // Employee Information & Job Knowledge
        if (
          !form.reviewTypeProbationary &&
          !form.reviewTypeRegular &&
          !form.reviewTypeOthersImprovement &&
          (!form.reviewTypeOthersCustom ||
            form.reviewTypeOthersCustom.trim() === "")
        ) {
          return "Please select at least one review type";
        }

        if (!form.coverageFrom || form.coverageFrom === "") {
          return "Please select Performance Coverage 'From' date";
        }
        if (!form.coverageTo || form.coverageTo === "") {
          return "Please select Performance Coverage 'To' date";
        }
        // Check if coverage dates are valid (coverageFrom must be before coverageTo and not before hireDate)
        if (form.coverageFrom && form.coverageTo) {
          try {
            // Convert to date strings in YYYY-MM-DD format for reliable comparison
            const fromDateStr =
              typeof form.coverageFrom === "string"
                ? form.coverageFrom
                : new Date(form.coverageFrom).toISOString().split("T")[0];
            const toDateStr =
              typeof form.coverageTo === "string"
                ? form.coverageTo
                : new Date(form.coverageTo).toISOString().split("T")[0];

            if (
              fromDateStr &&
              toDateStr &&
              fromDateStr.length === 10 &&
              toDateStr.length === 10
            ) {
              // Check if fromDate is before toDate (string comparison works for YYYY-MM-DD format)
              if (fromDateStr >= toDateStr) {
                return "Performance Coverage 'From' date must be earlier than 'To' date";
              }
              // Check if coverageFrom is before date hired
              if (form.hireDate) {
                const hireDateStr =
                  typeof form.hireDate === "string"
                    ? form.hireDate
                    : new Date(form.hireDate).toISOString().split("T")[0];
                if (
                  hireDateStr &&
                  hireDateStr.length === 10 &&
                  fromDateStr < hireDateStr
                ) {
                  return "Performance Coverage cannot start before Date Hired";
                }
              }
            }
          } catch (error) {
            return "Please enter valid Performance Coverage dates";
          }
        }
        if (
          !form.jobKnowledgeScore1 ||
          form.jobKnowledgeScore1 === 0 ||
          !form.jobKnowledgeScore2 ||
          form.jobKnowledgeScore2 === 0 ||
          !form.jobKnowledgeScore3 ||
          form.jobKnowledgeScore3 === 0
        ) {
          return "Please complete all job knowledge scores";
        }

        if (
          !form.jobKnowledgeComments1 ||
          form.jobKnowledgeComments1.trim() === "" ||
          !form.jobKnowledgeComments2 ||
          form.jobKnowledgeComments2.trim() === "" ||
          !form.jobKnowledgeComments3 ||
          form.jobKnowledgeComments3.trim() === ""
        ) {
          return "Please provide comments for all Job Knowledge items";
        }

        return "Please complete all required fields";
      case 2: // Quality of Work
        if (
          !form.qualityOfWorkComments1?.trim() ||
          !form.qualityOfWorkComments2?.trim() ||
          !form.qualityOfWorkComments3?.trim() ||
          !form.qualityOfWorkComments4?.trim()
        ) {
          return "Please provide comments for all Quality of Work items";
        }
        // // If the single Job Targets row is used (Step2.tsx), require its comment too
        //  if (
        //   form.qualityOfWorkScore5 &&
        //   form.qualityOfWorkScore5 !== 0 &&
        //   (!form.qualityOfWorkComments5 || form.qualityOfWorkComments5.trim() === "")
        // ) {
        //   return "Please provide a comment for Job Targets";
        // }
        return "Please complete all required fields";
      case 3: // Adaptability
        return "Please complete all Adaptability scores and comments";
      case 4: // Teamwork
        return "Please complete all Teamwork scores and comments";
      case 5: // Reliability
        return "Please complete all Reliability scores and comments";
      case 6: // Ethical & Professional Behavior
        return "Please complete all Ethical & Professional Behavior scores and explanations";
      case 7: // Customer Service or Managerial Skills (depends on evaluation type)
        return "Please complete all required scores and explanations for this step";
      case 8: // Managerial Skills or Overall Assessment (depends on evaluation type)
        return "Please complete all required fields";
      default:
        return "Please complete all scores for this step";
    }
  };

  const nextStep = () => {
    setCurrentStep((step) =>
      step < filteredSteps.length ? step + 1 : step
    );
  };

  const { saveAndNext, saveDraft, isSavingDraft } = useEvaluationDraftOnNext({
    employeeId: employee?.id,
    form,
    draftType: isHO
      ? evaluationType === "basic"
        ? "basic"
        : "rankNfile"
      : evaluationType === "rankNfile"
        ? "branchRankNfile"
        : "branchBasic",
    editSession,
    onAdvance: nextStep,
  });

  const prevStep = () => {
    // Move to previous step
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Direct submission - no modal needed
    await confirmSubmit();
  };

  const handleCloseAfterSubmission = () => {
    // Close the modal after successful submission
    if (onCloseAction) {
      onCloseAction();
    }
  };


  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    // Close the main evaluation modal
    if (onCloseAction) {
      onCloseAction();
    }
  };

  // submission confirmation
  const confirmSubmit = async () => {
    try {
      const empID = employee?.id;
      if (!empID) {
        throw new Error("Missing employee ID. Please reopen the evaluation and try again.");
      }

      // Route by the *employee being evaluated* (HO vs branch), not the evaluator.
      // RankNfileHo/BasicHo omit Customer Service and (for rank-and-file) Job Targets row 5;
      // posting those payloads to branch endpoints caused backend validation errors
      // (e.g. customerServiceExplanation1–5, qualityOfWorkComments5 required).

      const employeeHireDate = toDateInputValue(
        (employee as { date_hired?: unknown } | null | undefined)?.date_hired ??
          (employee as { dateHired?: unknown } | null | undefined)?.dateHired ??
          (employee as { hireDate?: unknown } | null | undefined)?.hireDate
      );
      const payload = buildEvaluationSavePayload(form, {
        ...(employeeHireDate && !toDateInputValue(form.hireDate)
          ? { hireDate: employeeHireDate }
          : {}),
      });

      await submitEvaluationForm(editSession, payload, async () => {
        if (isHO) {
          if (evaluationType === "rankNfile") {
            await apiService.postHoRankNFile(empID, payload);
          } else if (evaluationType === "basic") {
            await apiService.postHoBasic(empID, payload);
          } else {
            await apiService.createSubmission(empID, payload);
          }
        } else if (evaluationType === "rankNfile") {
          await apiService.postBranchRankNFile(empID, payload);
        } else {
          await apiService.postBranchBasic(empID, payload);
        }
      });

      setShowSuccessDialog(true);
    } catch (clientError) {
      console.error("Evaluation submit failed:", clientError);
      toastMessages.generic.error(
        "Evaluation Error",
        getEvaluationApiErrorMessage(
          clientError,
          "Failed to save evaluation. Please try again."
        )
      );
    }
  };



    // Get current step info
    const currentStepInfo = currentStep > 0 ? filteredSteps[currentStep - 1] : null;
    const isLastStep = currentStep === filteredSteps.length;
    // Check if current step is Overall Assessment (any variant)
    const isOverallAssessmentStep = isLastStep || 
      (currentStep > 0 && filteredSteps[currentStep - 1]?.title === "Overall Assessment");
    
    // Get the current step component for rendering
    const getCurrentStepComponent = () => {
      if (currentStep === 0) return WelcomeStep;
      const stepIndex = currentStep - 1;
      return filteredSteps[stepIndex]?.component || WelcomeStep;
    };

  return (
    <>
      <style jsx>{`
        @keyframes dialogPopup {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes drawCheck {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes successBounce {
          0% {
            transform: scale(0.9);
            opacity: 0; 
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .check-animation {
          animation: drawCheck 0.6s ease-in-out 0.3s forwards;
        }

        .success-dialog {
          animation: successBounce 0.5s ease-out;
        }

        .success-message {
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            background-color: rgb(240 253 244);
          }
          50% {
            background-color: rgb(220 252 231);
          }
        }

        @keyframes welcomePopup {
          0% {
            transform: scale(0.9) translateY(20px);
            opacity: 0;
          }
          50% {
            transform: scale(1.02) translateY(-5px);
            opacity: 0.9;
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        .welcome-step-animate {
          animation: welcomePopup 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }

        /* Ensure animation works even inside containers */
        .evaluation-container .welcome-step-animate {
          animation: welcomePopup 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          transform-origin: center;
        }
      `}</style>
      <div className="max-h-[95vh] bg-gradient-to-br from-blue-50 to-indigo-100 p-6 overflow-y-auto">
        <div className="w-full mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {/* Step Numbers Indicator */}
            {currentStep > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex justify-center mb-4">
                    <div className="flex items-center">
                      {filteredSteps.map((step, index) => (
                        <div key={step.id} className="flex items-center">
                          {/* Step Circle */}
                          <div
                            className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all duration-200 relative z-10 ${
                              index + 1 === currentStep
                                ? "bg-blue-500 text-white shadow-md scale-110"
                                : index + 1 < currentStep
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            {index === filteredSteps.length - 1 ? "End" : step.id}
                          </div>

                          {/* Connecting Line */} 
                          {index < filteredSteps.length - 1 && (
                            <div className="w-16 h-1 mx-2 relative">
                              <div className="absolute inset-0 bg-gray-200 rounded-full"></div>
                              <div
                                className={`absolute inset-0 rounded-full transition-all duration-500 ${
                                  index + 1 < currentStep
                                    ? "bg-green-500"
                                    : "bg-gray-200"
                                }`}
                                style={{
                                  width:
                                    index + 1 < currentStep ? "100%" : "0%",
                                }}
                              ></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {isOverallAssessmentStep 
                        ? `End of ${filteredSteps.length} steps: ${currentStepInfo?.title || "Overall Assessment"}`
                        : `Step ${currentStep} of ${filteredSteps.length}: ${currentStepInfo?.title || "Welcome"}`
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step Content */}
            {currentStep === 0 && !isEditMode ? (
              <Card
                key={`welcome-${welcomeAnimationKey}`}
                className="welcome-step-animate"
              >
                <CardContent>
                  <WelcomeStep
                    data={form}
                    updateDataAction={updateDataAction}
                    employee={employee}
                    onStartAction={startEvaluation}
                    onBackAction={onCloseAction}
                    evaluationType={evaluationType}
                    branchOptions={branchOptions}
                    branchListLoading={branchListLoading}
                    disabled={isEditMode}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                      {isOverallAssessmentStep ? "End" : currentStep}
                    </span>
                    {currentStepInfo?.title || "Step"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const stepIndex = currentStep - 1;
                    const step = filteredSteps[stepIndex];
                    if (!step) return null;
                    const StepComponent = step.component;
                    
                    // For Overall Assessment steps, pass additional props
                    if (isOverallAssessmentStep) {
                      return (
                        <StepComponent
                          data={form}
                          updateDataAction={updateDataAction}
                          employee={employee}
                          onSubmitAction={handleSubmit}
                          onPreviousAction={prevStep}
                          onCloseAction={handleCloseAfterSubmission}
                        />
                      );
                    }
                    
                    // For regular steps - pass evaluationType if StepComponent accepts it
                    const stepProps: any = {
                      data: form,
                      updateDataAction: updateDataAction,
                      employee: employee,
                    };
                    // Pass evaluationType to Step1, Step2, and Step7 (and potentially other steps that need it)
                    if (step.id === 1 || step.id === 2 || step.id === 7) {
                      stepProps.evaluationType = evaluationType;
                    }
                    // Pass branch lookup props so Step1 can render the same branch text as WelcomeStep
                    if (step.id === 1) {
                      stepProps.branchOptions = branchOptions;
                      stepProps.branchListLoading = branchListLoading;
                    }
                    return <StepComponent {...stepProps} />;
                  })()}
                </CardContent>
              </Card>
            )}

            {currentStep > 0 && !isOverallAssessmentStep && (
              <EvaluationStepNavigation
                currentStep={currentStep}
                canProceed={Boolean(isCurrentStepComplete())}
                validationMessage={getValidationMessage()}
                isSaving={isSavingDraft}
                onPrevious={prevStep}
                onCancel={() => setShowCancelDialog(true)}
                onNext={saveAndNext}
              />
            )}
          </div>
        </div>
      </div>

      <EvaluationCancelDraftDialog
        open={showCancelDialog}
        isSaving={isSavingDraft}
        onOpenChangeAction={setShowCancelDialog}
        onKeepEditingAction={() => setShowCancelDialog(false)}
        onConfirmDraftAction={async () => {
          const ok = await saveDraft();
          if (!ok) return;
          setShowCancelDialog(false);
          if (onCancelAction) {
            onCancelAction();
          } else if (onCloseAction) {
            onCloseAction();
          }
        }}
      />

      {/* Success Dialog */}
      <Dialog
        open={showSuccessDialog}
        onOpenChangeAction={setShowSuccessDialog}
      >
        <DialogContent
          className="max-w-md m-8 success-dialog"
          style={{
            animation: "dialogPopup 0.3s ease-out",
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center justify-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600 check-animation"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{
                    strokeDasharray: "20",
                    strokeDashoffset: "20",
                    animation: "drawCheck 0.6s ease-in-out 0.3s forwards",
                  }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              Evaluation Submitted Successfully!
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-green-50 p-4 rounded-lg mb-4 success-message">
              <p className="text-gray-700 text-center">
                🎉 Your evaluation has been submitted successfully!
                <br />
                The employee can now view their results in their dashboard.
              </p>
            </div>
            <div className="text-sm text-gray-600 text-center">
              <p>
                <strong>Employee:</strong>{" "}
                {employee?.fname + " " + employee?.lname}
              </p>
              <p>
                <strong>Submitted:</strong>{" "}
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <DialogFooter className="flex justify-center">
            <Button
              onClick={handleSuccessDialogClose}
              className="px-8 py-2 bg-red-600 text-white hover:bg-red-700 hover:text-white cursor-pointer hover:scale-110 transition-transform duration-200"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
