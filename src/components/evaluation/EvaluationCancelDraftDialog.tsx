"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

type EvaluationCancelDraftDialogProps = {
  open: boolean;
  isSaving?: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onKeepEditingAction: () => void;
  onCancelEvaluationAction: () => void;
  onConfirmDraftAction: () => void;
};

/** Confirm leaving the evaluation while keeping progress as a draft. */
export default function EvaluationCancelDraftDialog({
  open,
  isSaving = false,
  onOpenChangeAction,
  onKeepEditingAction,
  onCancelEvaluationAction,
  onConfirmDraftAction,
}: EvaluationCancelDraftDialogProps) {
  return (
    <Dialog open={open} onOpenChangeAction={onOpenChangeAction}>
      <DialogContent
        className="m-8 max-w-md"
        style={{
          animation: "dialogPopup 0.3s ease-out",
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Save as Draft
          </DialogTitle>
        </DialogHeader>
        <div className="mx-2 my-2 bg-amber-50 p-4 py-3">
          <p className="text-gray-600">
            Save your progress as a draft so you can continue later, or cancel
            this evaluation and leave without saving.
          </p>
        </div>
        <DialogFooter className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onKeepEditingAction();
            }}
            className="cursor-pointer bg-blue-600 px-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:text-white hover:shadow-md active:translate-y-0"
          >
            Keep Editing
          </Button>
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancelEvaluationAction();
            }}
            className="cursor-pointer border-red-300 bg-red-600 px-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-700 hover:text-white hover:shadow-md active:translate-y-0"
          >
            Cancel Evaluation
          </Button>
          <Button
            disabled={isSaving}
            className={`flex cursor-pointer items-center gap-2 bg-amber-600 px-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-700 hover:shadow-md active:translate-y-0 ${
              isSaving ? "cursor-not-allowed opacity-70" : ""
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConfirmDraftAction();
            }}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Draft...
              </>
            ) : (
              "Save Draft"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
