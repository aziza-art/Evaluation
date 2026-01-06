
import { FeedbackData, FeedbackEntry, SubjectStats } from "../types";

const STORAGE_KEY = "gi_feedback_history";

const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

export const saveFeedback = (data: FeedbackData): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    const history = getHistory();
    const newEntry: FeedbackEntry = {
      ...data,
      id: generateId(),
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([newEntry, ...history]));
  } catch (e) {
    console.warn("Échec de la sauvegarde locale:", e);
  }
};

export const getHistory = (): FeedbackEntry[] => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export const getCompletedSubjectNames = (): string[] => {
  try {
    const history = getHistory();
    return Array.from(new Set(history.map(h => h.subject)));
  } catch (e) {
    return [];
  }
};

export const getSubjectHistory = (subjectName: string): FeedbackEntry[] => {
  return getHistory().filter(entry => entry.subject === subjectName);
};

export const getSubjectStats = (subjectName: string): SubjectStats | null => {
  const entries = getSubjectHistory(subjectName);
  if (entries.length === 0) return null;

  const type = entries[0].type;
  const sums = entries.reduce(
    (acc, curr) => ({
      q1: acc.q1 + (curr.q1 || 0),
      q2: acc.q2 + (curr.q2 || 0),
      q3: acc.q3 + (curr.q3 || 0),
      q4: acc.q4 + (curr.q4 || 0),
      q5: acc.q5 + (curr.q5 || 0),
      q6: acc.q6 + (curr.q6 || 0),
      q7_salles: acc.q7_salles + (curr.q7_salles || 0),
      q7_ressources: acc.q7_ressources + (curr.q7_ressources || 0),
      q7_pc: acc.q7_pc + (curr.q7_pc || 0),
    }),
    { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7_salles: 0, q7_ressources: 0, q7_pc: 0 }
  );

  const count = entries.length;
  const qAverages = {
    q1: sums.q1 / count,
    q2: sums.q2 / count,
    q3: sums.q3 / count,
    q4: sums.q4 / count,
    q5: sums.q5 / count,
    q6: sums.q6 / count,
    q7_salles: sums.q7_salles / count,
    q7_ressources: sums.q7_ressources / count,
    q7_pc: sums.q7_pc / count,
  };

  // Calcul de la moyenne globale uniquement sur les champs pertinents
  let relevantScores = [];
  if (type === 'module') {
    relevantScores = [qAverages.q1, qAverages.q2, qAverages.q3, qAverages.q4, qAverages.q5];
  } else if (type === 'global_orientation') {
    relevantScores = [qAverages.q6];
  } else if (type === 'global_env') {
    relevantScores = [qAverages.q7_salles, qAverages.q7_ressources, qAverages.q7_pc];
  }

  const averageScore = relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length;

  return {
    averageScore,
    totalEntries: count,
    qAverages
  };
};
