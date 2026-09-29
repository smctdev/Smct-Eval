import { EvaluationPayload } from "@/components/evaluation/types";
import { toDateInputValue } from "@/lib/dateInputValue";
import {
  type EvaluationScoreItem,
  type EvaluationSubmissionRecord,
} from "@/lib/evaluationSubmissionRecord";

type ScoreSectionConfig = {
  apiKey: string;
  recordKeys: string[];
  formPrefix: string;
  textField: "comment" | "explanation";
};

const SCORE_SECTIONS: ScoreSectionConfig[] = [
  {
    apiKey: "job_knowledge",
    recordKeys: ["job_knowledge"],
    formPrefix: "jobKnowledge",
    textField: "comment",
  },
  {
    apiKey: "quality_of_works",
    recordKeys: ["quality_of_works", "qualityOfWorks"],
    formPrefix: "qualityOfWork",
    textField: "comment",
  },
  {
    apiKey: "adaptabilities",
    recordKeys: ["adaptabilities", "adaptability"],
    formPrefix: "adaptability",
    textField: "comment",
  },
  {
    apiKey: "teamworks",
    recordKeys: ["teamworks", "teamwork"],
    formPrefix: "teamwork",
    textField: "comment",
  },
  {
    apiKey: "reliabilities",
    recordKeys: ["reliabilities", "reliability"],
    formPrefix: "reliability",
    textField: "comment",
  },
  {
    apiKey: "ethicals",
    recordKeys: ["ethicals", "ethical"],
    formPrefix: "ethical",
    textField: "explanation",
  },
  {
    apiKey: "customer_services",
    recordKeys: ["customer_services", "customerServices"],
    formPrefix: "customerService",
    textField: "explanation",
  },
  {
    apiKey: "managerial_skills",
    recordKeys: ["managerial_skills", "managerialSkills"],
    formPrefix: "managerialSkills",
    textField: "explanation",
  },
];

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

function serializeDateValue(value: unknown): string | undefined {
  const normalized = toDateInputValue(value);
  return normalized || undefined;
}

function setIfPresent(
  target: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  if (value !== undefined && value !== null && value !== "") {
    target[key] = value;
  }
}

function readEntityId(value: unknown): number | string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const id = (value as { id?: unknown }).id;
    if (id !== undefined && id !== null && id !== "") {
      return id as number | string;
    }
    return undefined;
  }
  return value as number | string;
}

/**
 * Basic info in API-style JSON (employee/evaluator ids only + snake_case fields),
 * with editable evaluation fields taken from the form.
 */
function buildBasicInfoForResubmit(
  form: EvaluationPayload,
  record: EvaluationSubmissionRecord
): Record<string, unknown> {
  const basic: Record<string, unknown> = {};
  const recordExtras = record as Record<string, unknown>;

  const employeeId = readEntityId(record.employee);
  if (employeeId !== undefined) {
    basic.employee = { id: employeeId };
  }

  const evaluatorId =
    readEntityId(recordExtras.evaluator) ??
    readEntityId(recordExtras.evaluator_id ?? recordExtras.evaluatorId);
  if (evaluatorId !== undefined) {
    basic.evaluator = { id: evaluatorId };
  }

  setIfPresent(basic, "id", record.id);
  setIfPresent(basic, "hire_date", serializeDateValue(form.hireDate));
  setIfPresent(basic, "rating", form.rating);
  setIfPresent(basic, "performance_score", form.performanceScore ?? form.rating);
  setIfPresent(basic, "coverage_from", serializeDateValue(form.coverageFrom));
  setIfPresent(basic, "coverage_to", serializeDateValue(form.coverageTo));
  setIfPresent(
    basic,
    "review_type_probationary",
    form.reviewTypeProbationary
  );
  setIfPresent(basic, "review_type_regular", form.reviewTypeRegular);
  setIfPresent(
    basic,
    "review_type_others_improvement",
    form.reviewTypeOthersImprovement
  );
  setIfPresent(basic, "review_type_others_custom", form.reviewTypeOthersCustom);
  setIfPresent(basic, "quarter", form.quarter);
  setIfPresent(basic, "priority_area_1", form.priorityArea1);
  setIfPresent(basic, "priority_area_2", form.priorityArea2);
  setIfPresent(basic, "priority_area_3", form.priorityArea3);
  setIfPresent(basic, "remarks", form.remarks);
  setIfPresent(basic, "created_at", form.created_at);

  setIfPresent(basic, "status", record.status);
  setIfPresent(
    basic,
    "evaluation_type",
    record.evaluation_type ?? record.evaluationType ?? record.type
  );

  return basic;
}

function readRecordArray(
  record: EvaluationSubmissionRecord,
  keys: string[]
): EvaluationScoreItem[] {
  const evaluationData = (record.evaluationData ??
    record.evaluation_data ??
    {}) as Record<string, unknown>;
  const sources = [record as Record<string, unknown>, evaluationData];

  for (const key of keys) {
    for (const source of sources) {
      const value = source[key];
      if (Array.isArray(value) && value.length > 0) {
        return value as EvaluationScoreItem[];
      }
    }
  }
  return [];
}

function getQuestionNumber(item: EvaluationScoreItem): number {
  return Number(item.question_number ?? 0);
}

function readFormScore(
  form: EvaluationPayload,
  formPrefix: string,
  questionNumber: number
): number {
  const key = `${formPrefix}Score${questionNumber}` as keyof EvaluationPayload;
  const raw = form[key];
  return raw === undefined || raw === null || raw === "" ? 0 : Number(raw);
}

function readFormText(
  form: EvaluationPayload,
  formPrefix: string,
  questionNumber: number,
  textField: "comment" | "explanation"
): string {
  const suffix = textField === "explanation" ? "Explanation" : "Comments";
  const key = `${formPrefix}${suffix}${questionNumber}` as keyof EvaluationPayload;
  return String(form[key] ?? "");
}

function readQualityText(
  form: EvaluationPayload,
  questionNumber: number
): string {
  const jobTarget = JOB_TARGET_BY_QUESTION[questionNumber];
  if (jobTarget?.comment) {
    const fromJobTarget = form[jobTarget.comment];
    if (fromJobTarget != null && String(fromJobTarget).trim() !== "") {
      return String(fromJobTarget);
    }
  }
  return readFormText(form, "qualityOfWork", questionNumber, "comment");
}

function mergeScoreSection(
  form: EvaluationPayload,
  record: EvaluationSubmissionRecord,
  section: ScoreSectionConfig
): EvaluationScoreItem[] {
  const items = readRecordArray(record, section.recordKeys);
  const usersEvaluationId = Number(record.id ?? 0) || undefined;

  return items.map((item) => {
    const questionNumber = getQuestionNumber(item);
    const score =
      section.apiKey === "quality_of_works" && questionNumber >= 6
        ? Number(
            form[
              JOB_TARGET_BY_QUESTION[questionNumber]?.score ??
                (`qualityOfWorkScore${questionNumber}` as keyof EvaluationPayload)
            ] ??
              form[`qualityOfWorkScore${questionNumber}` as keyof EvaluationPayload] ??
              0
          )
        : readFormScore(form, section.formPrefix, questionNumber);

    const text =
      section.apiKey === "quality_of_works" && questionNumber >= 6
        ? readQualityText(form, questionNumber)
        : readFormText(form, section.formPrefix, questionNumber, section.textField);

    const merged: EvaluationScoreItem = {
      ...item,
      question_number: questionNumber,
      score,
      users_evaluation_id: item.users_evaluation_id ?? usersEvaluationId,
    };

    if (section.textField === "explanation") {
      merged.explanation = text;
      delete merged.comment;
    } else {
      merged.comment = text;
      delete merged.explanation;
    }

    return merged;
  });
}

function serializeScoreItemForJson(
  item: EvaluationScoreItem,
  textField: "comment" | "explanation"
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: item.id,
    users_evaluation_id: item.users_evaluation_id,
    question_number: item.question_number,
    score: item.score ?? 0,
  };

  if (textField === "explanation") {
    row.explanation = item.explanation ?? "";
  } else {
    row.comment = item.comment ?? "";
  }

  return row;
}

/**
 * Resubmit POST body (application/json):
 * - Basic info: employee/evaluator ids only, plus snake_case evaluation fields
 * - Steps: nested snake_case arrays with id + users_evaluation_id
 */
export function buildResubmitJsonPayload(
  form: EvaluationPayload,
  record: EvaluationSubmissionRecord
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...buildBasicInfoForResubmit(form, record),
  };

  for (const section of SCORE_SECTIONS) {
    const merged = mergeScoreSection(form, record, section);
    if (merged.length > 0) {
      body[section.apiKey] = merged.map((item) =>
        serializeScoreItemForJson(item, section.textField)
      );
    }
  }

  return body;
}

/** @deprecated Prefer buildResubmitJsonPayload for resubmit API calls. */
export function buildResubmitRequestBody(
  form: EvaluationPayload,
  record: EvaluationSubmissionRecord
): EvaluationPayload & Record<string, EvaluationScoreItem[] | unknown> {
  const body: EvaluationPayload & Record<string, unknown> = { ...form };

  for (const section of SCORE_SECTIONS) {
    const merged = mergeScoreSection(form, record, section);
    if (merged.length > 0) {
      body[section.apiKey] = merged;
    }
  }

  return body;
}
