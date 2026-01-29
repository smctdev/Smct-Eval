"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, X } from "lucide-react";
import { EvaluationPayload } from "./types";
import { useAuth, User } from "@/contexts/UserContext";

interface WelcomeStepBranchProps {
  data: EvaluationPayload;
  updateDataAction: (updates: Partial<EvaluationPayload>) => void;
  employee?: User | null;
  onStartAction: () => void;
  onBackAction?: () => void;
  evaluationType?: 'rankNfile' | 'basic' | 'default'; // For branch: 'rankNfile' = BranchRankNFile, 'default' or 'basic' = BranchManager
}

export default function WelcomeStepBranch({
  employee,
  onStartAction,
  onBackAction,
  evaluationType = 'default',
}: WelcomeStepBranchProps) {
  const { user } = useAuth();
  // Signature can be a PNG file (base64 data URL or file path)
  const hasSignature = user?.signature;
  
  // Check if employee is Branch Manager or Branch Supervisor
  const isEmployeeBranchManagerOrSupervisor = () => {
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
      (positionLabel.includes('MANAGER') && !positionLabel.includes('AREA MANAGER')) ||
      positionLabel.includes('SUPERVISOR')
    );
  };

  const isBranchManager = isEmployeeBranchManagerOrSupervisor();
  const isBranchRankNFile = evaluationType === 'rankNfile';
  // Branch Manager evaluations use 'default' or 'basic' evaluationType
  // If user picks "manager" evaluation type, show Managerial Skills regardless of employee position
  const isBranchManagerEvaluation = evaluationType === 'default' || evaluationType === 'basic';
  
  // Define steps based on evaluation type
  // BranchRankNFile: Steps 1-6, Step 7 (Customer Service), Overall Assessment
  // BranchManager: Steps 1-6, Step 7 (Customer Service), Step 8 (Managerial Skills), Overall Assessment
  const getEvaluationSteps = () => {
    const steps = [
      { id: 1, title: "Employee Information/Job Knowledge" },
      { id: 2, title: "Quality of Work" },
      { id: 3, title: "Adaptability" },
      { id: 4, title: "Teamwork" },
      { id: 5, title: "Reliability" },
      { id: 6, title: "Ethical & Professional Behavior" },
    ];
    
    let nextStepId = 7;
    
    // Step 7: Customer Service (always shown for branch evaluations)
    steps.push({ id: nextStepId++, title: "Customer Service" });
    
    // Step 8: Managerial Skills (shown when evaluationType is 'default' or 'basic', not 'rankNfile')
    // This is determined by the evaluation type selection, not the employee's position
    if (isBranchManagerEvaluation) {
      steps.push({ id: nextStepId++, title: "Managerial Skills" });
    }
    
    // Overall Assessment
    steps.push({ id: nextStepId, title: "Overall Assessment" });
    
    return steps;
  };
  
  const evaluationSteps = getEvaluationSteps();
  
  return (
    <div className="space-y-6">
      {/* Close Button */}
      {onBackAction && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBackAction}
            className="h-10 w-20 text-white hover:text-white hover:bg-red-600 cursor-pointer hover:scale-110 transition-transform duration-200 bg-red-500"
            aria-label="Close"
          >
            Close
            <X className="h-12 w-12" />
          </Button>
        </div>
      )}

      {/* Welcome Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to Performance Evaluation
        </h3>
        <p className="text-gray-600 mb-6">
          {isBranchManagerEvaluation
            ? "This comprehensive evaluation for Branch Managers includes customer service and managerial skills assessment and will help evaluate performance across multiple dimensions."
            : "This comprehensive evaluation for Branch employees includes customer service assessment and will help evaluate performance across multiple dimensions."}
        </p>
      </div>

      {/* Employee Information Card */}
      {employee && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center mb-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-blue-600">
                  {(() => {
                    // Handle fname/lname format
                    const nameToUse = (employee.fname && employee.lname ? `${employee.fname} ${employee.lname}` : employee.fname || employee.lname || 'N/A');
                    return nameToUse
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase();
                  })()}
                </span>
              </div>
              <h4 className="text-xl font-semibold text-gray-900">
                {(employee.fname && employee.lname ? `${employee.fname} ${employee.lname}` : employee.fname || employee.lname || 'N/A')}
              </h4>
              <p className="text-gray-600">{employee.email || 'N/A'}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <Badge className="bg-blue-100 text-blue-800 mb-1">
                  Position
                </Badge>
                <p className="text-sm text-gray-900">
                  {employee.positions?.label || employee.positions?.name || "N/A"}
                </p>
              </div>
              <div>
                <Badge className="bg-green-100 text-green-800 mb-1">
                  Department
                </Badge>
                <p className="text-sm text-gray-900">
                  {employee.departments?.department_name || employee.departments?.name || "N/A"}
                </p>
              </div>
              <div>
                <Badge className="bg-purple-100 text-purple-800 mb-1">
                  Branch
                </Badge>
                <p className="text-sm text-gray-900">
                  {Array.isArray(employee.branches) 
                    ? employee.branches[0]?.branch_name || employee.branches[0]?.branch_code || "N/A"
                    : (employee.branches as any)?.branch_name || (employee.branches as any)?.branch_code || "N/A"}
                </p>
              </div>
              <div>
                <Badge className="bg-orange-100 text-orange-800 mb-1">
                  Role
                </Badge>
                <p className="text-sm text-gray-900">
                  {employee.roles?.[0]?.name || employee.roles?.name || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evaluation Overview */}
      <Card>
        <CardContent className="pt-6">
          <h4 className="font-medium text-gray-900 mb-4">
            Evaluation Overview
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Column */}
            <div className="space-y-3">
              {evaluationSteps
                .filter((_, index) => index < Math.ceil(evaluationSteps.length / 2))
                .map((step) => {
                  const isLastStep = step.title === "Overall Assessment";
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isLastStep
                            ? "bg-green-500 text-white"
                            : "bg-blue-500 text-white"
                        }`}
                      >
                        {isLastStep ? "End" : step.id}
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900">
                          {step.title}
                        </h5>
                      </div>
                    </div>
                  );
                })}
            </div>
            {/* Second Column */}
            <div className="space-y-3">
              {evaluationSteps
                .filter((_, index) => index >= Math.ceil(evaluationSteps.length / 2))
                .map((step) => {
                  const isLastStep = step.title === "Overall Assessment";
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isLastStep
                            ? "bg-green-500 text-white"
                            : "bg-blue-500 text-white"
                        }`}
                      >
                        {isLastStep ? "End" : step.id}
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900">
                          {step.title}
                        </h5>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature Validation */}
      {!hasSignature && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-red-600 text-lg">⚠️</div>
              <div>
                <h4 className="font-medium text-red-800 mb-2">
                  Signature Required
                </h4>
                <p className="text-sm text-red-700 mb-3">
                  You must have a signature saved in your profile to start an
                  evaluation. Please add your signature in your profile settings
                  before proceeding.
                </p>
                <div className="bg-red-100 p-3 rounded-md">
                  <p className="text-sm text-red-800 font-medium">
                    ❌ Cannot start evaluation without signature
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important Information */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="text-yellow-600 text-lg">ℹ️</div>
            <div>
              <h4 className="font-medium text-yellow-800 mb-2">
                Important Information
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>
                  • This evaluation will take approximately 15-20 minutes to
                  complete
                </li>
                <li>• All ratings are on a scale of 1-5 (Poor to Excellent)</li>
                <li>
                  • You can navigate back to previous steps to make changes
                </li>
                <li>
                  • Your responses will be saved automatically as you progress
                </li>
                <li>
                  • This evaluation will be used for performance management and
                  development planning
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-4">
          {/* Back Button - Only show when no signature */}
          {onBackAction && !hasSignature && (
            <Button
              variant="outline"
              onClick={onBackAction}
              size="lg"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white hover:text-white text-lg flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          )}

          {/* Start Button */}
          <Button
            onClick={hasSignature ? onStartAction : undefined}
            size="lg"
            disabled={!hasSignature}
            className={`px-8 py-3 text-lg ${
              hasSignature
                ? "bg-blue-600 hover:bg-blue-700 cursor-pointer hover:scale-110 transition-transform duration-200"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {hasSignature ? "Start Evaluation" : "Signature Required"}
          </Button>
        </div>

        <p className="text-sm text-gray-500 mt-2">
          {hasSignature
            ? "Click to begin the performance evaluation process"
            : "Add your signature in profile settings to start evaluation"}
        </p>
      </div>
    </div>
  );
}

