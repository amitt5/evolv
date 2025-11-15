export interface Question {
  id: number;
  question: string;
  baselineScore: number;
  score: number;
  status: 'ACTIVE' | 'RETIRED' | 'NEW';
  lastScore: number;
}

export interface RatingMetrics {
  specificity: number;
  depth: number;
  behavioralEvidence: number;
  novelty: number;
  overallScore: number;
}

export interface Speaker {
  name: string;
  voice: string;
}
