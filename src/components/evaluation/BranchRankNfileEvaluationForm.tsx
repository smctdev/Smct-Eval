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
import { AlertTriangle } from "lucide-react";
import WelcomeStepBranch from "./WelcomeStepBranch";
import { EvaluationPayload } from "./types";
import { storeEvaluationResult } from "@/lib/evaluationStorage";
import { apiService } from "@/lib/apiService";
import { createEvaluationNotification } from "@/lib/notificationUtils";
import { User, useAuth } from "../../contexts/UserContext";
import { branchRankNfileSteps } from "./configs/branchRankNfileConfig";

interface BranchRankNfileEvaluationFormProps {
  employee?: User | null;
  onCloseAction?: () => void;
  onCancelAction?: () => void;
}

export default function BranchRankNfileEvaluationForm({
  employee,
  onCloseAction,
  onCancelAction,
}: BranchRankNfileEvaluationFormProps) {
  const [currentStep, setCurrentStep] = useState(0); // 0 = welcome step, 1-N = actual steps
  const [welcomeAnimationKey, setWelcomeAnimationKey] = useState(0);
  const { user } = useAuth();
  
  // BranchRankNfile uses branchRankNfileSteps (fixed configuration)
  const filteredSteps = branchRankNfileSteps;
  
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
    qualityOfWorkScore5: 0, // Required for BranchRankNfile (Job Targets row)
    qualityOfWorkComments1: "",
    qualityOfWorkComments2: "",
    qualityOfWorkComments3: "",
    qualityOfWorkComments4: "",
    qualityOfWorkComments5: "",
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
    // Managerial Skills not included in BranchRankNfile
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

  const updateDataAction = useCallback((updates: Partial<EvaluationPayload>) => {
    setForm((prev: EvaluationPayload) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Animation trigger for welcome step
  useEffect(() => {
    if (currentStep === 0) {
      setTimeout(() => {
        setWelcomeAnimationKey((prev) => prev + 1);
      }, 100);
    }
  }, [currentStep]);

  // Validation for BranchRankNfile - simplified and specific
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
          hasBasicInfo &&
          hasValidCoverageDates
        );
      case 2: // Quality of Work - BranchRankNfile specific
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
        
        // qualityOfWorkScore5 (Job Targets row) is REQUIRED for BranchRankNfile
        const hasQualityOfWorkScore5 = form.qualityOfWorkScore5 && form.qualityOfWorkScore5 !== 0;
        
        return hasBaseScores && hasQualityOfWorkScore5;
      case 3: // Adaptability
        return (
          form.adaptabilityScore1 &&
          form.adaptabilityScore1 !== 0 &&
          form.adaptabilityScore2 &&
          form.adaptabilityScore2 !== 0 &&
          form.adaptabilityScore3 &&
          form.adaptabilityScore3 !== 0
        );
      case 4: // Teamwork
        return (
          form.teamworkScore1 &&
          form.teamworkScore1 !== 0 &&
          form.teamworkScore2 &&
          form.teamworkScore2 !== 0 &&
          form.teamworkScore3 &&
          form.teamworkScore3 !== 0
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
          form.reliabilityScore4 !== 0
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
          form.ethicalScore4 !== 0
        );
      case 7: // Customer Service
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
          form.customerServiceScore5 !== 0
        );
      case 8: // Overall Assessment
        return true; // No validation required
      default:
        return true;
    }
  };

  // Get step name for tooltip
  const getStepName = () => {
    if (currentStep > 0 && currentStep <= filteredSteps.length) {
      const stepConfig = filteredSteps[currentStep - 1];
      if (stepConfig?.title) {
        return stepConfig.title;
      }
    }
    return "evaluation";
  };

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
        return "Please complete all required fields";
      case 2:
        if (!form.qualityOfWorkScore1 || form.qualityOfWorkScore1 === 0) {
          return "Please complete all Quality of Work scores";
        }
        if (!form.qualityOfWorkScore5 || form.qualityOfWorkScore5 === 0) {
          return "Please complete the Job Targets score";
        }
        return "Please complete all required fields";
      case 3:
        return "Please complete all Adaptability scores";
      case 4:
        return "Please complete all Teamwork scores";
      case 5:
        return "Please complete all Reliability scores";
      case 6:
        return "Please complete all Ethical & Professional Behavior scores";
      case 7:
        return "Please complete all Customer Service scores";
      default:
        return "Please complete all required fields to continue";
    }
  };

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const startEvaluation = () => {
    setCurrentStep(1);
  };

  const nextStep = () => {
    if (currentStep < filteredSteps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

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

  // Submission for BranchRankNfile - simplified
  const confirmSubmit = async () => {
    try {
      const empID = employee?.id;
      if (empID) {
        setIsSubmitting(true);
        
        // Ensure empID is a number
        const employeeId = typeof empID === 'string' ? parseInt(empID, 10) : empID;
        const evaluatorId = typeof user?.id === 'string' ? parseInt(user.id, 10) : (user?.id || 0);
        
        // BranchRankNfile always uses postBranchRankNFile endpoint
        await apiService.postBranchRankNFile(employeeId, form);
        
        // Store in localStorage as backup
        if (employee) {
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

  // Get current step info
  const currentStepInfo = currentStep > 0 ? filteredSteps[currentStep - 1] : null;
  const isLastStep = currentStep === filteredSteps.length;
  const isOverallAssessmentStep = isLastStep || 
    (currentStep > 0 && filteredSteps[currentStep - 1]?.title === "Overall Assessment");

  // Get the current step component for rendering
  const getCurrentStepComponent = () => {
    if (currentStep === 0) return WelcomeStepBranch;
    const stepIndex = currentStep - 1;
    return filteredSteps[stepIndex]?.component || WelcomeStepBranch;
  };

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
                {currentStep === 0 ? (
                  <WelcomeStepBranch
                    data={form}
                    updateDataAction={updateDataAction}
                    employee={employee}
                    onStartAction={startEvaluation}
                    onBackAction={onCloseAction}
                    evaluationType="rankNfile"
                  />
                ) : (() => {
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
                  // Pass evaluationType to Step1, Step2, and Step7
                  if (step.id === 1 || step.id === 2 || step.id === 7) {
                    stepProps.evaluationType = "rankNfile";
                  }
                  return <StepComponent {...stepProps} />;
                })()}
              </CardContent>
            </Card>

            {/* Navigation Buttons - Only show for steps before Overall Assessment */}
            {currentStep > 0 && !isOverallAssessmentStep && (
              <div className="flex justify-between mt-6">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className="px-6 cursor-pointer bg-blue-500 text-white hover:scale-110 transition-transform duration-200 hover:bg-blue-500 hover:text-white"
                  >
                    Previous
                  </Button>

                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCancelDialog(true);
                    }}
                    className="px-6 text-red-600 bg-red-500 text-white border-red-300 hover:bg-red-500 hover:text-white cursor-pointer hover:scale-110 transition-transform duration-200"
                  >
                    Cancel Evaluation
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <TooltipProvider>
                    {currentStep >= 1 &&
                    !isOverallAssessmentStep &&
                    !isCurrentStepComplete() ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={(e) => {
                              e.preventDefault();
                              // Button is disabled, do nothing
                            }}
                            className="px-6 opacity-50 cursor-not-allowed"
                          >
                            Next
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getValidationMessage()}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={nextStep}
                            className="px-6 bg-blue-500 text-white hover:bg-green-600 hover:text-white cursor-pointer hover:scale-110 transition-transform duration-200"
                          >
                            Next
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Proceed to the next step</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TooltipProvider>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Evaluation Dialog */}
      <Dialog open={showCancelDialog} onOpenChangeAction={setShowCancelDialog}>
        <DialogContent
          className="max-w-md m-8"
          style={{
            animation: "dialogPopup 0.3s ease-out",
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cancel Evaluation
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 bg-red-50 p-4 mx-2 my-2">
            <p className="text-gray-600">
              Are you sure you want to cancel this evaluation? All progress will
              be lost and cannot be recovered.
            </p>
          </div>
          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowCancelDialog(false);
              }}
              className="px-4 bg-blue-500 text-white hover:bg-blue-600 hover:text-white cursor-pointer hover:scale-110 transition-transform duration-200"
            >
              Keep Editing
            </Button>
            <Button
              variant="destructive"
              disabled={isCancelling}
              className={`px-4 flex items-center gap-2 cursor-pointer hover:scale-110 transition-transform duration-200
    ${isCancelling ? "opacity-70 cursor-not-allowed" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                setIsCancelling(true);

                try {
                  setShowCancelDialog(false);

                  if (onCancelAction) {
                    onCancelAction();
                  } else if (onCloseAction) {
                    onCloseAction();
                  }

                  setForm({
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
                    qualityOfWorkComments1: "",
                    qualityOfWorkComments2: "",
                    qualityOfWorkComments3: "",
                    qualityOfWorkComments4: "",
                    qualityOfWorkComments5: "",
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
                } finally {
                  setIsCancelling(false);
                }
              }}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Evaluation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

