import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FeedbackData, FeedbackEntry } from './types';
import QuestionCard from './components/QuestionCard';
import { saveFeedback, getHistory } from './services/storageService';
import { analyzeFeedback } from './services/geminiService';
import { sendAnalysisToAdmin } from './services/emailService';
import jsQR from 'jsqr';
import { 
  Factory, CheckCircle2, 
  Target, MessageSquare, BookOpen, Award, 
  ShieldCheck, MapPin, Truck, HelpCircle,
  Menu, X, Lock, Info,
  Book, Building2, ArrowLeft,
  Zap, Play, QrCode, Camera, RefreshCw,
  Circle, Clock, CheckCircle, Activity,
  ShieldAlert, Laptop, ArrowRight,
  TrendingUp, LayoutDashboard,
  Award as AwardIcon,
  Flame, Sparkles
} from 'lucide-react';

type AppStep = 'welcome' | 'hub' | 'scanner' | 'modules' | 'form_pedagogy' | 'form_env' | 'submitting' | 'thanks';

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
  "Mécanique générale",
  "Probabilités et Statistiques"
];

const DRAFT_KEY = "isgi_feedback_draft_v2";

const QRScanner: React.FC<{ onScan: (data: string) => void; onClose: () => void }> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err) {
        setError("Accès caméra refusé. Veuillez autoriser l'accès pour scanner les codes modules.");
      }
    };

    const tick = () => {
      if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.height = videoRef.current.videoHeight;
          canvas.width = videoRef.current.videoWidth;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) onScan(code.data);
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animationFrameId);
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col">
      <div className="p-6 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <h3 className="font-black text-xs uppercase tracking-[0.3em] text-white flex items-center gap-3">
          <Camera className="w-4 h-4 text-indigo-400" /> Scanner Module ISGI
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-xl transition-colors"><X className="w-6 h-6 text-slate-500" /></button>
      </div>
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-center p-8 max-w-xs">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-500 font-black uppercase text-[10px] tracking-widest leading-relaxed">{error}</p>
          </div>
        ) : (
          <video ref={videoRef} className="h-full w-full object-cover opacity-60" />
        )}
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-72 border-2 border-indigo-500/50 rounded-3xl relative">
            <div className="scanline"></div>
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl"></div>
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl"></div>
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl"></div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('welcome');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [completedSubjects, setCompletedSubjects] = useState<string[]>([]);
  const [envAuditDone, setEnvAuditDone] = useState(false);
  const [lastSubmissionId, setLastSubmissionId] = useState('');
  
  const initialFormData: FeedbackData = {
    subject: '', q1: null, q2: null, q3: null, q4: null, q5: null,
    q6_jobs: null, q7_rooms: null, q8_resources: null, q9_transport: null, q10_laptop: null,
    comments: ''
  };

  const [formData, setFormData] = useState<FeedbackData>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? JSON.parse(saved) : initialFormData;
    } catch {
      return initialFormData;
    }
  });

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    const history = getHistory();
    setCompletedSubjects(history.filter(e => e.subject !== 'ENVIRONNEMENT_GLOBAL').map(e => e.subject));
    setEnvAuditDone(history.some(e => e.subject === 'ENVIRONNEMENT_GLOBAL'));
  }, [step]);

  const progressStats = useMemo(() => {
    const isEnv = formData.subject === 'ENVIRONNEMENT_GLOBAL';
    const fields = isEnv 
      ? [formData.q6_jobs, formData.q7_rooms, formData.q8_resources, formData.q9_transport, formData.q10_laptop]
      : [formData.q1, formData.q2, formData.q3, formData.q4, formData.q5];
    const completed = fields.filter(v => v !== null).length;
    return { percentage: Math.round((completed / 5) * 100), completed, total: 5 };
  }, [formData]);

  const getSubjectStatus = (name: string) => {
    if (completedSubjects.includes(name)) return 'Terminé';
    if (formData.subject === name && progressStats.completed > 0) return 'En cours';
    return 'À faire';
  };

  const startPedagogy = (subject: string) => {
    if (formData.subject !== subject) {
      setFormData({
        ...initialFormData,
        subject
      });
    }
    setStep('form_pedagogy');
    setShowValidationErrors(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEnvAudit = () => {
    if (formData.subject !== 'ENVIRONNEMENT_GLOBAL') {
      setFormData({
        ...initialFormData,
        subject: 'ENVIRONNEMENT_GLOBAL'
      });
    }
    setStep('form_env');
    setShowValidationErrors(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (progressStats.completed < 5) {
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
      localStorage.removeItem(DRAFT_KEY);
      setFormData(initialFormData);
      setStep('thanks');
    } catch { 
      setStep('thanks'); 
    }
  };

  const totalStepsCount = GI_SUBJECTS.length + 1; // 11 modules + 1 Env = 12 étapes
  const currentProgressCount = completedSubjects.length + (envAuditDone ? 1 : 0);
  const globalProgression = Math.round((currentProgressCount / totalStepsCount) * 100);
  const firstUncompleted = GI_SUBJECTS.find(s => !completedSubjects.includes(s));

  return (
    <div className="min-h-screen industrial-pattern text-slate-100 pb-20 selection:bg-indigo-500/30">
      {step === 'scanner' && <QRScanner onScan={(d) => { const s = GI_SUBJECTS.find(x => d.includes(x)); if(s) startPedagogy(s); }} onClose={() => setStep('hub')} />}

      <div className={`fixed inset-y-0 left-0 z-[150] bg-slate-950 border-r border-slate-900 transform transition-all duration-500 shadow-2xl flex flex-col w-80 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-900">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            <h3 className="font-black text-[10px] uppercase tracking-[0.25em] text-white">Console Admin ISGI</h3>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-900 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="flex-1 p-6 flex flex-col justify-center items-center text-center space-y-6">
          <div className="relative">
            <Lock className="w-12 h-12 text-slate-800" />
            <div className="absolute inset-0 bg-indigo-500/5 blur-xl"></div>
          </div>
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest leading-relaxed px-4">Espace réservé à l'analyse stratégique et à la gouvernance ISGI</p>
        </div>
      </div>

      <header className="bg-slate-950/60 backdrop-blur-xl border-b border-slate-900 sticky top-0 z-50 h-16 flex items-center px-6">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setStep('welcome')}>
            <div className="p-1.5 bg-indigo-600 rounded-lg shadow-indigo-500/20 shadow-lg group-hover:scale-110 transition-transform"><Factory className="text-white w-4 h-4" /></div>
            <h1 className="font-black text-sm uppercase tracking-tighter">ISGI <span className="text-indigo-400">QUALITÉ</span></h1>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-900 rounded-xl text-slate-400"><Menu className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {step === 'welcome' && (
          <div className="py-20 text-center space-y-12 animate-in fade-in duration-700">
            <div className="relative inline-block">
              <ShieldCheck className="w-24 h-24 text-indigo-400 mx-auto relative z-10" />
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse"></div>
            </div>
            <div className="space-y-4">
              <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">Diagnostic ISGI <br/><span className="text-indigo-500">Génie Industriel</span></h2>
              <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">Amélioration Continue • Standard Qualité</p>
            </div>
            <button onClick={() => setStep('hub')} className="w-full py-10 bg-indigo-600 hover:bg-indigo-500 rounded-[40px] font-black uppercase text-white shadow-2xl border-b-8 border-indigo-800 transition-all active:translate-y-1 hover:scale-[1.01]">Initialiser la Session d'Audit</button>
          </div>
        )}

        {step === 'hub' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">
            <div className="bg-slate-900/60 border-2 border-slate-800 rounded-[48px] p-8 md:p-10 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
              <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none">
                <TrendingUp size={240} className="text-indigo-400" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-500/20 p-2 rounded-xl border border-indigo-500/10">
                      <Flame className="w-5 h-5 text-indigo-400" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Progression Totale (12 ÉTAPES)</p>
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
                    {currentProgressCount} <span className="text-slate-700">/ {totalStepsCount}</span>
                  </h2>
                </div>
                <div className="flex-1 max-w-sm w-full space-y-4">
                  <div className="flex justify-between items-end px-1">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{globalProgression}% ARCHIVÉ</span>
                    {globalProgression === 100 && <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />}
                  </div>
                  <div className="h-6 bg-slate-950 rounded-full border-2 border-slate-800 p-1 relative shadow-inner overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-700 to-indigo-400 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(99,102,241,0.4)]" style={{ width: `${globalProgression}%` }}>
                      <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                    </div>
                  </div>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">
                    {globalProgression === 100 ? "Audit validé à 100%" : "Complétez les 12 diagnostics pour valider"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-6 h-6 text-indigo-400" />
                <h2 className="text-3xl font-black uppercase italic leading-none">Console Étudiant</h2>
              </div>
              <button onClick={() => setStep('scanner')} className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400 flex items-center gap-3 font-black text-[10px] uppercase hover:bg-indigo-500 hover:text-white transition-all shadow-lg shadow-indigo-500/10"><QrCode className="w-5 h-5" /> Scanner Module</button>
            </div>

            <div className="bg-slate-900/20 border border-slate-800/60 rounded-[40px] p-8 space-y-6 backdrop-blur-md">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {GI_SUBJECTS.map((s) => {
                  const status = getSubjectStatus(s);
                  const isDone = status === 'Terminé';
                  const isProgress = status === 'En cours';
                  return (
                    <button key={s} onClick={() => !isDone && startPedagogy(s)} className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col gap-2 text-left h-full ${
                      isDone ? 'bg-emerald-500/5 border-emerald-500/30' : 
                      isProgress ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/20 shadow-lg shadow-indigo-500/5' : 
                      'bg-slate-950/40 border-slate-800 hover:border-slate-600'
                    }`}>
                      <div className="flex items-center justify-between">
                        {isDone ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : isProgress ? <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> : <Circle className="w-3.5 h-3.5 text-slate-700" />}
                        <span className={`text-[8px] font-black uppercase tracking-tighter ${isDone ? 'text-emerald-400' : isProgress ? 'text-indigo-400' : 'text-slate-600'}`}>{status}</span>
                      </div>
                      <p className={`text-[10px] font-black uppercase leading-tight line-clamp-2 ${isDone ? 'text-emerald-100' : isProgress ? 'text-indigo-100' : 'text-slate-400 group-hover:text-white'}`}>{s}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {firstUncompleted && (
              <button onClick={() => startPedagogy(firstUncompleted)} className="w-full p-8 rounded-[40px] bg-indigo-600 border-2 border-indigo-500 hover:bg-indigo-500 transition-all flex items-center justify-between shadow-2xl group active:translate-y-1">
                <div className="flex items-center gap-5 text-left">
                   <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center group-hover:rotate-6 transition-transform"><Zap className="text-white w-7 h-7" /></div>
                   <div>
                     <h3 className="text-xl font-black text-white uppercase leading-none">Diagnostic Prioritaire</h3>
                     <p className="text-[10px] font-bold text-indigo-100 uppercase mt-1 tracking-widest">{firstUncompleted}</p>
                   </div>
                </div>
                <div className="p-3 bg-white/10 rounded-xl group-hover:translate-x-2 transition-transform">
                  <ArrowRight className="w-6 h-6 text-white" />
                </div>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-12">
              <button onClick={() => setStep('modules')} className="p-10 rounded-[40px] bg-slate-900/40 border-2 border-slate-800 hover:border-indigo-500/50 transition-all text-left group">
                <Book className="text-indigo-400 w-12 h-12 mb-6 group-hover:-rotate-6 transition-transform" />
                <h3 className="text-2xl font-black uppercase text-white">Catalogue Modules</h3>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mt-2">Inventaire Académique ISGI</p>
              </button>
              <button onClick={startEnvAudit} className={`p-10 rounded-[40px] border-2 transition-all text-left group ${envAuditDone ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-900/40 border-slate-800 hover:border-emerald-500/50'}`}>
                <Building2 className={`w-12 h-12 mb-6 transition-transform group-hover:scale-110 ${envAuditDone ? 'text-emerald-400' : 'text-slate-600'}`} />
                <h3 className="text-2xl font-black uppercase text-white">Environnement</h3>
                <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-2 ${envAuditDone ? 'text-emerald-400' : 'text-slate-500'}`}>{envAuditDone ? 'Audit Terminé' : 'Audit Infrastructure'}</p>
              </button>
            </div>
          </div>
        )}

        {step === 'modules' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between mb-8"><h2 className="text-3xl font-black uppercase italic">Modules ISGI GI</h2><button onClick={() => setStep('hub')} className="p-4 bg-slate-900 rounded-2xl text-slate-500 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button></div>
            <div className="grid gap-4">
              {GI_SUBJECTS.map(s => {
                const isDone = completedSubjects.includes(s);
                return (
                  <button key={s} onClick={() => !isDone && startPedagogy(s)} disabled={isDone} className={`p-8 rounded-[32px] border-2 flex items-center justify-between transition-all ${isDone ? 'bg-emerald-500/5 border-emerald-500/20 opacity-50' : 'bg-slate-900/40 border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900/60'}`}>
                    <div className="flex items-center gap-6">
                      <div className="p-4 bg-slate-950 rounded-2xl shadow-inner"><Book className="w-6 h-6 text-indigo-400" /></div>
                      <div className="text-left"><p className="font-black text-lg uppercase text-white leading-tight">{s}</p><p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isDone ? 'text-emerald-500' : 'text-slate-500'}`}>{isDone ? 'Diagnostic Archivé' : 'Diagnostic Requis'}</p></div>
                    </div>
                    {isDone ? <div className="p-2 bg-emerald-500/20 rounded-full"><CheckCircle2 className="text-emerald-500 w-8 h-8" /></div> : <Play className="text-indigo-400/30 w-5 h-5 group-hover:text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(step === 'form_pedagogy' || step === 'form_env') && (
          <form onSubmit={handleFormSubmit} className="space-y-10 pb-40 animate-in slide-in-from-bottom-10 duration-500">
            <div className={`p-10 rounded-[48px] border-2 relative overflow-hidden shadow-2xl ${step === 'form_env' ? 'bg-emerald-600/10 border-emerald-500/30' : 'bg-indigo-600/10 border-indigo-500/30'}`}>
              <div className="absolute top-0 right-0 p-8 text-5xl font-black opacity-10 select-none">{progressStats.percentage}%</div>
              <p className={`text-[10px] font-black uppercase tracking-[0.4em] mb-4 ${step === 'form_env' ? 'text-emerald-400' : 'text-indigo-400'}`}>Évaluation de Session ISGI</p>
              <h2 className="text-3xl md:text-4xl font-black uppercase italic text-white leading-tight pr-12">{formData.subject === 'ENVIRONNEMENT_GLOBAL' ? 'Cadre de Vie' : formData.subject}</h2>
              <div className="mt-8 flex items-center gap-4">
                <div className="h-2 flex-1 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                  <div className={`h-full transition-all duration-500 ${step === 'form_env' ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progressStats.percentage}%` }}></div>
                </div>
                <span className="text-xs font-black text-white/50">{progressStats.completed}/5</span>
              </div>
            </div>

            <div className="space-y-6">
              {step === 'form_pedagogy' ? (
                <>
                  <QuestionCard number={1} icon={Target} text="Objectifs clairs au démarrage ?" value={formData.q1} onChange={v => setFormData({...formData, q1: v as number})} showError={showValidationErrors} />
                  <QuestionCard number={2} icon={MessageSquare} text="Échanges et questions favorisés ?" value={formData.q2} onChange={v => setFormData({...formData, q2: v as number})} showError={showValidationErrors} />
                  <QuestionCard number={3} icon={Info} text="Disponibilité de l'enseignant ?" value={formData.q3} onChange={v => setFormData({...formData, q3: v as number})} showError={showValidationErrors} />
                  <QuestionCard number={4} icon={BookOpen} text="Supports structurés et utiles ?" value={formData.q4} onChange={v => setFormData({...formData, q4: v as number})} showError={showValidationErrors} />
                  <QuestionCard number={5} icon={Award} text="Évaluations pertinentes ?" value={formData.q5} onChange={v => setFormData({...formData, q5: v as number})} showError={showValidationErrors} />
                </>
              ) : (
                <>
                  <QuestionCard number={1} icon={HelpCircle} text="Débouchés GI bien connus ?" value={formData.q6_jobs} onChange={v => setFormData({...formData, q6_jobs: v as string})} showError={showValidationErrors} options={[{label:'Oui', value:'Oui'}, {label:'Non', value:'Non'}, {label:'Flou', value:'Flou'}]} />
                  <QuestionCard number={2} icon={MapPin} text="Confort et état des salles ?" value={formData.q7_rooms} onChange={v => setFormData({...formData, q7_rooms: v as number})} showError={showValidationErrors} />
                  <QuestionCard number={3} icon={ShieldCheck} text="Accès suffisant aux ressources ?" value={formData.q8_resources} onChange={v => setFormData({...formData, q8_resources: v as number})} showError={showValidationErrors} />
                  <QuestionCard number={4} icon={Truck} text="Moyen de transport dominant ?" value={formData.q9_transport} onChange={v => setFormData({...formData, q9_transport: v as string})} showError={showValidationErrors} options={[{label:'Bus', value:'Bus'}, {label:'Voiture', value:'Voiture'}, {label:'Taxi', value:'Taxi'}, {label:'Moto', value:'Moto'}]} />
                  <QuestionCard number={5} icon={Laptop} text="Possession d'un PC portable ?" value={formData.q10_laptop} onChange={v => setFormData({...formData, q10_laptop: v as string})} showError={showValidationErrors} options={[{label:'Oui', value:'Oui'}, {label:'Non', value:'Non'}]} />
                </>
              )}
            </div>
            
            <div className="p-10 bg-slate-900/40 rounded-[48px] border-2 border-slate-800 shadow-xl">
               <label className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] block mb-6">Observations libres (facultatif)</label>
               <textarea value={formData.comments} onChange={e => setFormData({...formData, comments: e.target.value})} placeholder="Détaillez vos remarques ou suggestions d'amélioration pour l'ISGI..." className="w-full h-40 bg-slate-950 border-2 border-slate-800 rounded-3xl p-8 text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-slate-800" />
            </div>
            
            <div className="sticky bottom-6 px-4">
              <button type="submit" className="w-full py-12 bg-emerald-600 hover:bg-emerald-500 rounded-[50px] font-black uppercase tracking-[0.5em] text-white shadow-[0_20px_60px_rgba(16,185,129,0.3)] border-b-[12px] border-emerald-800 transition-all hover:scale-[1.02] active:translate-y-2 active:border-b-4">Finaliser l'Audit ISGI</button>
            </div>
          </form>
        )}

        {step === 'submitting' && (
          <div className="fixed inset-0 z-[200] bg-slate-950/95 flex flex-col items-center justify-center backdrop-blur-2xl">
             <div className="relative">
               <RefreshCw className="w-24 h-24 text-indigo-500 animate-spin mb-12" />
               <div className="absolute inset-0 bg-indigo-500/20 blur-3xl animate-pulse"></div>
             </div>
             <div className="text-center space-y-4">
                <p className="text-3xl font-black text-white uppercase italic tracking-tighter">Synchronisation ISGI</p>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 animate-pulse">Audit Qualité en cours d'archivage...</p>
                </div>
             </div>
          </div>
        )}

        {step === 'thanks' && (
          <div className="py-20 text-center space-y-16 animate-in zoom-in duration-700">
            <div className="relative inline-block group">
              <div className="w-40 h-40 bg-emerald-500 rounded-[60px] flex items-center justify-center mx-auto rotate-12 shadow-2xl border-8 border-emerald-400/50 group-hover:rotate-0 transition-transform duration-500">
                <CheckCircle2 className="w-24 h-24 text-white" />
              </div>
              <div className="absolute inset-0 bg-emerald-500/30 blur-3xl -z-10 group-hover:scale-150 transition-transform"></div>
            </div>
            <div className="space-y-6">
              <h2 className="text-7xl font-black text-white uppercase italic tracking-tighter leading-none">Diagnostic Archivé</h2>
              <div className="inline-block px-6 py-2 bg-slate-900 border border-slate-800 rounded-full">
                <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">JETON: {lastSubmissionId}</p>
              </div>
            </div>
            <div className="max-w-md mx-auto space-y-4">
              <button onClick={() => setStep('hub')} className="w-full py-10 bg-indigo-600 hover:bg-indigo-500 rounded-[40px] font-black uppercase tracking-widest text-white shadow-xl hover:scale-105 active:scale-95 transition-all">Retour au Hub ISGI</button>
              <p className="text-slate-600 font-bold uppercase text-[9px] tracking-widest italic">Votre feedback participe à l'excellence de l'institut.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-12 text-center opacity-30 border-t border-slate-900/50 mt-20">
        <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.6em] mb-2">Institut Supérieur de Génie Industriel • ISGI GIM</p>
        <p className="text-[8px] font-mono text-slate-800 uppercase tracking-widest">© 2024 • Système d'Audit Qualité Académique</p>
      </footer>
    </div>
  );
};

export default App;