"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Briefcase, ArrowRight, Building2, ClipboardCheck, X } from "lucide-react";
import { useDialogAnimation } from "@/hooks/useDialogAnimation";
import { User, useUser } from "@/contexts/UserContext";

interface EvaluationTypeModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  onSelectEmployeeAction: () => void;
  onSelectManagerAction: () => void;
  onSelectAreaManagerAction?: () => void;
  employeeName?: string;
  employee?: User | null;
}

export default function EvaluationTypeModal({
  isOpen,
  onCloseAction,
  onSelectEmployeeAction,
  onSelectManagerAction,
  onSelectAreaManagerAction,
  employeeName,
  employee,
}: EvaluationTypeModalProps) {
  const dialogAnimationClass = useDialogAnimation({ duration: 0.4 });
  const { user } = useUser();

  const handleSelectEmployee = () => {
    onSelectEmployeeAction();
    onCloseAction();
  };

  const handleSelectManager = () => {
    onSelectManagerAction();
    onCloseAction();
  };

  const handleSelectAreaManager = () => {
    if (onSelectAreaManagerAction) {
      onSelectAreaManagerAction();
      onCloseAction();
    }
  };

  // Check if BOTH conditions are met:
  // 1. Logged-in user is AVP - Sales & Marketing
  // 2. Employee being evaluated is Area Manager or Cluster Head
  const showAreaManagerOption = (() => {
    // Check logged-in user's position
    const userPositionName = (
      user?.positions?.label ||
      user?.positions?.name ||
      ""
    ).toLowerCase();
    const isUserAVP = userPositionName.includes("avp - sales & marketing") || userPositionName.includes("avp sales marketing");

    // Check employee's position (the one being evaluated)
    const employeePositionName = (
      employee?.positions?.label ||
      employee?.positions?.name ||
      ""
    ).toLowerCase();
    const isEmployeeAreaManager =
      employeePositionName.includes("area manager") ||
      employeePositionName.includes("cluster head");

    // Both conditions must be true
    return isUserAVP && isEmployeeAreaManager;
  })();

  return (
    <Dialog open={isOpen} onOpenChangeAction={onCloseAction}>
      <DialogContent
        className={`${showAreaManagerOption ? "max-w-5xl" : "max-w-3xl"} ${dialogAnimationClass} p-0 overflow-hidden relative`}
      >
        {/* Faded background image */}
        <div
          className="pointer-events-none absolute inset-0 opacity-12"
          style={{
            backgroundImage: 'url(/smct.png)',
            backgroundSize: "80%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        {/* Foreground content */}
        <div className="relative z-10">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-8 py-6 text-white relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCloseAction}
            className="absolute top-4 right-4 cursor-pointer hover:bg-white/20 text-white h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <ClipboardCheck className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Select Evaluation Type</h2>
              <p className="text-blue-100 mt-1">
                {employeeName
                  ? `Choose the type of evaluation for ${employeeName}`
                  : "Choose the type of evaluation you want to start"}
              </p>
            </div>
          </div>
        </div>

        {/* Cards Section */}
        <div className="p-8">
          <div className={`grid gap-6 grid-cols-1 ${showAreaManagerOption ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {/* Employee Evaluation Option (Rank and File) */}
            <Card
              className="cursor-pointer hover:shadow-xl transition-all hover:bg-blue-100 duration-300 border-0 shadow-md group overflow-hidden relative animate-fade-in-up-delay-1s"
              onClick={handleSelectEmployee}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600"></div>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md shadow-sm">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Rank and File
                    </h3>
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                      Standard performance evaluation for rank and file employees.
                      Assesses job knowledge, quality of work, and teamwork.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mb-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                        Rank & File I & II
                      </span>
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                        7 Steps
                      </span>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectEmployee();
                    }}
                  >
                    Select
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Manager Evaluation Option (Basic) */}
            <Card
              className="cursor-pointer hover:shadow-xl transition-all hover:bg-green-100 duration-300 border-0 shadow-md group overflow-hidden relative animate-fade-in-up-delay-2s"
              onClick={handleSelectManager}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-600"></div>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md shadow-sm">
                    <Briefcase className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Basic Evaluation
                    </h3>
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                      Comprehensive evaluation for managers. Assesses leadership,
                      decision-making, and managerial performance.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mb-4">
                      <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">
                        Managers Only
                      </span>
                      <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">
                        8 Steps
                      </span>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectManager();
                    }}
                  >
                    Select
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Area Manager Evaluation Option - Only shown when user is AVP and employee is Area Manager */}
            {showAreaManagerOption && (
              <Card
                className="cursor-pointer hover:shadow-xl transition-all hover:bg-green-100 sduration-300 border-0 shadow-md group overflow-hidden relative animate-fade-in-up-delay-3s"
                onClick={handleSelectAreaManager}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-600"></div>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md shadow-sm">
                      <Building2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        Area Manager
                      </h3>
                      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                        Specialized evaluation for Area Managers overseeing multiple
                        branches. Assesses regional oversight and leadership.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center mb-4">
                        <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">
                          Area Managers
                        </span>
                        <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">
                          8 Steps
                        </span>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectAreaManager();
                      }}
                    >
                      Select
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 flex justify-end">
            
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
