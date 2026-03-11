
import React, { useState } from 'react';
import { Round } from '../types';

interface Props {
  round: Round;
  stepInstruction?: string;
}

export const RoundInfo: React.FC<Props> = ({ round, stepInstruction }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-slate-900 text-white shadow-lg z-40 shrink-0 relative transition-all duration-300">
      {/* Header Bar */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-900/50">
              Tour {round.id}
            </div>
            <h2 className="text-sm font-black uppercase tracking-tight text-white truncate drop-shadow-md">
              {round.title}
            </h2>
          </div>
          
          <div className="h-6 w-px bg-slate-700 hidden md:block mx-2"></div>
          
          {/* Toggle Button / Summary */}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 group hover:bg-slate-800 px-4 py-2 rounded-xl transition-all duration-200 border border-transparent hover:border-slate-700 flex-1 text-left"
          >
            <div className={`p-1.5 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors ${isExpanded ? 'text-blue-400' : 'text-slate-400'}`}>
                <svg 
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" 
                  className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-400 transition-colors">
                    {isExpanded ? 'Masquer les consignes' : 'Voir les consignes'}
                </span>
                {!isExpanded && (
                    <span className="text-xs font-bold text-slate-300 truncate max-w-[200px] md:max-w-[400px]">
                        {stepInstruction || round.instructions || "Aucune consigne particulière"}
                    </span>
                )}
            </div>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-4 text-[10px] font-bold text-slate-500 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-800">
           <span className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></span> En ligne</span>
        </div>
      </div>

      {/* Expanded Content Panel */}
      <div className={`
          transition-all duration-500 ease-in-out border-t border-slate-800 bg-slate-900/50
          ${isExpanded ? 'max-h-[80vh] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'}
      `}>
        <div className="p-6 md:p-8 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* General Instructions */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                    </div>
                    <h3 className="text-xs font-black uppercase text-blue-400 tracking-widest">Consignes Générales</h3>
                </div>
                <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap shadow-inner">
                    {round.instructions || "Aucune consigne générale pour ce tour."}
                </div>
            </div>

            {/* Specific Instructions */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <h3 className="text-xs font-black uppercase text-emerald-400 tracking-widest">Étape en cours</h3>
                </div>
                <div className="bg-emerald-900/10 p-5 rounded-2xl border border-emerald-500/20 text-emerald-100 text-sm leading-relaxed whitespace-pre-wrap shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-500">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                        </svg>
                    </div>
                    {stepInstruction || "Aucune consigne spécifique pour cette étape."}
                </div>
            </div>
        </div>
        
        {/* Footer Close Button */}
        <div className="bg-slate-900/80 p-4 flex justify-center border-t border-slate-800 backdrop-blur-sm">
            <button 
                onClick={() => setIsExpanded(false)}
                className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700 hover:border-slate-600"
            >
                Fermer les consignes
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
            </button>
        </div>
      </div>
    </div>
  );
};
