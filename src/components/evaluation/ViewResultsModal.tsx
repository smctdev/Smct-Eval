"use client";

// Router component - routes to appropriate ViewResultsModal based on evaluation type
import ViewResultsModalRouter from "./ViewResultsModalRouter";

// Re-export the router as ViewResultsModal to maintain backward compatibility
export default ViewResultsModalRouter;

// Re-export types for backward compatibility
export type { Submission, ApprovalData, ViewResultsModalProps } from "./ViewResultsModalRouter";
