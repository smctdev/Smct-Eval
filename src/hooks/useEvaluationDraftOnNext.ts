"use client";

import { useCallback, useRef, useState } from "react";
import { EvaluationPayload } from "@/components/evaluation/types";
import { getEvaluationApiErrorMessage } from "@/components/evaluation/evaluationRecordsShared";
import {
  type EvaluationEditSession,
  type EvaluationResubmitType,
} from "@/lib/evaluationEditTypes";
import {
  buildEvaluationSavePayload,
  saveEvaluationStepDraft,
} from "@/lib/evaluationDraftSave";
import { toastMessages } from "@/lib/toastMessages";

export function useEvaluationDraftOnNext(options: {
  employeeId: number | string | null | undefined;
  form: EvaluationPayload;
  draftType: EvaluationResubmitType;
  editSession?: EvaluationEditSession;
  buildPayload?: (form: EvaluationPayload) => EvaluationPayload;
  onAdvance: () => void;
}) {
  const {
    employeeId,
    form,
    draftType,
    editSession,
    buildPayload,
    onAdvance,
  } = options;
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const savingRef = useRef(false);

  const buildPayloadForSave = useCallback(() => {
    return buildPayload
      ? buildPayload(form)
      : buildEvaluationSavePayload(form);
  }, [buildPayload, form]);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setIsSavingDraft(true);
    try {
      await saveEvaluationStepDraft({
        employeeId,
        draftType,
        payload: buildPayloadForSave(),
        editSession,
      });
      return true;
    } catch (error) {
      console.error("Evaluation draft save failed:", error);
      toastMessages.generic.error(
        "Could not save progress",
        getEvaluationApiErrorMessage(
          error,
          "Failed to save this evaluation as a draft. Please try again."
        )
      );
      return false;
    } finally {
      savingRef.current = false;
      setIsSavingDraft(false);
    }
  }, [buildPayloadForSave, draftType, editSession, employeeId]);

  const saveAndNext = useCallback(async () => {
    const saved = await saveDraft();
    if (saved) onAdvance();
  }, [onAdvance, saveDraft]);

  return { saveAndNext, saveDraft, isSavingDraft };
}
