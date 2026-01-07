import React, { useState, useMemo } from 'react';
import { FeedbackData, FeedbackEntry } from './types';
import QuestionCard from './components/QuestionCard';
import { saveFeedback, getHistory, downloadHistoryCSV, getSubjectStats, downloadAggregatedStatsCSV } from './services/storageService';
import { analyzeFeedback } from './services/geminiService';
import { sendAnalysisToAdmin } from './services/emailService';
import { 
  Factory, CheckCircle2, 
  Target, MessageSquare, BookOpen, Award, 
  ShieldCheck, MapPin, Truck, HelpCircle,
  Menu, X, Lock, AlertCircle, Info,
  Book, Building2, LayoutGrid, ArrowLeft,
  Search, ChevronUp, ChevronDown, Maximize2, Minimize2,
  Table as TableIcon, History, BarChart3, Copy, Users,
  TrendingUp, Calendar, Hash, Zap, Share2, Download,
  LogOut, ShieldAlert, Filter, RotateCcw, Activity,
  Globe, BarChart, PieChart, Laptop, Play
} from 'lucide-react';

type AppStep = 'welcome' | 'hub' | 'modules' | 'form_pedagogy' | 'form_env' | 'submitting' | 'thanks';
type AdminTab = 'historique' | 'stats_details' | 'table';
type SortKey = 'timestamp' | 'subject' | 'score';
type SortOrder = 'asc' | 'desc';

const GI_SUBJECTS = [
  "Algèbre 1",
  "Algorithmique et Programmation C",
  "Analyse 1",
  "Anglais 1",
  "Circuits Électriques",
  "Circuits Électroniques",
  "Environnement Informatique",
  "Français 1",
  "Introduction au Génie Industriel",
  "Mécanique générale"
];

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('welcome');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminTab, setAdminTab] = useState<AdminTab>('historique');
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [completedSubjects, setCompletedSubjects] = useState<string[]>([]);
  const [envAuditDone, setEnvAuditDone] = useState(false);
  const [lastSubmissionId, setLastSubmissionId] = useState('');
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  
  // Table state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; order: SortOrder }>({ key: 'timestamp', order: 'desc' });
  
  const [formData, setFormData] = useState<FeedbackData>({
    subject: '',
    q1: null, q2: null, q3: null, q4: null, q5: null,
    q6_jobs: null, q7_rooms: null, q8_resources: null, q9_transport: null, q10_laptop: null,
    comments: ''
  });

  const backToHub = () => setStep('hub');
  const isAdminAuthenticated = adminPass === 'admin123';
  const history = useMemo(() => getHistory(), [sidebarOpen, step]);

  const filteredAndSortedHistory = useMemo(() => {
    let result = [...history];

    // Text Search
    if (searchTerm) {
      result = result.filter(entry => 
        entry.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.comments.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Subject Filter
    if (filterSubject !== 'ALL') {
      result = result.filter(entry => entry.subject === filterSubject);
    }

    // Date Filter
    if (filterDate) {
      const [fYear, fMonth, fDay] = filterDate.split('-');
      const targetDateStr = `${fDay}/${fMonth}/${fYear}`;
      result = result.filter(entry => entry.timestamp.startsWith(targetDateStr));
    }

    result.sort((a, b) => {
      let valA: any = a[sortConfig.key === 'score' ? 'q1' : sortConfig.key] || 0;
      let valB: any = b[sortConfig.key === 'score' ? 'q1' : sortConfig.key] || 0;
      
      if (sortConfig.key === 'score') {
        valA = ((a.q1||0) + (a.q2||0) + (a.q3||0) + (a.q4||0) + (a.q5||0)) / 5;
        valB = ((b.q1||0) + (b.q2||0) + (b.q3||0) + (b.q4||0) + (b.q5||0)) / 5;
      }

      if (valA < valB) return sortConfig.order === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.order === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [history, searchTerm, filterSubject, filterDate, sortConfig]);

  // View specific stats (for the table tab)
  const viewStats = useMemo(() => {
    const total = filteredAndSortedHistory.length;
    const subjects = new Set(filteredAndSortedHistory.map(e => e.subject));
    
    const pedagogyEntries = filteredAndSortedHistory.filter(e => e.subject !== 'ENVIRONNEMENT_GLOBAL');
    const average = pedagogyEntries.length 
      ? Math.round(pedagogyEntries.reduce((acc, e) => acc + ((e.q1||0)+(e.q2||0)+(e.q3||0)+(e.q4||0)+(e.q5||0))/5, 0) / pedagogyEntries.length)
      : 0;

    return { total, subjectCount: subjects.size, average };
  }, [filteredAndSortedHistory]);

  const adminStats = useMemo(() => {
    const total = history.length;
    if (total === 0) return { total, average: 0, bySubject: [] };
    
    const validHistory = history.filter(e => e.subject !== 'ENVIRONNEMENT_GLOBAL');
    const sum = validHistory.reduce((acc, entry) => {
      const entrySum = (entry.q1 || 0) + (entry.q2 || 0) + (entry.q3 || 0) + (entry.q4 || 0) + (entry.q5 || 0);
      return acc + (entrySum / 5);
    }, 0);

    const bySubject = GI_SUBJECTS.map(s => ({
      name: s,
      stats: getSubjectStats(s)
    })).filter(item => item.stats !== null);
    
    return { 
      total, 
      average: validHistory.length ? Math.round(sum / validHistory.length) : 0, 
      bySubject 
    };
  }, [history]);

  const progressStats = useMemo(() => {
    if (step === 'form_pedagogy') {
      const fields = [formData.q1, formData.q2, formData.q3, formData.q4, formData.q5];
      const completed = fields.filter(v => v !== null).length;
      return { percentage: Math.round((completed / 5) * 100), completed, total: 5 };
    }
    if (step === 'form_env') {
      const fields = [formData.q6_jobs, formData.q7_rooms, formData.q8_resources, formData.q9_transport, formData.q10_laptop];
      const completed = fields.filter(v => v !== null).length;
      return { percentage: Math.round((completed / 5) * 100), completed, total: 5 };
    }
    return { percentage: 0, completed: 0, total: 0 };
  }, [formData, step]);

  const firstUncompletedSubject = useMemo(() => {
    return GI_SUBJECTS.find(s => !completedSubjects.includes(s));
  }, [completedSubjects]);

  const startPedagogy = (subject: string) => {
    setSelectedSubject(subject);
    setFormData({
      subject,
      q1: null, q2: null, q3: null, q4: null, q5: null,
      q6_jobs: null, q7_rooms: null, q8_resources: null, q9_transport: null, q10_laptop: null,
      comments: ''
    });
    setStep('form_pedagogy');
    setShowValidationErrors(false);
  };

  const startEnvAudit = () => {
    setFormData({
      subject: 'ENVIRONNEMENT_GLOBAL',
      q1: null, q2: null, q3: null, q4: null, q5: null,
      q6_jobs: null, q7_rooms: null, q8_resources: null, q9_transport: null, q10_laptop: null,
      comments: ''
    });
    setStep('form_env');
    setShowValidationErrors(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (progressStats.completed < progressStats.total) {
      setShowValidationErrors(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    setStep('submitting');
    
    try {
      const id = saveFeedback(formData);
      setLastSubmissionId(id);
      const analysis = await analyzeFeedback(formData);
      await sendAnalysisToAdmin(formData, analysis);

      if (step === 'form_pedagogy') {
        setCompletedSubjects(prev => [...prev, formData.subject]);
      } else {
        setEnvAuditDone(true);
      }
      setStep('thanks');
    } catch (error) {
      console.error("Échec de la transmission IA/Email", error);
      setStep('thanks');
    }
  };

  const copyToClipboard = () => {
    if (lastSubmissionId) {
      navigator.clipboard.writeText(lastSubmissionId);
      setShowCopyFeedback(true);
      setTimeout(() => setShowCopyFeedback(false), 2000);
    }
  };

  const toggleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      order: prev.key === key && prev.order === 'desc' ? 'asc' : 'desc'
    }));
  };

  const resetAll = () => {
    setCompletedSubjects([]);
    setEnvAuditDone(false);
    setStep('welcome');
  };

  return (
    <div className="min-h-screen industrial-pattern text-slate-100 selection:bg-indigo-500/30">
      {/* Sidebar Admin */}
      <div className={`fixed inset-y-0 left-0 z-[100] bg-slate-950 border-r border-slate-900 transform transition-all duration-500 shadow-2xl flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${adminExpanded ? 'w-full md:w-4/5 lg:w-3/4' : 'w-80'}`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-900">
          <div className="flex items-center gap-2">
            {isAdminAuthenticated ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <ShieldAlert className="w-5 h-5 text-indigo-400" />}
            <h3 className="font-black text-[10px] uppercase tracking-[0.25em] text-white">Console Qualité</h3>
          </div>
          <div className="flex items-center gap-2">
            {isAdminAuthenticated && (
              <button 
                onClick={() => setAdminExpanded(!adminExpanded)}
                className="p-2 hover:bg-slate-900 rounded-xl transition-colors text-slate-500"
                title={adminExpanded ? "Réduire" : "Agrandir"}
              >
                {adminExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
            <button onClick={() => { setSidebarOpen(false); setAdminExpanded(false); }} className="p-2 hover:bg-slate-900 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {!isAdminAuthenticated ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[32px] text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Lock className="w-8 h-8 text-indigo-400" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-black uppercase tracking-widest text-white">Zone Sécurisée</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Veuillez entrer le code d'accès administrateur</p>
                </div>
                <div className="space-y-3">
                  <input 
                    type="password" 
                    autoFocus
                    value={adminPass} 
                    onChange={(e) => setAdminPass(e.target.value)} 
                    placeholder="CODE..." 
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-center text-lg font-mono tracking-[0.5em] focus:border-indigo-500 outline-none text-indigo-400 transition-all placeholder:tracking-normal placeholder:text-slate-800" 
                  />
                  {adminPass.length > 0 && adminPass !== 'admin123' && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest animate-pulse">Authentification échouée</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex bg-slate-900 p-1 rounded-xl gap-1">
                <button onClick={() => setAdminTab('historique')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${adminTab === 'historique' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                  <History className="w-3 h-3" /> Historique
                </button>
                <button onClick={() => setAdminTab('stats_details')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${adminTab === 'stats_details' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                  <BarChart3 className="w-3 h-3" /> Modules
                </button>
                <button onClick={() => setAdminTab('table')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${adminTab === 'table' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                  <TableIcon className="w-3 h-3" /> Tableau
                </button>
              </div>

              {adminTab === 'historique' && (
                <div className="animate-in fade-in duration-300 space-y-6">
                  <div className="space-y-4">
                    <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-[28px] relative overflow-hidden group hover:border-indigo-500/50 transition-all shadow-xl">
                      <div className="absolute -right-4 -top-4 opacity-5 group-hover:rotate-12 group-hover:scale-110 transition-transform">
                        <Users size={80} className="text-indigo-400" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                            <Hash className="w-5 h-5 text-indigo-400" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Volume d'Enquêtes</p>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <p className="text-5xl font-black text-white">{adminStats.total}</p>
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">+ En temps réel</span>
                        </div>
                        <p className="text-[9px] text-slate-600 font-bold uppercase mt-2 tracking-widest">Total des audits enregistrés</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-[24px] group hover:border-amber-500/50 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2 bg-amber-500/10 rounded-lg">
                            <BookOpen className="w-4 h-4 text-amber-500" />
                          </div>
                          <span className="text-2xl font-black text-white">{adminStats.bySubject.length}</span>
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Matières Audités</p>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-[24px] group hover:border-emerald-500/50 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                          </div>
                          <span className="text-2xl font-black text-white">{adminStats.average}%</span>
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Qualité Globale</p>
                      </div>
                    </div>
                  </div>

                  <button onClick={() => downloadHistoryCSV()} className="w-full flex items-center justify-center gap-3 bg-white text-slate-950 py-4 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] hover:bg-indigo-50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
                    <TableIcon className="w-4 h-4" /> Exporter Historique Complet
                  </button>

                  <div className="space-y-3 pt-4 border-t border-slate-900">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 mb-4">
                      <Zap className="w-3 h-3 text-indigo-400" /> Flux d'enquêtes récent
                    </p>
                    {history.length === 0 ? (
                      <div className="text-center py-20 text-slate-600 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
                        <History className="w-10 h-10 mx-auto mb-4 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Aucune donnée archivée</p>
                      </div>
                    ) : (
                      history.map((entry) => {
                        const avg = entry.subject === 'ENVIRONNEMENT_GLOBAL' ? null : Math.round(((entry.q1||0) + (entry.q2||0) + (entry.q3||0) + (entry.q4||0) + (entry.q5||0)) / 5);
                        return (
                          <div key={entry.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl hover:border-indigo-500/30 hover:bg-slate-900 transition-all cursor-default group relative overflow-hidden">
                            {avg !== null && (
                              <div className={`absolute top-0 right-0 w-1.5 h-full ${avg >= 75 ? 'bg-emerald-500' : avg >= 50 ? 'bg-indigo-500' : 'bg-red-500'} opacity-50`}></div>
                            )}
                            <div className="flex justify-between items-start mb-2 pr-2">
                              <div>
                                <p className="text-xs font-black text-white leading-tight uppercase tracking-tighter">
                                  {entry.subject === 'ENVIRONNEMENT_GLOBAL' ? '🌍 ENVIRONNEMENT' : entry.subject}
                                </p>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-2 h-2" /> {entry.timestamp}
                                </p>
                              </div>
                              <span className="text-[8px] font-mono text-indigo-400/80">#{entry.id}</span>
                            </div>
                            {avg !== null && (
                              <div className="flex items-center gap-3 mt-3">
                                <div className="flex-1 h-1 bg-slate-950 rounded-full overflow-hidden">
                                  <div className={`h-full transition-all duration-1000 ${avg >= 75 ? 'bg-emerald-500' : avg >= 50 ? 'bg-indigo-500' : 'bg-red-500'}`} style={{ width: `${avg}%` }}></div>
                                </div>
                                <span className={`text-[10px] font-black ${avg >= 75 ? 'text-emerald-400' : avg >= 50 ? 'text-indigo-400' : 'text-red-400'}`}>{avg}%</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {adminTab === 'stats_details' && (
                <div className="animate-in fade-in duration-300 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Performances par Module</p>
                    <button 
                      onClick={() => downloadAggregatedStatsCSV(GI_SUBJECTS)} 
                      className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/5 px-3 py-1.5 rounded-lg border border-indigo-500/10"
                    >
                      <Download className="w-3 h-3" /> Export CSV
                    </button>
                  </div>
                  {adminStats.bySubject.length === 0 ? (
                    <div className="text-center py-20 text-slate-600 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
                      <BarChart3 className="w-10 h-10 mx-auto mb-4 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Aucune donnée par matière</p>
                    </div>
                  ) : (
                    adminStats.bySubject.map((item, idx) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-indigo-500/30 transition-all">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-xs font-black text-white uppercase tracking-tight">{item.name}</h4>
                          <span className="text-[10px] font-black text-indigo-400">{Math.round(item.stats.averageScore)}%</span>
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500 tracking-widest">
                             <span>Réponses : {item.stats.totalEntries}</span>
                             <span>Qualité : {Math.round(item.stats.averageScore)}%</span>
                           </div>
                           <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                             <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${item.stats.averageScore}%` }}></div>
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {adminTab === 'table' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-6">
                  {/* KPI Cards Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-[32px] relative overflow-hidden group hover:border-indigo-500/50 transition-all shadow-xl">
                      <div className="absolute -right-4 -bottom-4 opacity-[0.05] group-hover:scale-125 group-hover:rotate-12 transition-transform duration-700">
                        <Activity size={90} className="text-indigo-400" />
                      </div>
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <BarChart className="w-4 h-4 text-indigo-400" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Volume Audité</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-auto">
                          <p className="text-4xl font-black text-white">{viewStats.total}</p>
                          <span className="text-[9px] font-bold text-slate-600 uppercase">Enquêtes</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-[32px] relative overflow-hidden group hover:border-amber-500/50 transition-all shadow-xl">
                      <div className="absolute -right-4 -bottom-4 opacity-[0.05] group-hover:scale-125 group-hover:-rotate-12 transition-transform duration-700">
                        <BookOpen size={90} className="text-amber-400" />
                      </div>
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="p-2 bg-amber-500/10 rounded-xl">
                            <PieChart className="w-4 h-4 text-amber-400" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Diversité Modules</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-auto">
                          <p className="text-4xl font-black text-white">{viewStats.subjectCount}</p>
                          <span className="text-[9px] font-bold text-slate-600 uppercase">Matières</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-[32px] relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-xl">
                      <div className="absolute -right-4 -bottom-4 opacity-[0.05] group-hover:scale-125 transition-transform duration-700">
                        <Target size={90} className="text-emerald-400" />
                      </div>
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Qualité Moyenne</span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-auto">
                          <p className={`text-4xl font-black ${viewStats.average >= 75 ? 'text-emerald-400' : viewStats.average >= 50 ? 'text-indigo-400' : 'text-red-400'}`}>
                            {viewStats.average}%
                          </p>
                          <span className="text-[9px] font-bold text-slate-600 uppercase">Score Vue</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filters Container */}
                  <div className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-[40px] space-y-5 shadow-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">
                          <Filter className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Moteur de Filtrage</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {filteredAndSortedHistory.length > 0 && (
                          <button 
                            onClick={() => downloadHistoryCSV(filteredAndSortedHistory)}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase text-indigo-400 hover:bg-indigo-500/20 transition-all animate-in fade-in slide-in-from-top-2"
                            title="Télécharger ces résultats en CSV"
                          >
                            <Download className="w-3 h-3" /> Exporter la sélection ({filteredAndSortedHistory.length})
                          </button>
                        )}
                        {(filterSubject !== 'ALL' || filterDate !== '' || searchTerm !== '') && (
                          <button 
                            onClick={() => { setFilterSubject('ALL'); setFilterDate(''); setSearchTerm(''); }}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase text-indigo-400 hover:bg-indigo-500/20 transition-all animate-in fade-in slide-in-from-right-4"
                          >
                            <RotateCcw className="w-3 h-3" /> Réinitialiser
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="relative group">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Filtrer par ID de transaction ou contenu du commentaire..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-800 shadow-inner"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="relative">
                        <Globe className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                        <select 
                          value={filterSubject}
                          onChange={(e) => setFilterSubject(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-12 pr-10 py-3.5 text-[11px] font-black uppercase text-slate-400 outline-none focus:border-indigo-500 appearance-none transition-all cursor-pointer hover:bg-slate-950"
                        >
                          <option value="ALL">Tous les modules (Pédagogie + Env)</option>
                          <option value="ENVIRONNEMENT_GLOBAL">🌍 Diagnostic Environnemental</option>
                          <optgroup label="Modules d'Enseignement">
                            {GI_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </optgroup>
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-700 pointer-events-none" />
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                        <input 
                          type="date" 
                          value={filterDate}
                          onChange={(e) => setFilterDate(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-[11px] font-black uppercase text-slate-400 outline-none focus:border-indigo-500 transition-all [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Results List */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-4 mb-4">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                        Affichage de {filteredAndSortedHistory.length} entrées archivées
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/30 shadow-2xl backdrop-blur-sm">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                          <thead className="bg-slate-950/90 backdrop-blur-xl sticky top-0 z-20">
                            <tr>
                              <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:text-white transition-colors group" onClick={() => toggleSort('timestamp')}>
                                <div className="flex items-center gap-2">
                                  Horodatage {sortConfig.key === 'timestamp' && (sortConfig.order === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />)}
                                </div>
                              </th>
                              <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:text-white transition-colors group" onClick={() => toggleSort('subject')}>
                                <div className="flex items-center gap-2">
                                  Domaine Audit {sortConfig.key === 'subject' && (sortConfig.order === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />)}
                                </div>
                              </th>
                              <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:text-white transition-colors text-center group" onClick={() => toggleSort('score')}>
                                <div className="flex items-center justify-center gap-2">
                                  Score Q. {sortConfig.key === 'score' && (sortConfig.order === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />)}
                                </div>
                              </th>
                              <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-500">ID Transaction</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40">
                            {filteredAndSortedHistory.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-24 text-center">
                                  <div className="flex flex-col items-center gap-4 opacity-20">
                                    <Search size={64} className="text-slate-500" />
                                    <p className="text-xs font-black uppercase tracking-[0.4em] italic">Aucun diagnostic trouvé</p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredAndSortedHistory.map((entry) => {
                                const avgScore = entry.subject === 'ENVIRONNEMENT_GLOBAL' ? null : Math.round(((entry.q1||0) + (entry.q2||0) + (entry.q3||0) + (entry.q4||0) + (entry.q5||0)) / 5);
                                return (
                                  <tr key={entry.id} className="hover:bg-indigo-500/5 transition-all duration-300 group">
                                    <td className="p-5 text-[11px] font-bold text-slate-400 font-mono whitespace-nowrap">{entry.timestamp}</td>
                                    <td className="p-5">
                                      <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-white uppercase tracking-tight">
                                          {entry.subject === 'ENVIRONNEMENT_GLOBAL' ? '🌍 ENVIRONNEMENT GLOBAL' : entry.subject}
                                        </span>
                                        {entry.comments && (
                                          <span className="text-[9px] text-slate-600 font-medium italic truncate max-w-[200px] mt-1">
                                            "{entry.comments}"
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-5 text-center">
                                      {avgScore !== null ? (
                                        <div className="flex flex-col items-center gap-1.5">
                                          <span className={`text-[11px] font-black px-3 py-1 rounded-xl shadow-lg ${avgScore >= 75 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : avgScore >= 50 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {avgScore}%
                                          </span>
                                          <div className="w-12 h-1 bg-slate-950 rounded-full overflow-hidden">
                                            <div className={`h-full ${avgScore >= 75 ? 'bg-emerald-500' : avgScore >= 50 ? 'bg-indigo-500' : 'bg-red-500'}`} style={{ width: `${avgScore}%` }}></div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">Diag. Global</span>
                                          <span className="text-[8px] text-slate-700 italic">N/A Score</span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-5 text-[10px] text-indigo-500/60 font-mono font-bold group-hover:text-indigo-400 transition-colors uppercase tracking-widest">
                                      {entry.id}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="pt-6 border-t border-slate-900 mt-auto">
                <button 
                  onClick={() => setAdminPass('')}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-slate-900 text-slate-500 hover:text-red-400 hover:bg-red-500/5 border border-slate-800 transition-all font-black text-[9px] uppercase tracking-widest"
                >
                  <LogOut className="w-4 h-4" /> Quitter l'Administration
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <header className="bg-slate-950/60 backdrop-blur-xl border-b border-slate-900 sticky top-0 z-50 h-16 flex items-center">
        <div className="max-w-4xl mx-auto px-6 w-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={resetAll}>
            <div className="p-1.5 bg-indigo-600 rounded-lg group-hover:rotate-12 transition-transform shadow-lg"><Factory className="text-white w-4 h-4" /></div>
            <h1 className="font-black text-sm tracking-tighter uppercase">GI <span className="text-indigo-400">EVAL</span></h1>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-900 rounded-xl text-slate-400 transition-all hover:text-white"><Menu className="w-5 h-5" /></button>
        </div>
      </header>

      {(step === 'form_pedagogy' || step === 'form_env') && (
        <div className="sticky top-16 z-40 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-6">
            <button onClick={step === 'form_pedagogy' ? () => setStep('modules') : backToHub} className="p-2 hover:bg-slate-900 rounded-xl text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex-1">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                 {step === 'form_pedagogy' ? `Matière : ${selectedSubject}` : 'Diagnostic Environnemental'}
               </p>
               <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${progressStats.percentage}%` }}></div>
               </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-indigo-400">{progressStats.completed}/{progressStats.total}</span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-6 py-12">
        {step === 'welcome' && (
          <div className="space-y-12 animate-in fade-in duration-700 text-center py-20">
            <div className="inline-block p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-full mb-6"><ShieldCheck className="w-16 h-16 text-indigo-400" /></div>
            <h2 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter leading-none">Enquête de <br/><span className="text-indigo-500">Satisfaction Étudiante</span></h2>
            <p className="text-slate-400 text-lg italic max-w-xl mx-auto">Votre avis est l'outil principal de notre maintenance pédagogique.</p>
            <button onClick={() => setStep('hub')} className="w-full py-8 bg-indigo-600 hover:bg-indigo-500 rounded-3xl font-black text-xs uppercase tracking-[0.4em] text-white shadow-2xl transition-all border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2">Entrer dans le questionnaire</button>
          </div>
        )}

        {step === 'hub' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="flex items-center justify-between">
              <div><h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Hub d'Enquête</h2><p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Choisissez votre axe d'évaluation</p></div>
              <button onClick={() => setStep('welcome')} className="p-3 bg-slate-900 rounded-2xl border border-slate-800 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            </div>

            {firstUncompletedSubject && (
              <button 
                onClick={() => startPedagogy(firstUncompletedSubject)}
                className="w-full p-8 rounded-[40px] bg-indigo-600 border-2 border-indigo-500 hover:bg-indigo-500 transition-all group flex items-center justify-between shadow-2xl shadow-indigo-500/20"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Zap className="text-white w-6 h-6 animate-pulse" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-black text-white uppercase leading-none">Continuer les Évaluations</h3>
                    <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mt-1 italic">Prochain : {firstUncompletedSubject}</p>
                  </div>
                </div>
                <Play className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={() => setStep('modules')} className="p-10 rounded-[40px] bg-slate-900/40 border-2 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all group text-left relative overflow-hidden">
                <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6"><Book className="text-indigo-400 w-7 h-7" /></div>
                <h3 className="text-xl font-black text-white uppercase mb-2">Qualité Enseignement</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-bold uppercase tracking-tight">Audit pédagogique détaillé par matière (5 critères essentiels).</p>
                <div className="mt-6 flex items-center justify-between">
                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Accéder aux modules →</span>
                   <span className="bg-slate-950 px-3 py-1 rounded-full text-[9px] font-bold text-slate-500">{completedSubjects.length}/{GI_SUBJECTS.length}</span>
                </div>
              </button>
              <button onClick={startEnvAudit} className={`p-10 rounded-[40px] border-2 transition-all text-left relative overflow-hidden ${envAuditDone ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900/40 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900'}`}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-emerald-500/20"><Building2 className="w-7 h-7 text-emerald-400" /></div>
                <h3 className={`text-xl font-black uppercase mb-2 ${envAuditDone ? 'text-emerald-200' : 'text-white'}`}>Cadre de Vie & Métiers</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-bold uppercase tracking-tight">Audit global sur l'environnement, les ressources et l'orientation.</p>
                <div className="mt-6">
                   {envAuditDone ? <span className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 className="w-4 h-4" /> Audit Terminé</span> : <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Démarrer l'audit global →</span>}
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'modules' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Catalogue des Modules</h2>
              <button onClick={backToHub} className="p-3 bg-slate-900 rounded-xl border border-slate-800 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {GI_SUBJECTS.map((s, idx) => {
                const isDone = completedSubjects.includes(s);
                return (
                  <button key={idx} onClick={() => !isDone && startPedagogy(s)} disabled={isDone} className={`p-6 rounded-[32px] border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px] ${isDone ? 'bg-indigo-500/5 border-indigo-500/20 opacity-50' : 'bg-slate-900/40 border-slate-800 hover:border-indigo-500/40'}`}>
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div className="p-2 bg-slate-950 rounded-lg"><Book className={`w-4 h-4 ${isDone ? 'text-slate-700' : 'text-indigo-400'}`} /></div>
                        {isDone && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
                      </div>
                      <h3 className="font-black text-sm uppercase tracking-tight text-white">{s}</h3>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(step === 'form_pedagogy' || step === 'form_env') && (
          <form onSubmit={handleFormSubmit} className="space-y-12 animate-in slide-in-from-bottom-6 duration-500">
            {step === 'form_pedagogy' ? (
              <div className="space-y-8">
                <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-[32px] mb-8">
                   <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-2">Enquête Pédagogique</p>
                   <h2 className="text-xl font-black text-white italic leading-tight uppercase">Veuillez évaluer les affirmations suivantes concernant le cours de <span className="text-indigo-400 underline decoration-indigo-500/50">{selectedSubject}</span></h2>
                </div>
                <QuestionCard number={1} icon={Target} text="Les objectifs du cours ont été clairement présentés au début." value={formData.q1} onChange={(v) => setFormData({...formData, q1: v as number})} showError={showValidationErrors} />
                <QuestionCard number={2} icon={MessageSquare} text="L’enseignant favorise les questions et échanges pendant le cours." value={formData.q2} onChange={(v) => setFormData({...formData, q2: v as number})} showError={showValidationErrors} />
                <QuestionCard number={3} icon={Info} text="L’enseignant est disponible pour répondre aux questions hors cours." value={formData.q3} onChange={(v) => setFormData({...formData, q3: v as number})} showError={showValidationErrors} />
                <QuestionCard number={4} icon={BookOpen} text="Les explications et les supports de cours sont clairs et bien structurés." value={formData.q4} onChange={(v) => setFormData({...formData, q4: v as number})} showError={showValidationErrors} />
                <QuestionCard number={5} icon={Award} text="Les évaluations (examens, devoirs, projets) reflètent les compétences acquises." value={formData.q5} onChange={(v) => setFormData({...formData, q5: v as number})} showError={showValidationErrors} />
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-emerald-600/10 border border-emerald-500/20 p-6 rounded-[32px] mb-8">
                   <p className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">Enquête Environnementale</p>
                   <h2 className="text-xl font-black text-white italic leading-tight uppercase">Évaluation du cadre de vie et des ressources de l'Institut</h2>
                </div>
                <QuestionCard number={1} icon={HelpCircle} text="Je connais les métiers visés par cette formation." value={formData.q6_jobs} onChange={(v) => setFormData({...formData, q6_jobs: v as string})} showError={showValidationErrors} options={[{label:'Oui', value:'Oui'}, {label:'Non', value:'Non'}, {label:'Flou', value:'Flou'}]} />
                <QuestionCard number={2} icon={MapPin} text="Les salles de cours sont adaptées (bruit, éclairage, confort)." value={formData.q7_rooms} onChange={(v) => setFormData({...formData, q7_rooms: v as number})} showError={showValidationErrors} />
                <QuestionCard number={3} icon={ShieldCheck} text="L’accès aux ressources (Wi-Fi, labo, bibliothèque, plateformes) est suffisant." value={formData.q8_resources} onChange={(v) => setFormData({...formData, q8_resources: v as number})} showError={showValidationErrors} />
                <QuestionCard number={4} icon={Truck} text="Quel est votre principal moyen de transport pour venir à l’institut ?" value={formData.q9_transport} onChange={(v) => setFormData({...formData, q9_transport: v as string})} showError={showValidationErrors} options={[{label:'Voiture Fam', value:'Voiture familiale'}, {label:'Bus Public', value:'Bus public'}, {label:'Voiture Perso', value:'Voiture personnelle'}, {label:'Taxi', value:'Taxi'}, {label:'Moto', value:'Moto'}]} />
                <QuestionCard number={5} icon={Laptop} text="Disposez-vous d'un ordinateur portable pour vos travaux ?" value={formData.q10_laptop} onChange={(v) => setFormData({...formData, q10_laptop: v as string})} showError={showValidationErrors} options={[{label:'Oui', value:'Oui'}, {label:'Non', value:'Non'}]} />
              </div>
            )}
            <div className="p-10 rounded-[40px] bg-slate-900/40 border border-slate-800"><label className="flex items-center gap-3 text-[12px] font-black uppercase tracking-widest text-white mb-6"><MessageSquare className="w-5 h-5 text-indigo-400" /> Suggestions libres</label><textarea value={formData.comments} onChange={(e) => setFormData({...formData, comments: e.target.value})} placeholder="Commentaires additionnels..." className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-6 text-sm text-white focus:border-indigo-500 outline-none transition-all" /></div>
            <button type="submit" className="w-full py-10 bg-emerald-600 hover:bg-emerald-500 rounded-[40px] font-black text-sm uppercase tracking-[0.4em] text-white shadow-2xl transition-all border-b-8 border-emerald-800 active:border-b-0 active:translate-y-2 mb-20 hover:animate-subtle-pulse hover:shadow-emerald-500/50">Soumettre l'Enquête</button>
          </form>
        )}

        {step === 'submitting' && (
          <div className="fixed inset-0 z-[200] bg-slate-950/95 flex flex-col items-center justify-center backdrop-blur-xl">
            <div className="w-full max-w-md px-10">
              <div className="flex justify-between items-end mb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 animate-pulse">Diagnostic IA actif</p>
                  <p className="text-xl font-black text-white uppercase italic tracking-tighter">Traitement des données...</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-indigo-500 font-mono animate-pulse">...</span>
                </div>
              </div>
              
              <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] relative">
                <div className="absolute inset-0 bg-stripes opacity-10 animate-slide-stripes"></div>
                <div className="h-full bg-indigo-600 shadow-[0_0_25px_rgba(79,70,229,0.4)] rounded-full animate-progress-fill relative">
                  <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col items-center space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-500 text-center animate-pulse">Synchronisation e-UNA sécurisée</p>
                <div className="flex gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '200ms' }}></div>
                  <div className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '400ms' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'thanks' && (
          <div className="py-10 text-center space-y-12 animate-in zoom-in duration-700">
            <div className="w-32 h-32 bg-emerald-500 rounded-[48px] flex items-center justify-center mx-auto rotate-12 shadow-2xl"><CheckCircle2 className="w-16 h-16 text-white -rotate-12" /></div>
            <div className="space-y-6"><h2 className="text-6xl font-black text-white uppercase italic tracking-tighter leading-none">Enquête Archivée</h2><p className="text-slate-400 text-xl italic leading-relaxed max-w-lg mx-auto">Merci pour votre contribution à l'amélioration de <span className="text-white font-bold">{formData.subject === 'ENVIRONNEMENT_GLOBAL' ? "l'environnement global" : selectedSubject}</span>.</p></div>
            <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-[48px] space-y-6 shadow-2xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Référence unique de l'audit</span>
              <div className="flex items-center gap-4 bg-slate-950 px-6 py-4 rounded-2xl border border-slate-800 group hover:border-indigo-500/50 transition-all">
                <code className="flex-1 text-2xl font-black text-white tracking-widest font-mono">{lastSubmissionId}</code>
                <button onClick={copyToClipboard} className="text-slate-500 hover:text-white transition-colors p-2"><Copy className="w-5 h-5" /></button>
              </div>
              {showCopyFeedback && <p className="text-emerald-400 text-[9px] font-black uppercase animate-pulse">ID Copié avec succès !</p>}
            </div>
            <div className="flex flex-col gap-4 max-w-sm mx-auto">
              <button onClick={copyToClipboard} className="w-full py-8 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-[32px] font-black uppercase text-[12px] text-white tracking-[0.3em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 group">
                <Share2 className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" /> Partager mon Diagnostic
              </button>
              <button onClick={backToHub} className="w-full py-8 bg-indigo-600 hover:bg-indigo-500 rounded-[32px] font-black uppercase text-[12px] text-white tracking-[0.3em] shadow-xl hover:shadow-indigo-900/40 transition-all active:scale-95">Retour au Hub</button>
            </div>
          </div>
        )}
      </main>

      <footer className="py-10 border-t border-slate-900/50 text-center opacity-40"><p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">IUP - Génie Industriel • Excellence Qualité</p></footer>
    </div>
  );
};

export default App;