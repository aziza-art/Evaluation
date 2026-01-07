
// Fix: Added optional data parameter to downloadHistoryCSV to support exporting filtered views
import { FeedbackData, FeedbackEntry, SubjectStats } from "../types";

const STORAGE_KEY = "iup_evaluations_v3";

const generateId = () => Math.random().toString(36).substring(2, 11).toUpperCase();

export const saveFeedback = (data: FeedbackData): string => {
  try {
    const history = getHistory();
    const id = generateId();
    const now = new Date();
    const dateStr = now.toLocaleString('fr-FR', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
    
    const newEntry: FeedbackEntry = { 
      ...data, 
      id: id, 
      timestamp: dateStr 
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([newEntry, ...history]));
    return id;
  } catch (e) {
    console.error("Erreur lors de la sauvegarde locale", e);
    return "ERROR";
  }
};

export const getHistory = (): FeedbackEntry[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Retourne la liste des noms de matières ayant au moins une évaluation
 */
export const getCompletedSubjectNames = (): string[] => {
  const history = getHistory();
  return Array.from(new Set(history.map(e => e.subject)));
};

/**
 * Calcule les statistiques pour une matière donnée
 */
export const getSubjectStats = (subject: string): SubjectStats | null => {
  const history = getHistory().filter(e => e.subject === subject);
  if (history.length === 0) return null;

  const numericKeys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q7_rooms', 'q8_resources'];
  const qAverages: Record<string, number> = {};

  numericKeys.forEach(key => {
    const values = history
      .map(e => e[key as keyof FeedbackEntry])
      .filter((v): v is number => typeof v === 'number' && v !== null);
    
    if (values.length > 0) {
      qAverages[key] = values.reduce((a, b) => a + b, 0) / values.length;
    } else {
      qAverages[key] = 0;
    }
  });

  // Score moyen basé sur la pédagogie (q1-q5)
  const pedagogyKeys = ['q1', 'q2', 'q3', 'q4', 'q5'];
  const pedagogySum = pedagogyKeys.reduce((acc, k) => acc + (qAverages[k] || 0), 0);
  const averageScore = pedagogySum / pedagogyKeys.length;

  return {
    averageScore,
    totalEntries: history.length,
    qAverages
  };
};

/**
 * Génère un contenu CSV à partir de l'historique ou d'un set de données fourni
 */
export const downloadHistoryCSV = (data?: FeedbackEntry[]): void => {
  const history = data || getHistory();
  if (history.length === 0) return;

  const headers = [
    "ID", "Date_Heure", "Matiere", "Q1_Objectifs", "Q2_Echanges", "Q3_Dispo", 
    "Q4_Supports", "Q5_Eval", "Q6_Metiers", "Q7_Salles", "Q8_Ressources", 
    "Q9_Transport", "Q10_PC_Portable", "Commentaires"
  ];

  const rows = history.map(e => [
    e.id, e.timestamp, e.subject, e.q1, e.q2, e.q3, e.q4, e.q5, 
    e.q6_jobs, e.q7_rooms, e.q8_resources, e.q9_transport, e.q10_laptop,
    `"${(e.comments || "").replace(/"/g, '""')}"`
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(r => r.join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8-sig;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const prefix = data ? "filtre_" : "complet_";
  link.setAttribute("download", `${prefix}historique_evaluations.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Génère un contenu CSV des statistiques agrégées par matière
 */
export const downloadAggregatedStatsCSV = (subjectsList: string[]): void => {
  const statsList = subjectsList
    .map(s => {
      const stats = getSubjectStats(s);
      return { name: s, stats };
    })
    .filter((item): item is { name: string; stats: SubjectStats } => item.stats !== null);

  if (statsList.length === 0) return;

  const headers = ["Matière", "Nombre d'évaluations", "Score Moyen Qualité (%)"];
  const rows = statsList.map(item => [
    item.name,
    item.stats.totalEntries,
    Math.round(item.stats.averageScore)
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(r => r.join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8-sig;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "statistiques_modules_iup.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};