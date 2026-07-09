import React, { useState, useEffect } from 'react';
import { ExchangeRules } from './ExchangeRules';
import { PlanningPanel } from './AdminDashboard';

export const StandardisteDashboard = ({ users, supabase, onLogout, currentUserTrigram, activeRound, columnConfigs, globalClosures }: any) => {
  const [choices, setChoices] = useState<any[]>([]);
  const [headerConfigs, setHeaderConfigs] = useState<any[]>([]);
  
  const refreshData = async () => {
    // we might need to fetch choices here if we need them, though ExchangeRules can manage itself or we fetch them
    const { data: choicesData } = await supabase.from('choices').select('*');
    if (choicesData) setChoices(choicesData);
    
    const { data: headersData } = await supabase.from('header_configs').select('*');
    if (headersData) setHeaderConfigs(headersData);
  };
  
  useEffect(() => {
    refreshData();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex flex-col font-sans overflow-hidden text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none">SOS 92</h1>
            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Espace Standardiste</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            {currentUserTrigram}
          </span>
          <button 
            onClick={onLogout}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-sm"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 flex flex-col min-h-0 relative">
        <ExchangeRules 
            supabase={supabase} 
            choices={choices} 
            users={users} 
            activeRound={activeRound} 
            columnConfigs={columnConfigs} 
            headerConfigs={headerConfigs} 
            globalClosures={globalClosures} 
            PlanningPanel={PlanningPanel} 
            refreshData={refreshData} 
        />
      </main>
    </div>
  );
};
