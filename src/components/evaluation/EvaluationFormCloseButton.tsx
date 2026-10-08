"use client";

import { X } from "lucide-react";

type EvaluationFormCloseButtonProps = {
  disabled?: boolean;
  onClick: () => void;
};

/** Close control pinned to the evaluation modal, on every step. */
export default function EvaluationFormCloseButton({
  disabled = false,
  onClick,
}: EvaluationFormCloseButtonProps) {
  return (
    <button
      type="button"
      aria-label="Cancel evaluation"
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200/80 bg-white/95 text-slate-500 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-600 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
