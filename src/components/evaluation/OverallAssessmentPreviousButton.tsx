"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PRIORITY_AREA_PREVIOUS_SAFETY_MESSAGE,
  shouldDisablePreviousForPriorityAreas,
  type PriorityAreaFields,
} from "@/lib/priorityAreasValidation";

type OverallAssessmentPreviousButtonProps = {
  data: PriorityAreaFields;
  onClick: () => void;
};

/** Previous is locked only while a priority area is started but still too short. */
export default function OverallAssessmentPreviousButton({
  data,
  onClick,
}: OverallAssessmentPreviousButtonProps) {
  const disabled = shouldDisablePreviousForPriorityAreas(data);

  return (
    <div className="flex max-w-[28rem] items-center gap-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                onClick={onClick}
                disabled={disabled}
                variant="outline"
                className={
                  disabled
                    ? "cursor-not-allowed px-8 py-3 text-lg opacity-50"
                    : "cursor-pointer bg-blue-600 px-8 py-3 text-lg text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:text-white hover:shadow-md active:translate-y-0"
                }
                size="lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            </span>
          </TooltipTrigger>
          {disabled ? (
            <TooltipContent className="max-w-xs">
              <p>{PRIORITY_AREA_PREVIOUS_SAFETY_MESSAGE}</p>
            </TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>
      {disabled ? (
        <p className="text-xs leading-snug text-amber-700 sm:text-sm">
          {PRIORITY_AREA_PREVIOUS_SAFETY_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}
