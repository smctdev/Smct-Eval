"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import WelcomeStepAreaManager from "./WelcomeStepAreaManager";
import { EvaluationPayload } from "./types";
import { storeEvaluationResult } from "@/lib/evaluationStorage";
import { apiService } from "@/lib/apiService";
import { createEvaluationNotification } from "@/lib/notificationUtils";
import { User, useAuth } from "../../contexts/UserContext";
import { areaManagerEvaluationSteps } from "./configs/areaManagerEvaluationConfig";
import { useBranchesForEvaluation } from "@/hooks/useBranchesForEvaluation";
import {
  EvaluationFormSessionProps,
  useApplyInitialFormData,
} from "./evaluationFormEdit";
import { submitEvaluationForm } from "@/lib/evaluationEditSubmit";
import { isEditSession } from "@/lib/evaluationEditTypes";
import EvaluationStepNavigation from "./EvaluationStepNavigation";
import EvaluationCancelDraftDialog from "./EvaluationCancelDraftDialog";
import { useEvaluationDraftOnNext } from "@/hooks/useEvaluationDraftOnNext";
import { buildEvaluationSavePayload } from "@/lib/evaluationDraftSave";

interface AreaManagerEvaluationFormProps extends EvaluationFormSessionProps {
  employee?: User | null;
  onCloseAction?: () => void;
  onCancelAction?: () => void;
}

function buildAreaManagerSavePayload(form: EvaluationPayload): EvaluationPayload {
  const managerial_skills = (
    [
      {
        question_number: 1 as const,
        score: Number(form.managerialSkillsScore1 || 0),
        explanation: form.managerialSkillsExplanation1 || "",
      },
      {
        question_number: 2 as const,
        score: Number(form.managerialSkillsScore2 || 0),
        explanation: form.managerialSkillsExplanation2 || "",
      },
      {
        question_number: 3 as const,
        score: Number(form.managerialSkillsScore3 || 0),
        explanation: form.managerialSkillsExplanation3 || "",
      },
      {
        question_number: 4 as const,
        score: Number(form.managerialSkillsScore4 || 0),
        explanation: form.managerialSkillsExplanation4 || "",
      },
      {
        question_number: 5 as const,
        score: Number(form.managerialSkillsScore5 || 0),
        explanation: form.managerialSkillsExplanation5 || "",
      },
      {
        question_number: 6 as const,
        score: Number(form.managerialSkillsScore6 || 0),
        explanation: form.managerialSkillsExplanation6 || "",
      },
    ] as NonNullable<EvaluationPayload["managerial_skills"]>
  ).filter((item) => item.score > 0);

  return buildEvaluationSavePayload(form, { managerial_skills });
}

export default function AreaManagerEvaluationForm({
  employee,
  onCloseAction,
  onCancelAction,
  editSession,
}: AreaManagerEvaluationFormProps) {
  const isEditMode = isEditSession(editSession);
  const [currentStep, setCurrentStep] = useState(() => (isEditMode ? 1 : 0));
  const [welcomeAnimationKey, setWelcomeAnimationKey] = useState(0);
  const { user } = useAuth();
  const { branchOptions, isLoading: branchListLoading } =
    useBranchesForEvaluation();
  
  // Area Manager uses areaManagerEvaluationSteps (excludes Customer Service)
  const filteredSteps = areaManagerEvaluationSteps;
  
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
    qualityOfWorkScore6: 0,
    qualityOfWorkScore7: 0,
    qualityOfWorkScore8: 0,
    qualityOfWorkScore9: 0,
    qualityOfWorkScore10: 0,
    qualityOfWorkScore11: 0,
    qualityOfWorkScore12: 0,
    jobTargetMotorcyclesScore: 0,
    jobTargetAppliancesScore: 0,
    jobTargetCarsScore: 0,
    jobTargetTriWheelersScore: 0,
    jobTargetCollectionScore: 0,
    jobTargetSparepartsLubricantsScore: 0,
    jobTargetShopIncomeScore: 0,
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
    qualityOfWorkComments6: "",
    qualityOfWorkComments7: "",
    qualityOfWorkComments8: "",
    qualityOfWorkComments9: "",
    qualityOfWorkComments10: "",
    qualityOfWorkComments11: "",
    qualityOfWorkComments12: "",
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
    // Customer Service fields (not used but kept for type compatibility)
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

  const updateDataAction = useCallback((updates: Partial<EvaluationPayload>) => {
    setForm((prev: EvaluationPayload) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  useEffect(() => {
    if (currentStep === 0) {
      setTimeout(() => {
        setWelcomeAnimationKey((prev) => prev + 1);
      }, 100);
    }
  }, [currentStep]);

  // Get validation message for incomplete steps
  const getValidationMessage = () => {
    switch (currentStep) {
      case 1:
        if (
          !form.reviewTypeProbationary &&
          !form.reviewTypeRegular &&
          !form.reviewTypeOthersImprovement &&
          (!form.reviewTypeOthersCustom || form.reviewTypeOthersCustom.trim() === "")
        ) {
          return "Please select at least one review type";
        }
        if (!form.coverageFrom || form.coverageFrom === "") {
          return "Please select Performance Coverage 'From' date";
        }
        if (!form.coverageTo || form.coverageTo === "") {
          return "Please select Performance Coverage 'To' date";
        }
        if (!form.jobKnowledgeScore1 || form.jobKnowledgeScore1 === 0) {
          return "Please complete all Job Knowledge scores";
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
      case 2:
        if (!form.qualityOfWorkScore1 || form.qualityOfWorkScore1 === 0) {
          return "Please complete all Quality of Work scores";
        }
        if (
          !form.qualityOfWorkComments1?.trim() ||
          !form.qualityOfWorkComments2?.trim() ||
          !form.qualityOfWorkComments3?.trim() ||
          !form.qualityOfWorkComments4?.trim()
        ) {
          return "Please provide comments for all Quality of Work items";
        }
        return "Please complete all required fields";
      case 3:
        return "Please complete all Adaptability scores and comments";
      case 4:
        return "Please complete all Teamwork scores and comments";
      case 5:
        return "Please complete all Reliability scores and comments";
      case 6:
        return "Please complete all Ethical & Professional Behavior scores and explanations";
      case 7: // Managerial Skills (was Step 8, now Step 7)
        return "Please complete all Managerial Skills scores and explanations";
      default:
        return "Please complete all required fields to continue";
    }
  };

  // Validation for Area Manager - specific to their requirements (no Customer Service)
  const isCurrentStepComplete = () => {
    switch (currentStep) {
      case 1: // Employee Information & Job Knowledge
        const hasReviewType =
          form.reviewTypeProbationary ||
          form.reviewTypeRegular ||
          form.reviewTypeOthersImprovement ||
          (form.reviewTypeOthersCustom && form.reviewTypeOthersCustom.trim() !== "");

        const hasJobKnowledgeScores =
          form.jobKnowledgeScore1 &&
          form.jobKnowledgeScore1 !== 0 &&
          form.jobKnowledgeScore2 &&
          form.jobKnowledgeScore2 !== 0 &&
          form.jobKnowledgeScore3 &&
          form.jobKnowledgeScore3 !== 0;

        const hasJobKnowledgeComments =
          !!form.jobKnowledgeComments1?.trim() &&
          !!form.jobKnowledgeComments2?.trim() &&
          !!form.jobKnowledgeComments3?.trim();

        const hasBasicInfo =
          form.coverageFrom &&
          form.coverageFrom !== "" &&
          form.coverageTo &&
          form.coverageTo !== "";

        const hasValidCoverageDates = (() => {
          if (!hasBasicInfo) return false;
          try {
            const fromDateStr =
              typeof form.coverageFrom === "string"
                ? form.coverageFrom
                : new Date(form.coverageFrom).toISOString().split("T")[0];
            const toDateStr =
              typeof form.coverageTo === "string"
                ? form.coverageTo
                : new Date(form.coverageTo).toISOString().split("T")[0];

            if (
              !fromDateStr ||
              !toDateStr ||
              fromDateStr.length !== 10 ||
              toDateStr.length !== 10
            ) {
              return false;
            }

            if (fromDateStr >= toDateStr) {
              return false;
            }

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
        
        const hasQualityOfWorkComments =
          !!form.qualityOfWorkComments1?.trim() &&
          !!form.qualityOfWorkComments2?.trim() &&
          !!form.qualityOfWorkComments3?.trim() &&
          !!form.qualityOfWorkComments4?.trim();

        return hasBaseScores && hasQualityOfWorkComments;
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
      case 7: // Managerial Skills (Step 7 in this form, was Step 8)
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
      case 8: // Overall Assessment
        return true;
      default:
        return true;
    }
  };

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startEvaluation = () => {
    setCurrentStep(1);
  };

  const nextStep = () => {
    setCurrentStep((step) =>
      step < filteredSteps.length ? step + 1 : step
    );
  };

  const { saveAndNext, saveDraft, isSavingDraft } = useEvaluationDraftOnNext({
    employeeId: employee?.id,
    form,
    draftType: "branchBasicAreaManager",
    editSession,
    buildPayload: buildAreaManagerSavePayload,
    onAdvance: nextStep,
  });

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    confirmSubmit();
  };

  const handleCloseAfterSubmission = () => {
    if (onCloseAction) {
      onCloseAction();
    }
  };

  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    if (onCloseAction) {
      onCloseAction();
    }
  };

  // Submission for Area Manager evaluation
  const confirmSubmit = async () => {
    try {
      const empID = employee?.id;
      if (empID) {
        setIsSubmitting(true);
        
        const employeeId = typeof empID === 'string' ? parseInt(empID, 10) : empID;
        const evaluatorId = typeof user?.id === 'string' ? parseInt(user.id, 10) : (user?.id || 0);

        const submissionPayload = buildAreaManagerSavePayload(form);

        await submitEvaluationForm(editSession, submissionPayload, async () => {
            await apiService.postBranchBasicAreaManager(
              employeeId,
              submissionPayload
            );
          });
        
        // Store in localStorage as backup
        if (!isEditSession(editSession) && employee) {
          await storeEvaluationResult({
            employeeId: employeeId,
            employeeEmail: employee.email || "",
            employeeName: `${employee.fname || ""} ${employee.lname || ""}`.trim() || "Unknown",
            evaluatorId: evaluatorId,
            evaluatorName: `${user?.fname || ""} ${user?.lname || ""}`.trim() || "Unknown",
            evaluationData: form,
            status: 'completed',
            period: `${form.coverageFrom} to ${form.coverageTo}`,
            overallRating: String(form.rating || 0),
          });
          
          // Create notification
          await createEvaluationNotification(
            `${employee.fname || ""} ${employee.lname || ""}`.trim() || "Unknown",
            `${user?.fname || ""} ${user?.lname || ""}`.trim() || "Unknown",
            employeeId,
            employee.email
          );
        }
        
        setShowSuccessDialog(true);
        setIsSubmitting(false);
      }
    } catch (clientError) {
      console.log(
        "Client data service storage failed, but localStorage storage succeeded:",
        clientError
      );
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancelAction) {
      onCancelAction();
    } else if (onCloseAction) {
      onCloseAction();
    }
  };

  const currentStepInfo = currentStep > 0 ? filteredSteps[currentStep - 1] : null;
  const isLastStep = currentStep === filteredSteps.length;
  const isOverallAssessmentStep = isLastStep || 
    (currentStep > 0 && filteredSteps[currentStep - 1]?.title === "Overall Assessment");

  return (
    <>
      <div className="max-h-[95vh] bg-gradient-to-br from-blue-50 to-indigo-100 p-6 overflow-y-auto">
        <div className="w-full mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {/* Step Numbers Indicator */}
            {currentStep > 0 && (
              <div className="mb-6 flex items-center justify-center gap-2 flex-wrap">
                {filteredSteps.map((step, index) => {
                  const stepNumber = index + 1;
                  const isActive = currentStep === stepNumber;
                  const isCompleted = currentStep > stepNumber;
                  const isAccessible = currentStep >= stepNumber;

                  return (
                    <TooltipProvider key={step.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex items-center ${
                              isAccessible ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                            }`}
                            onClick={() => {
                              if (isAccessible && currentStep !== stepNumber) {
                                setCurrentStep(stepNumber);
                              }
                            }}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                                isActive
                                  ? "bg-blue-600 text-white scale-110 shadow-lg"
                                  : isCompleted
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-300 text-gray-600"
                              }`}
                            >
                              {stepNumber}
                            </div>
                            {stepNumber < filteredSteps.length && (
                              <div
                                className={`w-8 h-1 mx-1 ${
                                  isCompleted ? "bg-green-500" : "bg-gray-300"
                                }`}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{step.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            )}

            {/* Main Content Card */}
            <Card className="shadow-xl border-2 border-blue-200">
              {currentStep > 0 && (
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <CardTitle className="text-2xl font-bold text-center">
                    {currentStepInfo?.title || "Evaluation"}
                  </CardTitle>
                </CardHeader>
              )}
              <CardContent>
                {currentStep === 0 && !isEditMode ? (
                  <WelcomeStepAreaManager
                    data={form}
                    updateDataAction={updateDataAction}
                    employee={employee}
                    onStartAction={startEvaluation}
                    onBackAction={onCloseAction}
                    branchOptions={branchOptions}
                    branchListLoading={branchListLoading}
                    disabled={isEditMode}
                  />
                ) : (() => {
                  const stepIndex = currentStep - 1;
                  const step = filteredSteps[stepIndex];
                  if (!step) return null;
                  const StepComponent = step.component;
                  
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
                  
                  const stepProps: any = {
                    data: form,
                    updateDataAction: updateDataAction,
                    employee: employee,
                  };
                  if (step.id === 1 || step.id === 2) {
                    stepProps.evaluationType = "areaManager";
                  }
                  if (step.id === 2) {
                    stepProps.forceShowJobTargets = true;
                  }
                  return <StepComponent {...stepProps} />;
                })()}
              </CardContent>
            </Card>

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
              className="px-8 py-2 bg-red-600 text-white hover:bg-red-700 hover:text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
