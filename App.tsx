
import React, { useState, useMemo, useEffect } from 'react';
import { FeedbackData, AnalysisResult, FeedbackType, SubjectStats, FeedbackEntry } from './types';
import QuestionCard from './components/QuestionCard';
import { analyzeFeedback } from './services/geminiService';
import { sendAnalysisToAdmin } from './services/emailService';
import { saveFeedback, getCompletedSubjectNames, getSubjectStats, getSubjectHistory, getHistory } from './services/storageService';
import { 
  GraduationCap, Send, Factory, ChevronRight, CheckCircle2, 
  MessageSquareText, Calculator, Cpu, Globe, Settings, BookOpen,
  Target, MessageSquare, Clock, Layers, Award, Search, XCircle,
  Hash, Zap, AlertCircle, Activity, QrCode, Sparkles, Briefcase, 
  Monitor, ShieldCheck, Info, Sun, Wifi, Laptop, Car, Bus, Bike, MapPin,
  ArrowLeft, BarChart3, TrendingUp, Users, MessageCircle, Code, LayoutDashboard, Mail, History, Calendar, Filter, SortAsc, Loader2,
  ExternalLink, ArrowUpRight, ClipboardList
} from 'lucide-react';

interface Subject {
  name: string;
  category: string;
  icon: any;
  color: string;
  type: FeedbackType;
}

const GLOBAL_DIAGNOSTICS: Subject[] = [
  { name: "Orientation Professionnelle", category: "Diagnostic Global", icon: Briefcase, color: "text-emerald-400", type: 'global_orientation' },
  { name: "Environnements & Ressources", category: "Diagnostic Global", icon: Monitor, color: "text-amber-400", type: 'global_env' }
];

const MODULES_DATA: Subject[] = [
  // 1. Langues & Com
  { name: "Français 1", category: "Langues & Com", icon: BookOpen, color: "text-orange-400", type: 'module' },
  { name: "Anglais 1", category: "Langues & Com", icon: Globe, color: "text-yellow-400", type: 'module' },
  // 2. Sciences Base
  { name: "Algèbre 1", category: "Sciences Base", icon: Calculator, color: "text-emerald-400", type: 'module' },
  { name: "Analyse 1", category: "Sciences Base", icon: Hash, color: "text-teal-400", type: 'module' },
  { name: "Mécanique générale", category: "Sciences Base", icon: Settings, color: "text-slate-400", type: 'module' },
  // 3. Informatique
  { name: "Environnement Informatique", category: "Informatique", icon: Layers, color: "text-indigo-400", type: 'module' },
  { name: "Algorithmique et Programmation C", category: "Informatique", icon: Code, color: "text-purple-400", type: 'module' },
  // 4. Électronique
  { name: "Circuits Électriques", category: "Électronique", icon: Zap, color: "text-amber-400", type: 'module' },
  { name: "Circuits Électroniques", category: "Électronique", icon: Cpu, color: "text-rose-400", type: 'module' },
  // 5. Fondamentaux GI
  { name: "Introduction au Génie Industriel", category: "Fondamentaux GI", icon: Factory, color: "text-blue-400", type: 'module' }
];

const TRANSPORT_MODES = [
  { id: 'Voiture familiale', icon: Car, label: 'Voiture familiale' },
  { id: 'Bus public', icon: Bus, label: 'Bus public' },
  { id: 'Voiture personnelle', icon: Car, label: 'Voiture personnelle' },
  { id: 'Taxi', icon: MapPin, label: 'Taxi' },
  { id: 'Moto', icon: Bike, label: 'Moto' }
];

type DateFilter = 'all' | 'today' | 'week' | 'month';

const App: React.FC = () => {
  const [step, setStep] = useState<'welcome' | 'form' | 'submitting' | 'thanks' | 'stats' | 'history'>('welcome');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrLoading, setQrLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittingPhase, setSubmittingPhase] = useState<'analyzing' | 'mailing'>('analyzing');
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [completedSubjects, setCompletedSubjects] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [selectedSubjectForStats, setSelectedSubjectForStats] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [formData, setFormData] = useState<FeedbackData>({
    subject: '', type: 'module', q1: null, q2: null, q3: null, q4: null, q5: null, q6: null, 
    q7_salles: null, q7_ressources: null, q7_pc: null, q7_transport: null, comments: ''
  });

  useEffect(() => { setCompletedSubjects(getCompletedSubjectNames()); }, [step]);

  useEffect(() => {
    if (step === 'submitting') {
      const interval = setInterval(() => {
        setSubmissionProgress(prev => {
          if (submittingPhase === 'analyzing') return prev < 70 ? prev + 1 : prev;
          return prev < 100 ? prev + 2 : prev;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [step, submittingPhase]);

  const isFormValid = useMemo(() => {
    if (!formData.subject) return false;
    if (formData.type === 'global_orientation') return formData.q6 !== null;
    if (formData.type === 'global_env') {
      return formData.q7_salles !== null && formData.q7_ressources !== null && 
             formData.q7_pc !== null && formData.q7_transport !== null;
    }
    return formData.q1 !== null && formData.q2 !== null && formData.q3 !== null && formData.q4 !== null && formData.q5 !== null;
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) { setShowValidationErrors(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false); setStep('submitting'); setSubmittingPhase('analyzing');
    try {
      const result = await analyzeFeedback(formData);
      setAnalysisResult(result);
      saveFeedback(formData);
      await new Promise(r => setTimeout(r, 1500));
      setSubmittingPhase('mailing');
      await sendAnalysisToAdmin(formData, result);
      setSubmissionProgress(100);
      await new Promise(r => setTimeout(r, 500));
      setStep('thanks');
    } catch { setStep('thanks'); }
  };

  const resetForm = () => {
    setFormData({ 
      subject: '', type: 'module', q1: null, q2: null, q3: null, q4: null, q5: null, q6: null, 
      q7_salles: null, q7_ressources: null, q7_pc: null, q7_transport: null, comments: '' 
    });
    setStep('welcome'); setAnalysisResult(null); setShowValidationErrors(false); setSelectedSubjectForStats(null);
    setDateFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startNextEvaluation = () => {
    const all = [...MODULES_DATA, ...GLOBAL_DIAGNOSTICS];
    const next = all.find(s => !completedSubjects.includes(s.name));
    if (next) {
      setFormData({ 
        ...formData, subject: next.name, type: next.type, 
        q1: null, q2: null, q3: null, q4: null, q5: null, q6: null, 
        q7_salles: null, q7_ressources: null, q7_pc: null, q7_transport: null, 
        comments: '' 
      });
      setStep('form'); window.scrollTo({ top: 0, behavior: 'smooth' });
    } else { resetForm(); }
  };

  const openStats = (subjectName: string) => {
    setSelectedSubjectForStats(subjectName);
    setStep('stats');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openQrModal = () => {
    setQrLoading(true);
    setShowQrModal(true);
  };

  const totalTasks = GLOBAL_DIAGNOSTICS.length + MODULES_DATA.length;
  const progress = (completedSubjects.length / totalTasks) * 100;
  const filteredModules = MODULES_DATA.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const HistoryListView = () => {
    const allHistory = getHistory();
    const thresholdDate = useMemo(() => {
      if (dateFilter === 'all') return 0;
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (dateFilter === 'today') return now - oneDay;
      if (dateFilter === 'week') return now - (7 * oneDay);
      if (dateFilter === 'month') return now - (30 * oneDay);
      return 0;
    }, [dateFilter]);

    const filteredHistory = useMemo(() => {
      return allHistory.filter(h => h.timestamp >= thresholdDate);
    }, [allHistory, thresholdDate]);

    const subjectStats = useMemo(() => {
      // Fixed: Casting Array.from(new Set(...)) to string[] to resolve 'unknown' type errors for 'name' variable
      const subjectsInHistory = Array.from(new Set(filteredHistory.map(h => h.subject))) as string[];
      return subjectsInHistory.map(name => {
        const stats = getSubjectStats(name); 
        // Note: Current storageService helper calculates for all time. 
        // For strict date filtering in list, we'd need a filtered stats helper.
        return { name, stats };
      }).filter(s => s.name.toLowerCase().includes(historySearchQuery.toLowerCase()));
    }, [filteredHistory, historySearchQuery]);

    const globalAvg = useMemo(() => {
      if (subjectStats.length === 0) return 0;
      return subjectStats.reduce((acc, curr) => acc + (curr.stats?.averageScore || 0), 0) / subjectStats.length;
    }, [subjectStats]);

    return (
      <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900/40 p-8 rounded-[40px] border-2 border-slate-800/60 backdrop-blur-xl shadow-2xl gap-6">
          <div className="flex items-center gap-6">
            <button onClick={() => setStep('welcome')} className="p-4 bg-slate-800/80 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all shadow-md">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-1">Portail de Diagnostic</h3>
              <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">Historique Global</h2>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/40 p-2 rounded-2xl border border-slate-800">
             {(['all', 'today', 'week', 'month'] as DateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateFilter === f ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}
              >
                {f === 'all' ? 'Total' : f === 'today' ? '24h' : f === 'week' ? '7j' : '30j'}
              </button>
            ))}
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-indigo-600 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 opacity-10"><Activity className="w-16 h-16" /></div>
             <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">Satisfaction Moyenne</p>
             <h3 className="text-5xl font-black text-white tracking-tighter">{Math.round(globalAvg)}%</h3>
          </div>
          <div className="bg-slate-900/40 p-8 rounded-[40px] border border-slate-800 shadow-xl">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Total Feedbacks</p>
             <h3 className="text-5xl font-black text-white tracking-tighter">{filteredHistory.length}</h3>
          </div>
          <div className="bg-slate-900/40 p-8 rounded-[40px] border border-slate-800 shadow-xl">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Matières Évaluées</p>
             <h3 className="text-5xl font-black text-white tracking-tighter">{subjectStats.length}</h3>
          </div>
        </section>

        <section className="bg-slate-900/40 p-10 rounded-[50px] border border-slate-800 space-y-8 shadow-2xl backdrop-blur-md">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                 <ClipboardList className="w-6 h-6 text-indigo-400" />
                 <h4 className="font-black uppercase text-sm tracking-[0.2em] text-white">Récapitulatif par Matière</h4>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" placeholder="Filtrer..." value={historySearchQuery} onChange={(e)=>setHistorySearchQuery(e.target.value)} className="w-full bg-slate-950/40 border border-slate-800 rounded-full py-2.5 pl-12 pr-6 text-xs outline-none focus:border-indigo-500 transition-all shadow-inner text-white" />
              </div>
           </div>

           <div className="grid grid-cols-1 gap-4">
              {subjectStats.map(({ name, stats }) => (
                <button 
                  key={name} 
                  onClick={() => openStats(name)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-slate-950/30 hover:bg-indigo-900/10 border border-slate-800 hover:border-indigo-500/30 rounded-3xl transition-all group"
                >
                  <div className="flex items-center gap-4 text-left">
                     <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 group-hover:bg-indigo-600 transition-colors">
                        <History className="w-5 h-5 text-indigo-400 group-hover:text-white" />
                     </div>
                     <div>
                        <h5 className="font-black text-white uppercase tracking-tight text-sm">{name}</h5>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{stats?.totalEntries} feedbacks enregistrés</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-8 mt-4 sm:mt-0">
                     <div className="text-right">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Indice</p>
                        <p className={`text-xl font-black tabular-nums ${stats && stats.averageScore > 75 ? 'text-emerald-400' : 'text-indigo-400'}`}>{Math.round(stats?.averageScore || 0)}%</p>
                     </div>
                     <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                  </div>
                </button>
              ))}
              {subjectStats.length === 0 && (
                <div className="py-20 text-center text-slate-600 border-2 border-dashed border-slate-800 rounded-[40px]">
                   <Info className="w-12 h-12 mx-auto mb-4 opacity-20" />
                   <p className="font-black uppercase text-[10px] tracking-[0.3em]">Aucun feedback trouvé pour ces critères</p>
                </div>
              )}
           </div>
        </section>

        <button onClick={() => setStep('welcome')} className="w-full py-8 bg-slate-800/40 hover:bg-slate-700/60 backdrop-blur-md rounded-[30px] border border-slate-700/60 font-black text-lg uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 flex items-center justify-center gap-4">
          <ArrowLeft className="w-6 h-6" /> RETOUR AU MENU PRINCIPAL
        </button>
      </div>
    );
  };

  const StatsView = () => {
    if (!selectedSubjectForStats) return null;
    
    // Get full history for the subject
    const rawHistory = getSubjectHistory(selectedSubjectForStats);
    
    // Filter history based on selected date filter
    const filteredHistory = useMemo(() => {
      if (dateFilter === 'all') return rawHistory;
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      let threshold = 0;
      
      if (dateFilter === 'today') threshold = now - oneDay;
      else if (dateFilter === 'week') threshold = now - (7 * oneDay);
      else if (dateFilter === 'month') threshold = now - (30 * oneDay);
      
      return rawHistory.filter(entry => entry.timestamp >= threshold);
    }, [rawHistory, dateFilter]);

    // Recalculate stats manually based on filtered entries
    const stats = useMemo(() => {
      if (filteredHistory.length === 0) return null;

      const type = filteredHistory[0].type;
      const sums = filteredHistory.reduce(
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

      const count = filteredHistory.length;
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

      let relevantScores = [];
      if (type === 'module') {
        relevantScores = [qAverages.q1, qAverages.q2, qAverages.q3, qAverages.q4, qAverages.q5];
      } else if (type === 'global_orientation') {
        relevantScores = [qAverages.q6];
      } else if (type === 'global_env') {
        relevantScores = [qAverages.q7_salles, qAverages.q7_ressources, qAverages.q7_pc];
      }

      const averageScore = relevantScores.reduce((a, b) => a + b, 0) / (relevantScores.length || 1);

      return {
        averageScore,
        totalEntries: count,
        qAverages
      };
    }, [filteredHistory]);

    if (!stats && dateFilter === 'all') return (
      <div className="max-w-xl mx-auto py-20 text-center animate-in fade-in zoom-in duration-500">
        <div className="p-8 bg-slate-900/60 backdrop-blur-md rounded-[40px] border border-slate-800 space-y-6">
          <History className="w-16 h-16 text-slate-600 mx-auto" />
          <h2 className="text-2xl font-black text-white uppercase">Aucune donnée</h2>
          <p className="text-slate-400">Il n'y a pas encore d'historique pour {selectedSubjectForStats}.</p>
          <button onClick={() => setStep('history')} className="px-8 py-3 bg-indigo-600 rounded-2xl font-black uppercase text-xs transition-all shadow-lg shadow-indigo-900/20">Retour à l'historique</button>
        </div>
      </div>
    );

    const scoreColor = stats ? (stats.averageScore >= 75 ? 'text-emerald-400' : stats.averageScore >= 50 ? 'text-indigo-400' : 'text-rose-400') : 'text-slate-600';
    const scoreBg = stats ? (stats.averageScore >= 75 ? 'bg-emerald-500/10' : stats.averageScore >= 50 ? 'bg-indigo-500/10' : 'bg-rose-500/10') : 'bg-slate-900';
    const scoreBorder = stats ? (stats.averageScore >= 75 ? 'border-emerald-500/30' : stats.averageScore >= 50 ? 'border-indigo-500/30' : 'border-rose-500/30') : 'border-slate-800';

    return (
      <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900/40 p-8 rounded-[40px] border-2 border-slate-800/60 backdrop-blur-xl shadow-2xl gap-6">
          <div className="flex items-center gap-6">
            <button onClick={() => setStep('history')} className="p-4 bg-slate-800/80 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all shadow-md">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-1">Rapport de Performance</h3>
              <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">{selectedSubjectForStats}</h2>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/40 p-2 rounded-2xl border border-slate-800">
            {(['all', 'today', 'week', 'month'] as DateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateFilter === f ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}
              >
                {f === 'all' ? 'Total' : f === 'today' ? '24h' : f === 'week' ? '7j' : '30j'}
              </button>
            ))}
          </div>
        </header>

        {stats ? (
          <>
            <section className={`relative overflow-hidden p-16 rounded-[60px] border-2 ${scoreBorder} ${scoreBg} text-center shadow-3xl backdrop-blur-md`}>
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <TrendingUp className="w-64 h-64" />
              </div>
              <p className="text-[12px] font-black uppercase tracking-[0.5em] text-slate-400 mb-6">Indice de Satisfaction {dateFilter !== 'all' && '(Période)'}</p>
              <div className="relative inline-block">
                 <div className="text-[120px] md:text-[160px] font-black leading-none tracking-tighter tabular-nums flex items-baseline justify-center">
                    <span className={scoreColor}>{Math.round(stats.averageScore as number)}</span>
                    <span className="text-4xl md:text-6xl text-slate-500 ml-2">%</span>
                 </div>
                 <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-800 opacity-30" />
                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="301.59" strokeDashoffset={301.59 - (301.59 * stats.averageScore / 100)} className={`${scoreColor} transition-all duration-1000 ease-out`} />
                 </svg>
              </div>
              <div className="mt-12 flex justify-center gap-12">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-500 mb-1">Impact</span>
                    <span className={`text-lg font-black ${scoreColor}`}>{stats.averageScore > 80 ? 'EXCELLENT' : stats.averageScore > 60 ? 'POSITIF' : 'À AMÉLIORER'}</span>
                 </div>
                 <div className="w-px h-10 bg-slate-800"></div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-500 mb-1">Volume</span>
                    <span className="text-lg font-black text-white">{stats.totalEntries} <span className="text-[10px] text-slate-500">ENTRÉES</span></span>
                 </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-slate-900/40 p-10 rounded-[40px] border border-slate-800 space-y-8 shadow-lg backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <BarChart3 className="w-5 h-5 text-indigo-500" />
                       <h4 className="font-black uppercase text-sm tracking-widest text-white">Détails des Scores</h4>
                    </div>
                  </div>
                  <div className="space-y-6">
                     {Object.entries(stats.qAverages).map(([key, val]) => {
                        const value = val as number;
                        if (value === 0 && key !== 'q7_pc') return null;
                        let label = "";
                        if(key === 'q1') label = "Clarté des Objectifs";
                        if(key === 'q2') label = "Qualité des Échanges";
                        if(key === 'q3') label = "Disponibilité Tutorat";
                        if(key === 'q4') label = "Qualité des Supports";
                        if(key === 'q5') label = "Équité de l'Évaluation";
                        if(key === 'q6') label = "Projection Métiers";
                        if(key === 'q7_salles') label = "Équipements Salles";
                        if(key === 'q7_ressources') label = "Ressources Numériques";
                        if(!label) return null;
                        
                        return (
                          <div key={key} className="space-y-3">
                             <div className="flex justify-between items-end">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
                                <span className="text-sm font-black text-white tabular-nums">{Math.round(value)}%</span>
                             </div>
                             <div className="h-2.5 bg-slate-800/50 rounded-full overflow-hidden border border-slate-800">
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.3)]" style={{ width: `${value}%` }}></div>
                             </div>
                          </div>
                        );
                     })}
                  </div>
               </div>

               <div className="bg-slate-900/40 p-10 rounded-[40px] border border-slate-800 space-y-8 flex flex-col shadow-lg backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <MessageCircle className="w-5 h-5 text-indigo-500" />
                       <h4 className="font-black uppercase text-sm tracking-widest text-white">Journal des retours</h4>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-4 custom-scrollbar">
                     {filteredHistory.map((entry, idx) => (
                        entry.comments && (
                          <div key={idx} className="bg-slate-950/30 p-6 rounded-3xl border border-slate-800/50 italic text-slate-300 text-sm leading-relaxed relative hover:border-indigo-500/30 transition-all">
                             <div className="absolute -top-2 -left-2 p-2 bg-slate-900 rounded-full border border-slate-800 shadow-md">
                                <MessageSquareText className="w-3 h-3 text-indigo-500" />
                             </div>
                             "{entry.comments}"
                             <div className="mt-4 text-[9px] font-black uppercase text-slate-500 non-italic flex items-center justify-between">
                                <span className="flex items-center gap-1"><Users className="w-2 h-2" /> Anonyme</span>
                                <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                             </div>
                          </div>
                        )
                     ))}
                     {!filteredHistory.some(h => h.comments) && (
                       <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center py-20 opacity-50">
                          <MessageCircle className="w-16 h-16 mb-4" />
                          <p className="text-xs font-black uppercase tracking-widest">Aucun commentaire sur cette période</p>
                       </div>
                     )}
                  </div>
               </div>
            </section>
          </>
        ) : (
          <div className="bg-slate-900/40 p-20 rounded-[40px] border border-slate-800 text-center shadow-lg">
            <Filter className="w-16 h-16 text-slate-700 mx-auto mb-6" />
            <h3 className="text-2xl font-black text-white uppercase mb-2">Aucun résultat trouvé</h3>
            <p className="text-slate-500">Essayez de modifier les filtres pour afficher des données sur cette période.</p>
            <button onClick={() => setDateFilter('all')} className="mt-8 px-6 py-3 bg-slate-800 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-all">Afficher tout l'historique</button>
          </div>
        )}

        <button onClick={() => setStep('history')} className="w-full py-8 bg-slate-800/40 hover:bg-slate-700/60 backdrop-blur-md rounded-[30px] border border-slate-700/60 font-black text-lg uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 flex items-center justify-center gap-4">
          <ArrowLeft className="w-6 h-6" /> RETOUR À L'HISTORIQUE
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen industrial-pattern text-slate-100 pb-20 selection:bg-indigo-500/30">
      <header className="bg-slate-900/40 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50 h-16 flex items-center">
        <div className="max-w-6xl mx-auto px-6 w-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={resetForm}>
            <div className="p-1.5 bg-indigo-600 rounded-lg shadow-lg"><Factory className="text-white w-5 h-5" /></div>
            <h1 className="font-black text-lg tracking-tighter uppercase">GI <span className="text-indigo-400">FEEDBACK</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setStep('history')} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all shadow-md">
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
            </button>
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none">Progression {completedSubjects.length}/{totalTasks}</span>
              <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
            <button onClick={openQrModal} className="p-2 bg-slate-800/60 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all shadow-md"><QrCode className="w-4 h-4 text-indigo-400" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {step === 'welcome' && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-8 text-center md:text-left">
              <h2 className="text-5xl md:text-7xl font-black tracking-tight uppercase leading-[0.85] text-white">VOTRE VOIX <br/><span className="text-indigo-400">EST DÉCISIVE.</span></h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Barre de Progression Globale Hero */}
                <div className="lg:col-span-2 bg-slate-900/30 backdrop-blur-xl border-2 border-slate-800/60 p-10 rounded-[40px] shadow-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BarChart3 className="w-32 h-32 text-indigo-400" />
                  </div>
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-2 text-left">
                      <div className="flex items-center gap-3 text-indigo-400">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em]">Progression Totale du Diagnostic</span>
                      </div>
                      <p className="text-3xl font-black text-white uppercase tracking-tighter">
                        {completedSubjects.length} <span className="text-slate-600">/ {totalTasks} ÉTAPES</span>
                      </p>
                    </div>
                    <div className="flex-1 max-w-md w-full">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Avancement Global</span>
                        <span className="text-sm font-black text-indigo-400 tabular-nums">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-5 bg-slate-950 rounded-full border border-slate-800 p-1 overflow-hidden relative shadow-inner">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(79,70,229,0.4)] relative overflow-hidden" 
                          style={{ width: `${progress}%` }}
                        >
                           <div className="absolute inset-0 bg-stripes animate-slide-stripes opacity-20"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Accès Historique Global */}
                <button 
                  onClick={() => setStep('history')}
                  className="bg-indigo-950/20 hover:bg-indigo-600 backdrop-blur-xl border-2 border-indigo-500/30 p-10 rounded-[40px] shadow-3xl relative overflow-hidden group text-left transition-all hover:-translate-y-2"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <History className="w-24 h-24 text-white" />
                  </div>
                  <div className="relative z-10 h-full flex flex-col justify-between">
                     <div className="p-4 bg-indigo-500 rounded-2xl w-fit mb-6 shadow-lg group-hover:bg-white transition-colors">
                        <LayoutDashboard className="w-6 h-6 text-white group-hover:text-indigo-600" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 group-hover:text-white">DASHBOARD QUALITÉ</h3>
                        <p className="text-[10px] font-black uppercase text-indigo-300 tracking-widest flex items-center gap-2 group-hover:text-white/80">
                           Consulter les statistiques globales <ArrowUpRight className="w-4 h-4" />
                        </p>
                     </div>
                  </div>
                </button>
              </div>

              <div className="max-w-2xl bg-indigo-950/10 backdrop-blur-md border-2 border-indigo-500/10 p-8 rounded-[32px] space-y-4 shadow-2xl relative overflow-hidden group mx-auto md:mx-0">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <ShieldCheck className="w-24 h-24 text-indigo-400" />
                </div>
                <div className="flex items-center gap-3 text-indigo-400">
                  <Info className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Note d'information</span>
                </div>
                <p className="text-slate-300 text-lg font-medium leading-relaxed italic relative z-10">
                  Questionnaire de satisfaction anonyme : votre avis pour optimiser la qualité pédagogique de l'Institut de Génie Industriel.
                </p>
              </div>

              {completedSubjects.length < totalTasks && (
                <div className="flex justify-center md:justify-start">
                  <button onClick={startNextEvaluation} className="flex items-center gap-4 px-10 py-6 bg-indigo-600 hover:bg-indigo-500 rounded-3xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl active:scale-95 group border-b-4 border-indigo-800">
                    CONTINUER LE DIAGNOSTIC <ChevronRight className="w-5 h-5 animate-bounce-x" />
                  </button>
                </div>
              )}
            </div>

            <section className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-t border-slate-800/50 pt-12">
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/30 backdrop-blur-md border-l-4 border-indigo-500 rounded-r-xl w-fit shadow-md">
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Phase 1 : Évaluation des Modules</span>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" placeholder="Rechercher un module..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className="w-full bg-slate-900/40 border border-slate-800 rounded-full py-3 pl-12 pr-6 text-sm outline-none focus:border-indigo-500 transition-all shadow-inner text-white" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredModules.map(m => {
                  const done = completedSubjects.includes(m.name);
                  return (
                    <div key={m.name} className={`flex flex-col p-8 rounded-[32px] border-2 transition-all text-left relative overflow-hidden group shadow-lg backdrop-blur-sm ${done ? 'bg-slate-900/40 border-emerald-500/20' : 'bg-slate-900/20 border-slate-800/60 hover:border-indigo-500/30'}`}>
                      <div className="flex items-center justify-between mb-6">
                        <div className={`p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 shadow-sm`}>
                          <m.icon className={`w-6 h-6 ${done ? 'text-emerald-500' : m.color}`} />
                        </div>
                        {done && (
                          <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Enregistré</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                        )}
                      </div>
                      <h4 className="text-lg font-black text-white leading-tight mb-2">{m.name}</h4>
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-6">{m.category}</p>
                      
                      <div className="mt-auto grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => { if(!done){ setFormData({...formData, subject: m.name, type: m.type}); setStep('form'); window.scrollTo({top:0, behavior:'smooth'}); } }}
                          disabled={done}
                          className={`py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${done ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-lg'}`}
                        >
                          {done ? 'TERMINE' : 'ÉVALUER'}
                        </button>
                        <button 
                          onClick={() => openStats(m.name)}
                          className="py-3 bg-slate-800/40 hover:bg-slate-700/60 text-indigo-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-slate-700/60 flex items-center justify-center gap-2 shadow-sm"
                        >
                          <History className="w-3.5 h-3.5" /> HISTORIQUE
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/30 backdrop-blur-md border-l-4 border-emerald-500 rounded-r-xl w-fit shadow-md">
                <LayoutDashboard className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Phase 2 : Diagnostic Institutionnel</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {GLOBAL_DIAGNOSTICS.map(d => {
                  const done = completedSubjects.includes(d.name);
                  return (
                    <div key={d.name} className={`flex flex-col p-8 rounded-[32px] border-2 transition-all text-left group relative overflow-hidden shadow-lg backdrop-blur-sm ${done ? 'bg-slate-900/40 border-emerald-500/20' : 'bg-slate-900/20 border-slate-800/60 hover:border-emerald-500/30'}`}>
                      <div className="flex items-center gap-6 mb-6">
                        <div className={`p-5 rounded-2xl border ${done ? 'bg-emerald-500/10 border-emerald-500/20 shadow-inner' : 'bg-slate-950/40 border-slate-800/60'}`}>
                          <d.icon className={`w-8 h-8 ${done ? 'text-emerald-500' : d.color}`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-black text-white">{d.name}</h4>
                          {done && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Soumis</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => { if(!done){ setFormData({...formData, subject: d.name, type: d.type}); setStep('form'); window.scrollTo({top:0, behavior:'smooth'}); } }}
                          disabled={done}
                          className={`py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${done ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-xl shadow-emerald-900/10'}`}
                        >
                          {done ? 'ÉVALUÉ' : 'RÉPONDRE'}
                        </button>
                        <button 
                          onClick={() => openStats(d.name)}
                          className="py-4 bg-slate-800/40 hover:bg-slate-700/60 text-emerald-300 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border border-slate-700/60 flex items-center justify-center gap-2 shadow-sm"
                        >
                          <History className="w-4 h-4" /> HISTORIQUE
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {step === 'history' && <HistoryListView />}
        {step === 'stats' && <StatsView />}

        {step === 'form' && (
          <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-xl p-10 rounded-[40px] border-2 border-slate-800/60 shadow-3xl">
              <div>
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">{formData.type === 'module' ? 'ÉVALUATION MODULE' : 'DIAGNOSTIC GLOBAL'}</h3>
                <p className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-white leading-none">{formData.subject}</p>
              </div>
              <button onClick={resetForm} className="px-6 py-3 bg-slate-800/60 hover:bg-slate-700 rounded-2xl border border-slate-700/60 font-black text-[9px] uppercase hover:bg-slate-700 transition-all">RETOUR</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
              {formData.type === 'global_orientation' && (
                <QuestionCard number={1} text="Je connais les métiers visés par cette formation." value={formData.q6} onChange={(v)=>setFormData({...formData, q6:v})} icon={Briefcase} showError={showValidationErrors} />
              )}
              
              {formData.type === 'global_env' && (
                <div className="space-y-8">
                  <QuestionCard number={1} text="Les salles de cours sont adaptées (bruit, éclairage, confort)." value={formData.q7_salles} onChange={(v)=>setFormData({...formData, q7_salles:v})} icon={Sun} showError={showValidationErrors} />
                  <QuestionCard number={2} text="L’accès aux ressources (Wi-Fi, labo, bibliothèque, plateformes) est suffisant." value={formData.q7_ressources} onChange={(v)=>setFormData({...formData, q7_ressources:v})} icon={Wifi} showError={showValidationErrors} />
                  <QuestionCard number={3} text="Disposez-vous personnellement d’un ordinateur portable pour vos études ?" value={formData.q7_pc} onChange={(v)=>setFormData({...formData, q7_pc:v})} icon={Laptop} showError={showValidationErrors} options={[{ label: 'NON', value: 0 }, { label: 'OUI', value: 100 }]} />
                  <div className={`bg-slate-900/40 backdrop-blur-md p-8 rounded-3xl border-2 transition-all ${showValidationErrors && !formData.q7_transport ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-slate-800/60'}`}>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-amber-500/10 rounded-xl"><Car className="w-6 h-6 text-amber-500" /></div>
                      <h4 className="text-xl font-black uppercase tracking-tighter text-white">Moyen de transport principal</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {TRANSPORT_MODES.map((mode) => (
                        <button key={mode.id} type="button" onClick={() => setFormData({...formData, q7_transport: mode.id})} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${formData.q7_transport === mode.id ? 'bg-amber-900/20 border-amber-500 text-white shadow-lg' : 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:border-slate-700'}`}>
                          <mode.icon className="w-5 h-5" />
                          <span className="font-bold text-sm uppercase tracking-widest">{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {formData.type === 'module' && (
                <div className="space-y-6">
                  {[
                    { n: 1, t: "Les objectifs du cours ont été clairement présentés.", i: Target, k: 'q1' },
                    { n: 2, t: "L’enseignant favorise les questions et échanges.", i: MessageSquare, k: 'q2' },
                    { n: 3, t: "L’enseignant est disponible pour un soutien hors cours.", i: Clock, k: 'q3' },
                    { n: 4, t: "Les explications et supports sont clairs.", i: Layers, k: 'q4' },
                    { n: 5, t: "Les évaluations reflètent les acquis réels.", i: Award, k: 'q5' }
                  ].map(q => (
                    <QuestionCard key={q.k} number={q.n} text={q.t} value={formData[q.k as keyof FeedbackData] as any} onChange={(v)=>setFormData({...formData, [q.k]:v})} icon={q.i} showError={showValidationErrors} />
                  ))}
                </div>
              )}

              <div className="bg-slate-900/40 backdrop-blur-md border-l-8 border-indigo-800 p-10 rounded-3xl space-y-6 shadow-xl">
                <div className="flex items-center gap-3">
                  <MessageSquareText className="w-5 h-5 text-indigo-400/50" />
                  <label className="font-black text-[10px] uppercase tracking-widest text-white">Observations Supplémentaires (Optionnel)</label>
                </div>
                <textarea value={formData.comments} onChange={(e)=>setFormData({...formData, comments:e.target.value})} placeholder="Dites-nous en plus..." rows={3} className="w-full bg-slate-950/40 border-2 border-slate-800/60 rounded-2xl p-6 text-lg focus:border-indigo-500 outline-none transition-all resize-none shadow-inner text-white" />
              </div>

              <div className="flex flex-col gap-6 pt-6">
                {showValidationErrors && !isFormValid && (
                  <div className="flex items-center gap-3 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
                    <AlertCircle className="w-5 h-5" /><p className="text-xs font-black uppercase">Réponses incomplètes pour ce diagnostic.</p>
                  </div>
                )}
                <button type="submit" className="w-full py-8 rounded-[2rem] font-black text-2xl uppercase tracking-widest transition-all flex items-center justify-center gap-5 bg-gradient-to-br from-indigo-700 to-indigo-500 text-white shadow-2xl active:scale-95 group border-b-4 border-indigo-900 hover:brightness-110">
                  <Send className="w-7 h-7 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" /> TRANSMETTRE
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'submitting' && (
          <div className="max-w-xl mx-auto py-32 space-y-10 text-center animate-in zoom-in duration-700">
            <div className="inline-flex p-8 bg-indigo-500/10 rounded-full border border-indigo-500/20 animate-subtle-pulse shadow-2xl">
              {submittingPhase === 'analyzing' ? <Activity className="w-16 h-16 text-indigo-500" /> : <Mail className="w-16 h-16 text-indigo-500 animate-bounce" />}
            </div>
            <h2 className="text-5xl font-black uppercase text-white tracking-tighter">{submittingPhase === 'analyzing' ? 'IA ANALYSE' : 'TRANSMISSION'}</h2>
            <div className="bg-slate-900/40 backdrop-blur-xl p-12 rounded-[50px] border border-slate-800/60 relative overflow-hidden shadow-2xl">
               <div className="h-16 w-full bg-slate-950/40 rounded-full p-2 border border-slate-800/60 relative shadow-inner">
                 <div className="h-full bg-indigo-500 rounded-full transition-all duration-300 relative shadow-[0_0_20px_rgba(99,102,241,0.4)]" style={{ width: `${submissionProgress}%` }}>
                    <div className="absolute inset-0 bg-stripes animate-slide-stripes opacity-20"></div>
                 </div>
               </div>
               <p className="mt-8 text-3xl font-black text-white tabular-nums">{submissionProgress}%</p>
            </div>
          </div>
        )}

        {step === 'thanks' && (
          <div className="max-w-3xl mx-auto space-y-12 pb-24 text-center animate-in zoom-in duration-500">
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[60px] border-2 border-slate-800/60 overflow-hidden shadow-3xl">
              <div className="p-20 bg-emerald-600/90">
                <CheckCircle2 className="w-20 h-20 mx-auto mb-8 text-white" />
                <h2 className="text-7xl font-black uppercase leading-none mb-4 tracking-tighter text-white">SUCCÈS !</h2>
                <p className="text-xl font-bold text-white/90">{formData.subject} a été enregistré avec succès.</p>
              </div>
              <div className="p-16 space-y-12">
                {analysisResult && (
                  <div className="bg-slate-950/40 backdrop-blur-md p-10 rounded-[40px] text-left border border-slate-800/60 shadow-inner">
                    <div className="flex items-center gap-3 mb-6">
                      <Sparkles className="w-6 h-6 text-indigo-400" />
                      <h4 className="font-black uppercase text-indigo-200 tracking-widest text-sm">Synthèse Qualité GI</h4>
                    </div>
                    <p className="text-slate-300 text-lg leading-relaxed italic">"{analysisResult.summary}"</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <button onClick={startNextEvaluation} className="bg-indigo-600 hover:bg-indigo-500 py-8 rounded-3xl font-black text-xl uppercase transition-all flex items-center justify-center gap-4 text-white shadow-xl hover:-translate-y-1">SUIVANT <ChevronRight className="w-6 h-6" /></button>
                  <button onClick={() => openStats(formData.subject)} className="bg-slate-800/60 hover:bg-slate-700/80 py-8 rounded-3xl font-black text-xl uppercase transition-all flex items-center justify-center gap-4 border border-slate-700/60 shadow-xl hover:-translate-y-1 text-white">STATISTIQUES <History className="w-6 h-6" /></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border-2 border-slate-800/60 p-16 rounded-[60px] max-w-lg w-full text-center space-y-10 animate-in zoom-in duration-300 shadow-3xl backdrop-blur-2xl">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
              <AlertCircle className="w-10 h-10 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-4xl font-black uppercase text-white tracking-tighter">Confirmation</h2>
              <p className="text-slate-400 text-lg font-medium mt-4">Soumettre ce diagnostic au système qualité de l'IUP ?</p>
            </div>
            <div className="flex flex-col gap-4">
              <button onClick={handleConfirmSubmit} className="py-6 bg-indigo-600 hover:bg-indigo-500 rounded-3xl font-black text-lg uppercase transition-all text-white shadow-lg">CONFIRMER</button>
              <button onClick={()=>setShowConfirmModal(false)} className="py-6 bg-slate-800/60 hover:bg-slate-700 rounded-3xl font-black text-lg uppercase transition-all border border-slate-700/60 text-white">ANNULER</button>
            </div>
          </div>
        </div>
      )}

      {showQrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="bg-slate-900/60 border-2 border-slate-800/60 p-16 rounded-[70px] max-w-xl w-full text-center space-y-10 relative shadow-3xl backdrop-blur-2xl">
            <button onClick={()=>setShowQrModal(false)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all bg-slate-800/60 p-2 rounded-full z-20"><XCircle className="w-8 h-8"/></button>
            <h2 className="text-4xl font-black uppercase text-white tracking-tighter">Scanner / Partager</h2>
            
            <div className="aspect-square bg-white rounded-[4rem] p-10 mx-auto max-w-[320px] shadow-2xl relative flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 border-8 border-slate-900 rounded-[4rem] pointer-events-none z-10"></div>
              
              {qrLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 z-20 bg-white/90 backdrop-blur-sm animate-in fade-in duration-300">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                  <p className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] animate-pulse">Génération...</p>
                </div>
              )}
              
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(window.location.href)}&bgcolor=ffffff&color=000000&margin=5`} 
                alt="QR Code Interactif" 
                onLoad={() => setQrLoading(false)}
                className={`w-full h-full transition-opacity duration-700 ${qrLoading ? 'opacity-0' : 'opacity-100'}`} 
              />
              
              {!qrLoading && (
                <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500 opacity-20 animate-scan pointer-events-none"></div>
              )}
            </div>
            
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Lien d'accès rapide pour mobile</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
