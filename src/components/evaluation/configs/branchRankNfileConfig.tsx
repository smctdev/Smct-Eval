import Step1 from "../Step1";
import Step2 from "../Step2";
import Step3 from "../Step3";
import Step4 from "../Step4";
import Step5 from "../Step5";
import Step6 from "../Step6";
import Step7 from "../Step7";
import OverallAssessmentBranchRankNfile from "../OverallAssessmentBranchRankNfile";
import { EvaluationStepConfig } from "../types";

// Branch Rank and File evaluation configuration
// Different from managerEvaluationSteps: does NOT include Step8 (Managerial Skills)
// Uses Step2 (Quality of Work up to "Job Targets" only, not the 7 job target rows)
// Includes Customer Service (Step7) unlike HO rankNfile
export const branchRankNfileSteps: EvaluationStepConfig[] = [
  { id: 1, title: "Employee Information / Job Knowledge", component: Step1 },
  { id: 2, title: "Quality of Work", component: Step2 }, // Step2 only goes up to "Job Targets" (qualityOfWorkScore5)
  { id: 3, title: "Adaptability", component: Step3 },
  { id: 4, title: "Teamwork", component: Step4 },
  { id: 5, title: "Reliability", component: Step5 },
  { id: 6, title: "Ethical & Professional Behavior", component: Step6 },
  { id: 7, title: "Customer Service", component: Step7 },
  { id: 8, title: "Overall Assessment", component: OverallAssessmentBranchRankNfile },
];

