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

type EvaluationCloseConfirmDialogProps = {
  open: boolean;
  isDiscarding?: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onConfirmAction: () => void;
};

/** Ask before leaving an evaluation from the corner close button. */
export default function EvaluationCloseConfirmDialog({
  open,
  isDiscarding = false,
  onOpenChangeAction,
  onConfirmAction,
}: EvaluationCloseConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChangeAction={onOpenChangeAction}>
      <DialogContent
        portalClassName="z-[80]"
        className="m-8 max-w-md"
        style={{
          animation: "dialogPopup 0.3s ease-out",
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Close Evaluation
          </DialogTitle>
        </DialogHeader>
        <div className="mx-2 my-2 bg-red-50 p-4 py-3">
          <p className="text-gray-600">
            Are you sure you want to close this evaluation? Your progress is automatically saved as a draft each time you proceed to the next step. 
            You can safely close this evaluation and resume it later without losing your saved progress.
          </p>
        </div>
        <DialogFooter className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isDiscarding}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenChangeAction(false);
            }}
            className="cursor-pointer bg-blue-600 px-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:text-white hover:shadow-md active:translate-y-0"
          >
            Keep Editing
          </Button>
          <Button
            type="button"
            disabled={isDiscarding}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onConfirmAction();
            }}
            className={`cursor-pointer bg-red-600 px-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-700 hover:text-white hover:shadow-md active:translate-y-0 ${
              isDiscarding ? "cursor-not-allowed opacity-70" : ""
            }`}
          >
            {isDiscarding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Closing...
              </>
            ) : (
              "Close"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
