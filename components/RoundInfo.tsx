
import React, { useState } from 'react';
import { Round } from '../types';

interface Props {
  round: Round;
  stepInstruction?: string;
}

export const RoundInfo: React.FC<Props> = ({ round, stepInstruction }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-slate-900 text-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 z-40 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] shrink-0">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse shadow-lg shadow-blue-500/20">
            Tour {round.id}
          </div>
          <h2 className="text-sm font-black uppercase tracking-tight text-white truncate drop-shadow-md">
            {round.title}
          </h2>
        </div>
        
        <div className="h-8 w-px bg-slate-700 hidden md:block mx-2"></div>
        
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex flex-col cursor-pointer group hover:bg-slate-800 px-4 py-2 rounded-xl transition-all duration-200 overflow-hidden flex-1 border border-transparent hover:border-slate-700"
        >
          <div className="flex items-center gap-3">
              <svg 
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" 
                className={`text-blue-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <span className={`text-xs font-bold text-slate-300 group-hover:text-white transition-all truncate ${isExpanded ? 'whitespace-normal' : 'max-w-[500px]'}`}>
                {isExpanded ? 'Masquer les détails' : `${round.instructions}`}
              </span>
          </div>
          {stepInstruction && (
              <span className="text-[11px] font-bold text-emerald-400 pl-7 truncate block mt-1">
                  👉 {stepInstruction}
              </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="md:absolute md:top-full md:left-0 md:right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 p-8 z-50 animate-in slide-in-from-top-2 duration-300 shadow-2xl">
          <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                  </div>
                  <h3 className="text-xs font-black uppercase text-blue-400 tracking-[0.2em]">Consignes Générales</h3>
                </div>
                <p className="text-slate-200 text-sm leading-relaxed font-medium pl-11 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  {round.instructions}
                </p>
            </div>
            
            {stepInstruction && (
                <div className="bg-emerald-900/20 p-6 rounded-2xl border border-emerald-500/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <span className="text-lg">👉</span>
                      </div>
                      <h3 className="text-xs font-black uppercase text-emerald-400 tracking-[0.2em]">Consignes pour l'étape en cours</h3>
                    </div>
                    <p className="text-emerald-100 text-sm leading-relaxed font-bold pl-11">
                      {stepInstruction}
                    </p>
                </div>
            )}

            <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-colors border border-slate-700"
                >
                  Fermer
                </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:flex items-center gap-4 text-[10px] font-bold text-slate-500 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-800">
         <span className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span> Serveur Synchro</span>
         <span className="opacity-30">|</span>
         <span className="opacity-50 tracking-tighter">V.2024.10.12</span>
      </div>
    </div>
  );
};
