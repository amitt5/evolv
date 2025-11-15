export interface Question {
  id: number;
  text: string;
  strength: 'weak' | 'medium' | 'strong';
  baselineScore: number;
  score: number;
  status: 'active' | 'retired' | 'new';
  lastScore: number;
  ratingCount: number;
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
