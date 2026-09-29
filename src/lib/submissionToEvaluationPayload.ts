import { EvaluationPayload } from "@/components/evaluation/types";
import { pickBestDateInputValue } from "@/lib/dateInputValue";
import {
  type EvaluationScoreItem,
  type EvaluationSubmissionData,
  type EvaluationSubmissionRecord,
} from "@/lib/evaluationSubmissionRecord";

const JOB_TARGET_BY_QUESTION: Record<
  number,
  { score: keyof EvaluationPayload; comment: keyof EvaluationPayload }
> = {
  6: {
    score: "jobTargetMotorcyclesScore",
    comment: "jobTargetMotorcyclesComment",
  },
  7: {
    score: "jobTargetAppliancesScore",
    comment: "jobTargetAppliancesComment",
  },
  8: { score: "jobTargetCarsScore", comment: "jobTargetCarsComment" },
  9: {
    score: "jobTargetTriWheelersScore",
    comment: "jobTargetTriWheelersComment",
  },
  10: {
    score: "jobTargetCollectionScore",
    comment: "jobTargetCollectionComment",
  },
  11: {
    score: "jobTargetSparepartsLubricantsScore",
    comment: "jobTargetSparepartsLubricantsComment",
  },
  12: {
    score: "jobTargetShopIncomeScore",
    comment: "jobTargetShopIncomeComment",
  },
};

function getQuestionNumber(item: EvaluationScoreItem): number {
  return Number(item.question_number ?? item.questionNumber ?? item.q ?? 0);
}

function getScore(item: EvaluationScoreItem): number {
  return Number(item.score ?? item.value ?? 0);
}

function getText(item: EvaluationScoreItem, preferExplanation = false): string {
  if (preferExplanation) {
    return String(
      item.explanation ?? item.comment ?? item.comments ?? ""
    );
  }
  return String(item.comment ?? item.comments ?? item.explanation ?? "");
}

function mapScoreCommentItems(
  items: EvaluationScoreItem[] | null | undefined,
  prefix: string,
  useExplanation = false
): Partial<EvaluationPayload> {
  const result: Record<string, string | number> = {};
  if (!Array.isArray(items)) return result;

  const suffix = useExplanation ? "Explanation" : "Comments";

  for (const item of items) {
    const q = getQuestionNumber(item);
    if (!q) continue;
    result[`${prefix}Score${q}`] = getScore(item);
    result[`${prefix}${suffix}${q}`] = getText(item, useExplanation);
  }

  return result as Partial<EvaluationPayload>;
}

function mapQualityOfWorks(
  items: EvaluationScoreItem[] | null | undefined
): Partial<EvaluationPayload> {
  const result: Record<string, string | number> = {};
  if (!Array.isArray(items)) return result;

  for (const item of items) {
    const q = getQuestionNumber(item);
    if (!q) continue;

    const score = getScore(item);
    const comment = getText(item);

    if (q >= 6 && q <= 12) {
      const jobTarget = JOB_TARGET_BY_QUESTION[q];
      if (jobTarget) {
        result[jobTarget.score] = score;
        result[jobTarget.comment] = comment;
      }
      result[`qualityOfWorkScore${q}`] = score;
      result[`qualityOfWorkComments${q}`] = comment;
      continue;
    }

    result[`qualityOfWorkScore${q}`] = score;
    result[`qualityOfWorkComments${q}`] = comment;
  }

  return result as Partial<EvaluationPayload>;
}

function pickKnownFields(
  source: EvaluationSubmissionData | null | undefined
): Partial<EvaluationPayload> {
  if (!source || typeof source !== "object") return {};

  const payload: Record<string, unknown> = {};

  const assign = (targetKey: string, ...keys: string[]) => {
    for (const key of keys) {
      const value = (source as Record<string, unknown>)[key];
      if (value !== undefined && value !== null && value !== "") {
        payload[targetKey] = value;
        return;
      }
    }
  };

  assign("rating", "rating", "performanceScore", "performance_score");
  assign(
    "reviewTypeProbationary",
    "reviewTypeProbationary",
    "review_type_probationary"
  );
  assign("reviewTypeRegular", "reviewTypeRegular", "review_type_regular");
  assign(
    "reviewTypeOthersImprovement",
    "reviewTypeOthersImprovement",
    "review_type_others_improvement"
  );
  assign(
    "reviewTypeOthersCustom",
    "reviewTypeOthersCustom",
    "review_type_others_custom"
  );
  assign("priorityArea1", "priorityArea1", "priority_area_1");
  assign("priorityArea2", "priorityArea2", "priority_area_2");
  assign("priorityArea3", "priorityArea3", "priority_area_3");
  assign("remarks", "remarks", "overallComments", "overall_comments");
  assign("created_at", "created_at");

  return payload as Partial<EvaluationPayload>;
}

function firstScoreItems(
  ...candidates: Array<EvaluationScoreItem[] | undefined>
): EvaluationScoreItem[] | undefined {
  for (const items of candidates) {
    if (Array.isArray(items) && items.length > 0) return items;
  }
  return candidates.find(Array.isArray);
}

/**
 * Maps a GET /submissions/:id record into flat form state for edit/create UIs.
 */
export function submissionToEvaluationPayload(
  submission: EvaluationSubmissionRecord | null | undefined
): Partial<EvaluationPayload> {
  if (!submission) return {};

  const evaluationData =
    submission.evaluationData ?? submission.evaluation_data ?? {};

  // Top-level DB columns can be start-of-month; prefer nested form/JSON dates.
  const base = {
    ...pickKnownFields(submission),
    ...pickKnownFields(evaluationData),
  };

  const evalRec = evaluationData as Record<string, unknown>;
  const subRec = submission as Record<string, unknown>;
  const employee = (subRec.employee ?? null) as Record<string, unknown> | null;

  // Prefer exact calendar day across camelCase / snake_case / nested sources.
  // Only assign when non-empty — empty string would wipe Step1 auto-fill from employee.
  const hireDate = pickBestDateInputValue(
    evalRec.hireDate,
    evalRec.hire_date,
    subRec.hireDate,
    subRec.hire_date,
    employee?.date_hired,
    employee?.dateHired,
    employee?.hireDate
  );
  const coverageFrom = pickBestDateInputValue(
    evalRec.coverageFrom,
    evalRec.coverage_from,
    subRec.coverageFrom,
    subRec.coverage_from
  );
  const coverageTo = pickBestDateInputValue(
    evalRec.coverageTo,
    evalRec.coverage_to,
    subRec.coverageTo,
    subRec.coverage_to
  );
  if (hireDate) base.hireDate = hireDate;
  if (coverageFrom) base.coverageFrom = coverageFrom;
  if (coverageTo) base.coverageTo = coverageTo;

  return {
    ...base,
    ...mapScoreCommentItems(
      firstScoreItems(
        submission.job_knowledge,
        evaluationData.job_knowledge
      ),
      "jobKnowledge"
    ),
    ...mapQualityOfWorks(
      firstScoreItems(
        submission.quality_of_works,
        submission.qualityOfWorks,
        evaluationData.quality_of_works,
        evaluationData.qualityOfWorks
      )
    ),
    ...mapScoreCommentItems(
      firstScoreItems(
        submission.adaptabilities,
        submission.adaptability,
        evaluationData.adaptabilities,
        evaluationData.adaptability
      ),
      "adaptability"
    ),
    ...mapScoreCommentItems(
      firstScoreItems(
        submission.teamworks,
        submission.teamwork,
        evaluationData.teamworks,
        evaluationData.teamwork
      ),
      "teamwork"
    ),
    ...mapScoreCommentItems(
      firstScoreItems(
        submission.reliabilities,
        submission.reliability,
        evaluationData.reliabilities,
        evaluationData.reliability
      ),
      "reliability"
    ),
    ...mapScoreCommentItems(
      firstScoreItems(
        submission.ethicals,
        submission.ethical,
        evaluationData.ethicals,
        evaluationData.ethical
      ),
      "ethical",
      true
    ),
    ...mapScoreCommentItems(
      firstScoreItems(
        submission.customer_services,
        submission.customerServices,
        evaluationData.customer_services,
        evaluationData.customerServices
      ),
      "customerService",
      true
    ),
    ...mapScoreCommentItems(
      firstScoreItems(
        submission.managerial_skills,
        submission.managerialSkills,
        evaluationData.managerial_skills,
        evaluationData.managerialSkills
      ),
      "managerialSkills",
      true
    ),
  };
}
