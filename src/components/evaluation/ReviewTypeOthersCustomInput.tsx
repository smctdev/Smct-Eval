"use client";

import { cn } from "@/lib/utils";

/** Max length for the Others free-text review type label. */
export const REVIEW_TYPE_OTHERS_CUSTOM_MAX_LENGTH = 50;

type ReviewTypeOthersCustomInputProps = {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  className?: string;
  maxLength?: number;
};

/**
 * Inline Others custom review type field.
 * Width hugs the typed text (ends near the last letter), with a character cap.
 */
export function ReviewTypeOthersCustomInput({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  id,
  className,
  maxLength = REVIEW_TYPE_OTHERS_CUSTOM_MAX_LENGTH,
}: ReviewTypeOthersCustomInputProps) {
  const isLocked = disabled || readOnly;
  const text = value ?? "";
  const placeholder = "Enter custom review type";
  // Hug the typed text; empty field keeps a short stub, not the full section width.
  const charWidth =
    text.length > 0
      ? Math.min(maxLength + 1, text.length + 1)
      : 12;

  return (
    <input
      id={id}
      type="text"
      value={text}
      readOnly={readOnly}
      disabled={disabled}
      maxLength={isLocked ? undefined : maxLength}
      onChange={(event) =>
        onChange?.(event.target.value.slice(0, maxLength))
      }
      placeholder={placeholder}
      title={text || placeholder}
      size={charWidth}
      style={{ width: `${charWidth}ch` }}
      className={cn(
        "max-w-full shrink px-2 py-1 text-sm border border-gray-300 rounded",
        isLocked
          ? "bg-gray-50 text-gray-800"
          : "bg-white text-gray-900",
        disabled && !readOnly && "bg-gray-100 text-gray-400 cursor-not-allowed",
        className
      )}
    />
  );
}
