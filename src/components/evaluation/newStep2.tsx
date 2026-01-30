"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronDownIcon, Info } from "lucide-react";
import { EvaluationPayload } from "./types";
import { User, useAuth } from "@/contexts/UserContext";

interface Step2Props {
  data: EvaluationPayload;
  updateDataAction: (updates: Partial<EvaluationPayload>) => void;
  employee?: User | null;
  evaluationType?: 'rankNfile' | 'basic' | 'default'; // Optional: evaluation type to determine HO context
  forceShowJobTargets?: boolean; // Optional: force show job targets (for BranchManagerEvaluationForm)
}

// Score Dropdown Component
function ScoreDropdown({
  value,
  onValueChange,
  placeholder = "Select Score",
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) {
  const getScoreColor = (score: string) => {
    switch (score) {
      case "5":
        return "text-green-700 bg-green-100";
      case "4":
        return "text-blue-700 bg-blue-100";
      case "3":
        return "text-yellow-700 bg-yellow-100";
      case "2":
        return "text-orange-700 bg-orange-100";
      case "1":
        return "text-red-700 bg-red-100";
      default:
        return "text-gray-500 bg-gray-100";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`w-15 px-1 py-2 text-lg font-bold border-2 border-yellow-400 rounded-md bg-yellow-100 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm min-h-[40px]
           justify-between inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none
            disabled:opacity-50 border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground cursor-pointer hover:scale-110 transition-transform duration-200 ${getScoreColor(
          value
        )}`}
      >
        {value || ""}
        <ChevronDownIcon className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-32 min-w-[128px] bg-white border-2 border-yellow-400">
        <DropdownMenuItem
          onClick={() => onValueChange("1")}
          className="text-lg font-bold text-red-700 hover:bg-red-50 py-2 text-center justify-center cursor-pointer hover:scale-110 transition-transform duration-200"
        >
          1
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onValueChange("2")}
          className="text-lg font-bold text-orange-700 hover:bg-orange-50 py-2 text-center justify-center cursor-pointer hover:scale-110 transition-transform duration-200"
        >
          2
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onValueChange("3")}
          className="text-lg font-bold text-yellow-700 hover:bg-yellow-50 py-2 text-center justify-center cursor-pointer hover:scale-110 transition-transform duration-200"
        >
          3
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onValueChange("4")}
          className="text-lg font-bold text-blue-700 hover:bg-blue-50 py-2 text-center justify-center cursor-pointer hover:scale-110 transition-transform duration-200"
        >
          4
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onValueChange("5")}
          className="text-lg font-bold text-green-700 hover:bg-green-50 py-2 text-center justify-center cursor-pointer hover:scale-110 transition-transform duration-200"
        >
          5
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Step2({ data, updateDataAction, employee, evaluationType, forceShowJobTargets = false }: Step2Props) {
  const { user } = useAuth();
  const [showJobTargetsInfoDialog, setShowJobTargetsInfoDialog] = useState(false);
  
  // Check if employee being evaluated is HO (Head Office)
  // This determines the evaluationType based on the employee being evaluated, not the evaluator
  const isEmployeeHO = () => {
    if (!employee?.branches) {
      // Fallback: if evaluationType is 'rankNfile' or 'basic', it's definitely an HO evaluation
      return evaluationType === 'rankNfile' || evaluationType === 'basic';
    }
    
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
    
    // Fallback: check if branch field exists directly
    if ((employee as any).branch) {
      const branchName = String((employee as any).branch).toUpperCase();
      return (
        branchName === "HO" || 
        branchName === "HEAD OFFICE" ||
        branchName.includes("HEAD OFFICE") ||
        branchName.includes("/HO")
      );
    }
    
    // Final fallback: if evaluationType is 'rankNfile' or 'basic', it's definitely an HO evaluation
    return evaluationType === 'rankNfile' || evaluationType === 'basic';
  };

  // Check if employee is Branch Manager or Branch Supervisor
  const isEmployeeBranchManagerOrSupervisor = () => {
    if (!employee?.positions) return false;
    
    // Get position name from various possible fields
    const positionName = (
      employee.positions?.label || 
      employee.positions?.name || 
      (employee as any).position ||
      ""
    ).toUpperCase().trim();
    
    // Check if position is any Manager (excluding Area Manager) or Supervisor
    const isManager = positionName.includes('MANAGER') && !positionName.includes('AREA MANAGER');
    const isSupervisor = positionName.includes('SUPERVISOR');
    
    return isManager || isSupervisor;
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

  // Determine if this is an HO evaluation based on employee's branch
  // If evaluationType is 'rankNfile' or 'basic', it's definitely an HO evaluation
  const isHO = isEmployeeHO();
  
  // Show Job Targets if:
  // 1. forceShowJobTargets is true (for BranchManagerEvaluationForm)
  // 2. OR employee is Area Manager
  // 3. OR employee is Branch Manager/Supervisor and not HO
  const showJobTargets = forceShowJobTargets || isEmployeeAreaManager() || (isEmployeeBranchManagerOrSupervisor() && !isHO);
  
  // Show info dialog when job targets are visible (once per session)
  useEffect(() => {
    if (showJobTargets) {
      // Check if user has already seen the dialog in this session
      const hasSeenDialog = sessionStorage.getItem('jobTargetsInfoDialogShown');
      if (!hasSeenDialog) {
        setShowJobTargetsInfoDialog(true);
        sessionStorage.setItem('jobTargetsInfoDialogShown', 'true');
      }
    }
  }, [showJobTargets]);
  
  // Calculate average score for Quality of Work
  // Includes: qualityOfWorkScore1-4 (required), and all job target scores if they exist (optional)
  const calculateAverageScore = () => {
    const baseScores = [
      data.qualityOfWorkScore1,
      data.qualityOfWorkScore2,
      data.qualityOfWorkScore3,
      data.qualityOfWorkScore4,
    ];
    
    // Include job target scores if Job Targets should be shown (they're optional, so include if they exist)
    const jobTargetScores = showJobTargets ? [
      data.jobTargetMotorcyclesScore,
      data.jobTargetAppliancesScore,
      data.jobTargetCarsScore,
      data.jobTargetTriWheelersScore,
      data.jobTargetCollectionScore,
      data.jobTargetSparepartsLubricantsScore,
      data.jobTargetShopIncomeScore,
    ] : [];
    
    const allScores = [...baseScores, ...jobTargetScores]
      .filter((score) => score && score !== 0)
      .map((score) => parseInt(String(score)));

    if (allScores.length === 0) return "0.00";
    return (
      allScores.reduce((sum, score) => sum + score, 0) / allScores.length
    ).toFixed(2);
  };

  const averageScore = calculateAverageScore();
  const averageScoreNumber = parseFloat(averageScore);

  const getAverageScoreColor = (score: number) => {
    if (score >= 4.5) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 3.5) return "bg-blue-100 text-blue-800 border-blue-300";
    if (score >= 2.5) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (score >= 1.5) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getAverageScoreLabel = (score: number) => {
    if (score >= 4.5) return "Outstanding";
    if (score >= 3.5) return "Exceeds Expectation";
    if (score >= 2.5) return "Meets Expectations";
    if (score >= 1.5) return "Needs Improvement";
    return "Unsatisfactory";
  };

  return (
    <div className="space-y-6">
      {/* Job Targets Information Dialog */}
      <Dialog open={showJobTargetsInfoDialog} onOpenChangeAction={setShowJobTargetsInfoDialog}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="space-y-3 pb-4">
            <DialogTitle className="flex items-center gap-2 text-blue-600 text-xl font-semibold">
              <Info className="h-5 w-5" />
              Job Targets - Optional Fields
            </DialogTitle>
            <DialogDescription className="text-gray-700 text-base">
              The following 7 job target rows are <strong>optional</strong> 
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-3">
              <p className="text-sm text-gray-800 font-semibold">
                Please note:
              </p>
              <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside pl-2">
                <li>Only the top 4 Quality of Work rows are required</li>
                <li>The 7 job target rows below are optional</li>
                <li>If a job target is <strong>not applicable</strong> to you, simply <strong>leave it blank</strong></li>
                <li>Only fill in the job targets that are <strong>applicable to your role</strong></li>
              </ul>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button 
              onClick={() => setShowJobTargetsInfoDialog(false)}
              className="w-full bg-blue-600 hover:bg-green-600 cursor-pointer hover:scale-110 transition-transform duration-200 text-white px-6 py-2"
            >
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* II. QUALITY OF WORK Section */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              II. QUALITY OF WORK
            </h3>
            <p className="text-sm text-gray-600">
              Accuracy and precision in completing tasks. Attention to detail.
              Consistency in delivering high-quality results. Timely completion
              of tasks and projects. Effective use of resources. Ability to meet
              deadlines.
            </p>
          </div>


          {/* Quality of Work Reset Button */}
          <div className="flex justify-end mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                updateDataAction({
                  // Base Quality of Work scores
                  qualityOfWorkScore1: 0,
                  qualityOfWorkScore2: 0,
                  qualityOfWorkScore3: 0,
                  qualityOfWorkScore4: 0,
                  qualityOfWorkScore5: 0,
                  // Job Target scores (qualityOfWorkScore6-12 for backend mapping)
                  
                  // Job Target specific scores (what the form inputs are bound to)
                  jobTargetMotorcyclesScore: 0,
                  jobTargetAppliancesScore: 0,
                  jobTargetCarsScore: 0,
                  jobTargetTriWheelersScore: 0,
                  jobTargetCollectionScore: 0,
                  jobTargetSparepartsLubricantsScore: 0,
                  jobTargetShopIncomeScore: 0,
                  // Base Quality of Work comments
                  qualityOfWorkComments1: "",
                  qualityOfWorkComments2: "",
                  qualityOfWorkComments3: "",
                  qualityOfWorkComments4: "",
                  qualityOfWorkComments5: "",
                  // Job Target comments (qualityOfWorkComments6-12 for backend mapping)
                  qualityOfWorkComments6: "",
                  qualityOfWorkComments7: "",
                  qualityOfWorkComments8: "",
                  qualityOfWorkComments9: "",
                  qualityOfWorkComments10: "",
                  qualityOfWorkComments11: "",
                  qualityOfWorkComments12: "",
                  // Job Target specific comments (what the form inputs are bound to)
                  jobTargetMotorcyclesComment: "",
                  jobTargetAppliancesComment: "",
                  jobTargetCarsComment: "",
                  jobTargetTriWheelersComment: "",
                  jobTargetCollectionComment: "",
                  jobTargetSparepartsLubricantsComment: "",
                  jobTargetShopIncomeComment: "",
                });
              }}
              className="text-xs px-3 py-1 h-7 bg-blue-500 text-white border-gray-300 hover:text-white hover:bg-blue-700 cursor-pointer hover:scale-110 transition-transform duration-200 "
            >
              Clear Quality of Work Scores
            </Button>
          </div>

          {/* Evaluation Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900 w-16"></th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 w-1/4">
                    Behavioral Indicators
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 w-1/5">
                    Example
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 w-32 bg-yellow-200">
                    SCORE
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900 w-32">
                    Rating
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 w-1/4">
                    Comments
                  </th>
                </tr>
              </thead>
              <tbody>

                {/* Row 1: Meets Standards and Requirements */}
                <tr>
                  <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                    Meets Standards and Requirements
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                    Ensures work is accurate and meets or exceeds established
                    standards
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                    Complies with industry regulations and project
                    specifications; delivers reliable, high-quality work, and
                    accurate work.
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <ScoreDropdown
                      value={String(data.qualityOfWorkScore1)}
                      onValueChange={(value) =>
                        updateDataAction({ qualityOfWorkScore1: Number(value) })
                      }
                      placeholder="-- Select --"
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <div
                      className={`px-2 py-1 rounded-md text-sm font-bold ${
                        data.qualityOfWorkScore1 === 5
                          ? "bg-green-100 text-green-800"
                          : data.qualityOfWorkScore1 === 4
                          ? "bg-blue-100 text-blue-800"
                          : data.qualityOfWorkScore1 === 3
                          ? "bg-yellow-100 text-yellow-800"
                          : data.qualityOfWorkScore1 === 2
                          ? "bg-orange-100 text-orange-800"
                          : data.qualityOfWorkScore1 === 1
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {data.qualityOfWorkScore1 === 5
                        ? "Outstanding"
                        : data.qualityOfWorkScore1 === 4
                        ? "Exceeds Expectation"
                        : data.qualityOfWorkScore1 === 3
                        ? "Meets Expectations"
                        : data.qualityOfWorkScore1 === 2
                        ? "Needs Improvement"
                        : data.qualityOfWorkScore1 === 1
                        ? "Unsatisfactory"
                        : "Not Rated"}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <textarea
                      value={data.qualityOfWorkComments1 || ""}
                      onChange={(e) =>
                        updateDataAction({
                          qualityOfWorkComments1: e.target.value,
                        })
                      }
                      placeholder="Enter comments about this competency..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                  </td>
                </tr>

                {/* Row 2: Timeliness (L.E.A.D.E.R.) */}
                <tr>
                  <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                    "Timeliness (L.E.A.D.E.R.)"
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                    Completes tasks and projects within specified deadlines
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                    Submits work on time without compromising quality.
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <ScoreDropdown
                      value={String(data.qualityOfWorkScore2)}
                      onValueChange={(value) =>
                        updateDataAction({
                          qualityOfWorkScore2: Number(value),
                        })
                      }
                      placeholder="-- Select --"
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <div
                      className={`px-2 py-1 rounded-md text-sm font-bold ${
                        data.qualityOfWorkScore2 === 5
                          ? "bg-green-100 text-green-800"
                          : data.qualityOfWorkScore2 === 4
                          ? "bg-blue-100 text-blue-800"
                          : data.qualityOfWorkScore2 === 3
                          ? "bg-yellow-100 text-yellow-800"
                          : data.qualityOfWorkScore2 === 2
                          ? "bg-orange-100 text-orange-800"
                          : data.qualityOfWorkScore2 === 1
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {data.qualityOfWorkScore2 === 5
                        ? "Outstanding"
                        : data.qualityOfWorkScore2 === 4
                        ? "Exceeds Expectation"
                        : data.qualityOfWorkScore2 === 3
                        ? "Meets Expectations"
                        : data.qualityOfWorkScore2 === 2
                        ? "Needs Improvement"
                        : data.qualityOfWorkScore2 === 1
                        ? "Unsatisfactory"
                        : "Not Rated"}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <textarea
                      value={data.qualityOfWorkComments2 || ""}
                      onChange={(e) =>
                        updateDataAction({
                          qualityOfWorkComments2: e.target.value,
                        })
                      }
                      placeholder="Enter comments about this competency..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                  </td>
                </tr>

                {/* Row 3: Work Output Volume (L.E.A.D.E.R.) */}
                <tr>
                  <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                    "Work Output Volume (L.E.A.D.E.R.)"
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                    Produces a high volume of quality work within a given time
                    frame
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                    Handles a substantial workload without sacrificing quality.
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <ScoreDropdown
                      value={String(data.qualityOfWorkScore3)}
                      onValueChange={(value) =>
                        updateDataAction({ qualityOfWorkScore3: Number(value) })
                      }
                      placeholder="-- Select --"
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <div
                      className={`px-2 py-1 rounded-md text-sm font-bold ${
                        data.qualityOfWorkScore3 === 5
                          ? "bg-green-100 text-green-800"
                          : data.qualityOfWorkScore3 === 4
                          ? "bg-blue-100 text-blue-800"
                          : data.qualityOfWorkScore3 === 3
                          ? "bg-yellow-100 text-yellow-800"
                          : data.qualityOfWorkScore3 === 2
                          ? "bg-orange-100 text-orange-800"
                          : data.qualityOfWorkScore3 === 1
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {data.qualityOfWorkScore3 === 5
                        ? "Outstanding"
                        : data.qualityOfWorkScore3 === 4
                        ? "Exceeds Expectation"
                        : data.qualityOfWorkScore3 === 3
                        ? "Meets Expectations"
                        : data.qualityOfWorkScore3 === 2
                        ? "Needs Improvement"
                        : data.qualityOfWorkScore3 === 1
                        ? "Unsatisfactory"
                        : "Not Rated"}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <textarea
                      value={data.qualityOfWorkComments3 || ""}
                      onChange={(e) =>
                        updateDataAction({
                          qualityOfWorkComments3: e.target.value,
                        })
                      }
                      placeholder="Enter comments about this competency..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                  </td>
                </tr>

                {/* Row 4: Consistency in Performance (L.E.A.D.E.R.) */}
                <tr>
                  <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                    "Consistency in Performance (L.E.A.D.E.R.)"
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                    Maintains a consistent level of productivity over time
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                    Meets productivity expectations reliably, without
                    significant fluctuations.
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <ScoreDropdown
                      value={String(data.qualityOfWorkScore4)}
                      onValueChange={(value) =>
                        updateDataAction({ qualityOfWorkScore4: Number(value) })
                      }
                      placeholder="-- Select --"
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <div
                      className={`px-2 py-1 rounded-md text-sm font-bold ${
                        data.qualityOfWorkScore4 === 5
                          ? "bg-green-100 text-green-800"
                          : data.qualityOfWorkScore4 === 4
                          ? "bg-blue-100 text-blue-800"
                          : data.qualityOfWorkScore4 === 3
                          ? "bg-yellow-100 text-yellow-800"
                          : data.qualityOfWorkScore4 === 2
                          ? "bg-orange-100 text-orange-800"
                          : data.qualityOfWorkScore4 === 1
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {data.qualityOfWorkScore4 === 5
                        ? "Outstanding"
                        : data.qualityOfWorkScore4 === 4
                        ? "Exceeds Expectation"
                        : data.qualityOfWorkScore4 === 3
                        ? "Meets Expectations"
                        : data.qualityOfWorkScore4 === 2
                        ? "Needs Improvement"
                        : data.qualityOfWorkScore4 === 1
                        ? "Unsatisfactory"
                        : "Not Rated"}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <textarea
                      value={data.qualityOfWorkComments4 || ""}
                      onChange={(e) =>
                        updateDataAction({
                          qualityOfWorkComments4: e.target.value,
                        })
                      }
                      placeholder="Enter comments about this competency..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                  </td>
                </tr>

                {/* Job Targets Section - Multiple target types (Optional - always visible when showJobTargets is true) */}
                {showJobTargets && (
                  <>
                    {/* Sales Targets for MOTORCYCLES */}
                    <tr>
                      <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                        Sales Targets for MOTORCYCLES
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Achieves branch sales targets for motorcycles
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Consistently hits monthly sales targets.
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <ScoreDropdown
                          value={String(data.jobTargetMotorcyclesScore || 0)}
                          onValueChange={(value) => {
                            const scoreValue = Number(value);
                            updateDataAction({ 
                              jobTargetMotorcyclesScore: scoreValue,
                              qualityOfWorkScore6: scoreValue // Also update qualityOfWorkScore6 for backend mapping
                            });
                          }}
                          placeholder="-- Select --"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <div
                          className={`px-2 py-1 rounded-md text-sm font-bold ${
                            (data.jobTargetMotorcyclesScore || 0) === 5
                              ? "bg-green-100 text-green-800"
                              : (data.jobTargetMotorcyclesScore || 0) === 4
                              ? "bg-blue-100 text-blue-800"
                              : (data.jobTargetMotorcyclesScore || 0) === 3
                              ? "bg-yellow-100 text-yellow-800"
                              : (data.jobTargetMotorcyclesScore || 0) === 2
                              ? "bg-orange-100 text-orange-800"
                              : (data.jobTargetMotorcyclesScore || 0) === 1
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {(data.jobTargetMotorcyclesScore || 0) === 5
                            ? "Outstanding"
                            : (data.jobTargetMotorcyclesScore || 0) === 4
                            ? "Exceeds Expectation"
                            : (data.jobTargetMotorcyclesScore || 0) === 3
                            ? "Meets Expectations"
                            : (data.jobTargetMotorcyclesScore || 0) === 2
                            ? "Needs Improvement"
                            : (data.jobTargetMotorcyclesScore || 0) === 1
                            ? "Unsatisfactory"
                            : "Not Rated"}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <textarea
                          value={data.jobTargetMotorcyclesComment || ""}
                          onChange={(e) =>
                            updateDataAction({
                              jobTargetMotorcyclesComment: e.target.value,
                              qualityOfWorkComments6: e.target.value, // Also update for backend mapping
                            })
                          }
                          placeholder="Enter comments..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </td>
                    </tr>

                    {/* Sales Targets for APPLIANCES */}
                    <tr>
                      <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                        Sales Targets for APPLIANCES
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Achieves branch sales targets for appliances
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Consistently hits monthly sales targets.
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <ScoreDropdown
                          value={String(data.jobTargetAppliancesScore || 0)}
                          onValueChange={(value) => {
                            const scoreValue = Number(value);
                            updateDataAction({ 
                              jobTargetAppliancesScore: scoreValue,
                              qualityOfWorkScore7: scoreValue // Also update qualityOfWorkScore7 for backend mapping
                            });
                          }}
                          placeholder="-- Select --"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <div
                          className={`px-2 py-1 rounded-md text-sm font-bold ${
                            (data.jobTargetAppliancesScore || 0) === 5
                              ? "bg-green-100 text-green-800"
                              : (data.jobTargetAppliancesScore || 0) === 4
                              ? "bg-blue-100 text-blue-800"
                              : (data.jobTargetAppliancesScore || 0) === 3
                              ? "bg-yellow-100 text-yellow-800"
                              : (data.jobTargetAppliancesScore || 0) === 2
                              ? "bg-orange-100 text-orange-800"
                              : (data.jobTargetAppliancesScore || 0) === 1
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {(data.jobTargetAppliancesScore || 0) === 5
                            ? "Outstanding"
                            : (data.jobTargetAppliancesScore || 0) === 4
                            ? "Exceeds Expectation"
                            : (data.jobTargetAppliancesScore || 0) === 3
                            ? "Meets Expectations"
                            : (data.jobTargetAppliancesScore || 0) === 2
                            ? "Needs Improvement"
                            : (data.jobTargetAppliancesScore || 0) === 1
                            ? "Unsatisfactory"
                            : "Not Rated"}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <textarea
                          value={data.jobTargetAppliancesComment || ""}
                          onChange={(e) =>
                            updateDataAction({
                              jobTargetAppliancesComment: e.target.value,
                              qualityOfWorkComments7: e.target.value, // Also update for backend mapping
                            })
                          }
                          placeholder="Enter comments..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </td>
                    </tr>

                    {/* Sales Targets for CARS */}
                    <tr>
                      <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                        Sales Targets for CARS
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Achieves branch sales targets for cars
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Consistently hits monthly sales targets.
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <ScoreDropdown
                          value={String(data.jobTargetCarsScore || 0)}
                          onValueChange={(value) => {
                            const scoreValue = Number(value);
                            updateDataAction({ 
                              jobTargetCarsScore: scoreValue,
                              qualityOfWorkScore8: scoreValue // Also update qualityOfWorkScore8 for backend mapping
                            });
                          }}
                          placeholder="-- Select --"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <div
                          className={`px-2 py-1 rounded-md text-sm font-bold ${
                            (data.jobTargetCarsScore || 0) === 5
                              ? "bg-green-100 text-green-800"
                              : (data.jobTargetCarsScore || 0) === 4
                              ? "bg-blue-100 text-blue-800"
                              : (data.jobTargetCarsScore || 0) === 3
                              ? "bg-yellow-100 text-yellow-800"
                              : (data.jobTargetCarsScore || 0) === 2
                              ? "bg-orange-100 text-orange-800"
                              : (data.jobTargetCarsScore || 0) === 1
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {(data.jobTargetCarsScore || 0) === 5
                            ? "Outstanding"
                            : (data.jobTargetCarsScore || 0) === 4
                            ? "Exceeds Expectation"
                            : (data.jobTargetCarsScore || 0) === 3
                            ? "Meets Expectations"
                            : (data.jobTargetCarsScore || 0) === 2
                            ? "Needs Improvement"
                            : (data.jobTargetCarsScore || 0) === 1
                            ? "Unsatisfactory"
                            : "Not Rated"}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <textarea
                          value={data.jobTargetCarsComment || ""}
                          onChange={(e) =>
                            updateDataAction({
                              jobTargetCarsComment: e.target.value,
                              qualityOfWorkComments8: e.target.value, // Also update for backend mapping
                            })
                          }
                          placeholder="Enter comments..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </td>
                    </tr>

                    {/* Sales Targets for TRI-WHEELERS (for 3S Shops only) */}
                    <tr>
                      <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                        Sales Targets for TRI-WHEELERS (for 3S Shops only)
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Achieves branch sales targets for tri-wheelers
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Consistently hits monthly sales targets.
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <ScoreDropdown
                          value={String(data.jobTargetTriWheelersScore || 0)}
                          onValueChange={(value) => {
                            const scoreValue = Number(value);
                            updateDataAction({ 
                              jobTargetTriWheelersScore: scoreValue,
                              qualityOfWorkScore9: scoreValue // Also update qualityOfWorkScore9 for backend mapping
                            });
                          }}
                          placeholder="-- Select --"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <div
                          className={`px-2 py-1 rounded-md text-sm font-bold ${
                            (data.jobTargetTriWheelersScore || 0) === 5
                              ? "bg-green-100 text-green-800"
                              : (data.jobTargetTriWheelersScore || 0) === 4
                              ? "bg-blue-100 text-blue-800"
                              : (data.jobTargetTriWheelersScore || 0) === 3
                              ? "bg-yellow-100 text-yellow-800"
                              : (data.jobTargetTriWheelersScore || 0) === 2
                              ? "bg-orange-100 text-orange-800"
                              : (data.jobTargetTriWheelersScore || 0) === 1
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {(data.jobTargetTriWheelersScore || 0) === 5
                            ? "Outstanding"
                            : (data.jobTargetTriWheelersScore || 0) === 4
                            ? "Exceeds Expectation"
                            : (data.jobTargetTriWheelersScore || 0) === 3
                            ? "Meets Expectations"
                            : (data.jobTargetTriWheelersScore || 0) === 2
                            ? "Needs Improvement"
                            : (data.jobTargetTriWheelersScore || 0) === 1
                            ? "Unsatisfactory"
                            : "Not Rated"}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <textarea
                          value={data.jobTargetTriWheelersComment || ""}
                          onChange={(e) =>
                            updateDataAction({
                              jobTargetTriWheelersComment: e.target.value,
                              qualityOfWorkComments9: e.target.value, // Also update for backend mapping
                            })
                          }
                          placeholder="Enter comments..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </td>
                    </tr>

                    {/* Collection Targets */}
                    <tr>
                      <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                        Collection Targets
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Achieves branch collection targets
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Consistently hits monthly collection targets.
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <ScoreDropdown
                          value={String(data.jobTargetCollectionScore || 0)}
                          onValueChange={(value) => {
                            const scoreValue = Number(value);
                            updateDataAction({ 
                              jobTargetCollectionScore: scoreValue,
                              qualityOfWorkScore10: scoreValue // Also update qualityOfWorkScore10 for backend mapping
                            });
                          }}
                          placeholder="-- Select --"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <div
                          className={`px-2 py-1 rounded-md text-sm font-bold ${
                            (data.jobTargetCollectionScore || 0) === 5
                              ? "bg-green-100 text-green-800"
                              : (data.jobTargetCollectionScore || 0) === 4
                              ? "bg-blue-100 text-blue-800"
                              : (data.jobTargetCollectionScore || 0) === 3
                              ? "bg-yellow-100 text-yellow-800"
                              : (data.jobTargetCollectionScore || 0) === 2
                              ? "bg-orange-100 text-orange-800"
                              : (data.jobTargetCollectionScore || 0) === 1
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {(data.jobTargetCollectionScore || 0) === 5
                            ? "Outstanding"
                            : (data.jobTargetCollectionScore || 0) === 4
                            ? "Exceeds Expectation"
                            : (data.jobTargetCollectionScore || 0) === 3
                            ? "Meets Expectations"
                            : (data.jobTargetCollectionScore || 0) === 2
                            ? "Needs Improvement"
                            : (data.jobTargetCollectionScore || 0) === 1
                            ? "Unsatisfactory"
                            : "Not Rated"}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <textarea
                          value={data.jobTargetCollectionComment || ""}
                          onChange={(e) =>
                            updateDataAction({
                              jobTargetCollectionComment: e.target.value,
                              qualityOfWorkComments10: e.target.value, // Also update for backend mapping
                            })
                          }
                          placeholder="Enter comments..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </td>
                    </tr>

                    {/* Spareparts & Lubricants Targets */}
                    <tr>
                      <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                        Spareparts & Lubricants Targets
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Achieves branch spareparts and lubricants targets
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Consistently hits monthly spareparts and lubricants targets.
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <ScoreDropdown
                          value={String(data.jobTargetSparepartsLubricantsScore || 0)}
                          onValueChange={(value) => {
                            const scoreValue = Number(value);
                            updateDataAction({ 
                              jobTargetSparepartsLubricantsScore: scoreValue,
                              qualityOfWorkScore11: scoreValue // Also update qualityOfWorkScore11 for backend mapping
                            });
                          }}
                          placeholder="-- Select --"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <div
                          className={`px-2 py-1 rounded-md text-sm font-bold ${
                            (data.jobTargetSparepartsLubricantsScore || 0) === 5
                              ? "bg-green-100 text-green-800"
                              : (data.jobTargetSparepartsLubricantsScore || 0) === 4
                              ? "bg-blue-100 text-blue-800"
                              : (data.jobTargetSparepartsLubricantsScore || 0) === 3
                              ? "bg-yellow-100 text-yellow-800"
                              : (data.jobTargetSparepartsLubricantsScore || 0) === 2
                              ? "bg-orange-100 text-orange-800"
                              : (data.jobTargetSparepartsLubricantsScore || 0) === 1
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {(data.jobTargetSparepartsLubricantsScore || 0) === 5
                            ? "Outstanding"
                            : (data.jobTargetSparepartsLubricantsScore || 0) === 4
                            ? "Exceeds Expectation"
                            : (data.jobTargetSparepartsLubricantsScore || 0) === 3
                            ? "Meets Expectations"
                            : (data.jobTargetSparepartsLubricantsScore || 0) === 2
                            ? "Needs Improvement"
                            : (data.jobTargetSparepartsLubricantsScore || 0) === 1
                            ? "Unsatisfactory"
                            : "Not Rated"}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <textarea
                          value={data.jobTargetSparepartsLubricantsComment || ""}
                          onChange={(e) =>
                            updateDataAction({
                              jobTargetSparepartsLubricantsComment: e.target.value,
                              qualityOfWorkComments11: e.target.value, // Also update for backend mapping
                            })
                          }
                          placeholder="Enter comments..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </td>
                    </tr>

                    {/* Shop Income Targets */}
                    <tr>
                      <td className="border border-gray-300 font-bold text-center px-4 py-3 text-sm text-black">
                        Shop Income Targets
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Achieves branch shop income targets
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        Consistently hits monthly shop income targets.
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <ScoreDropdown
                          value={String(data.jobTargetShopIncomeScore || 0)}
                          onValueChange={(value) => {
                            const scoreValue = Number(value);
                            updateDataAction({ 
                              jobTargetShopIncomeScore: scoreValue,
                              qualityOfWorkScore12: scoreValue // Also update qualityOfWorkScore12 for backend mapping
                            });
                          }}
                          placeholder="-- Select --"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <div
                          className={`px-2 py-1 rounded-md text-sm font-bold ${
                            (data.jobTargetShopIncomeScore || 0) === 5
                              ? "bg-green-100 text-green-800"
                              : (data.jobTargetShopIncomeScore || 0) === 4
                              ? "bg-blue-100 text-blue-800"
                              : (data.jobTargetShopIncomeScore || 0) === 3
                              ? "bg-yellow-100 text-yellow-800"
                              : (data.jobTargetShopIncomeScore || 0) === 2
                              ? "bg-orange-100 text-orange-800"
                              : (data.jobTargetShopIncomeScore || 0) === 1
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {(data.jobTargetShopIncomeScore || 0) === 5
                            ? "Outstanding"
                            : (data.jobTargetShopIncomeScore || 0) === 4
                            ? "Exceeds Expectation"
                            : (data.jobTargetShopIncomeScore || 0) === 3
                            ? "Meets Expectations"
                            : (data.jobTargetShopIncomeScore || 0) === 2
                            ? "Needs Improvement"
                            : (data.jobTargetShopIncomeScore || 0) === 1
                            ? "Unsatisfactory"
                            : "Not Rated"}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <textarea
                          value={data.jobTargetShopIncomeComment || ""}
                          onChange={(e) =>
                            updateDataAction({
                              jobTargetShopIncomeComment: e.target.value,
                              qualityOfWorkComments12: e.target.value, // Also update for backend mapping
                            })
                          }
                          placeholder="Enter comments..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Average Score Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Quality of Work - Average Score
            </h3>
            <div className="flex justify-center items-center gap-6">
              <div
                className={`px-6 py-4 rounded-lg border-2 ${getAverageScoreColor(
                  averageScoreNumber
                )}`}
              >
                <div className="text-3xl font-bold">{averageScore}</div>
                <div className="text-sm font-medium mt-1">
                  {getAverageScoreLabel(averageScoreNumber)}
                </div>
              </div>
              <div className="text-left">
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Score Breakdown:</strong>
                </div>
                <div className="space-y-1 text-sm">
                  <div>
                    Meets Standards and Requirements:{" "}
                    <span className="font-semibold">
                      {data.qualityOfWorkScore1 || "Not rated"}
                    </span>
                  </div>
                  <div>
                    Timeliness:{" "}
                    <span className="font-semibold">
                      {data.qualityOfWorkScore2 || "Not rated"}
                    </span>
                  </div>
                  <div>
                    Work Output Volume:{" "}
                    <span className="font-semibold">
                      {data.qualityOfWorkScore3 || "Not rated"}
                    </span>
                  </div>
                  <div>
                    Consistency in Performance:{" "}
                    <span className="font-semibold">
                      {data.qualityOfWorkScore4 || "Not rated"}
                    </span>
                  </div>
                  {showJobTargets && (
                    <>
                      <div>
                        Sales Targets for MOTORCYCLES:{" "}
                        <span className="font-semibold">
                          {data.jobTargetMotorcyclesScore || "Not rated"}
                        </span>
                      </div>
                      <div>
                        Sales Targets for APPLIANCES:{" "}
                        <span className="font-semibold">
                          {data.jobTargetAppliancesScore || "Not rated"}
                        </span>
                      </div>
                      <div>
                        Sales Targets for CARS:{" "}
                        <span className="font-semibold">
                          {data.jobTargetCarsScore || "Not rated"}
                        </span>
                      </div>
                      <div>
                        Sales Targets for TRI-WHEELERS:{" "}
                        <span className="font-semibold">
                          {data.jobTargetTriWheelersScore || "Not rated"}
                        </span>
                      </div>
                      <div>
                        Collection Targets:{" "}
                        <span className="font-semibold">
                          {data.jobTargetCollectionScore || "Not rated"}
                        </span>
                      </div>
                      <div>
                        Spareparts & Lubricants Targets:{" "}
                        <span className="font-semibold">
                          {data.jobTargetSparepartsLubricantsScore || "Not rated"}
                        </span>
                      </div>
                      <div>
                        Shop Income Targets:{" "}
                        <span className="font-semibold">
                          {data.jobTargetShopIncomeScore || "Not rated"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Average calculated from{" "}
              {
                [
                  data.qualityOfWorkScore1,
                  data.qualityOfWorkScore2,
                  data.qualityOfWorkScore3,
                  data.qualityOfWorkScore4,
                  ...(showJobTargets ? [
                    data.jobTargetMotorcyclesScore,
                    data.jobTargetAppliancesScore,
                    data.jobTargetCarsScore,
                    data.jobTargetTriWheelersScore,
                    data.jobTargetCollectionScore,
                    data.jobTargetSparepartsLubricantsScore,
                    data.jobTargetShopIncomeScore,
                  ] : []),
                ].filter((score) => score && score !== 0).length
              }{" "}
              of {showJobTargets ? "up to 11" : 4} criteria (Job Targets are optional)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

