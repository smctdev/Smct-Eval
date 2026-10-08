"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, X } from "lucide-react";
import { EvaluationPayload } from "./types";
import { useAuth, User } from "@/contexts/UserContext";
import {
  getEmployeeBranchCodeDisplay,
  type BranchOption,
} from "./employeeBranchLabel";

interface WelcomeStepAreaManagerProps {
  data: EvaluationPayload;
  updateDataAction: (updates: Partial<EvaluationPayload>) => void;
  employee?: User | null;
  onStartAction: () => void;
  onBackAction?: () => void;
  branchOptions?: BranchOption[];
  branchListLoading?: boolean;
  /** When true (edit mode), welcome actions are disabled and start is hidden. */
  disabled?: boolean;
}

export default function WelcomeStepAreaManager({
  employee,
  onStartAction,
  onBackAction,
  branchOptions,
  branchListLoading = false,
  disabled = false,
}: WelcomeStepAreaManagerProps) {
  const { user } = useAuth();
  // Signature can be a PNG file (base64 data URL or file path)
  const hasSignature = user?.signature;
  const canStart = hasSignature && !disabled;

  // Steps for Area Manager (branch-based) evaluation:
  // 1–6 core competencies, 7 Managerial Skills, then Overall Assessment (no Customer Service step)
  const evaluationSteps = [
    { id: 1, title: "Employee Information / Job Knowledge" },
    { id: 2, title: "Quality of Work" },
    { id: 3, title: "Adaptability" },
    { id: 4, title: "Teamwork" },
    { id: 5, title: "Reliability" },
    { id: 6, title: "Ethical & Professional Behavior" },
    { id: 7, title: "Managerial Skills" },
    { id: 8, title: "Overall Assessment" },
  ];

  return (
    <div className="space-y-6">
      

      {disabled && (
        <Card className="border-gray-300 bg-gray-100">
          <CardContent className="pt-4 pb-4">
            <p className="text-center text-sm font-medium text-gray-700">
              Welcome step is not available while editing an evaluation. Continue
              with the evaluation steps below.
            </p>
          </CardContent>
        </Card>
      )}

      <div className={disabled ? "pointer-events-none space-y-6 opacity-60" : "space-y-6"}>
      {/* Welcome Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to Performance Evaluation
        </h3>
        <p className="text-gray-600 mb-6">
          This comprehensive evaluation for Area Managers focuses on leadership,
          regional performance, and managerial skills across multiple dimensions.
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
                    const nameToUse =
                      employee.fname && employee.lname
                        ? `${employee.fname} ${employee.lname}`
                        : employee.fname || employee.lname || "N/A";
                    return nameToUse
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase();
                  })()}
                </span>
              </div>
              <h4 className="text-xl font-semibold text-gray-900">
                {employee.fname && employee.lname
                  ? `${employee.fname} ${employee.lname}`
                  : employee.fname || employee.lname || "N/A"}
              </h4>
              <p className="text-gray-600">{employee.email || "N/A"}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <Badge className="bg-blue-100 text-blue-800 mb-1">
                  Position
                </Badge>
                <p className="text-sm text-gray-900">
                  {employee.positions?.label ||
                    employee.positions?.name ||
                    "N/A"}
                </p>
              </div>
              <div>
                <Badge className="bg-green-100 text-green-800 mb-1">
                  Department
                </Badge>
                <p className="text-sm text-gray-900">
                  {employee.departments?.department_name ||
                    employee.departments?.name ||
                    "N/A"}
                </p>
              </div>
              <div>
                <Badge className="bg-amber-100 text-amber-900 mb-1">
                  Branch
                </Badge>
                <p className="text-sm text-gray-900">
                  {getEmployeeBranchCodeDisplay(
                    employee,
                    branchOptions,
                    branchListLoading
                  )}
                </p>
              </div>
              <div>
                <Badge className="bg-purple-100 text-purple-800 mb-1">
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
                .filter(
                  (_, index) =>
                    index < Math.ceil(evaluationSteps.length / 2)
                )
                .map((step) => {
                  const isLastStep = step.title === "Overall Assessment";
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isLastStep
                            ? "bg-green-500 text-white"
                            : "bg-blue-600 text-white"
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
                .filter(
                  (_, index) =>
                    index >= Math.ceil(evaluationSteps.length / 2)
                )
                .map((step) => {
                  const isLastStep = step.title === "Overall Assessment";
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isLastStep
                            ? "bg-green-500 text-white"
                            : "bg-blue-600 text-white"
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
      {!hasSignature && !disabled && (
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
                  evaluation. Please add your signature in your profile
                  settings before proceeding.
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
                
                <li>• All ratings are on a scale of 1–5 (Poor to Excellent)</li>
                <li>
                  • You can navigate back to previous steps to make changes
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
      {!disabled && (
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
            onClick={canStart ? onStartAction : undefined}
            size="lg"
            disabled={!canStart}
            className={`px-8 py-3 text-lg ${
              canStart
                ? "bg-blue-600 hover:bg-blue-700 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {hasSignature ? "Start Evaluation" : "Signature Required"}
          </Button>
        </div>

        <p className="text-sm text-gray-500 mt-2">
          {hasSignature
            ? "Click to begin the Area Manager performance evaluation"
            : "Add your signature in profile settings to start evaluation"}
        </p>
      </div>
      )}
      </div>
    </div>
  );
}

