
export type RatingValue = 0 | 25 | 50 | 75 | 100 | null;

export type FeedbackType = 'module' | 'global_orientation' | 'global_env';

export interface FeedbackData {
  subject: string;
  type: FeedbackType;
  q1: RatingValue; // Objectifs (Module)
  q2: RatingValue; // Échanges (Module)
  q3: RatingValue; // Soutien (Module)
  q4: RatingValue; // Structure (Module)
  q5: RatingValue; // Évaluation (Module)
  q6: RatingValue; // Orientation (Global)
  // Environnement détaillé
  q7_salles: RatingValue; 
  q7_ressources: RatingValue;
  q7_pc: RatingValue;
  q7_transport: string | null;
  comments: string;
}

export interface FeedbackEntry extends FeedbackData {
  id: string;
  timestamp: number;
}

export interface AnalysisResult {
  summary: string;
  recommendations: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface SubjectStats {
  averageScore: number;
  totalEntries: number;
  qAverages: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    q5: number;
    q6: number;
    q7_salles: number;
    q7_ressources: number;
    q7_pc: number;
  };
}
