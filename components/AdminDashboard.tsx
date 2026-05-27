import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { AdminTab, UserProfile, Round, Choice, ColumnConfig, HeaderConfig, GuardType, Site, UserRole, ColumnDefinition, ShiftDefinition, ShiftGlobalSettings } from '../types';
import { COLUMNS, DEFAULT_HEADERS, parseTimeRange, isPublicHoliday, doRangesOverlap } from '../constants';
import { MatrixHeader } from './MatrixHeader';
import { VersionsPanel } from './VersionsPanel';
import { ExchangeRules } from './ExchangeRules';

interface Props {
  users: UserProfile[];
  setUsers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  rounds: Round[];
  setRounds: React.Dispatch<React.SetStateAction<Round[]>>;
  supabase: any;
  onLogout: () => void;
}

const getDefaultColor = (colorClass: string) => {
  const match = colorClass?.match(/bg-\[#([0-9a-fA-F]{6})\]/);
  if (match) return `#${match[1]}`;
  return '#FFFFFF';
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const fetchAll = async (supabaseClient: any, table: string, queryModifier: (q: any) => any = (q) => q) => {
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabaseClient.from(table).select('*');
    query = queryModifier(query);
    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    allData.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return allData;
};

const generateAutoVersionName = async (supabase: any, activeRound: any) => {
    const startM = activeRound?.monthStart ?? 0;
    const startY = activeRound?.yearStart ?? 2025;
    const numMonths = activeRound?.numMonths || 1;
    
    const months = [];
    for (let i = 0; i < numMonths; i++) {
        const d = new Date(startY, startM + i, 1);
        months.push(d.toLocaleString('fr-FR', { month: 'long' }));
    }
    const monthsStr = months.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join('-');
    const baseName = `${monthsStr} ${startY}`;

    const { data: existingVersions } = await supabase.from('planning_versions').select('name').ilike('name', `${baseName} v%`);
    let maxV = 0;
    if (existingVersions && existingVersions.length > 0) {
        existingVersions.forEach((v: any) => {
            const match = v.name.match(/v(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxV) maxV = num;
            }
        });
    }
    return `${baseName} v${maxV + 1}`;
};

export const AdminDashboard: React.FC<Props> = ({ users, setUsers, rounds, setRounds, supabase, onLogout }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(AdminTab.USERS);
  const [selectedRoundId, setSelectedRoundId] = useState<number>(1);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const logAction = useCallback(async (action: string, details: any) => {
    try {
      await supabase.from('logs').insert([{ action, details, user_trigram: 'ADMIN' }]);
    } catch (e) {
      console.error('Failed to log action', e);
    }
  }, [supabase]);
  const [allChoices, setAllChoices] = useState<Choice[]>([]);
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([]);
  const [headerConfigs, setHeaderConfigs] = useState<HeaderConfig[]>([]);
  const [shiftDefinitions, setShiftDefinitions] = useState<ShiftDefinition[]>([]);
  const [shiftGlobalSettings, setShiftGlobalSettings] = useState<ShiftGlobalSettings | null>(null);
  const [globalClosures, setGlobalClosures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [showHeaderSqlHelp, setShowHeaderSqlHelp] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'PENDING' | 'ALL'>('PENDING');
  const [pendingTarget, setPendingTarget] = useState<'DOCTOR' | 'SUBSTITUTE' | 'BOTH'>('BOTH');

  const activeRound = useMemo(() => rounds.find(r => r.isActive) || rounds[0], [rounds]);
  const selectedRound = useMemo(() => rounds.find(r => r.id === selectedRoundId) || rounds[0], [rounds, selectedRoundId]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: ud } = await supabase.from('users').select('*').order('trigram');
      if (ud) setUsers(ud);
      const { data: rd } = await supabase.from('rounds').select('*').order('id');
      if (rd) {
        setRounds(rd.map((r: any) => ({
          ...r,
          isActive: r.is_active, 
          isActiveDoctors: r.is_active_doctors ?? true,
          isActiveSubstitutes: r.is_active_substitutes ?? true,
          isLocked: r.is_locked ?? false,
          numMonths: r.num_months || 1,
          monthStart: r.month_start - 1,
          yearStart: r.year_start,
          step_normal_active: r.step_normal_active ?? true,
          instructions_normal: r.instructions_normal ?? "",
          step_bad_bonus_active: r.step_bad_bonus_active ?? true,
          instructions_bad_bonus: r.instructions_bad_bonus ?? "",
          step_good_bonus_active: r.step_good_bonus_active ?? true,
          instructions_good_bonus: r.instructions_good_bonus ?? "",
          maxOverlapMinutes: r.max_overlap_minutes ?? 0,
        })));
      }
      const cd = await fetchAll(supabase, 'choices', q => q.neq('status', 'ARCHIVED'));
      if (cd) setAllChoices(cd.map((db: any) => ({
        id: db.id, row: db.row, col: db.col, month: db.month - 1, year: db.year,
        groupIndex: db.group_index, subRank: db.sub_rank, category: db.category,
        userTrigram: db.user_trigram, 
        userRole: db.user_role || 'DOCTOR',
        status: db.status, submittedAt: db.submitted_at, roundId: db.round_id,
        colLabel: db.col_label,
        colType: db.col_type,
        colTimeRange: db.col_time_range
      })));
      const { data: cfg } = await supabase.from('column_configs').select('*').eq('round_id', selectedRoundId);
      if (cfg) setColumnConfigs(cfg || []);
      const { data: hc } = await supabase.from('header_configs').select('*').order('start_col', { ascending: true });
      if (hc && hc.length > 0) setHeaderConfigs(hc);
      else setHeaderConfigs(DEFAULT_HEADERS);
      const { data: sd } = await supabase.from('shift_definitions').select('*').order('id');
      if (sd) setShiftDefinitions(sd);
      const { data: sgs } = await supabase.from('shift_global_settings').select('*').eq('id', 1).single();
      if (sgs) setShiftGlobalSettings(sgs);
      const gc = await fetchAll(supabase, 'global_closures');
      if (gc) setGlobalClosures(gc.map((g: any) => ({ ...g, month: g.month !== null ? g.month - 1 : null })));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, selectedRoundId, setUsers, setRounds]);

  useEffect(() => { refreshData(); }, [refreshData]);

  const executeDelete = async () => {
    setIsDeletingAll(true);
    try {
      if (deleteMode === 'PENDING') {
          let query = supabase.from('choices').delete().eq('status', 'PENDING');
          if (pendingTarget === 'DOCTOR') query = query.eq('user_role', 'DOCTOR');
          else if (pendingTarget === 'SUBSTITUTE') query = query.eq('user_role', 'SUBSTITUTE');
          await query;
          logAction('VIDER_BASE', { mode: 'PENDING', target: pendingTarget });
      } else {
          // RESET MODE: Automatically create a version first
          const rawAssignedChoices = allChoices.filter((c: any) => c.status === 'ASSIGNED');
          const assignedChoices = rawAssignedChoices.filter((a: any, index: number, self: any[]) => 
              index === self.findIndex((t: any) => t.row === a.row && t.col === a.col && t.userTrigram === a.userTrigram && t.month === a.month && t.year === a.year)
          );
          if (assignedChoices.length > 0) {
            const versionName = await generateAutoVersionName(supabase, activeRound);
            
            const { error: versionError } = await supabase.from('planning_versions').insert({
              name: versionName,
              data: assignedChoices
            });
            
            if (versionError) {
              if (versionError.message.includes('relation "planning_versions" does not exist')) {
                alert("La table planning_versions n'existe pas. La version n'a pas pu être créée. Veuillez configurer la table dans l'onglet VERSIONS.");
                const proceed = window.confirm("Continuer la réinitialisation SANS sauvegarde ?");
                if (!proceed) {
                  setIsDeletingAll(false);
                  setShowDeleteModal(false);
                  return;
                }
              } else {
                console.error(versionError);
                alert("Erreur lors de la création de la version automatique.");
                setIsDeletingAll(false);
                return;
              }
            } else {
              logAction('CREATE_VERSION', { name: versionName, count: assignedChoices.length });
            }
          }

          // Clear choices, unavailabilities
          await supabase.from('choices').delete().not('id', 'is', null);
          await supabase.from('unavailabilities').delete().not('id', 'is', null);
          logAction('VIDER_BASE', { mode: 'ALL' });
      }
      await refreshData();
      alert("Base mise à jour.");
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeletingAll(false);
      setShowDeleteModal(false);
    }
  };

  const handleImportCSV = async (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    const rows = lines.slice(1);
    if (rows.length === 0) return;
    const upserts = rows.map(line => {
      const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
      const matches = line.match(regex) || [];
      const cols = matches.map(m => m.replace(/^"|"$/g, '').trim());
      if (cols.length < 16) return null;
      return {
        id: cols[0], user_trigram: cols[1], user_role: cols[2], round_id: Number(cols[3]),
        submitted_at: cols[4] ? new Date(cols[4]).toISOString() : new Date().toISOString(),
        year: Number(cols[5]), month: Number(cols[6]), row: Number(cols[7]),
        col: Number(cols[8]), col_label: cols[9], col_type: cols[10], col_time_range: cols[11],
        category: cols[12], group_index: Number(cols[13]), sub_rank: Number(cols[14]), status: cols[15]
      };
    }).filter(x => x && x.id);
    
    let hasError = false;
    let errorMessage = "";
    for (let i = 0; i < upserts.length; i += 500) {
        const chunk = upserts.slice(i, i + 500);
        const { error } = await supabase.from('choices').upsert(chunk);
        if (error) {
            hasError = true;
            errorMessage = error.message;
            break;
        }
    }

    if (hasError) alert("Erreur import: " + errorMessage);
    else { alert("Import réussi !"); refreshData(); }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row overflow-hidden font-sans text-slate-900 relative">
      {showDeleteModal && (
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4">
                    <h3 className="text-lg font-black text-red-600 uppercase tracking-tight">Suppression</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <button onClick={() => setDeleteMode('PENDING')} className={`w-full p-4 border-2 rounded-2xl transition-all ${deleteMode === 'PENDING' ? 'border-blue-500 bg-blue-50' : 'border-slate-100'}`}>
                            <span className="block text-sm font-black uppercase text-slate-900">En Attente</span>
                        </button>
                        
                        {deleteMode === 'PENDING' && (
                            <div className="flex gap-2 pl-4 animate-in slide-in-from-top-2">
                                <button onClick={() => setPendingTarget('DOCTOR')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${pendingTarget === 'DOCTOR' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'}`}>Titulaires</button>
                                <button onClick={() => setPendingTarget('SUBSTITUTE')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${pendingTarget === 'SUBSTITUTE' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-200'}`}>Remplaçants</button>
                                <button onClick={() => setPendingTarget('BOTH')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${pendingTarget === 'BOTH' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200'}`}>Les Deux</button>
                            </div>
                        )}
                    </div>

                    <button onClick={() => setDeleteMode('ALL')} className={`w-full p-4 border-2 rounded-2xl transition-all ${deleteMode === 'ALL' ? 'border-red-500 bg-red-50' : 'border-slate-100'}`}>
                        <span className="block text-sm font-black uppercase text-red-600">Réinitialiser la base de données</span>
                        <span className="block text-[10px] font-bold text-red-400 mt-1">Supprime TOUS les choix et indisponibilités (les fermetures sont conservées)</span>
                    </button>
                </div>
                <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 bg-white border rounded-xl text-xs font-black uppercase">Annuler</button>
                    <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase">Confirmer</button>
                </div>
            </div>
        </div>
      )}

      <aside className={`hidden md:flex ${isSidebarCollapsed ? 'w-16' : 'w-16 lg:w-48'} bg-slate-900 text-white flex-col shadow-2xl z-50 shrink-0 border-r border-slate-800 transition-all duration-300 relative`}>
        <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-6 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-50 hidden lg:flex shadow-lg"
            title={isSidebarCollapsed ? "Déplier le menu" : "Replier le menu"}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}>
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
        </button>
        <div className="p-4 lg:p-6 border-b border-slate-800 flex items-center justify-center lg:justify-start gap-3">
          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-sm lg:text-lg shadow-inner shrink-0">A</div>
          {!isSidebarCollapsed && <h2 className="hidden lg:block text-xs font-black uppercase tracking-tighter">SOS 92</h2>}
        </div>
        <nav className="flex-1 p-2 lg:p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {[{ id: AdminTab.USERS, label: 'Médecins', icon: '👥' }, { id: AdminTab.CONFIG, label: 'Paramétrage', icon: '⚙️' }, { id: AdminTab.SHIFTS, label: 'Gardes', icon: '🛡️' }, { id: AdminTab.PLANNING, label: 'Planning', icon: '📅' }, { id: AdminTab.WISHES, label: 'Choix Médecin', icon: '📝' }, { id: AdminTab.VERSIONS, label: 'Copies de planning', icon: '💾' }, { id: AdminTab.EXCHANGES, label: 'Mouvements de garde', icon: '🔄' }, { id: AdminTab.CONNECTION_LOGS, label: 'Historique log', icon: '📊' }].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as AdminTab)} className={`w-full flex items-center justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-start'} gap-3 p-3 lg:px-4 lg:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`} title={item.label}>
              <span className="text-lg lg:text-base">{item.icon}</span>
              {!isSidebarCollapsed && <span className="hidden lg:block">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-2 lg:p-4 border-t border-slate-800 space-y-3">
            <button onClick={() => setShowDeleteModal(true)} disabled={isDeletingAll} className={`w-full p-3 lg:py-3 bg-slate-700 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="Vider la base">
                <span className={isSidebarCollapsed ? '' : 'lg:hidden'}>⚠️</span>
                {!isSidebarCollapsed && <span className="hidden lg:inline">⚠️ Vider la base</span>}
            </button>
            <button onClick={onLogout} className={`w-full p-3 lg:py-3 bg-slate-800 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="Déconnexion">
                <span className={isSidebarCollapsed ? '' : 'lg:hidden'}>🚪</span>
                {!isSidebarCollapsed && <span className="hidden lg:inline">Déconnexion</span>}
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
        <header className="h-16 bg-white border-b px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h1 className="text-xs font-black uppercase tracking-widest text-slate-400">{activeTab}</h1>
          </div>
          {isLoading && <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest animate-pulse">Chargement...</div>}
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm md:hidden flex">
            <div className="w-64 bg-slate-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center font-black text-sm shadow-inner text-white shrink-0">A</div>
                  <h2 className="text-xs font-black uppercase tracking-tighter text-white">SOS 92</h2>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {[{ id: AdminTab.USERS, label: 'Médecins', icon: '👥' }, { id: AdminTab.CONFIG, label: 'Paramétrage', icon: '⚙️' }, { id: AdminTab.SHIFTS, label: 'Gardes', icon: '🛡️' }, { id: AdminTab.PLANNING, label: 'Planning', icon: '📅' }, { id: AdminTab.WISHES, label: 'Choix Médecin', icon: '📝' }, { id: AdminTab.VERSIONS, label: 'Copies de planning', icon: '💾' }, { id: AdminTab.EXCHANGES, label: 'Mouvements de garde', icon: '🔄' }, { id: AdminTab.CONNECTION_LOGS, label: 'Historique log', icon: '📊' }].map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => { setActiveTab(item.id as AdminTab); setIsMobileMenuOpen(false); }} 
                    className={`w-full flex items-center justify-start gap-3 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
              <div className="p-4 border-t border-slate-800 space-y-3">
                  <button onClick={() => { setShowDeleteModal(true); setIsMobileMenuOpen(false); }} disabled={isDeletingAll} className="w-full p-3 bg-slate-700 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex justify-center items-center gap-2">
                      <span>⚠️ Vider la base</span>
                  </button>
                  <button onClick={onLogout} className="w-full p-3 bg-slate-800 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-2">
                      <span>🚪 Déconnexion</span>
                  </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)}></div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {activeTab === AdminTab.USERS && <UsersPanel users={users} supabase={supabase} refreshData={refreshData} logAction={logAction} />}
          {activeTab === AdminTab.CONFIG && (
            <ConfigPanel 
              round={selectedRound} 
              allRounds={rounds} 
              setRounds={setRounds}
              selectedRoundId={selectedRoundId} 
              setSelectedRoundId={setSelectedRoundId} 
              columnConfigs={columnConfigs} 
              setColumnConfigs={setColumnConfigs}
              headerConfigs={headerConfigs}
              setHeaderConfigs={setHeaderConfigs}
              shiftGlobalSettings={shiftGlobalSettings}
              users={users}
              supabase={supabase} 
              refreshRounds={refreshData} 
              onShowHeaderHelp={() => setShowHeaderSqlHelp(true)}
              logAction={logAction}
            />
          )}
          {activeTab === AdminTab.SHIFTS && (
            <ShiftsPanel
              shiftDefinitions={shiftDefinitions}
              shiftGlobalSettings={shiftGlobalSettings}
              users={users}
              supabase={supabase}
              refreshData={refreshData}
              logAction={logAction}
            />
          )}
          {activeTab === AdminTab.PLANNING && <PlanningPanel choices={allChoices} setChoices={setAllChoices} users={users} activeRound={activeRound} columnConfigs={columnConfigs} headerConfigs={headerConfigs} supabase={supabase} onImport={handleImportCSV} globalClosures={globalClosures} setGlobalClosures={setGlobalClosures} logAction={logAction} />}
          {activeTab === AdminTab.WISHES && <WishesPanel choices={allChoices} setChoices={setAllChoices} supabase={supabase} onImport={handleImportCSV} activeRound={activeRound} logAction={logAction} users={users} />}
          {activeTab === AdminTab.VERSIONS && <VersionsPanel supabase={supabase} logAction={logAction} users={users} activeRound={activeRound} columnConfigs={columnConfigs} headerConfigs={headerConfigs} globalClosures={globalClosures} refreshData={refreshData} />}
          {activeTab === AdminTab.EXCHANGES && <ExchangeRules supabase={supabase} choices={allChoices} users={users} activeRound={activeRound} columnConfigs={columnConfigs} headerConfigs={headerConfigs} globalClosures={globalClosures} PlanningPanel={PlanningPanel} refreshData={refreshData} />}
          {activeTab === AdminTab.CONNECTION_LOGS && <ConnectionLogsPanel supabase={supabase} />}
        </div>
      </main>
    </div>
  );
};

const ConnectionLogsPanel = ({ supabase }: any) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTrigram, setFilterTrigram] = useState('');
  const [filterMode, setFilterMode] = useState<string>('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('connection_logs').select('*').order('login_time', { ascending: false }).limit(500);
    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchTri = filterTrigram === '' || l.user_trigram.toLowerCase().includes(filterTrigram.toLowerCase());
      const matchMode = filterMode === 'ALL' || l.view_mode === filterMode;
      return matchTri && matchMode;
    });
  }, [logs, filterTrigram, filterMode]);

  const chartDataTri = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLogs.forEach(l => {
      counts[l.user_trigram] = (counts[l.user_trigram] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [filteredLogs]);

  const chartDataTime = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLogs.forEach(l => {
      const date = new Date(l.login_time).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      counts[date] = (counts[date] || 0) + 1;
    });
    // Reverse because data is loaded desc, we want asc for chart
    return Object.entries(counts).reverse()
      .map(([date, count]) => ({ date, Connexions: count }));
  }, [filteredLogs]);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2">
            <span className="text-2xl">📊</span> Historique log
        </h2>
        <div className="flex flex-wrap items-center gap-3">
            <input 
              type="text" 
              placeholder="Filtrer trigramme..." 
              value={filterTrigram} 
              onChange={e => setFilterTrigram(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-xs uppercase font-black"
            />
            <select 
              value={filterMode} 
              onChange={e => setFilterMode(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-xs uppercase font-black"
            >
              <option value="ALL">Tous les modes</option>
              <option value="APP">Planning</option>
              <option value="LIST_INPUT">Liste</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button onClick={fetchLogs} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200" title="Actualiser">🔄</button>
        </div>
      </div>

      {!loading && filteredLogs.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest text-center">Connexions par Trigramme (Top 15)</h3>
                  <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartDataTri}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 800}} axisLine={false} tickLine={false} />
                              <YAxis allowDecimals={false} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                              <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest text-center">Évolution des connexions</h3>
                  <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartDataTime}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="date" tick={{fontSize: 10, fontWeight: 800}} axisLine={false} tickLine={false} />
                              <YAxis allowDecimals={false} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                              <Line type="monotone" dataKey="Connexions" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}

      {loading ? (
          <div className="text-slate-500 text-sm py-4">Chargement des logs...</div>
      ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="p-3">Trigramme</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Connexion</th>
                  <th className="p-3">Déconnexion</th>
                  <th className="p-3">Durée</th>
                  <th className="p-3">Appareil & Résolution</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400 text-sm">Aucun log trouvé.</td>
                  </tr>
                ) : filteredLogs.map((l: any) => {
                  const loginTime = new Date(l.login_time);
                  const logoutTime = l.logout_time ? new Date(l.logout_time) : null;
                  
                  let duration = '-';
                  if (logoutTime) {
                      const diffMs = logoutTime.getTime() - loginTime.getTime();
                      const minutes = Math.floor(diffMs / 60000);
                      const seconds = Math.floor((diffMs % 60000) / 1000);
                      duration = `${minutes}m ${seconds}s`;
                  } else if (l.session_duration_seconds) {
                      duration = `${Math.floor(l.session_duration_seconds / 60)}m ${l.session_duration_seconds % 60}s`;
                  } else {
                      duration = 'En cours...';
                  }

                  const formatTime = (d: Date) => d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                      <td className="p-3 font-bold text-slate-800">{l.user_trigram}</td>
                      <td className="p-3 font-bold text-slate-500">{l.view_mode || '-'}</td>
                      <td className="p-3 text-slate-600">{formatTime(loginTime)}</td>
                      <td className="p-3 text-slate-600">{logoutTime ? formatTime(logoutTime) : '-'}</td>
                      <td className="p-3">
                          <span className={`px-2 py-1 rounded-md font-bold text-[10px] ${duration === 'En cours...' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                              {duration}
                          </span>
                      </td>
                      <td className="p-3 text-[10px] text-slate-400 max-w-[200px] truncate" title={l.device_info}>{l.device_info}<br/>{l.screen_resolution}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      )}
    </div>
  );
};

const UsersPanel = ({ users, supabase, refreshData, logAction }: any) => {
  const [newTri, setNewTri] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('DOCTOR');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'DOCTOR' | 'SUBSTITUTE'>('ALL');

  const addUser = async () => {
    if (newTri.length !== 3) return;
    await supabase.from('users').insert({ trigram: newTri.toUpperCase(), password: newPwd || '1234', role: newRole });
    logAction('AJOUT_UTILISATEUR', { trigram: newTri.toUpperCase(), role: newRole });
    setNewTri(''); setNewPwd(''); refreshData();
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => {
      const matchesSearch = u.trigram.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const UserCard: React.FC<{ u: any }> = ({ u }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [pwd, setPwd] = useState(u.password || '');
    return (
      <div className="bg-white p-6 rounded-3xl border flex justify-between items-center group relative overflow-hidden shadow-sm">
        <div className={`absolute top-0 left-0 w-1.5 h-full ${u.role === 'DOCTOR' ? 'bg-blue-600' : 'bg-orange-500'}`}></div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-black">{u.trigram}</span>
            <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${u.role === 'DOCTOR' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{u.role === 'DOCTOR' ? 'Titulaire' : 'Remplaçant'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-slate-400 uppercase">Code:</span>
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input value={pwd} onChange={e => setPwd(e.target.value)} className="p-1 border rounded text-[10px] w-20 outline-none" autoFocus />
                <button onClick={async () => { await supabase.from('users').update({ password: pwd }).eq('trigram', u.trigram); logAction('MODIFICATION_UTILISATEUR', { trigram: u.trigram }); setIsEditing(false); refreshData(); }} className="text-green-600 font-bold text-xs">✓</button>
              </div>
            ) : (
              <span className="text-[10px] font-black cursor-pointer hover:text-blue-600" onClick={() => setIsEditing(true)}>{u.password || '----'}</span>
            )}
          </div>
        </div>
        <button onClick={async () => { if(confirm(`Supprimer ${u.trigram} ?`)) { await supabase.from('users').delete().eq('trigram', u.trigram); logAction('SUPPRESSION_UTILISATEUR', { trigram: u.trigram }); refreshData(); } }} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-600 transition-all p-2">✕</button>
      </div>
    );
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full custom-scrollbar">
      <div className="bg-white p-6 rounded-[40px] border shadow-sm flex flex-col md:flex-row items-center gap-4 max-w-5xl">
        <input type="text" placeholder="TRI" value={newTri} onChange={e => setNewTri(e.target.value)} className="p-4 border rounded-2xl font-black uppercase text-center w-32" maxLength={3} />
        <input type="text" placeholder="Code secret" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="w-full p-4 border rounded-2xl font-black text-center" />
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button onClick={() => setNewRole('DOCTOR')} className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest ${newRole === 'DOCTOR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Titulaire</button>
          <button onClick={() => setNewRole('SUBSTITUTE')} className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest ${newRole === 'SUBSTITUTE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>Remplaçant</button>
        </div>
        <button onClick={addUser} className="px-8 bg-slate-900 text-white rounded-2xl font-black h-[58px] uppercase tracking-widest text-[10px]">Ajouter</button>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border shadow-sm">
        <div className="relative w-full md:w-64">
          <input 
            type="text" 
            placeholder="Rechercher un trigramme..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-50 text-slate-900"
          />
          <svg className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
          <button onClick={() => setRoleFilter('ALL')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${roleFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Tous</button>
          <button onClick={() => setRoleFilter('DOCTOR')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${roleFilter === 'DOCTOR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Titulaires</button>
          <button onClick={() => setRoleFilter('SUBSTITUTE')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${roleFilter === 'SUBSTITUTE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Remplaçants</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {filteredUsers.map((u: any) => <UserCard key={u.trigram} u={u} />)}
        {filteredUsers.length === 0 && (
          <div className="col-span-full text-center p-8 text-slate-400 font-medium">Aucun utilisateur trouvé.</div>
        )}
      </div>
    </div>
  );
};

const ShiftsPanel = ({ shiftDefinitions, shiftGlobalSettings, supabase, refreshData, users, logAction }: any) => {
  return (
    <div className="p-4 md:p-8 overflow-y-auto h-full custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Paramètres Globaux des Gardes</h3>
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex flex-col gap-4 bg-slate-50 p-4 rounded-2xl border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-orange-600">Remplaçant</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Max par jour</span>
                  <input type="number" value={shiftGlobalSettings?.target_substitute_max || 0} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_substitute_max: Number(e.target.value) }).eq('id', 1);
                    refreshData();
                  }} className="w-20 p-2 border rounded-xl text-sm font-bold text-center bg-white" min="0" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={shiftGlobalSettings?.target_substitute_normal_active || false} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_substitute_normal_active: e.target.checked }).eq('id', 1);
                    refreshData();
                  }} className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                  <span className="text-[10px] font-bold uppercase text-slate-600">Garde Cible</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={shiftGlobalSettings?.target_substitute_good_active || false} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_substitute_good_active: e.target.checked }).eq('id', 1);
                    refreshData();
                  }} className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                  <span className="text-[10px] font-bold uppercase text-slate-600">Bonne Garde</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={shiftGlobalSettings?.target_substitute_bad_active || false} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_substitute_bad_active: e.target.checked }).eq('id', 1);
                    refreshData();
                  }} className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                  <span className="text-[10px] font-bold uppercase text-slate-600">Garde Normale</span>
                </label>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-4 bg-slate-50 p-4 rounded-2xl border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-blue-600">Médecin</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Max par jour</span>
                  <input type="number" value={shiftGlobalSettings?.target_doctor_max || 0} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_doctor_max: Number(e.target.value) }).eq('id', 1);
                    refreshData();
                  }} className="w-20 p-2 border rounded-xl text-sm font-bold text-center bg-white" min="0" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={shiftGlobalSettings?.target_doctor_normal_active || false} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_doctor_normal_active: e.target.checked }).eq('id', 1);
                    refreshData();
                  }} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-[10px] font-bold uppercase text-slate-600">Garde Cible</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={shiftGlobalSettings?.target_doctor_good_active || false} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_doctor_good_active: e.target.checked }).eq('id', 1);
                    refreshData();
                  }} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-[10px] font-bold uppercase text-slate-600">Bonne Garde</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={shiftGlobalSettings?.target_doctor_bad_active || false} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_doctor_bad_active: e.target.checked }).eq('id', 1);
                    refreshData();
                  }} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                  <span className="text-[10px] font-bold uppercase text-slate-600">Garde Normale</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Définition des Gardes</h3>
            <button onClick={async () => {
              const { data, error } = await supabase.from('shift_definitions').insert({
                title: 'Nouvelle Garde',
                start_col: 1,
                end_col: 1
              }).select().single();
              if (data && !error) refreshData();
            }} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
              + Ajouter une garde
            </button>
          </div>
          
          <div className="space-y-4">
            {shiftDefinitions.map((shift: any) => (
              <div key={shift.id} className="p-4 border rounded-2xl bg-slate-50 flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex-1 space-y-2 w-full">
                  <input type="text" value={shift.title} onChange={async (e) => {
                    await supabase.from('shift_definitions').update({ title: e.target.value }).eq('id', shift.id);
                    refreshData();
                  }} className="w-full p-2 border rounded-lg text-sm font-bold text-slate-900 bg-white" placeholder="Titre de la garde" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">De col.</span>
                    <input type="number" value={shift.start_col} onChange={async (e) => {
                      await supabase.from('shift_definitions').update({ start_col: Number(e.target.value) }).eq('id', shift.id);
                      refreshData();
                    }} className="w-16 p-2 border rounded-lg text-xs font-bold text-slate-900 bg-white text-center" />
                    <span className="text-[10px] font-black uppercase text-slate-400">à col.</span>
                    <input type="number" value={shift.end_col} onChange={async (e) => {
                      await supabase.from('shift_definitions').update({ end_col: Number(e.target.value) }).eq('id', shift.id);
                      refreshData();
                    }} className="w-16 p-2 border rounded-lg text-xs font-bold text-slate-900 bg-white text-center" />
                  </div>
                </div>
                
                <button onClick={async () => {
                  if(window.confirm('Supprimer cette garde ?')) {
                    await supabase.from('shift_definitions').delete().eq('id', shift.id);
                    refreshData();
                  }
                }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                  ✕
                </button>
              </div>
            ))}
            {shiftDefinitions.length === 0 && (
              <div className="text-center p-8 text-slate-400 text-xs font-bold">Aucune garde définie.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfigPanel = ({ round, allRounds, setRounds, selectedRoundId, setSelectedRoundId, columnConfigs, setColumnConfigs, headerConfigs, setHeaderConfigs, shiftGlobalSettings, users, supabase, refreshRounds, onShowHeaderHelp, logAction }: any) => {
  const [instructions, setInstructions] = useState(round?.instructions || '');
  const [roundTitle, setRoundTitle] = useState(round?.title || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedColIds, setSelectedColIds] = useState<number[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'columns' | 'shifts'>('general');
  
  const [stepConfig, setStepConfig] = useState({
     normal: { active: round?.step_normal_active ?? true, instructions: round?.instructions_normal ?? '' },
     bad: { active: round?.step_bad_bonus_active ?? true, instructions: round?.instructions_bad_bonus ?? '' },
     good: { active: round?.step_good_bonus_active ?? true, instructions: round?.instructions_good_bonus ?? '' }
  });
  
  const [bulkLabel, setBulkLabel] = useState('');
  const [bulkHeaderLabel, setBulkHeaderLabel] = useState('');
  const [bulkType, setBulkType] = useState<GuardType | ''>('');
  const [bulkTime, setBulkTime] = useState('');
  const [bulkSite, setBulkSite] = useState<Site | ''>('');
  const [bulkColor, setBulkColor] = useState('#ffffff');
  
  const [bulkOpenings, setBulkOpenings] = useState<any>({
    open_normal_w: true, open_normal_s: true, open_normal_d: true,
    open_bad_w: true, open_bad_s: true, open_bad_d: true,
    open_good_w: true, open_good_s: true, open_good_d: true
  });

  const [period, setPeriod] = useState({ 
    month: round?.monthStart ?? 0, 
    year: round?.yearStart ?? 2025, 
    numMonths: round?.numMonths ?? 1 
  });

  useEffect(() => { 
    setInstructions(round?.instructions || '');
    setRoundTitle(round?.title || '');
    setPeriod({ 
      month: round?.monthStart ?? 0, 
      year: round?.yearStart ?? 2025, 
      numMonths: round?.numMonths ?? 1 
    });
    setStepConfig({
        normal: { active: round?.step_normal_active ?? true, instructions: round?.instructions_normal ?? '' },
        bad: { active: round?.step_bad_bonus_active ?? true, instructions: round?.instructions_bad_bonus ?? '' },
        good: { active: round?.step_good_bonus_active ?? true, instructions: round?.instructions_good_bonus ?? '' }
    });
    setSelectedColIds([]);
  }, [round]);

  const updateRoundFlags = async (flags: Partial<Round>) => {
    setIsUpdating(true);
    try {
        const payload: any = {};
        if (flags.isActiveDoctors !== undefined) payload.is_active_doctors = flags.isActiveDoctors;
        if (flags.isActiveSubstitutes !== undefined) payload.is_active_substitutes = flags.isActiveSubstitutes;
        if (flags.isLocked !== undefined) payload.is_locked = flags.isLocked;
        if (flags.maxOverlapMinutes !== undefined) payload.max_overlap_minutes = flags.maxOverlapMinutes;
        if (flags.allow_choice_reproduction !== undefined) payload.allow_choice_reproduction = flags.allow_choice_reproduction;
        
        const { error } = await supabase.from('rounds').update(payload).eq('id', selectedRoundId);
        if (error) throw error;
        await refreshRounds();
        
        if (flags.isLocked !== undefined) {
            logAction('VERROUILLAGE_TOUR', { tourId: selectedRoundId, nomTour: roundTitle, etat: flags.isLocked ? 'VERROUILLÉ' : 'DÉVERROUILLÉ' });
        }
    } catch (e) {
        console.error("Erreur mise à jour drapeaux:", e);
    } finally {
        setIsUpdating(false);
    }
  };

  const saveRoundSpecifics = async () => {
    setIsUpdating(true);
    try {
        await supabase.from('rounds').update({ 
            title: roundTitle,
            instructions,
            step_normal_active: stepConfig.normal.active,
            instructions_normal: stepConfig.normal.instructions,
            step_bad_bonus_active: stepConfig.bad.active,
            instructions_bad_bonus: stepConfig.bad.instructions,
            step_good_bonus_active: stepConfig.good.active,
            instructions_good_bonus: stepConfig.good.instructions
        }).eq('id', selectedRoundId);
        
        await refreshRounds();
        alert("Configuration complète du tour sauvegardée !");
    } catch(e: any) {
        console.error(e);
        alert("Erreur de sauvegarde: " + e.message);
    } finally {
        setIsUpdating(false);
    }
  };

  const saveGlobalPeriod = async () => {
    setIsUpdating(true);
    try {
        const { error } = await supabase.from('rounds').update({ 
            month_start: period.month + 1,
            year_start: period.year,
            num_months: period.numMonths
        }).neq('id', 0);
        if (error) throw error;
        alert("Période du planning mise à jour pour TOUS les tours.");
        refreshRounds();
        logAction('MODIFICATION_PERIODE', { mois: period.month + 1, annee: period.year, nbMois: period.numMonths });
    } catch (e: any) {
        alert("Erreur lors de la mise à jour globale : " + e.message);
    } finally {
        setIsUpdating(false);
    }
  };

  const setRoundActive = async () => {
    if (!selectedRoundId || isUpdating) return;
    setIsUpdating(true);
    try {
        await supabase.from('rounds').update({ is_active: false }).neq('id', 0);
        await supabase.from('rounds').update({ is_active: true }).eq('id', selectedRoundId);
        await refreshRounds();
        logAction('CHANGEMENT_TOUR_ACTIF', { tourId: selectedRoundId, nomTour: roundTitle });
    } catch (e) {
        console.error("Erreur activation tour:", e);
    } finally {
        setIsUpdating(false);
    }
  };

  const isGloballyLocked = allRounds.every(r => r.isLocked);

  const toggleGlobalLock = async () => {
    if (isUpdating) return;
    const newState = !isGloballyLocked;
    setIsUpdating(true);
    try {
        await supabase.from('rounds').update({ is_locked: newState }).neq('id', 0);
        await refreshRounds();
        logAction('VERROUILLAGE_GLOBAL', { etat: newState ? 'VERROUILLÉ' : 'DÉVERROUILLÉ' });
    } catch (e) {
        console.error("Erreur verrouillage global:", e);
    } finally {
        setIsUpdating(false);
    }
  };

  const isExchangesAllowed = allRounds.every(r => r.allow_exchanges);
  const isTakesAllowed = allRounds.every(r => r.allow_takes);

  const toggleExchanges = async () => {
    if (isUpdating) return;
    const newState = !isExchangesAllowed;
    setIsUpdating(true);
    try {
        await supabase.from('rounds').update({ allow_exchanges: newState }).neq('id', 0);
        await refreshRounds();
        logAction('AUTORISATION_ECHANGES', { etat: newState ? 'AUTORISÉ' : 'INTERDIT' });
    } catch (e) {
        console.error("Erreur autorisation échanges:", e);
    } finally {
        setIsUpdating(false);
    }
  };

  const toggleTakes = async () => {
    if (isUpdating) return;
    const newState = !isTakesAllowed;
    setIsUpdating(true);
    try {
        await supabase.from('rounds').update({ allow_takes: newState }).neq('id', 0);
        await refreshRounds();
        logAction('AUTORISATION_PRISES', { etat: newState ? 'AUTORISÉE' : 'INTERDITE' });
    } catch (e) {
        console.error("Erreur autorisation prises:", e);
    } finally {
        setIsUpdating(false);
    }
  };

  const updateCol = async (colId: number, field: string, value: any) => {
    setColumnConfigs((prev: any[]) => {
      const next = [...(prev || [])];
      const idx = next.findIndex(c => c.column_id === colId);
      
      const oldConfig = idx > -1 ? next[idx] : { round_id: selectedRoundId, column_id: colId };
      const newConfig = { ...oldConfig, [field]: value, round_id: selectedRoundId, column_id: colId };

      if (idx > -1) next[idx] = newConfig;
      else next.push(newConfig);
      
      return next;
    });

    const isGlobalField = ['custom_label', 'custom_header_label', 'custom_type', 'custom_site', 'custom_time_range', 'custom_color'].includes(field);

    try {
      if (isGlobalField) {
        const batch = allRounds.map((r: Round) => ({ 
            round_id: r.id, 
            column_id: colId, 
            [field]: value 
        }));
        await supabase.from('column_configs').upsert(batch, { onConflict: 'round_id,column_id' });
      } else {
        const payload = {
            round_id: selectedRoundId,
            column_id: colId,
            [field]: value
        };
        await supabase.from('column_configs').upsert(payload, { onConflict: 'round_id,column_id' });
      }
    } catch (e) {
      console.error("Erreur update col:", e);
    }
  };

  const applyBulkAction = async (settings: any) => {
    if (selectedColIds.length === 0) return;
    setIsUpdating(true);
    
    const cleanSettings: any = {};
    Object.keys(settings).forEach(key => {
        if (settings[key] !== '' && settings[key] !== null && settings[key] !== undefined) {
            cleanSettings[key] = settings[key];
        }
    });

    if (Object.keys(cleanSettings).length === 0) {
        setIsUpdating(false);
        return;
    }

    try {
        const isGlobalUpdate = Object.keys(cleanSettings).some(key => 
            ['custom_label', 'custom_header_label', 'custom_type', 'custom_site', 'custom_time_range', 'custom_color'].includes(key)
        );

        if (isGlobalUpdate) {
            // Fetch existing configs for these columns across all rounds
            const { data: existingConfigs } = await supabase
                .from('column_configs')
                .select('*')
                .in('column_id', selectedColIds);
            
            const existingMap = new Map();
            if (existingConfigs) {
                existingConfigs.forEach((c: any) => existingMap.set(`${c.round_id}-${c.column_id}`, c));
            }

            const upserts: any[] = [];
            allRounds.forEach((r: Round) => {
                selectedColIds.forEach(colId => {
                    const key = `${r.id}-${colId}`;
                    const existing = existingMap.get(key) || { round_id: r.id, column_id: colId };
                    upserts.push({ ...existing, ...cleanSettings });
                });
            });

            await supabase.from('column_configs').upsert(upserts, { onConflict: 'round_id,column_id' });
            
            // Also update local state for the current round
            setColumnConfigs((prev: any[]) => {
                const newConfigs = [...prev];
                selectedColIds.forEach(colId => {
                    const idx = newConfigs.findIndex(c => c.column_id === colId);
                    if (idx >= 0) {
                        newConfigs[idx] = { ...newConfigs[idx], ...cleanSettings };
                    } else {
                        newConfigs.push({ round_id: selectedRoundId, column_id: colId, ...cleanSettings });
                    }
                });
                return newConfigs;
            });

        } else {
            // Apply only to selected round (e.g., openings)
            const upserts = selectedColIds.map(colId => {
                const existing = columnConfigs.find((c: any) => c.column_id === colId) || { round_id: selectedRoundId, column_id: colId };
                return { ...existing, ...cleanSettings };
            });
            
            await supabase.from('column_configs').upsert(upserts, { onConflict: 'round_id,column_id' });
                
            setColumnConfigs((prev: any[]) => {
                const newConfigs = [...prev];
                selectedColIds.forEach(colId => {
                    const idx = newConfigs.findIndex(c => c.column_id === colId);
                    if (idx >= 0) {
                        newConfigs[idx] = { ...newConfigs[idx], ...cleanSettings };
                    } else {
                        newConfigs.push({ round_id: selectedRoundId, column_id: colId, ...cleanSettings });
                    }
                });
                return newConfigs;
            });
        }
        
        await refreshRounds();
        alert(`${selectedColIds.length} colonnes mises à jour !`);
    } catch (e: any) { alert("Erreur bulk action : " + e.message); } finally { setIsUpdating(false); }
  };

  const toggleSelectAll = () => {
    if (selectedColIds.length === COLUMNS.length) setSelectedColIds([]);
    else setSelectedColIds(COLUMNS.map(c => c.id));
  };

  const toggleSelectCol = (id: number) => {
    setSelectedColIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const syncGlobalSettingsToAllRounds = async () => {
    if (!window.confirm("Voulez-vous vraiment appliquer les paramètres globaux (Libellé, Type, Site, Horaires, Couleur) de ce tour à TOUS les autres tours ? Les ouvertures (W/S/D) ne seront pas modifiées.")) return;

    setIsUpdating(true);
    try {
        // 1. Get current round's configs
        const currentConfigs = columnConfigs.filter(c => c.round_id === selectedRoundId);

        // 2. Fetch ALL configs from DB to preserve round-specific settings
        const { data: allConfigs, error: fetchError } = await supabase.from('column_configs').select('*');
        if (fetchError) throw fetchError;

        // 3. Prepare upsert payload
        const upsertPayload: any[] = [];

        allRounds.forEach((round: Round) => {
            if (round.id === selectedRoundId) return; // Skip current round

            COLUMNS.forEach(col => {
                const currentRoundColConfig = currentConfigs.find(c => c.column_id === col.id);
                if (!currentRoundColConfig) return;

                const existingOtherRoundConfig = allConfigs?.find(c => c.round_id === round.id && c.column_id === col.id) || {
                    round_id: round.id,
                    column_id: col.id,
                    open_normal_w: true, open_normal_s: true, open_normal_d: true,
                    open_bad_w: true, open_bad_s: true, open_bad_d: true,
                    open_good_w: true, open_good_s: true, open_good_d: true,
                };

                upsertPayload.push({
                    ...existingOtherRoundConfig,
                    custom_label: currentRoundColConfig.custom_label,
                    custom_header_label: currentRoundColConfig.custom_header_label,
                    custom_type: currentRoundColConfig.custom_type,
                    custom_site: currentRoundColConfig.custom_site,
                    custom_time_range: currentRoundColConfig.custom_time_range,
                    custom_color: currentRoundColConfig.custom_color,
                });
            });
        });

        if (upsertPayload.length > 0) {
            const { error: upsertError } = await supabase.from('column_configs').upsert(upsertPayload, { onConflict: 'round_id,column_id' });
            if (upsertError) throw upsertError;
        }

        alert("Paramètres globaux synchronisés sur tous les tours avec succès !");
    } catch (e: any) {
        console.error(e);
        alert("Erreur lors de la synchronisation : " + e.message);
    } finally {
        setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      <div className="p-4 md:p-6 bg-white border-b flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center justify-between shrink-0">
         <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full md:w-auto">
             <div className="flex flex-col">
                 <label className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Tour</label>
                 <div className="flex items-center gap-3">
                     <select value={selectedRoundId} onChange={e => setSelectedRoundId(Number(e.target.value))} className="bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 ring-blue-50 min-w-[200px]">
                        {allRounds.map((r: Round) => <option key={r.id} value={r.id}>{r.title}</option>)}
                     </select>
                     {round && !round.isActive && (
                         <button onClick={setRoundActive} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all whitespace-nowrap">Activer ce tour</button>
                     )}
                 </div>
             </div>
             
             <div className="hidden md:block w-px h-10 bg-slate-200"></div>

             <div className="flex flex-col">
                 <label className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Tour actuellement actif</label>
                 {isGloballyLocked ? (
                     <div className="text-sm font-black text-red-600 flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                         SYSTÈME VERROUILLÉ
                     </div>
                 ) : (
                     <div className="text-sm font-black text-emerald-600 flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                         {allRounds.find(r => r.isActive)?.title || "Aucun"}
                     </div>
                 )}
             </div>

             <div className="hidden md:block w-px h-10 bg-slate-200"></div>

             <div className="flex flex-col">
                 <label className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Verrouillage Global</label>
                 <label className="flex items-center gap-3 cursor-pointer">
                     <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isGloballyLocked ? 'bg-red-500' : 'bg-slate-200'}`} onClick={toggleGlobalLock}>
                         <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isGloballyLocked ? 'translate-x-6' : ''}`}></div>
                     </div>
                     <span className={`text-xs font-bold ${isGloballyLocked ? 'text-red-600' : 'text-slate-400'}`}>{isGloballyLocked ? 'VERROUILLÉ' : 'DÉVERROUILLÉ'}</span>
                 </label>
             </div>

             <div className="hidden md:block w-px h-10 bg-slate-200"></div>

             <div className="flex flex-col">
                 <label className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Autoriser les échanges</label>
                 <label className="flex items-center gap-3 cursor-pointer">
                     <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isExchangesAllowed ? 'bg-green-500' : 'bg-slate-200'}`} onClick={toggleExchanges}>
                         <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isExchangesAllowed ? 'translate-x-6' : ''}`}></div>
                     </div>
                     <span className={`text-xs font-bold ${isExchangesAllowed ? 'text-green-600' : 'text-slate-400'}`}>{isExchangesAllowed ? 'AUTORISÉ' : 'INTERDIT'}</span>
                 </label>
             </div>
             
             <div className="hidden md:block w-px h-10 bg-slate-200"></div>

             <div className="flex flex-col">
                 <label className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Autoriser la prise de garde</label>
                 <label className="flex items-center gap-3 cursor-pointer">
                     <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isTakesAllowed ? 'bg-green-500' : 'bg-slate-200'}`} onClick={toggleTakes}>
                         <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isTakesAllowed ? 'translate-x-6' : ''}`}></div>
                     </div>
                     <span className={`text-xs font-bold ${isTakesAllowed ? 'text-green-600' : 'text-slate-400'}`}>{isTakesAllowed ? 'AUTORISÉE' : 'INTERDITE'}</span>
                 </label>
             </div>
         </div>
         <div className="flex gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveSubTab('general')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'general' ? 'bg-slate-800 text-white' : 'bg-white border hover:bg-slate-50'}`}>Général</button>
            <button onClick={() => setActiveSubTab('columns')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'columns' ? 'bg-slate-800 text-white' : 'bg-white border hover:bg-slate-50'}`}>Colonnes</button>
         </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        {activeSubTab === 'general' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Access Controls */}
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Accès Titulaires</h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${round?.isActiveDoctors ? 'bg-blue-600' : 'bg-slate-200'}`} onClick={() => updateRoundFlags({ isActiveDoctors: !round?.isActiveDoctors })}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${round?.isActiveDoctors ? 'translate-x-6' : ''}`}></div>
                            </div>
                            <span className={`text-xs font-bold ${round?.isActiveDoctors ? 'text-blue-600' : 'text-slate-400'}`}>{round?.isActiveDoctors ? 'OUVERT' : 'FERMÉ'}</span>
                        </label>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Accès Remplaçants</h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${round?.isActiveSubstitutes ? 'bg-orange-500' : 'bg-slate-200'}`} onClick={() => updateRoundFlags({ isActiveSubstitutes: !round?.isActiveSubstitutes })}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${round?.isActiveSubstitutes ? 'translate-x-6' : ''}`}></div>
                            </div>
                            <span className={`text-xs font-bold ${round?.isActiveSubstitutes ? 'text-orange-600' : 'text-slate-400'}`}>{round?.isActiveSubstitutes ? 'OUVERT' : 'FERMÉ'}</span>
                        </label>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest" title="Tolérance de chevauchement entre gardes (en minutes)">Tolérance Chevauchement</h3>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                min="0" 
                                step="15"
                                className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={round?.maxOverlapMinutes || 0}
                                onChange={(e) => updateRoundFlags({ maxOverlapMinutes: parseInt(e.target.value) || 0 })}
                            />
                            <span className="text-xs font-bold text-slate-400">min</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest" title="Permet aux médecins de reproduire leurs choix d'une étape précédente">Reproductibilité des choix</h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${round?.allow_choice_reproduction ? 'bg-emerald-500' : 'bg-slate-200'}`} onClick={() => updateRoundFlags({ allow_choice_reproduction: !round?.allow_choice_reproduction })}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${round?.allow_choice_reproduction ? 'translate-x-6' : ''}`}></div>
                            </div>
                            <span className={`text-xs font-bold ${round?.allow_choice_reproduction ? 'text-emerald-600' : 'text-slate-400'}`}>{round?.allow_choice_reproduction ? 'ACTIVÉ' : 'DÉSACTIVÉ'}</span>
                        </label>
                    </div>
                </div>
                
                <div className="bg-white p-6 md:p-8 rounded-3xl border shadow-sm space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black uppercase tracking-tight">Tête de Liste (Paramètre Commun)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Médecin Tête de Liste</label>
                             <select 
                                value={shiftGlobalSettings?.head_doctor_trigram || ''} 
                                onChange={async (e) => {
                                    const val = e.target.value || null;
                                    await supabase.from('shift_global_settings').update({ head_doctor_trigram: val }).eq('id', 1);
                                    refreshRounds();
                                    logAction('MODIFICATION_TETE_LISTE', { type: 'MEDECIN', trigram: val || 'Aucun' });
                                }} 
                                className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none text-slate-900"
                             >
                                <option value="">Aucun</option>
                                {users.filter((u: any) => u.role === 'DOCTOR').map((u: any) => (
                                    <option key={u.trigram} value={u.trigram}>{u.trigram}</option>
                                ))}
                             </select>
                        </div>
                        <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Remplaçant Tête de Liste</label>
                             <select 
                                value={shiftGlobalSettings?.head_substitute_trigram || ''} 
                                onChange={async (e) => {
                                    const val = e.target.value || null;
                                    await supabase.from('shift_global_settings').update({ head_substitute_trigram: val }).eq('id', 1);
                                    refreshRounds();
                                    logAction('MODIFICATION_TETE_LISTE', { type: 'REMPLACANT', trigram: val || 'Aucun' });
                                }} 
                                className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none text-slate-900"
                             >
                                <option value="">Aucun</option>
                                {users.filter((u: any) => u.role === 'SUBSTITUTE').map((u: any) => (
                                    <option key={u.trigram} value={u.trigram}>{u.trigram}</option>
                                ))}
                             </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-3xl border shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                         <h3 className="text-lg font-black uppercase tracking-tight">Période du Planning</h3>
                         <button onClick={saveGlobalPeriod} className="w-full md:w-auto px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">Appliquer à tous les tours</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mois de début</label>
                             <select value={period.month} onChange={e => setPeriod({...period, month: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none text-slate-900">
                                {Array.from({length: 12}, (_, i) => i).map(m => (
                                    <option key={m} value={m}>{new Date(2024, m, 1).toLocaleDateString('fr-FR', { month: 'long' })}</option>
                                ))}
                             </select>
                        </div>
                        <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Année</label>
                             <input type="number" value={period.year} onChange={e => setPeriod({...period, year: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none text-slate-900" />
                        </div>
                        <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nombre de mois</label>
                             <input type="number" value={period.numMonths} onChange={e => setPeriod({...period, numMonths: Number(e.target.value)})} min={1} max={12} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none text-slate-900" />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 md:p-8 rounded-3xl border shadow-sm space-y-6">
                    {/* ... (Round Specifics UI - Same as before) */}
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black uppercase tracking-tight">Configuration du Tour</h3>
                        <button onClick={saveRoundSpecifics} className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all">Sauvegarder Tout</button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nom du Tour (Visible dans le menu)</label>
                        <input type="text" value={roundTitle} onChange={e => setRoundTitle(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-blue-50 text-slate-900" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Message Général</label>
                        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-medium outline-none focus:ring-2 ring-blue-50 h-24 resize-none text-slate-900" placeholder="Instructions visibles par tous..."></textarea>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        {/* Steps config */}
                        <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black uppercase tracking-widest text-orange-600">Étape 1 : Gardes Cibles</h4>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" checked={stepConfig.normal.active} onChange={e => setStepConfig({...stepConfig, normal: {...stepConfig.normal, active: e.target.checked}})} />
                                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>
                            <textarea value={stepConfig.normal.instructions} onChange={e => setStepConfig({...stepConfig, normal: {...stepConfig.normal, instructions: e.target.value}})} className="w-full p-3 bg-white border border-orange-200 rounded-xl text-xs outline-none text-slate-900 h-20 resize-none" placeholder="Consignes spécifiques..."></textarea>
                        </div>
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black uppercase tracking-widest text-blue-600">Étape 2 : Bonnes Gardes</h4>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" checked={stepConfig.good.active} onChange={e => setStepConfig({...stepConfig, good: {...stepConfig.good, active: e.target.checked}})} />
                                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            </div>
                            <textarea value={stepConfig.good.instructions} onChange={e => setStepConfig({...stepConfig, good: {...stepConfig.good, instructions: e.target.value}})} className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs outline-none text-slate-900 h-20 resize-none" placeholder="Consignes spécifiques..."></textarea>
                        </div>
                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600">Étape 3 : Gardes Normales</h4>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" checked={stepConfig.bad.active} onChange={e => setStepConfig({...stepConfig, bad: {...stepConfig.bad, active: e.target.checked}})} />
                                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                </label>
                            </div>
                            <textarea value={stepConfig.bad.instructions} onChange={e => setStepConfig({...stepConfig, bad: {...stepConfig.bad, instructions: e.target.value}})} className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-xs outline-none text-slate-900 h-20 resize-none" placeholder="Consignes spécifiques..."></textarea>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {activeSubTab === 'columns' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                 <div className="flex justify-end">
                    <button 
                        onClick={syncGlobalSettingsToAllRounds}
                        disabled={isUpdating}
                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 2v6h-6"></path>
                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                            <path d="M3 22v-6h6"></path>
                            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                        </svg>
                        Appliquer ces paramètres globaux à tous les tours
                    </button>
                 </div>
                 {/* Columns content (omitted repeated parts for brevity but including full structure) */}
                 <div className="bg-white p-4 md:p-6 rounded-3xl border shadow-sm sticky top-0 z-20">
                    {/* Bulk controls ... */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Modification Groupée</h3>
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{selectedColIds.length} col.</span>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                             <button onClick={toggleSelectAll} className="flex-1 md:flex-none text-[10px] font-bold uppercase text-slate-500 hover:text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">
                                {selectedColIds.length === COLUMNS.length ? 'Rien' : 'Tout'}
                             </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4 pb-4 border-b border-slate-100">
                        <input type="text" placeholder="Libellé..." value={bulkLabel} onChange={e => setBulkLabel(e.target.value)} className="p-2 border rounded-xl text-xs font-bold text-slate-900 bg-white" />
                        <input type="text" placeholder="En-tête..." value={bulkHeaderLabel} onChange={e => setBulkHeaderLabel(e.target.value)} className="p-2 border rounded-xl text-xs font-bold text-slate-900 bg-white" />
                        <select value={bulkType} onChange={e => setBulkType(e.target.value as any)} className="p-2 border rounded-xl text-xs font-bold text-slate-900 bg-white">
                            <option value="">Type...</option>
                            {Object.values(GuardType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="text" placeholder="Horaires..." value={bulkTime} onChange={e => setBulkTime(e.target.value)} className="p-2 border rounded-xl text-xs font-bold text-slate-900 bg-white" />
                        <select value={bulkSite} onChange={e => setBulkSite(e.target.value as any)} className="p-2 border rounded-xl text-xs font-bold text-slate-900 bg-white">
                            <option value="">Site...</option>
                            {Object.values(Site).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                            <input type="color" value={bulkColor} onChange={e => setBulkColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-white" />
                            <button onClick={() => applyBulkAction({ custom_label: bulkLabel, custom_header_label: bulkHeaderLabel, custom_type: bulkType, custom_time_range: bulkTime, custom_site: bulkSite, custom_color: bulkColor })} className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50" disabled={selectedColIds.length === 0}>Appliquer Props</button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 w-24 shrink-0">Ouvertures :</span>
                        <div className="flex gap-4 flex-1 w-full justify-start overflow-x-auto no-scrollbar">
                            {/* Normal Group */}
                            <div className="flex gap-1 bg-orange-50 p-1.5 rounded-lg border border-orange-100">
                                <span className="text-[8px] font-bold text-orange-400 self-center mr-1">CIBLE</span>
                                {['w', 's', 'd'].map(d => (
                                    <button 
                                        key={d}
                                        onClick={() => setBulkOpenings((prev: any) => ({...prev, [`open_normal_${d}`]: !prev[`open_normal_${d}`]}))}
                                        className={`w-7 h-7 rounded-md text-[9px] font-black uppercase border transition-all ${bulkOpenings[`open_normal_${d}`] ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-slate-300 border-slate-200'}`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                            {/* Good Group */}
                            <div className="flex gap-1 bg-blue-50 p-1.5 rounded-lg border border-blue-100">
                                <span className="text-[8px] font-bold text-blue-400 self-center mr-1">BONNE</span>
                                {['w', 's', 'd'].map(d => (
                                    <button 
                                        key={d}
                                        onClick={() => setBulkOpenings((prev: any) => ({...prev, [`open_good_${d}`]: !prev[`open_good_${d}`]}))}
                                        className={`w-7 h-7 rounded-md text-[9px] font-black uppercase border ${bulkOpenings[`open_good_${d}`] ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-300 border-slate-200'}`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                            {/* Bad Group */}
                            <div className="flex gap-1 bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
                                <span className="text-[8px] font-bold text-indigo-400 self-center mr-1">NORMALE</span>
                                {['w', 's', 'd'].map(d => (
                                    <button 
                                        key={d}
                                        onClick={() => setBulkOpenings((prev: any) => ({...prev, [`open_bad_${d}`]: !prev[`open_bad_${d}`]}))}
                                        className={`w-7 h-7 rounded-md text-[9px] font-black uppercase border transition-all ${bulkOpenings[`open_bad_${d}`] ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-300 border-slate-200'}`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => applyBulkAction(bulkOpenings)} className="shrink-0 px-4 py-2 bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-600 transition-all disabled:opacity-50" disabled={selectedColIds.length === 0}>Appliquer Ouvertures</button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-max min-w-full text-left border-collapse">
                            <thead className="bg-slate-900 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b border-slate-800 w-10">
                                        <input type="checkbox" checked={selectedColIds.length === COLUMNS.length && COLUMNS.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 bg-white" />
                                    </th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-12 text-white">ID</th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-32 text-white">Libellé</th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-24 text-white">Lib. En-tête</th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-32 text-white">Type</th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-32 text-white">Site</th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-32 text-white">Horaires</th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-20 text-center text-white">Couleur</th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-24 text-center bg-orange-50/10 text-orange-200">Cible</th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-24 text-center bg-blue-50/10 text-blue-200">Bonne</th>
                                    <th className="p-4 border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest w-24 text-center bg-indigo-50/10 text-indigo-200">Normale</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {COLUMNS.map(col => {
                                    const cfg = columnConfigs.find((c: any) => c.column_id === col.id);
                                    const label = cfg?.custom_label ?? col.label;
                                    const headerLabel = cfg?.custom_header_label ?? '';
                                    const type = cfg?.custom_type ?? col.type;
                                    const site = cfg?.custom_site ?? col.site;
                                    const timeRange = cfg?.custom_time_range ?? col.timeRange;
                                    const color = cfg?.custom_color ?? getDefaultColor(col.colorClass);
                                    const getOpen = (field: string) => cfg ? cfg[field] : true;
                                    
                                    return (
                                        <tr key={`${selectedRoundId}-${col.id}`} className="hover:bg-slate-50">
                                            <td className="p-4 align-middle">
                                                <input type="checkbox" checked={selectedColIds.includes(col.id)} onChange={() => toggleSelectCol(col.id)} className="w-4 h-4 rounded border-slate-300 bg-white" />
                                            </td>
                                            <td className="p-4 font-mono text-xs text-slate-400 font-bold">{col.id}</td>
                                            <td className="p-2">
                                                <input type="text" value={label} onChange={e => updateCol(col.id, 'custom_label', e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-900 bg-white" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={headerLabel} onChange={e => updateCol(col.id, 'custom_header_label', e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-900 bg-white" placeholder={label} />
                                            </td>
                                            <td className="p-2">
                                                <select value={type} onChange={e => updateCol(col.id, 'custom_type', e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-900 bg-white">
                                                    {Object.values(GuardType).map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <select value={site} onChange={e => updateCol(col.id, 'custom_site', e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-900 bg-white">
                                                    {Object.values(Site).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={timeRange} onChange={e => updateCol(col.id, 'custom_time_range', e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold text-slate-900 bg-white" />
                                            </td>
                                            <td className="p-2 text-center">
                                                <div className="flex justify-center">
                                                    <input type="color" value={color} onChange={e => updateCol(col.id, 'custom_color', e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer bg-white" />
                                                </div>
                                            </td>
                                            <td className="p-2 bg-orange-50/30">
                                                <div className="flex gap-1 justify-center">
                                                    {['w', 's', 'd'].map(d => (
                                                        <button 
                                                            key={d}
                                                            onClick={() => updateCol(col.id, `open_normal_${d}`, !getOpen(`open_normal_${d}`))}
                                                            className={`w-6 h-6 rounded text-[9px] font-black uppercase border ${getOpen(`open_normal_${d}`) ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-slate-300 border-slate-200'}`}
                                                            title={d === 'w' ? 'Semaine' : d === 's' ? 'Samedi' : 'Dimanche'}
                                                        >
                                                            {d}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-2 bg-blue-50/30">
                                                <div className="flex gap-1 justify-center">
                                                    {['w', 's', 'd'].map(d => (
                                                        <button 
                                                            key={d}
                                                            onClick={() => updateCol(col.id, `open_good_${d}`, !getOpen(`open_good_${d}`))}
                                                            className={`w-6 h-6 rounded text-[9px] font-black uppercase border ${getOpen(`open_good_${d}`) ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-300 border-slate-200'}`}
                                                        >
                                                            {d}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-2 bg-indigo-50/30">
                                                <div className="flex gap-1 justify-center">
                                                    {['w', 's', 'd'].map(d => (
                                                        <button 
                                                            key={d}
                                                            onClick={() => updateCol(col.id, `open_bad_${d}`, !getOpen(`open_bad_${d}`))}
                                                            className={`w-6 h-6 rounded text-[9px] font-black uppercase border ${getOpen(`open_bad_${d}`) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-300 border-slate-200'}`}
                                                        >
                                                            {d}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export const PlanningPanel = ({ choices, setChoices, users, activeRound, columnConfigs, headerConfigs, supabase, globalClosures, setGlobalClosures, logAction, onCellClick, overrideAdminMode, highlightCell, highlightCells }: any) => {
  const [editingCell, setEditingCell] = useState<{row: number, col: number, month: number, year: number} | null>(null);
  const [selectedUserTrigram, setSelectedUserTrigram] = useState('');
  const [isEditClosuresMode, setIsEditClosuresMode] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ day: number, month: number, year: number, colId: number, colLabel: string, colType: string } | null>(null);
  const [highlightedTrigram, setHighlightedTrigram] = useState<string | null>(null);

  const monthsToDisplay = useMemo(() => {
    const list = [];
    if (!activeRound) return [];
    const startM = activeRound.monthStart ?? 0;
    const startY = activeRound.yearStart ?? 2025;
    for (let i = 0; i < (activeRound.numMonths || 1); i++) {
        const d = new Date(startY, startM + i, 1);
        list.push({ month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }) });
    }
    return list;
  }, [activeRound]);

  const dynamicColumns = useMemo(() => {
    return COLUMNS.map(col => {
      const cfg = columnConfigs.find((c: any) => c.column_id === col.id);
      return {
        ...col,
        label: cfg?.custom_label || col.label,
        headerLabel: cfg?.custom_header_label || col.headerLabel,
        type: (cfg?.custom_type as any) || col.type,
        site: (cfg?.custom_site as any) || col.site,
        timeRange: cfg?.custom_time_range || col.timeRange,
        customColor: cfg?.custom_color || getDefaultColor(col.colorClass) || '#FFFFFF'
      };
    });
  }, [columnConfigs]);

  const handleCellClick = async (row: number, colId: number, month: number, year: number) => {
      if (overrideAdminMode) {
          if (onCellClick) {
              const assigned = choices.find((c: any) => c.row === row && c.col === colId && c.month === month && c.year === year && c.status === 'ASSIGNED');
              onCellClick({ row, col: colId, month, year, assigned });
          }
          return;
      }
      if (isEditClosuresMode) {
          const existing = globalClosures.find((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
          if (existing) {
              await supabase.from('global_closures').delete().eq('id', existing.id);
              setGlobalClosures((prev: any[]) => prev.filter(gc => gc.id !== existing.id));
          } else {
              const { data, error } = await supabase.from('global_closures').insert({ col_id: colId, row, month: month + 1, year }).select();
              if (data && !error) setGlobalClosures((prev: any[]) => [...prev, { ...data[0], month: data[0].month - 1 }]);
          }
          return;
      }

      const isClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
      if (isClosed) {
          alert("Cette case est fermée.");
          return;
      }

      const assignedChoice = choices.find((c: any) => c.row === row && c.col === colId && c.month === month && c.year === year && c.status === 'ASSIGNED');

      if (assignedChoice) {
          if (window.confirm(`Retirer la garde du Dr ${assignedChoice.userTrigram} ?`)) {
              const { error } = await supabase.from('choices').delete().eq('id', assignedChoice.id);
              if (!error) {
                  setChoices((prev: any[]) => prev.filter((c: any) => c.id !== assignedChoice.id));
                  logAction('SUPPRESSION_GARDE', { user: assignedChoice.userTrigram, date: `${row}/${month+1}/${year}`, col: colId });
              } else {
                  alert("Erreur lors de la suppression");
              }
          }
      } else {
          // Open Modal for Assignment
          setEditingCell({ row, col: colId, month, year });
          setSelectedUserTrigram('');
      }
  };

  const handleAssignment = async () => {
      if (!editingCell || !selectedUserTrigram) return;
      
      const cleanTri = selectedUserTrigram.trim().toUpperCase();
      const user = users.find((u: any) => u.trigram === cleanTri);
      
      if (!user) {
          alert("Médecin introuvable !");
          return;
      }

      const colConfig = columnConfigs.find((c: any) => c.column_id === editingCell.col);
      const baseColDef = COLUMNS.find(c => c.id === editingCell.col);
      const finalTimeRange = colConfig?.custom_time_range || baseColDef?.timeRange || '';
      const maxOverlapMinutes = activeRound?.maxOverlapMinutes || 0;

      const assigned = choices.filter((c: any) => 
          c.userTrigram === cleanTri && 
          c.month === editingCell.month && 
          c.year === editingCell.year && 
          c.status === 'ASSIGNED'
      );

      for (const assignedChoice of assigned) {
          const existingTimeRange = assignedChoice.colTimeRange || COLUMNS.find(c => c.id === assignedChoice.col)?.timeRange;
          if (existingTimeRange && doRangesOverlap(editingCell.row, finalTimeRange, assignedChoice.row, existingTimeRange, maxOverlapMinutes)) {
              alert(`⚠️ ACTION BLOQUÉE : Le Dr ${cleanTri} a déjà une garde attribuée sur des horaires incompatibles (${existingTimeRange}).`);
              return;
          }
      }

      const pending = choices.find((c: any) => c.row === editingCell.row && c.col === editingCell.col && c.month === editingCell.month && c.year === editingCell.year && c.userTrigram === cleanTri);

      if (pending) {
          const { error } = await supabase.from('choices').update({ status: 'ASSIGNED' }).eq('id', pending.id);
          if (!error) {
              setChoices((prev: any[]) => prev.map((c: any) => c.id === pending.id ? { ...c, status: 'ASSIGNED' } : c));
              logAction('VALIDATION_GARDE', { user: cleanTri, date: `${editingCell.row}/${editingCell.month+1}/${editingCell.year}`, col: editingCell.col });
          }
      } else {
          const newPayload = {
              id: generateId(),
              row: editingCell.row, col: editingCell.col, month: editingCell.month + 1, year: editingCell.year,
              user_trigram: cleanTri,
              user_role: user.role,
              status: 'ASSIGNED',
              round_id: activeRound.id || 0,
              group_index: 1, sub_rank: 1, category: 'normal',
              submitted_at: new Date().toISOString()
          };
          
          const { data, error } = await supabase.from('choices').insert(newPayload).select();
          if (!error && data) {
              const newChoice: Choice = {
                  id: data[0].id,
                  row: data[0].row, col: data[0].col, month: data[0].month - 1, year: data[0].year,
                  groupIndex: data[0].group_index, subRank: data[0].sub_rank, category: data[0].category,
                  userTrigram: data[0].user_trigram, userRole: data[0].user_role,
                  status: data[0].status, submittedAt: data[0].submitted_at, roundId: data[0].round_id,
                  colLabel: data[0].col_label, colType: data[0].col_type, colTimeRange: data[0].col_time_range
              };
              setChoices((prev: any[]) => [...prev, newChoice]);
              logAction('ASSIGNATION_MANUELLE', { user: cleanTri, date: `${editingCell.row}/${editingCell.month+1}/${editingCell.year}`, col: editingCell.col });
          } else {
              console.error(error);
              alert("Erreur lors de l'attribution");
          }
      }
      setEditingCell(null);
  };

  const handleColumnClick = async (colId: number, month: number, year: number) => {
      if (!isEditClosuresMode) return;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const closedDays = globalClosures.filter((gc: any) => gc.col_id === colId && gc.month === month && gc.year === year && gc.row !== null);

      if (closedDays.length === daysInMonth) {
          // All days are closed -> Open them all (delete all)
          const idsToDelete = closedDays.map(gc => gc.id);
          await supabase.from('global_closures').delete().in('id', idsToDelete);
          setGlobalClosures((prev: any[]) => prev.filter(gc => !idsToDelete.includes(gc.id)));
      } else {
          // Not all days are closed -> Close the missing ones
          const missingDays = [];
          for (let d = 1; d <= daysInMonth; d++) {
              if (!closedDays.some(gc => gc.row === d)) {
                  missingDays.push({ col_id: colId, row: d, month: month + 1, year });
              }
          }
          const { data, error } = await supabase.from('global_closures').insert(missingDays).select();
          if (data && !error) {
              const formattedData = data.map((d: any) => ({ ...d, month: d.month - 1 }));
              setGlobalClosures((prev: any[]) => [...prev, ...formattedData]);
          }
      }
  };

  const handleCreateVersion = async () => {
    const rawAssignedChoices = choices.filter((c: any) => c.status === 'ASSIGNED');
    const assignedChoices = rawAssignedChoices.filter((a: any, index: number, self: any[]) => 
        index === self.findIndex((t: any) => t.row === a.row && t.col === a.col && t.userTrigram === a.userTrigram && t.month === a.month && t.year === a.year)
    );

    if (assignedChoices.length === 0) {
      alert("Aucune garde n'est actuellement attribuée.");
      return;
    }

    try {
      const versionName = await generateAutoVersionName(supabase, activeRound);
      
      const { error } = await supabase.from('planning_versions').insert({
        name: versionName,
        data: assignedChoices
      });
      if (error) {
        if (error.message.includes('relation "planning_versions" does not exist')) {
          alert("La table planning_versions n'existe pas. Veuillez aller dans l'onglet VERSIONS pour voir la configuration requise.");
        } else {
          console.error(error);
          alert("Erreur lors de la création de la version.");
        }
      } else {
        logAction('CREATE_VERSION', { name: versionName, count: assignedChoices.length });
        alert(`Version "${versionName}" créée avec succès (${assignedChoices.length} gardes).`);
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la création de la version.");
    }
  };

  return (
    <div className="flex-1 overflow-auto custom-scrollbar p-8 pb-32 relative">
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-3xl border shadow-sm">
            <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">{overrideAdminMode ? 'Planning (Sélectionnez une garde)' : 'Planning Global'}</h2>
                <p className="text-xs font-bold text-slate-400 mt-1">{overrideAdminMode ? 'Cliquez sur une case pour confirmer l\'abandon.' : 'Gérez les attributions ou fermez des cases pour tous les tours.'}</p>
            </div>
            {!overrideAdminMode && (
                <div className="flex gap-3">
                    <button 
                        onClick={handleCreateVersion}
                        className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100"
                    >
                        Créer une version
                    </button>
                    <button 
                        onClick={() => setIsEditClosuresMode(!isEditClosuresMode)}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${isEditClosuresMode ? 'bg-red-600 text-white shadow-red-200 hover:bg-red-700' : 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800'}`}
                    >
                        {isEditClosuresMode ? 'Terminer la fermeture' : 'Fermer des cases'}
                    </button>
                </div>
            )}
        </div>

        {/* Assignment Modal */}
        {editingCell && (
            <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 p-6">
                        <h3 className="text-white text-lg font-black uppercase tracking-tight">Attribuer la garde</h3>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">
                            Le {editingCell.row}/{editingCell.month + 1}/{editingCell.year} • Colonne {editingCell.col}
                        </p>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Médecin</label>
                            <div className="relative">
                                <select 
                                    value={selectedUserTrigram} 
                                    onChange={(e) => setSelectedUserTrigram(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-blue-500 appearance-none"
                                    autoFocus
                                >
                                    <option value="">Sélectionner...</option>
                                    <optgroup label="Titulaires">
                                        {users.filter((u:any) => u.role === 'DOCTOR').map((u:any) => (
                                            <option key={u.trigram} value={u.trigram}>{u.trigram}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Remplaçants">
                                        {users.filter((u:any) => u.role === 'SUBSTITUTE').map((u:any) => (
                                            <option key={u.trigram} value={u.trigram}>{u.trigram}</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setEditingCell(null)}
                                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={handleAssignment}
                                disabled={!selectedUserTrigram}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none"
                            >
                                Valider
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {monthsToDisplay.map(({ month, year, label }) => {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            let totalOpenCells = 0;
            let occupiedCells = 0;

            for (let day = 1; day <= daysInMonth; day++) {
                for (const col of dynamicColumns) {
                    const isClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === day && gc.month === month && gc.year === year);
                    
                    if (!isClosed) {
                        totalOpenCells++;
                        const assigned = choices.find((ch: any) => ch.row === day && ch.col === col.id && ch.month === month && ch.year === year && ch.status === 'ASSIGNED');
                        if (assigned) {
                            occupiedCells++;
                        }
                    }
                }
            }

            const freeCells = totalOpenCells - occupiedCells;
            const fillPercentage = totalOpenCells > 0 ? Math.round((occupiedCells / totalOpenCells) * 100) : 0;

            const activeUsersWithCounts = users.map((u: any) => {
                const userChoices = choices.filter((c: any) => c.userTrigram === u.trigram && c.status === 'ASSIGNED' && c.month === month && c.year === year);
                const uniqueChoices = userChoices.filter((a: any, index: number, self: any[]) => 
                    index === self.findIndex((t: any) => t.row === a.row && t.col === a.col)
                );
                const count = uniqueChoices.length;
                return { trigram: u.trigram, count, role: u.role };
            }).filter((u: any) => u.count > 0).sort((a: any, b: any) => a.trigram.localeCompare(b.trigram));

            const doctorCounters = activeUsersWithCounts.filter((u: any) => u.role === 'DOCTOR');
            const substituteCounters = activeUsersWithCounts.filter((u: any) => u.role === 'SUBSTITUTE');

            return (
                <div key={`${year}-${month}`} className="space-y-4 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{label}</h2>
                        <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-widest">
                            <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-2">
                                <span>Occupées: {occupiedCells}</span>
                            </div>
                            <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                                <span>Libres: {freeCells}</span>
                            </div>
                            <div className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-2">
                                <span>Remplissage: {fillPercentage}%</span>
                            </div>
                        </div>
                    </div>
                    {(doctorCounters.length > 0 || substituteCounters.length > 0) && (
                        <div className="flex flex-col gap-3 p-4 bg-white rounded-2xl border shadow-sm">
                            <div className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest">Compteurs de gardes acceptées</div>
                            
                            {doctorCounters.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Titulaires</div>
                                    <div className="flex flex-wrap gap-2">
                                        {doctorCounters.map((uc: any) => (
                                            <div 
                                                key={uc.trigram} 
                                                onClick={() => setHighlightedTrigram(prev => prev === uc.trigram ? null : uc.trigram)}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border flex items-center gap-1.5 cursor-pointer transition-all ${highlightedTrigram === uc.trigram ? 'ring-2 ring-yellow-400 scale-105 shadow-md z-10 ' : ''} bg-blue-50 text-blue-700 border-blue-100`}>
                                                <span>{uc.trigram}</span>
                                                <span className="px-1.5 py-0.5 rounded-md text-white bg-blue-600">{uc.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {substituteCounters.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">Remplaçants</div>
                                    <div className="flex flex-wrap gap-2">
                                        {substituteCounters.map((uc: any) => (
                                            <div 
                                                key={uc.trigram} 
                                                onClick={() => setHighlightedTrigram(prev => prev === uc.trigram ? null : uc.trigram)}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border flex items-center gap-1.5 cursor-pointer transition-all ${highlightedTrigram === uc.trigram ? 'ring-2 ring-yellow-400 scale-105 shadow-md z-10 ' : ''} bg-orange-50 text-orange-700 border-orange-100`}>
                                                <span>{uc.trigram}</span>
                                                <span className="px-1.5 py-0.5 rounded-md text-white bg-orange-500">{uc.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200">
                        <table className="w-max min-w-full border-separate border-spacing-0 table-fixed">
                            <MatrixHeader columns={dynamicColumns} isEditClosuresMode={isEditClosuresMode} onColumnClick={handleColumnClick} globalClosures={globalClosures} month={month} year={year} hoveredCell={hoveredCell} />
                            <tbody>
                                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                    const date = new Date(year, month, day);
                                    const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3).replace('.', '');
                                    const isSunday = date.getDay() === 0;
                                    const isHoliday = isPublicHoliday(date);
                                    const isOffDay = isSunday || isHoliday;
                                    
                                    const isHoveredRow = hoveredCell?.day === day && hoveredCell?.month === month && hoveredCell?.year === year;
                                    const rowHeaderBg = isHoveredRow ? 'bg-blue-100 text-blue-800' : (isOffDay ? 'bg-red-100 text-red-600' : 'bg-white text-slate-900');
                                    
                                    return (
                                        <tr key={day} className={`h-5 hover:bg-slate-50 ${isOffDay ? 'bg-red-50/30' : ''}`}>
                                            <td className={`sticky left-0 border-r border-b text-center z-10 w-20 md:w-16 h-5 font-black ${rowHeaderBg}`}>
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <span className="text-[7px] font-normal opacity-70">{dayName}</span>
                                                    <span className="text-[7px]">{day}</span>
                                                </div>
                                            </td>
                                            {dynamicColumns.map(col => {
                                                const isClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === day && gc.month === month && gc.year === year);
                                                
                                                const isHoveredCol = hoveredCell?.colId === col.id && hoveredCell?.month === month && hoveredCell?.year === year;
                                                const isCrosshair = isHoveredRow || isHoveredCol;
                                                
                                                const allHighlights = [...(highlightCells || []), ...(highlightCell ? [highlightCell] : [])];
                                                const isHighlightedCell = allHighlights.some((hc: any) => hc && hc.row === day && hc.col === col.id && hc.month === month && hc.year === year);
                                                
                                                const assigned = choices.find((ch: any) => ch.row === day && ch.col === col.id && ch.month === month && ch.year === year && ch.status === 'ASSIGNED');
                                                
                                                let bgColor = col.customColor || '#FFFFFF';
                                                
                                                const timeRange = parseTimeRange(col.timeRange);
                                                const isWeekendTime = isOffDay || (date.getDay() === 6 && timeRange && timeRange.end > 14 * 60);
                                                const isWeekendGuard = isWeekendTime && (col.type === 'Consultation' || col.type === 'Téléconsultation') && col.label !== 'PFG' && col.label !== 'TcN';
                                                
                                                if (isClosed) bgColor = '#fee2e2'; // red-100
                                                else if (assigned) {
                                                    if (highlightedTrigram && assigned.userTrigram === highlightedTrigram) {
                                                        bgColor = '#fef08a'; // yellow-300
                                                    } else {
                                                        bgColor = col.customColor || '#FFFFFF';
                                                    }
                                                } else {
                                                    // Cellule libre - 70% d'opacité
                                                    bgColor = col.customColor ? `${col.customColor}B3` : '#FFFFFFB3';
                                                }
                                                
                                                if (isWeekendGuard) {
                                                    bgColor = `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.1)), ${bgColor}`;
                                                }
                                                
                                                const style: React.CSSProperties = {
                                                    background: bgColor
                                                };
                                                
                                                return (
                                                    <td 
                                                        key={col.id} 
                                                        onMouseEnter={() => setHoveredCell({ day, month, year, colId: col.id, colLabel: col.label, colType: col.type })}
                                                        onMouseLeave={() => setHoveredCell(null)}
                                                        onClick={() => handleCellClick(day, col.id, month, year)}
                                                        className={`border-r border-b border-slate-200 text-center relative min-w-[60px] w-[60px] md:min-w-[28px] md:w-[28px] cursor-pointer transition-opacity align-middle overflow-hidden ${isEditClosuresMode ? 'hover:bg-red-200' : 'hover:opacity-80'} ${isCrosshair ? 'after:absolute after:inset-0 after:bg-blue-500/10 after:pointer-events-none' : ''} ${isHighlightedCell ? 'ring-4 ring-yellow-400 ring-inset z-20 bg-yellow-300 shadow-[0_0_15px_6px_rgba(250,204,21,0.6)] animate-[pulse_1s_ease-in-out_infinite]' : ''}`} 
                                                        style={style}
                                                    >
                                                        {isClosed && (
                                                            <svg className="absolute inset-0 w-full h-full text-red-400/60 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                                                                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="4" />
                                                                <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="4" />
                                                            </svg>
                                                        )}
                                                        {!isClosed && assigned && <span className="text-[14px] md:text-[11px] font-black text-slate-900 block leading-none tracking-tighter drop-shadow-sm relative z-10">{assigned.userTrigram}</span>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        })}

        {hoveredCell && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 text-xs md:text-sm font-bold pointer-events-none border border-slate-700/50 animate-in fade-in slide-in-from-bottom-4">
                <span className="text-blue-400 whitespace-nowrap">
                    {new Date(hoveredCell.year, hoveredCell.month, hoveredCell.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
                <span className="text-emerald-400 whitespace-nowrap">{hoveredCell.colType}</span>
                <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
                <span className="text-orange-400 whitespace-nowrap">Col {hoveredCell.colId}</span>
                <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
                <span className="whitespace-nowrap">{hoveredCell.colLabel}</span>
            </div>
        )}
    </div>
  );
};

const WishesPanel = ({ choices, setChoices, supabase, onRequestHelp, activeRound, logAction, users }: any) => {
    const [subTab, setSubTab] = useState<'journal' | 'data' | 'history'>('journal');
    const [showExportModal, setShowExportModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'ASSIGNED' | 'REFUSED'>('ALL');
    const [isDragging, setIsDragging] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'default', direction: 'asc' });
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [logs, setLogs] = useState<any[]>([]);
    const [logFilter, setLogFilter] = useState<'ALL' | 'SYSTEM' | 'USERS' | 'GUARDS'>('ALL');
    
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importType, setImportType] = useState<'CLASSIC' | '4D'>('CLASSIC');
    const [importTargetMonth, setImportTargetMonth] = useState<string>('ALL');
    const [show4DExportModal, setShow4DExportModal] = useState(false);
    const [selected4DMonthYear, setSelected4DMonthYear] = useState<string>('ALL');
    const [isCompareDragging, setIsCompareDragging] = useState(false);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareData, setCompareData] = useState<any[] | null>(null);
    const [compareMonthYear, setCompareMonthYear] = useState<string>('ALL');
    const [resolvedCompareCells, setResolvedCompareCells] = useState<Record<string, boolean>>({});
    const [isCompareFullscreen, setIsCompareFullscreen] = useState(false);
    const [showCompareCounters, setShowCompareCounters] = useState(false);

    useEffect(() => {
        if (subTab === 'history') {
            const fetchLogs = async () => {
                const { data } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(1000);
                if (data) setLogs(data);
            };
            fetchLogs();
        }
    }, [subTab, supabase]);

    const filteredLogs = useMemo(() => {
        if (logFilter === 'ALL') return logs;
        return logs.filter(log => {
            if (logFilter === 'SYSTEM') return ['VIDER_BASE', 'CHANGEMENT_TOUR_ACTIF', 'VERROUILLAGE_GLOBAL', 'VERROUILLAGE_TOUR', 'MODIFICATION_PERIODE', 'MODIFICATION_TETE_LISTE'].includes(log.action);
            if (logFilter === 'USERS') return ['AJOUT_UTILISATEUR', 'MODIFICATION_UTILISATEUR', 'SUPPRESSION_UTILISATEUR'].includes(log.action);
            if (logFilter === 'GUARDS') return ['SUPPRESSION_GARDE', 'VALIDATION_GARDE', 'ASSIGNATION_MANUELLE', 'SUPPRESSION_VOEU'].includes(log.action);
            return true;
        });
    }, [logs, logFilter]);
    
    // Compare File Logic
    const handleCompareDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsCompareDragging(true);
    };
    const handleCompareDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsCompareDragging(false);
    };
    const handleCompareDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsCompareDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processCompareFile(file);
    };
    const handleCompareFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processCompareFile(file);
        if (e.target) e.target.value = '';
    };
    
    const processCompareFile = (file: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            const lines = text.split('\n').filter(l => l.trim());
            let rows = lines;
            const firstLine = lines[0]?.toLowerCase() || '';
            if (firstLine.includes('trigram') || firstLine.includes('id') || firstLine.includes('date') || firstLine.includes('med')) {
                rows = lines.slice(1);
            }
            if (rows.length === 0) return;

            const imported = rows.map(line => {
                let cols = line.split('\t').map(c => c.replace(/^"|"$/g, '').trim());
                if (cols.length < 8) cols = line.split(';').map(c => c.replace(/^"|"$/g, '').trim());
                if (cols.length < 8) {
                    const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
                    const matches = line.match(regex) || [];
                    cols = matches.map(m => m.replace(/^"|"$/g, '').trim());
                }
                if (cols.length < 8) return null;
                const trigram = cols[0];
                if (trigram === 'ZZZ' || trigram === 'YYY' || trigram === 'XXX') return null;
                const dateParts = cols[1].split('/');
                if (dateParts.length !== 3) return null;
                const day = Number(dateParts[0]);
                const month = Number(dateParts[1]) - 1; // JS months are 0-indexed
                const year = Number(dateParts[2]);
                const colId = Number(cols[7]);
                if (isNaN(colId)) return null;

                return { trigram, day, month, year, colId };
            }).filter(x => x !== null);

            setCompareData(imported);
            
            // Set default month to the first available in the imported data
            const availableYMs = Array.from(new Set(imported.map((x: any) => `${x.year}-${x.month}`))).sort();
            if (availableYMs.length > 0) {
                setCompareMonthYear(availableYMs[0]);
            } else {
                setCompareMonthYear('ALL');
            }
            
            setShowCompareModal(true);
        };
        reader.readAsText(file);
    };

    // Process File Logic (Shared between Input and Drag&Drop)
    const processFileImport = (file: File, importType: 'CLASSIC' | '4D' = 'CLASSIC', targetMonthYear: string = 'ALL') => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            const lines = text.split('\n').filter(l => l.trim());
            
            // Skip header if present (assuming ID,Trigramme...)
            let rows = lines;
            const firstLine = lines[0]?.toLowerCase() || '';
            if (firstLine.includes('trigram') || firstLine.includes('id') || firstLine.includes('date') || firstLine.includes('med')) {
                rows = lines.slice(1);
            }
            
            if (rows.length === 0) return;

            let targetYear = -1;
            let targetMonth = -1;
            if (targetMonthYear !== 'ALL') {
                const parts = targetMonthYear.split('-');
                targetYear = Number(parts[0]);
                targetMonth = Number(parts[1]);
            }

            let confirmMsg = `Importer ${rows.length} lignes ? Cela écrasera les ID existants correspondants.`;
            if (targetMonthYear !== 'ALL') {
                const monthName = new Date(targetYear, targetMonth, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                confirmMsg = `Vous allez importer les gardes pour ${monthName}.\n\nATTENTION : Toutes les gardes actuellement validées (ASSIGNED) pour ce mois seront EFFACÉES et remplacées par le contenu de ce fichier.\n\nContinuer ?`;
            }

            if(!window.confirm(confirmMsg)) return;

            let upserts: any[] = [];

            if (importType === 'CLASSIC') {
                upserts = rows.map(line => {
                    const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
                    const matches = line.match(regex) || [];
                    const cols = matches.map(m => m.replace(/^"|"$/g, '').trim());

                    if (cols.length < 16) return null;
                    
                    const year = Number(cols[5]);
                    const month = Number(cols[6]) - 1; // JS months are 0-indexed
                    
                    if (targetMonthYear !== 'ALL' && (year !== targetYear || month !== targetMonth)) return null;

                    return {
                        id: cols[0],
                        user_trigram: cols[1],
                        user_role: cols[2],
                        round_id: Number(cols[3]),
                        submitted_at: cols[4] ? new Date(cols[4]).toISOString() : new Date().toISOString(),
                        year: year,
                        month: month + 1, // DB stores 1-indexed month
                        row: Number(cols[7]),
                        col: Number(cols[8]),
                        col_label: cols[9],
                        col_type: cols[10],
                        col_time_range: cols[11],
                        category: cols[12],
                        group_index: Number(cols[13]),
                        sub_rank: Number(cols[14]),
                        status: cols[15]
                    };
                }).filter(x => x && x.id && x.user_trigram);
            } else if (importType === '4D') {
                upserts = rows.map(line => {
                    let cols = line.split('\t').map(c => c.replace(/^"|"$/g, '').trim());
                    if (cols.length < 8) {
                        cols = line.split(';').map(c => c.replace(/^"|"$/g, '').trim());
                    }
                    if (cols.length < 8) {
                        // Handle commas inside quotes
                        const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
                        const matches = line.match(regex) || [];
                        cols = matches.map(m => m.replace(/^"|"$/g, '').trim());
                    }
                    
                    if (cols.length < 8) return null;

                    const trigram = cols[0];
                    if (trigram === 'ZZZ' || trigram === 'YYY' || trigram === 'XXX') return null;

                    const dateParts = cols[1].split('/');
                    if (dateParts.length !== 3) return null;
                    const day = Number(dateParts[0]);
                    const month = Number(dateParts[1]) - 1; // JS months are 0-indexed
                    const year = Number(dateParts[2]);
                    
                    if (targetMonthYear !== 'ALL' && (year !== targetYear || month !== targetMonth)) return null;

                    const colId = Number(cols[7]);
                    if (isNaN(colId)) return null;

                    // Generate a proper UUID for the choice
                    const id = generateId();

                    return {
                        id: id,
                        user_trigram: trigram,
                        user_role: 'DOCTOR',
                        round_id: activeRound?.id || 1,
                        submitted_at: new Date().toISOString(),
                        year: year,
                        month: month + 1, // DB stores 1-indexed month
                        row: day,
                        col: colId,
                        col_label: cols[8] || '',
                        col_type: 'GUARD',
                        col_time_range: cols[2] && cols[4] ? `${cols[2]} - ${cols[4]}` : '',
                        category: 'normal',
                        group_index: 1,
                        sub_rank: 1,
                        status: 'ASSIGNED'
                    };
                }).filter(x => x && x.id && x.user_trigram);
            }

            if (upserts.length === 0) {
                alert(targetMonthYear !== 'ALL' ? "Aucune donnée valide trouvée pour le mois sélectionné." : "Aucune donnée valide trouvée.");
                return;
            }

            // If a specific month is selected, delete existing ASSIGNED choices for that month
            if (targetMonthYear !== 'ALL') {
                const { error: deleteError } = await supabase.from('choices')
                    .delete()
                    .eq('status', 'ASSIGNED')
                    .eq('year', targetYear)
                    .eq('month', targetMonth + 1); // DB stores 1-indexed month
                    
                if (deleteError) {
                    console.error("Erreur suppression:", deleteError);
                    alert("Erreur lors de la suppression des anciennes gardes.");
                    return;
                }
            }

            let hasError = false;
            let errorMessage = "";
            for (let i = 0; i < upserts.length; i += 500) {
                const chunk = upserts.slice(i, i + 500);
                const { error } = await supabase.from('choices').upsert(chunk);
                if (error) {
                    hasError = true;
                    errorMessage = error.message;
                    break;
                }
            }

            if (hasError) {
                console.error(errorMessage);
                alert("Erreur import: " + errorMessage);
            } else {
                alert("Import réussi !");
                window.location.reload();
            }
        };
        reader.readAsText(file);
    };

    // Import Handlers
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'CLASSIC' | '4D' = 'CLASSIC') => {
        const file = e.target.files?.[0];
        if (file) {
            setImportFile(file);
            setImportType(type);
            setImportTargetMonth('ALL');
            setShowImportModal(true);
        }
        // Reset input value so the same file can be selected again
        e.target.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.name.endsWith('.csv')) {
            setImportFile(file);
            setImportType('CLASSIC'); // Default to classic for drag and drop
            setImportTargetMonth('ALL');
            setShowImportModal(true);
        } else if (file) {
            alert("Veuillez déposer un fichier CSV valide.");
        }
    };

    const generateCSV = (filter: 'PENDING' | 'ASSIGNED' | 'ALL') => {
        let dataToExport = choices;
        if (filter !== 'ALL') {
            dataToExport = choices.filter((c: any) => c.status === filter);
        }
        
        // Deduplicate ASSIGNED choices
        if (filter === 'ASSIGNED' || filter === 'ALL') {
            const assigned = dataToExport.filter((c: any) => c.status === 'ASSIGNED');
            const uniqueAssigned = assigned.filter((a: any, index: number, self: any[]) => 
                index === self.findIndex((t: any) => t.row === a.row && t.col === a.col && t.userTrigram === a.userTrigram && t.month === a.month && t.year === a.year)
            );
            const nonAssigned = dataToExport.filter((c: any) => c.status !== 'ASSIGNED');
            dataToExport = [...nonAssigned, ...uniqueAssigned];
        }

        const header = "ID,Trigramme,Rôle,Tour,Date Soumission,Année,Mois,Jour,Colonne ID,Libellé Colonne,Type Garde,Horaire,Catégorie,Priorité,Sous-rang,Statut";
        const rows = dataToExport.map((c: any) => {
            const dateSoumission = c.submittedAt ? new Date(c.submittedAt).toISOString().split('T')[0] : '';
            return `"${c.id}","${c.userTrigram}","${c.userRole}","${c.roundId}","${dateSoumission}","${c.year}","${c.month + 1}","${c.row}","${c.col}","${c.colLabel || ''}","${c.colType || ''}","${c.colTimeRange || ''}","${c.category}","${c.groupIndex}","${c.subRank}","${c.status}"`;
        });
        
        const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `choices_export_${filter.toLowerCase()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowExportModal(false);
    };

    const generate4DExport = (targetMonthYear: string = 'ALL') => {
        let validMonths: {month: number, year: number}[] = [];
        
        if (targetMonthYear !== 'ALL') {
            const parts = targetMonthYear.split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (!isNaN(y) && !isNaN(m)) {
                validMonths.push({ month: m, year: y });
            }
        } else if (activeRound) {
            const startM = activeRound.monthStart ?? 0;
            const startY = activeRound.yearStart ?? 2025;
            for (let i = 0; i < (activeRound.numMonths || 1); i++) {
                let m = startM + i;
                let y = startY;
                if (m > 11) {
                    m -= 12;
                    y += 1;
                }
                validMonths.push({ month: m, year: y });
            }
        }

        let dataToExport = choices.filter((c: any) => {
            if (c.status !== 'ASSIGNED') return false;
            // Si on a explicitement filtré par validMonths
            if (validMonths.length > 0) {
                return validMonths.some(vm => vm.month === c.month && vm.year === c.year);
            }
            return true;
        });

        // Deduplicate ASSIGNED choices
        dataToExport = dataToExport.filter((a: any, index: number, self: any[]) => 
            index === self.findIndex((t: any) => t.row === a.row && t.col === a.col && t.userTrigram === a.userTrigram && t.month === a.month && t.year === a.year)
        );
        
        let period = '';
        if (targetMonthYear !== 'ALL') {
            const parts = targetMonthYear.split('-');
            period = `${parts[0]}${String(parseInt(parts[1], 10) + 1).padStart(2, '0')}`;
        } else if (activeRound) {
            const year = activeRound.yearStart ?? 2025;
            const month = String((activeRound.monthStart ?? 0) + 1).padStart(2, '0');
            period = `${year}${month}`;
        } else if (dataToExport.length > 0) {
            const firstChoice = dataToExport[0];
            const year = firstChoice.year;
            const month = String(firstChoice.month + 1).padStart(2, '0');
            period = `${year}${month}`;
        } else {
            const now = new Date();
            period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mn = String(now.getMinutes()).padStart(2, '0');
        const hhmn = `${hh}${mn}`;

        const filename = `plan_importauto_${period}_${hhmn}.csv`;

        const header = "Trigramme,Tour,Année,Mois,Jour,Colonne ID,Catégorie";
        const rows = dataToExport.map((c: any) => {
            return `${c.userTrigram},${c.roundId},${c.year},${c.month + 1},${c.row},${c.col},${c.category}`;
        });
        
        const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowExportModal(false);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredChoices = useMemo(() => {
        let data = choices;
        if (filterStatus !== 'ALL') {
            data = data.filter((c:any) => c.status === filterStatus);
        }
        
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (!value) return;
            const searchStr = String(value).toLowerCase();
            data = data.filter((c:any) => {
                if (key === 'userTrigram') return c.userTrigram?.toLowerCase().includes(searchStr);
                if (key === 'date') {
                    const dateStr = new Date(c.year, c.month, c.row).toLocaleDateString('fr-FR');
                    return dateStr.includes(searchStr);
                }
                if (key === 'col') {
                    const colLabel = c.colLabel || c.colType || String(c.col);
                    return colLabel.toLowerCase().includes(searchStr);
                }
                if (key === 'category') {
                    const catStr = c.category === 'normal' ? 'Normal' : c.category === 'bad_bonus' ? 'Malus' : 'Bonus';
                    return catStr.toLowerCase().includes(searchStr);
                }
                if (key === 'groupIndex') return String(c.groupIndex).includes(searchStr);
                if (key === 'status') {
                    const statusStr = c.status === 'PENDING' ? 'En Attente' : c.status === 'ASSIGNED' ? 'Validé' : c.status === 'REFUSED' ? 'Refusé' : 'Refusé (Alt)';
                    return statusStr.toLowerCase().includes(searchStr);
                }
                return true;
            });
        });
        
        return data;
    }, [choices, filterStatus, columnFilters]);

    const sortedChoices = useMemo(() => {
        let data = [...filteredChoices];
        const { key, direction } = sortConfig;

        // Weights for custom sorting
        const statusWeight: Record<string, number> = { 'PENDING': 1, 'ASSIGNED': 2, 'REFUSED': 3, 'REFUSED_ALTERNATIVE': 4 };
        const categoryWeight: Record<string, number> = { 'normal': 1, 'bad_bonus': 2, 'good_bonus': 3 };

        data.sort((a: any, b: any) => {
            const dir = direction === 'asc' ? 1 : -1;

            if (key === 'default') {
                // 1. Médecin (A-Z)
                const tri = a.userTrigram.localeCompare(b.userTrigram);
                if (tri !== 0) return tri;
                
                // 2. Statut (En attente > Validé > Refusé)
                const statA = statusWeight[a.status] || 99;
                const statB = statusWeight[b.status] || 99;
                if (statA !== statB) return statA - statB;

                // 3. Type (Cible > Normale > Bonne)
                const catA = categoryWeight[a.category] || 99;
                const catB = categoryWeight[b.category] || 99;
                if (catA !== catB) return catA - catB;

                // 4. Priorité
                if (a.groupIndex !== b.groupIndex) return a.groupIndex - b.groupIndex;
                
                return a.subRank - b.subRank;
            }

            if (key === 'userTrigram') return a.userTrigram.localeCompare(b.userTrigram) * dir;
            if (key === 'status') return a.status.localeCompare(b.status) * dir;
            if (key === 'groupIndex') {
                if (a.groupIndex !== b.groupIndex) return (a.groupIndex - b.groupIndex) * dir;
                return (a.subRank - b.subRank) * dir;
            }
            if (key === 'col') return (a.col - b.col) * dir;
            if (key === 'date') {
                const dateA = new Date(a.year, a.month, a.row).getTime();
                const dateB = new Date(b.year, b.month, b.row).getTime();
                return (dateA - dateB) * dir;
            }
            if (key === 'category') {
                return a.category.localeCompare(b.category) * dir;
            }
            return 0;
        });
        return data;
    }, [filteredChoices, sortConfig]);

    const SortIcon = ({ colKey }: { colKey: string }) => {
        if (sortConfig.key !== colKey) return <span className="opacity-20 ml-1">⇅</span>;
        return <span className="ml-1 text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const uniqueAssignedCount = choices.filter((c: any) => c.status === 'ASSIGNED').filter((a: any, index: number, self: any[]) => 
        index === self.findIndex((t: any) => t.row === a.row && t.col === a.col && t.userTrigram === a.userTrigram && t.month === a.month && t.year === a.year)
    ).length;

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-blue-50 p-6 border-b border-blue-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-blue-900 uppercase tracking-tight">Exporter CSV</h3>
                                <p className="text-xs text-blue-500 font-bold uppercase tracking-wide">Sélectionnez les données</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-3">
                            <button onClick={() => generateCSV('PENDING')} className="w-full py-4 px-6 bg-white border-2 border-slate-100 hover:border-slate-300 text-slate-700 rounded-2xl flex items-center justify-between group transition-all">
                                <span className="font-black text-xs uppercase tracking-widest">En Attente</span>
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded group-hover:bg-slate-200">{choices.filter((c:any) => c.status === 'PENDING').length}</span>
                            </button>
                            <button onClick={() => generateCSV('ASSIGNED')} className="w-full py-4 px-6 bg-white border-2 border-green-100 hover:border-green-300 text-green-700 rounded-2xl flex items-center justify-between group transition-all">
                                <span className="font-black text-xs uppercase tracking-widest">Validées</span>
                                <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-1 rounded group-hover:bg-green-100">{uniqueAssignedCount}</span>
                            </button>
                            <button onClick={() => generateCSV('ALL')} className="w-full py-4 px-6 bg-slate-900 text-white rounded-2xl flex items-center justify-between group hover:bg-blue-600 transition-all shadow-lg shadow-slate-200">
                                <span className="font-black text-xs uppercase tracking-widest">Tout Exporter</span>
                                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded">{choices.length}</span>
                            </button>
                            <button onClick={() => { setShowExportModal(false); setShow4DExportModal(true); }} className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl flex items-center justify-between group hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 mt-2">
                                <span className="font-black text-xs uppercase tracking-widest">Exporter 4D</span>
                                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded">{uniqueAssignedCount}</span>
                            </button>
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-center">
                            <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest transition-colors">Annuler</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4D Export Settings Modal */}
            {show4DExportModal && (() => {
                const availableYMs = Array.from(new Set(
                    choices.filter((c: any) => c.status === 'ASSIGNED')
                           .map((c: any) => `${c.year}-${c.month}`)
                )).sort() as Array<string>;

                return (
                    <div className="fixed inset-0 z-[160] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-indigo-50 p-6 border-b border-indigo-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-indigo-900 uppercase tracking-tight">Exporter 4D</h3>
                                    <p className="text-xs text-indigo-500 font-bold uppercase tracking-wide">Sélectionnez la période</p>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Période cible</label>
                                    <select 
                                        value={selected4DMonthYear}
                                        onChange={(e) => setSelected4DMonthYear(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                    >
                                        <option value="ALL">TOUTES LES DONNÉES DU TOUR ACTIF</option>
                                        {availableYMs.map(ym => {
                                            const [y, m] = ym.split('-');
                                            const date = new Date(parseInt(y, 10), parseInt(m, 10), 1);
                                            const label = date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
                                            return <option key={ym} value={ym}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
                                        })}
                                    </select>
                                </div>
                                
                                <button 
                                    onClick={() => {
                                        generate4DExport(selected4DMonthYear);
                                        setShow4DExportModal(false);
                                    }} 
                                    className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl flex items-center justify-center group hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                                >
                                    <span className="font-black text-xs uppercase tracking-widest">Confirmer l'exportation</span>
                                </button>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-center">
                                <button onClick={() => setShow4DExportModal(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest transition-colors">Annuler</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Sub-Header */}
            <div className="p-4 md:p-6 bg-white border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Gestion des Vœux</h2>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setSubTab('journal')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${subTab === 'journal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Journal
                    </button>
                    <button 
                        onClick={() => setSubTab('data')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${subTab === 'data' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Données
                    </button>
                    <button 
                        onClick={() => setSubTab('history')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${subTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Historique
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-6">
                {subTab === 'journal' && (
                    <div className="h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                             <div className="flex gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                                {[
                                    { id: 'ALL', label: 'Tout' },
                                    { id: 'PENDING', label: 'En Attente' },
                                    { id: 'ASSIGNED', label: 'Validé' },
                                    { id: 'REFUSED', label: 'Refusé' }
                                ].map((filter) => (
                                    <button 
                                        key={filter.id}
                                        onClick={() => setFilterStatus(filter.id as any)}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterStatus === filter.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                             </div>
                        </div>
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                            <div className="overflow-auto custom-scrollbar flex-1">
                                <table className="w-max min-w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('userTrigram')}>
                                                Trigramme <SortIcon colKey="userTrigram" />
                                            </th>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>
                                                Date <SortIcon colKey="date" />
                                            </th>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('col')}>
                                                Créneau <SortIcon colKey="col" />
                                            </th>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest cursor-pointer hover:bg-slate-100 transition-colors text-center" onClick={() => handleSort('category')}>
                                                Type <SortIcon colKey="category" />
                                            </th>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('groupIndex')}>
                                                Priorité <SortIcon colKey="groupIndex" />
                                            </th>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                                                Statut <SortIcon colKey="status" />
                                            </th>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest text-right">Action</th>
                                        </tr>
                                        <tr className="bg-white border-b">
                                            <th className="px-2 py-1"><input type="text" placeholder="Filtrer..." className="w-full text-xs p-1 border rounded" value={columnFilters['userTrigram'] || ''} onChange={e => setColumnFilters({...columnFilters, userTrigram: e.target.value})} /></th>
                                            <th className="px-2 py-1"><input type="text" placeholder="Filtrer..." className="w-full text-xs p-1 border rounded" value={columnFilters['date'] || ''} onChange={e => setColumnFilters({...columnFilters, date: e.target.value})} /></th>
                                            <th className="px-2 py-1"><input type="text" placeholder="Filtrer..." className="w-full text-xs p-1 border rounded" value={columnFilters['col'] || ''} onChange={e => setColumnFilters({...columnFilters, col: e.target.value})} /></th>
                                            <th className="px-2 py-1"><input type="text" placeholder="Filtrer..." className="w-full text-xs p-1 border rounded" value={columnFilters['category'] || ''} onChange={e => setColumnFilters({...columnFilters, category: e.target.value})} /></th>
                                            <th className="px-2 py-1"><input type="text" placeholder="Filtrer..." className="w-full text-xs p-1 border rounded" value={columnFilters['groupIndex'] || ''} onChange={e => setColumnFilters({...columnFilters, groupIndex: e.target.value})} /></th>
                                            <th className="px-2 py-1"><input type="text" placeholder="Filtrer..." className="w-full text-xs p-1 border rounded" value={columnFilters['status'] || ''} onChange={e => setColumnFilters({...columnFilters, status: e.target.value})} /></th>
                                            <th className="px-2 py-1"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sortedChoices.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-400 italic text-xs">Aucun vœu trouvé.</td>
                                            </tr>
                                        ) : (
                                            sortedChoices.map((c: any) => (
                                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-black text-slate-900">{c.userTrigram}</td>
                                                    <td className="p-4 font-medium text-slate-600">
                                                        {new Date(c.year, c.month, c.row).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                    </td>
                                                    <td className="p-4 text-xs">
                                                        <span className="font-bold text-slate-700">Col {c.col}</span>
                                                        {c.colLabel && <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded text-slate-500 text-[10px]">{c.colLabel}</span>}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                                            c.category === 'normal' ? 'bg-orange-100 text-orange-700' : 
                                                            c.category === 'good_bonus' ? 'bg-blue-100 text-blue-700' : 
                                                            'bg-indigo-100 text-indigo-700'
                                                        }`}>
                                                            {c.category === 'normal' ? 'Cible' : c.category === 'good_bonus' ? 'Bonne' : 'Normale'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                                                            c.category === 'normal' ? 'bg-orange-100 text-orange-700' : 
                                                            c.category === 'bad_bonus' ? 'bg-indigo-100 text-indigo-700' : 
                                                            'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {c.groupIndex}.{c.subRank}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                                            c.status === 'ASSIGNED' ? 'bg-green-100 text-green-700' : 
                                                            c.status === 'PENDING' ? 'bg-slate-100 text-slate-500' : 
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                            {c.status === 'ASSIGNED' ? 'Validé' : c.status === 'PENDING' ? 'Attente' : c.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button 
                                                            onClick={async () => {
                                                                if(!window.confirm(c.status === 'ASSIGNED' ? "Supprimer cette garde attribuée ?" : "Supprimer ce vœu ?")) return;
                                                                await supabase.from('choices').delete().eq('id', c.id);
                                                                setChoices((prev: any[]) => prev.filter((x: any) => x.id !== c.id));
                                                                if (c.status === 'ASSIGNED') {
                                                                    logAction('SUPPRESSION_GARDE', { user: c.userTrigram, date: `${c.row}/${c.month+1}/${c.year}`, col: c.col });
                                                                } else {
                                                                    logAction('SUPPRESSION_VOEU', { user: c.userTrigram, date: `${c.row}/${c.month+1}/${c.year}`, col: c.col });
                                                                }
                                                            }}
                                                            className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {subTab === 'history' && (
                    <div className="h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                                {[
                                    { id: 'ALL', label: 'Tout' },
                                    { id: 'SYSTEM', label: 'Système' },
                                    { id: 'USERS', label: 'Utilisateurs' },
                                    { id: 'GUARDS', label: 'Gardes & Vœux' }
                                ].map(f => (
                                    <button 
                                        key={f.id} 
                                        onClick={() => setLogFilter(f.id as any)} 
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${logFilter === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                            <div className="overflow-auto custom-scrollbar flex-1">
                                <table className="w-max min-w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest">Date</th>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest">Utilisateur</th>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest">Action</th>
                                            <th className="p-4 font-black uppercase text-[10px] text-slate-400 tracking-widest">Détails</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">Aucun historique disponible.</td>
                                            </tr>
                                        ) : (
                                            filteredLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 whitespace-nowrap text-slate-500">{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                                                    <td className="p-4 font-bold text-slate-700">{log.user_trigram || 'Système'}</td>
                                                    <td className="p-4">
                                                        {(() => {
                                                            switch (log.action) {
                                                                case 'VIDER_BASE': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-[10px] font-black uppercase">Vider Base</span>;
                                                                case 'CHANGEMENT_TOUR_ACTIF': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black uppercase">Changement Tour Actif</span>;
                                                                case 'VERROUILLAGE_GLOBAL': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-[10px] font-black uppercase">Verrouillage Global</span>;
                                                                case 'VERROUILLAGE_TOUR': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-[10px] font-black uppercase">Verrouillage Tour</span>;
                                                                case 'MODIFICATION_PERIODE': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black uppercase">Période</span>;
                                                                case 'MODIFICATION_TETE_LISTE': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black uppercase">Tête de Liste</span>;
                                                                case 'AJOUT_UTILISATEUR': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase">Ajout Utilisateur</span>;
                                                                case 'MODIFICATION_UTILISATEUR': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black uppercase">Modif Utilisateur</span>;
                                                                case 'SUPPRESSION_UTILISATEUR': return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-[10px] font-black uppercase">Suppr Utilisateur</span>;
                                                                case 'SUPPRESSION_GARDE': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-[10px] font-black uppercase">Suppr Garde</span>;
                                                                case 'VALIDATION_GARDE': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase">Validation Garde</span>;
                                                                case 'ASSIGNATION_MANUELLE': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-[10px] font-black uppercase">Assignation Manuelle</span>;
                                                                case 'SUPPRESSION_VOEU': return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-[10px] font-black uppercase">Suppr Vœu</span>;
                                                                default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-[10px] font-black uppercase">{log.action}</span>;
                                                            }
                                                        })()}
                                                    </td>
                                                    <td className="p-4">
                                                        {log.details ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {Object.entries(log.details).map(([k, v]) => (
                                                                    <div key={k} className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                                                                        <span className="text-[9px] font-black uppercase text-slate-400">{k}:</span>
                                                                        <span className="text-xs font-bold text-slate-700">{String(v)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-xs">Aucun détail</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {subTab === 'data' && (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 h-full">
                        {/* EXPORT SECTION */}
                        <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col justify-center items-center text-center space-y-6">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Exporter les Données</h3>
                                <p className="text-slate-400 text-sm font-medium mt-2 max-w-xs mx-auto">Téléchargez l'intégralité de la base de choix au format CSV pour Excel.</p>
                            </div>
                            <div className="w-full max-w-md">
                                <button onClick={() => setShowExportModal(true)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/20">
                                    Format CSV
                                </button>
                            </div>
                        </div>

                        {/* IMPORT SECTION */}
                        <div 
                            className={`bg-white p-8 rounded-[40px] border-2 shadow-sm flex flex-col justify-center items-center text-center space-y-6 relative overflow-hidden transition-all duration-300 ${isDragging ? 'border-emerald-500 bg-emerald-50 scale-[1.02]' : 'border-transparent'}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                            </div>
                            
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 relative z-10 transition-colors ${isDragging ? 'bg-emerald-200 text-emerald-700' : 'bg-emerald-50 text-emerald-600'}`}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            </div>
                            <div className="relative z-10 pointer-events-none">
                                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">
                                    {isDragging ? "Déposez le fichier ici !" : "Importer / Restaurer"}
                                </h3>
                                <p className="text-slate-400 text-sm font-medium mt-2 max-w-xs mx-auto">Rechargez une sauvegarde ou importez des modifications en masse via CSV.</p>
                            </div>
                            
                            <div className="relative z-10 w-full max-w-md flex flex-col gap-3">
                                <label className="cursor-pointer group">
                                    <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'CLASSIC')} className="hidden" />
                                    <div className={`py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 ${isDragging ? 'bg-white text-emerald-600 shadow-emerald-200' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/30'}`}>
                                        <span>Importation Classique</span>
                                    </div>
                                </label>
                                <label className="cursor-pointer group">
                                    <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, '4D')} className="hidden" />
                                    <div className={`py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/30`}>
                                        <span>Importation 4D</span>
                                    </div>
                                </label>
                                <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-wide text-center">Format requis : CSV</p>
                            </div>
                        </div>

                        {/* COMPARE SECTION */}
                        <div 
                            className={`bg-white p-8 rounded-[40px] border-2 shadow-sm flex flex-col justify-center items-center text-center space-y-6 relative overflow-hidden transition-all duration-300 ${isCompareDragging ? 'border-amber-500 bg-amber-50 scale-[1.02]' : 'border-transparent'}`}
                            onDragOver={handleCompareDragOver}
                            onDragLeave={handleCompareDragLeave}
                            onDrop={handleCompareDrop}
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 3.8l7.5 14.2H4.5L12 5.8zm-1 5.2v5h2v-5h-2zm0 7v2h2v-2h-2z"/></svg>
                            </div>
                            
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 relative z-10 transition-colors ${isCompareDragging ? 'bg-amber-200 text-amber-700' : 'bg-amber-50 text-amber-600'}`}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                            </div>
                            <div className="relative z-10 pointer-events-none">
                                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">
                                    {isCompareDragging ? "Déposez le fichier 4D ici !" : "Comparer 4D"}
                                </h3>
                                <p className="text-slate-400 text-sm font-medium mt-2 max-w-xs mx-auto">Importez un planning 4D pour visualiser les écarts avec la base actuelle (sans rien écraser).</p>
                            </div>
                            
                            <div className="relative z-10 w-full max-w-md flex flex-col gap-3">
                                <label className="cursor-pointer group">
                                    <input type="file" accept=".csv" onChange={handleCompareFileUpload} className="hidden" />
                                    <div className={`py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 ${isCompareDragging ? 'bg-white text-amber-600 shadow-amber-200' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/30'}`}>
                                        <span>Sélectionner Fichier</span>
                                    </div>
                                </label>
                                <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-wide text-center">Format requis : 4D (CSV/TXT)</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {showImportModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-8">
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Options d'importation</h3>
                            <p className="text-slate-500 mb-6">Sélectionnez le mois pour lequel vous souhaitez importer les données. Les gardes validées du mois sélectionné seront remplacées.</p>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Mois cible</label>
                                    <select 
                                        value={importTargetMonth}
                                        onChange={(e) => setImportTargetMonth(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                    >
                                        <option value="ALL">Tous les mois (Ajout / Mise à jour)</option>
                                        {(() => {
                                            const options = [];
                                            if (activeRound) {
                                                const startM = activeRound.monthStart ?? 0;
                                                const startY = activeRound.yearStart ?? 2025;
                                                for (let i = 0; i < (activeRound.numMonths || 1); i++) {
                                                    let m = startM + i;
                                                    let y = startY;
                                                    if (m > 11) {
                                                        m -= 12;
                                                        y += 1;
                                                    }
                                                    const monthName = new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                                                    options.push(
                                                        <option key={`${y}-${m}`} value={`${y}-${m}`}>
                                                            {monthName.charAt(0).toUpperCase() + monthName.slice(1)} (Remplacer)
                                                        </option>
                                                    );
                                                }
                                            }
                                            return options;
                                        })()}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button 
                                onClick={() => {
                                    setShowImportModal(false);
                                    setImportFile(null);
                                }}
                                className="flex-1 py-3 px-4 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={() => {
                                    if (importFile) {
                                        processFileImport(importFile, importType, importTargetMonth);
                                        setShowImportModal(false);
                                        setImportFile(null);
                                    }
                                }}
                                className="flex-1 py-3 px-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                            >
                                Confirmer l'import
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showCompareModal && compareData && (() => {
                const availableYMs = Array.from(new Set([
                    ...compareData.map((c: any) => `${c.year}-${c.month}`),
                    ...choices.filter((c: any) => c.status === 'ASSIGNED').map((c: any) => `${c.year}-${c.month}`)
                ])).sort();

                const targetYM = compareMonthYear;
                const [tYearStr, tMonthStr] = targetYM.split('-');
                const tYear = Number(tYearStr) || 2025;
                const tMonth = Number(tMonthStr) || 0;
                
                const ourAssigned = choices.filter((c: any) => c.status === 'ASSIGNED' && c.year === tYear && c.month === tMonth);
                const imported = compareData.filter((c: any) => c.year === tYear && c.month === tMonth);

                const daysInMonth = new Date(tYear, tMonth + 1, 0).getDate();
                const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
                
                const allColIds = Array.from(new Set([
                    ...ourAssigned.map((c: any) => c.col),
                    ...imported.map((c: any) => c.colId)
                ])).sort((a,b) => a - b);
                
                const dynamicColumns = allColIds.map(id => COLUMNS.find(c => c.id === id)).filter((c): c is ColumnDefinition => c !== undefined);

                const activeUsers = Array.from(new Set([...ourAssigned.map((c:any) => c.userTrigram), ...imported.map((c:any) => c.trigram)])).sort();
                const usersWithCounts = activeUsers.map(trigram => {
                    const user = users.find((u: any) => u.trigram === trigram);
                    const ourCount = ourAssigned.filter((c:any) => c.userTrigram === trigram).length;
                    const importCount = imported.filter((c:any) => c.trigram === trigram).length;
                    return { trigram, ourCount, importCount, role: user?.role || 'UNKNOWN' };
                });
                
                const doctors = usersWithCounts.filter(u => u.role === 'DOCTOR' || u.role === 'UNKNOWN');
                const substitutes = usersWithCounts.filter(u => u.role === 'SUBSTITUTE');

                return (
                    <div className={`fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center ${isCompareFullscreen ? 'p-0' : 'p-0 md:p-4'}`}>
                        <div className={`bg-white shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95 ${isCompareFullscreen ? 'h-screen max-w-none rounded-none' : 'max-h-[95vh] max-w-7xl rounded-[32px]'}`}>
                            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 shrink-0">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Comparaison 4D</h3>
                                    <div className="flex flex-wrap gap-3 mt-2">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 block"></span> Manquant</div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 block"></span> En trop</div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 block"></span> Différent</div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 block"></span> OK</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <select 
                                        value={compareMonthYear}
                                        onChange={(e) => setCompareMonthYear(e.target.value)}
                                        className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all flex-1 md:flex-none"
                                    >
                                        {availableYMs.map(ym => {
                                            const [y, m] = ym.split('-');
                                            const date = new Date(parseInt(y, 10), parseInt(m, 10), 1);
                                            const label = date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
                                            return <option key={ym} value={ym}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
                                        })}
                                    </select>
                                    <button onClick={() => setIsCompareFullscreen(!isCompareFullscreen)} className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 shadow-sm transition-all shrink-0" title={isCompareFullscreen ? "Quitter le plein écran" : "Plein écran"}>
                                        {isCompareFullscreen ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                                        )}
                                    </button>
                                    <button onClick={() => setShowCompareModal(false)} className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 shadow-sm transition-all shrink-0">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="shrink-0 p-4 border-b border-slate-100 bg-white">
                                {(doctors.length > 0 || substitutes.length > 0) && (
                                    <div className="flex flex-col gap-3">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Compteurs
                                    </div>
                                    
                                    <div className="flex flex-col gap-3 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2">
                                        {doctors.length > 0 && (
                                            <div className="space-y-2">
                                                        <div className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Titulaires</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {doctors.map(uc => {
                                                                const isDiff = uc.ourCount !== uc.importCount;
                                                                return (
                                                                    <div key={uc.trigram} className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border flex items-center gap-1.5 ${isDiff ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                                        <span>{uc.trigram}</span>
                                                                        <span className={`px-1.5 py-0.5 rounded-md text-white ${isDiff ? 'bg-orange-500' : 'bg-slate-400'}`}>{uc.ourCount} / {uc.importCount}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {substitutes.length > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">Remplaçants</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {substitutes.map(uc => {
                                                                const isDiff = uc.ourCount !== uc.importCount;
                                                                return (
                                                                    <div key={uc.trigram} className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border flex items-center gap-1.5 ${isDiff ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                                        <span>{uc.trigram}</span>
                                                                        <span className={`px-1.5 py-0.5 rounded-md text-white ${isDiff ? 'bg-orange-500' : 'bg-slate-400'}`}>{uc.ourCount} / {uc.importCount}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                    </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-50">
                                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 inline-block min-w-full">
                                    <table className="w-max min-w-full border-separate border-spacing-0 table-fixed">
                                        <MatrixHeader columns={dynamicColumns} month={tMonth} year={tYear} />
                                        <tbody>
                                            {days.map(day => {
                                                const date = new Date(tYear, tMonth, day);
                                                const isSunday = date.getDay() === 0;
                                                const isHoliday = isPublicHoliday(date);
                                                const isOffDay = isSunday || isHoliday;
                                                const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3).replace('.', '');
                                                const rowHeaderBg = isOffDay ? 'bg-red-100 text-red-600' : 'bg-white text-slate-900';

                                                return (
                                                    <tr key={day} className={`h-5 hover:bg-slate-50 ${isOffDay ? 'bg-red-50/30' : ''}`}>
                                                        <td className={`sticky left-0 border-r border-b text-center z-10 w-20 md:w-16 h-5 font-black ${rowHeaderBg}`}>
                                                            <div className="flex items-center justify-center gap-0.5">
                                                                <span className="text-[7px] font-normal opacity-70">{dayName}</span>
                                                                <span className="text-[7px]">{day}</span>
                                                            </div>
                                                        </td>
                                                        {dynamicColumns.map(col => {
                                                            const inOurs = ourAssigned.find((c: any) => c.row === day && c.col === col.id);
                                                            const inImport = imported.find((c: any) => c.day === day && c.colId === col.id);
                                                            
                                                            let state = 'EMPTY';
                                                            let textContent: React.ReactNode = null;
                                                            
                                                            if (inOurs && !inImport) {
                                                                state = 'EXTRA';
                                                                textContent = <span className="text-[16px] md:text-[14px] font-black text-blue-700 drop-shadow-sm leading-none">{inOurs.userTrigram}</span>;
                                                            } else if (!inOurs && inImport) {
                                                                state = 'MISSING';
                                                                textContent = <span className="text-[16px] md:text-[14px] font-black text-red-700 drop-shadow-sm leading-none">{inImport.trigram}</span>;
                                                            } else if (inOurs && inImport) {
                                                                if (inOurs.userTrigram === inImport.trigram) {
                                                                    state = 'MATCH';
                                                                    textContent = <span className="text-[16px] md:text-[14px] font-black text-emerald-700 opacity-60 drop-shadow-sm leading-none">{inOurs.userTrigram}</span>;
                                                                } else {
                                                                    state = 'MISMATCH';
                                                                    textContent = (
                                                                        <div className="flex flex-col items-center leading-[1]">
                                                                            <span className="text-[9px] font-bold text-slate-500 line-through">{inOurs.userTrigram}</span>
                                                                            <span className="text-[14px] md:text-[12px] font-black text-orange-700">{inImport.trigram}</span>
                                                                        </div>
                                                                    );
                                                                }
                                                            }

                                                            const cellKey = `${tYear}-${tMonth}-${day}-${col.id}`;
                                                            const isResolved = resolvedCompareCells[cellKey];

                                                            let cellClasses = 'bg-white opacity-50';
                                                            if (isResolved) {
                                                                cellClasses = 'bg-emerald-200 border-emerald-400 cursor-pointer hover:bg-emerald-300';
                                                            } else if (state === 'EXTRA') {
                                                                cellClasses = 'bg-blue-100 border-blue-200 cursor-pointer hover:bg-blue-200 transition-colors';
                                                            } else if (state === 'MISSING') {
                                                                cellClasses = 'bg-red-100 border-red-200 cursor-pointer hover:bg-red-200 transition-colors';
                                                            } else if (state === 'MISMATCH') {
                                                                cellClasses = 'bg-orange-100 border-orange-200 cursor-pointer hover:bg-orange-200 transition-colors';
                                                            } else if (state === 'MATCH') {
                                                                cellClasses = 'bg-emerald-50 border-emerald-100';
                                                            }

                                                            const handleCellClick = () => {
                                                                if (state !== 'MATCH' && state !== 'EMPTY') {
                                                                    setResolvedCompareCells(prev => ({
                                                                        ...prev,
                                                                        [cellKey]: !prev[cellKey]
                                                                    }));
                                                                }
                                                            };

                                                            return (
                                                                <td key={col.id} onClick={handleCellClick} className={`border-r border-b border-slate-200 text-center relative min-w-[70px] w-[70px] md:min-w-[44px] md:w-[44px] align-middle overflow-hidden bg-white`}>
                                                                    <div className={`absolute inset-0 flex items-center justify-center ${cellClasses}`}>
                                                                        {textContent}
                                                                        {state !== 'MATCH' && state !== 'EMPTY' && !isResolved && <div className={`absolute top-0 right-0 w-4 h-4 -mr-2 -mt-2 rotate-45 opacity-20 ${state==='EXTRA'?'bg-blue-500':state==='MISSING'?'bg-red-500':'bg-orange-500'}`}></div>}
                                                                        {isResolved && <div className="absolute top-0.5 right-0.5 text-emerald-800"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};