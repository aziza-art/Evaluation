import React, { useState, useEffect } from 'react';
import { RatingValue } from '../types';
import { LucideIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface RatingOption {
  label: string;
  value: RatingValue;
}

interface QuestionCardProps {
  number: number;
  text: string;
  value: RatingValue;
  onChange: (val: RatingValue) => void;
  icon: LucideIcon;
  showError?: boolean;
  options?: RatingOption[];
}

const QuestionCard: React.FC<QuestionCardProps> = ({ 
  number, 
  text, 
  value, 
  onChange, 
  icon: Icon,
  showError = false,
  options = [
    { label: '25%', value: 25 },
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: '100%', value: 100 }
  ]
}) => {
  const isMissing = showError && value === null;
  const isSelected = value !== null;
  
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (value !== null) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timer);
    }
  }, [value]);

  // Détermination de la couleur sémantique du bouton sélectionné
  const getButtonStyles = (optValue: RatingValue) => {
    if (value !== optValue) {
      return isMissing
        ? 'bg-slate-900/60 border-red-900/30 text-slate-500 hover:border-red-500/50 hover:text-red-200'
        : 'bg-slate-950/40 border-slate-800/60 text-slate-500 hover:border-indigo-500/50 hover:bg-slate-800/60 hover:text-white';
    }

    // Styles pour l'état sélectionné
    const baseSelected = 'transform scale-105 z-10 ring-2 text-white';
    
    // Cas Négatif / Faible
    if (optValue === 'Non' || optValue === 25 || optValue === 'Flou') {
      return `${baseSelected} bg-red-800 border-red-400 shadow-[0_10px_30px_rgba(239,68,68,0.5)] ring-red-500/50`;
    }
    
    // Cas Positif / Maximum
    if (optValue === 'Oui' || optValue === 100) {
      return `${baseSelected} bg-emerald-800 border-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.5)] ring-emerald-500/50`;
    }

    // Cas Intermédiaire (50%, 75%, autres chaines)
    return `${baseSelected} bg-blue-900 border-blue-400 shadow-[0_10px_40px_rgba(30,58,138,0.6)] ring-blue-500/50`;
  };

  return (
    <div className={`p-8 rounded-[32px] transition-all duration-500 mb-8 group cursor-default relative overflow-hidden border-2 backdrop-blur-md ${
      isMissing 
        ? 'bg-red-500/5 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.1)] animate-subtle-shake' 
        : isSelected
          ? `bg-emerald-500/5 border-emerald-500/40 shadow-[0_20px_60px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20 ${animate ? 'animate-pop animate-selection-glow' : ''}`
          : 'bg-slate-900/40 border-slate-800/60 hover:border-indigo-500/40 hover:bg-slate-900/60 hover:shadow-[0_25px_50px_rgba(79,70,229,0.15)] hover:-translate-y-1'
    }`}>
      <div className={`absolute -right-4 -bottom-4 opacity-[0.03] transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12 ${isSelected ? 'text-emerald-500' : 'text-indigo-400'}`}>
        <Icon size={120} />
      </div>

      <div className="flex items-start gap-6 relative z-10">
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          <div className="relative">
            <span className={`w-10 h-10 font-black rounded-2xl flex items-center justify-center text-xs transition-all duration-500 ${
              isMissing 
                ? 'bg-red-500 text-white shadow-lg shadow-red-900/40' 
                : isSelected
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 scale-110 rotate-3'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500'
            }`}>
              {isSelected ? <CheckCircle2 className="w-5 h-5" /> : number}
            </span>
            {isMissing && (
              <div className="absolute -top-1 -right-1">
                <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
              </div>
            )}
          </div>
          <div className={`p-2 rounded-xl border transition-all duration-500 ${
            isMissing 
              ? 'border-red-500/30 bg-red-950/20' 
              : isSelected
                ? 'border-emerald-500/50 bg-emerald-950/30'
                : 'border-slate-800 bg-slate-950/40 group-hover:border-indigo-500/30'
          }`}>
            <Icon className={`w-5 h-5 ${isMissing ? 'text-red-400' : isSelected ? 'text-emerald-400' : 'text-indigo-400'}`} />
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <p className={`font-black text-xl md:text-2xl tracking-tight leading-tight transition-colors duration-500 ${
              isMissing ? 'text-red-200' : isSelected ? 'text-white' : 'text-slate-100'
            }`}>
              {text}
            </p>
          </div>
          
          {isMissing && (
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> Sélection obligatoire pour valider
            </p>
          )}
          
          {isSelected && !animate && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/80">Réponse mémorisée</p>
            </div>
          )}
        </div>
      </div>
      
      <div className={`grid gap-3 sm:gap-4 mt-10 relative z-10 ${options.length <= 2 ? 'grid-cols-2' : options.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
        {options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`group/btn py-4 px-2 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest border-2 transition-all duration-300 relative overflow-hidden ${getButtonStyles(opt.value)}`}
          >
            <span className="relative z-10">{opt.label}</span>
            {value === opt.value && <div className="absolute inset-0 bg-white/10 animate-shimmer"></div>}
            <div className="absolute inset-0 bg-white/0 group-hover/btn:bg-white/5 transition-colors duration-300"></div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuestionCard;