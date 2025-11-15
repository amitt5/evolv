export interface Question {
  id: number;
  text: string;
  strength: 'weak' | 'medium' | 'strong';
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
