import { FeedbackData, FeedbackEntry, SubjectStats } from "../types";

const STORAGE_KEY = "isgi_evaluations_v3";

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

  const pedagogyKeys = ['q1', 'q2', 'q3', 'q4', 'q5'];
  const pedagogySum = pedagogyKeys.reduce((acc, k) => acc + (qAverages[k] || 0), 0);
  const averageScore = pedagogySum / pedagogyKeys.length;

  return {
    averageScore,
    totalEntries: history.length,
    qAverages
  };
};

export const downloadHistoryCSV = (data?: FeedbackEntry[]): void => {
  const history = data || getHistory();
  if (history.length === 0) return;

  const headers = [
    "ID", "Timestamp", "Subject", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6_Jobs", "Q7_Rooms", "Q8_Resources", "Q9_Transport", "Q10_Laptop", "Comments"
  ];

  const rows = history.map(e => [
    e.id, e.timestamp, e.subject, e.q1, e.q2, e.q3, e.q4, e.q5, 
    e.q6_jobs, e.q7_rooms, e.q8_resources, e.q9_transport, e.q10_laptop,
    `"${(e.comments || "").replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8-sig;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `isgi_feedback_${new Date().getTime()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadAggregatedStatsCSV = (subjectsList: string[]): void => {
  const statsList = subjectsList
    .map(s => ({ name: s, stats: getSubjectStats(s) }))
    .filter((item): item is { name: string; stats: SubjectStats } => item.stats !== null);

  if (statsList.length === 0) return;

  const headers = ["Module", "Entries", "Average Score (%)"];
  const rows = statsList.map(item => [item.name, item.stats.totalEntries, Math.round(item.stats.averageScore)]);
  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8-sig;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "isgi_aggregated_stats.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};