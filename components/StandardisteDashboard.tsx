import React, { useState, useEffect } from 'react';
import { ExchangeRules } from './ExchangeRules';
import { PlanningPanel, ArchivePanel } from './AdminDashboard';
import { Settings, CheckSquare, Users, FileText, Download, Upload, Shield, LogOut, Clock, Calendar, Box, Database, Save, RotateCcw, Activity, ShieldAlert, X } from 'lucide-react';

export const StandardisteDashboard = ({ users, supabase, onLogout, currentUserTrigram, activeRound, columnConfigs, globalClosures, onOpenTerms, onOpenLegal }: any) => {
  const [choices, setChoices] = useState<any[]>([]);
  const [headerConfigs, setHeaderConfigs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'PLANNING' | 'ECHANGES' | 'ARCHIVES'>('PLANNING');
  
    
const fetchAll = async (supabaseClient: any, table: string, queryModifier: (q: any) => any = (q) => q) => {
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabaseClient.from(table).select('*');
    query = queryModifier(query);
    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error(error);
      break;
    }
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (data.length < pageSize) break;
      page++;
    } else {
      break;
    }
  }
  return allData;
};


  const logAction = async (action: string, details: any = {}) => {
    try {
      await supabase.from('logs').insert([{ action, details: { ...details, user: currentUserTrigram } }]);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshData = async () => {
    const choicesData = await fetchAll(supabase, 'choices');
    if (choicesData) {
        setChoices(choicesData.map((db: any) => ({
            id: db.id, row: db.row, col: db.col, month: db.month - 1, year: db.year,
            groupIndex: db.group_index, subRank: db.sub_rank, category: db.category,
            userTrigram: db.user_trigram, 
            userRole: db.user_role || 'DOCTOR',
            status: db.status, submittedAt: db.submitted_at, roundId: db.round_id,
            colLabel: db.col_label, colType: db.col_type, colTimeRange: db.col_time_range
        })));
    }
    
    const { data: headersData } = await supabase.from('header_configs').select('*');
    if (headersData) setHeaderConfigs(headersData);
  };
  
  useEffect(() => {
    refreshData();
  }, []);

  const navItems = [
    { id: 'PLANNING', label: 'Planning Actuel', icon: Calendar },
    { id: 'ECHANGES', label: 'Règles et Échanges', icon: Calendar },
    { id: 'ARCHIVES', label: 'Planning Archivé', icon: Database },
  ];

  return (
    <div className="min-h-[100dvh] flex font-sans bg-slate-100 text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 transition-all duration-300 relative z-20">
        <div className="p-6">
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1">SOS 92</h1>
          <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Espace Standardiste</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-200' : 'text-slate-500'}`} strokeWidth={2.5} />
                {item.label}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 mt-auto">
          <div className="mb-4 px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col gap-1">
             <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Connecté en tant que</span>
             <span className="text-sm font-black text-white">{currentUserTrigram}</span>
          </div>
          <button 
            onClick={onOpenTerms}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:bg-blue-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm mb-3"
          >
            <FileText className="w-4 h-4" strokeWidth={2.5} />
            CGU
          </button>
          <button 
            onClick={onOpenLegal}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:bg-blue-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm mb-3"
          >
            <Shield className="w-4 h-4" strokeWidth={2.5} />
            Légal
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" strokeWidth={2.5} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col min-h-0 relative z-10 bg-slate-100 p-6 md:p-8">
        <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
          {activeTab === 'PLANNING' && (
            <PlanningPanel
                currentUserTrigram={currentUserTrigram}
                choices={choices}
                setChoices={setChoices}
                users={users}
                activeRound={activeRound}
                columnConfigs={columnConfigs}
                quotas={[]}
                headerConfigs={headerConfigs}
                supabase={supabase}
                globalClosures={globalClosures}
                setGlobalClosures={() => {}}
                logAction={logAction}
            />
          )}
          {activeTab === 'ECHANGES' && (
            <ExchangeRules 
               supabase={supabase} 
               choices={choices} 
               users={users} 
               activeRound={activeRound} 
               columnConfigs={columnConfigs} 
               headerConfigs={headerConfigs} 
               globalClosures={globalClosures} 
               PlanningPanel={PlanningPanel} 
               refreshData={refreshData} currentUserTrigram={currentUserTrigram} isStandardist={true} 
            />
          )}
          {activeTab === 'ARCHIVES' && (
             <ArchivePanel 
               supabase={supabase} 
               users={users} 
               activeRound={activeRound} 
               columnConfigs={columnConfigs} 
               headerConfigs={headerConfigs} 
               quotas={[]} 
               globalClosures={globalClosures} 
               logAction={async () => {}} 
               refreshMainData={refreshData} 
             />
          )}
        </div>
      </main>
    </div>
  );
};
