"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

const navButtonClass =
  "px-6 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0";

type EvaluationStepNavigationProps = {
  currentStep: number;
  canProceed: boolean;
  validationMessage: string;
  isSaving?: boolean;
  onPrevious: () => void;
  onCancel: () => void;
  onNext: () => void;
};

export default function EvaluationStepNavigation({
  currentStep,
  canProceed,
  validationMessage,
  isSaving = false,
  onPrevious,
  onCancel,
  onNext,
}: EvaluationStepNavigationProps) {
  const nextDisabled = !canProceed || isSaving;

  return (
    <div className="mt-6 flex justify-between">
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={currentStep === 1 || isSaving}
          className={`${navButtonClass} bg-blue-600 text-white hover:bg-blue-700 hover:text-white`}
        >
          Previous
        </Button>

        <Button
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          disabled={isSaving}
          className={`${navButtonClass} border-red-300 bg-red-600 text-white hover:bg-red-700 hover:text-white`}
        >
          Save Draft
        </Button>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={(e) => {
                e.preventDefault();
                if (nextDisabled) return;
                onNext();
              }}
              disabled={nextDisabled}
              className={
                nextDisabled
                  ? "cursor-not-allowed px-6 opacity-50"
                  : `${navButtonClass} bg-blue-600 text-white hover:bg-blue-700 hover:text-white`
              }
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Next"
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isSaving
                ? "Saving this step as a draft..."
                : canProceed
                  ? "Save progress and proceed to the next step"
                  : validationMessage}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
