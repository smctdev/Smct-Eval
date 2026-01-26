"use client";

import EvaluationForm from "./index";
import { User } from "../../contexts/UserContext";

interface BranchEvaluationFormProps {
  branch?: {
    id: number;
    name: string;
    branchCode?: string;
    location?: string;
  } | null;
  employee?: User | null;
  onCloseAction?: () => void;
  onCancelAction?: () => void;
  evaluationType?: 'rankNfile' | 'basic' | 'default';
}

export default function BranchEvaluationForm({
  branch,
  employee,
  onCloseAction,
  onCancelAction,
  evaluationType = 'default',
}: BranchEvaluationFormProps) {
  // Don't pass custom steps - let EvaluationForm determine the correct steps
  // based on evaluationType and evaluator type (branch rankNfile uses branchRankNfileSteps)
  // This allows the logic in index.tsx to properly route to branchRankNfileSteps
  // when evaluationType === 'rankNfile' for branch evaluators

  return (
    <EvaluationForm
      employee={employee}
      onCloseAction={onCloseAction}
      onCancelAction={onCancelAction}
      evaluationType={evaluationType}
    />
  );
}

