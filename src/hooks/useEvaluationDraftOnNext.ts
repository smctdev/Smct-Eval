"use client";

import { useCallback, useRef, useState } from "react";
import { EvaluationPayload } from "@/components/evaluation/types";
import { getEvaluationApiErrorMessage } from "@/components/evaluation/evaluationRecordsShared";
import {
  type EvaluationEditSession,
  type EvaluationResubmitType,
  isEditSession,
} from "@/lib/evaluationEditTypes";
import {
  buildEvaluationSavePayload,
  saveEvaluationStepDraft,
} from "@/lib/evaluationDraftSave";
import { apiService } from "@/lib/apiService";
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
  const [isDiscardingDraft, setIsDiscardingDraft] = useState(false);
  const savingRef = useRef(false);
  const createdDraftIdRef = useRef<number | null>(null);

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
      const result = await saveEvaluationStepDraft({
        employeeId,
        draftType,
        payload: buildPayloadForSave(),
        editSession,
      });
      if (result.id && !isEditSession(editSession)) {
        createdDraftIdRef.current = result.id;
      }
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

  /** Close without keeping an in-session draft created by Next. */
  const discardDraftAndLeave = useCallback(async (): Promise<boolean> => {
    if (isEditSession(editSession)) return true;
    const draftId = createdDraftIdRef.current;
    if (!draftId) return true;
    if (savingRef.current) return false;
    savingRef.current = true;
    setIsDiscardingDraft(true);
    try {
      await apiService.deleteSubmission(draftId);
      createdDraftIdRef.current = null;
      return true;
    } catch (error) {
      console.error("Evaluation draft discard failed:", error);
      toastMessages.generic.error(
        "Could not discard evaluation",
        getEvaluationApiErrorMessage(
          error,
          "The evaluation was closed, but the draft may still appear in records."
        )
      );
      return true;
    } finally {
      savingRef.current = false;
      setIsDiscardingDraft(false);
    }
  }, [editSession]);

  return {
    saveAndNext,
    saveDraft,
    discardDraftAndLeave,
    isSavingDraft,
    isDiscardingDraft,
  };
}
