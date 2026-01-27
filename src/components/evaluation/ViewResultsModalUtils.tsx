// Shared utilities for ViewResultsModal components

export const getRatingLabel = (score: number) => {
  if (score >= 4.5) return "Outstanding";
  if (score >= 4.0) return "Exceeds Expectations";
  if (score >= 3.5) return "Meets Expectations";
  if (score >= 2.5) return "Needs Improvement";
  return "Unsatisfactory";
};

export const calculateScore = (scores: string[]) => {
  const validScores = scores
    .filter((score) => score && score !== "")
    .map((score) => parseFloat(score));
  if (validScores.length === 0) return 0;
  return (
    validScores.reduce((sum, score) => sum + score, 0) / validScores.length
  );
};

export const getRatingColorForLabel = (rating: string) => {
  switch (rating) {
    case "Outstanding":
    case "Exceeds Expectations":
      return "text-green-700 bg-green-100";
    case "Needs Improvement":
    case "Unsatisfactory":
      return "text-red-700 bg-red-100";
    case "Meets Expectations":
      return "text-yellow-700 bg-yellow-100";
    default:
      return "text-gray-500 bg-gray-100";
  }
};

export const getQuarterFromDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unknown";

    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    if (month >= 1 && month <= 3) return `Q1 ${year}`;
    if (month >= 4 && month <= 6) return `Q2 ${year}`;
    if (month >= 7 && month <= 9) return `Q3 ${year}`;
    if (month >= 10 && month <= 12) return `Q4 ${year}`;

    return "Unknown";
  } catch (error) {
    return "Unknown";
  }
};

export const rating = (value: number) => {
  switch (value) {
    case 1:
      return "Unsatisfactory";
    case 2:
      return "Needs Improvement";
    case 3:
      return "Meets Expectations";
    case 4:
      return "Exceeds Expectation";
    case 5:
      return "Outstanding";
    default:
      return "Not Rated";
  }
};

export const ratingBG = (value: number) => {
  switch (value) {
    case 1:
      return "bg-red-100 text-red-800";
    case 2:
      return "bg-orange-100 text-orange-800";
    case 3:
      return "bg-yellow-100 text-yellow-800";
    case 4:
      return "bg-blue-100 text-blue-800";
    case 5:
      return "bg-green-100 text-green-800";
    default:
      return "";
  }
};

