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
import { branchEvaluationSteps } from "./configs/branchEvaluationConfig";

interface BranchManagerEvaluationFormProps {
  employee?: User | null;
  onCloseAction?: () => void;
  onCancelAction?: () => void;
  evaluationType?: 'rankNfile' | 'basic' | 'default';
}

export default function BranchManagerEvaluationForm({
  employee,
  onCloseAction,
  onCancelAction,
  evaluationType = 'default',
}: BranchManagerEvaluationFormProps) {
  const [currentStep, setCurrentStep] = useState(0); // 0 = welcome step, 1-N = actual steps
  const [welcomeAnimationKey, setWelcomeAnimationKey] = useState(0);
  const { user } = useAuth();
  
  // Branch Manager/Supervisor uses branchEvaluationSteps (includes Customer Service + Managerial Skills)
  const filteredSteps = branchEvaluationSteps;
  
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
    qualityOfWorkScore6: 0, // Branch Manager - Motorcycles
    qualityOfWorkScore7: 0, // Branch Manager - Appliances
    qualityOfWorkScore8: 0, // Branch Manager - Cars
    qualityOfWorkScore9: 0, // Branch Manager - Tri-Wheelers
    qualityOfWorkScore10: 0, // Branch Manager - Collection
    qualityOfWorkScore11: 0, // Branch Manager - Spareparts/Lubricants
    qualityOfWorkScore12: 0, // Branch Manager - Shop Income Targets
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
        if (!form.jobTargetMotorcyclesScore || form.jobTargetMotorcyclesScore === 0) {
          return "Please complete all Job Target scores";
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
      case 8:
        return "Please complete all Managerial Skills scores";
      default:
        return "Please complete all required fields to continue";
    }
  };

  // Validation for Branch Manager/Supervisor - specific to their requirements
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
      case 2: // Quality of Work - Branch Manager/Supervisor specific
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
        
        // All 7 detailed job target scores are REQUIRED for Branch Managers/Supervisors
        const hasJobTargetScores = (
          form.jobTargetMotorcyclesScore &&
          form.jobTargetMotorcyclesScore !== 0 &&
          form.jobTargetAppliancesScore &&
          form.jobTargetAppliancesScore !== 0 &&
          form.jobTargetCarsScore &&
          form.jobTargetCarsScore !== 0 &&
          form.jobTargetTriWheelersScore &&
          form.jobTargetTriWheelersScore !== 0 &&
          form.jobTargetCollectionScore &&
          form.jobTargetCollectionScore !== 0 &&
          form.jobTargetSparepartsLubricantsScore &&
          form.jobTargetSparepartsLubricantsScore !== 0 &&
          form.jobTargetShopIncomeScore &&
          form.jobTargetShopIncomeScore !== 0
        );
        
        return hasBaseScores && hasJobTargetScores;
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
      case 8: // Managerial Skills
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
          form.managerialSkillsScore6 !== 0
        );
      case 9: // Overall Assessment
        return true; // No validation required
      default:
        return true;
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

  // Submission for Branch Manager/Supervisor
  const confirmSubmit = async () => {
    try {
      const empID = employee?.id;
      if (empID) {
        setIsSubmitting(true);
        
        // Ensure empID is a number
        const employeeId = typeof empID === 'string' ? parseInt(empID, 10) : empID;
        const evaluatorId = typeof user?.id === 'string' ? parseInt(user.id, 10) : (user?.id || 0);
        
        // Branch Manager/Supervisor uses appropriate endpoint based on evaluationType
        if (evaluationType === 'rankNfile') {
          await apiService.postBranchRankNFile(employeeId, form);
        } else if (evaluationType === 'basic') {
          await apiService.postBranchBasic(employeeId, form);
        } else {
          // Default evaluation for branch - use BranchBasic endpoint
          await apiService.postBranchBasic(employeeId, form);
        }
        
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
                    evaluationType={evaluationType}
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
                    stepProps.evaluationType = evaluationType;
                  }
                  // For Step2 (Quality of Work), force show job targets for BranchManagerEvaluationForm
                  if (step.id === 2) {
                    stepProps.forceShowJobTargets = true;
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
      <Dialog open={showSuccessDialog} onOpenChangeAction={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <AlertTriangle className="h-5 w-5" />
              Evaluation Submitted Successfully
            </DialogTitle>
          </DialogHeader>
          <p className="py-4">
            The evaluation has been submitted successfully. The employee will be
            notified.
          </p>
          <DialogFooter>
            <Button onClick={handleSuccessDialogClose} className="w-full">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

