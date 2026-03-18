import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AdminTab, UserProfile, Round, Choice, ColumnConfig, HeaderConfig, GuardType, Site, UserRole, ColumnDefinition, ShiftDefinition, ShiftGlobalSettings } from '../types';
import { COLUMNS, DEFAULT_HEADERS, parseTimeRange, isPublicHoliday } from '../constants';
import { MatrixHeader } from './MatrixHeader';

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

export const AdminDashboard: React.FC<Props> = ({ users, setUsers, rounds, setRounds, supabase, onLogout }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(AdminTab.USERS);
  const [selectedRoundId, setSelectedRoundId] = useState<number>(1);
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
        })));
      }
      const { data: cd } = await supabase.from('choices').select('*').neq('status', 'ARCHIVED');
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
      const { data: gc } = await supabase.from('global_closures').select('*');
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
      } else {
          // RESET MODE: Clear choices, unavailabilities, global_closures, column_quotas
          await supabase.from('choices').delete().neq('id', '0');
          await supabase.from('unavailabilities').delete().neq('id', '0');
          await supabase.from('global_closures').delete().neq('id', '0');
          await supabase.from('column_quotas').delete().neq('column_id', 0);
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
    const { error } = await supabase.from('choices').upsert(upserts);
    if (error) alert("Erreur import: " + error.message);
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
                        <span className="block text-[10px] font-bold text-red-400 mt-1">Supprime TOUS les choix, indisponibilités et fermetures</span>
                    </button>
                </div>
                <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 bg-white border rounded-xl text-xs font-black uppercase">Annuler</button>
                    <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase">Confirmer</button>
                </div>
            </div>
        </div>
      )}

      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col shadow-2xl z-50 shrink-0 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-lg shadow-inner">A</div>
          <h2 className="text-xs font-black uppercase tracking-tighter">SOS 92</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[{ id: AdminTab.USERS, label: 'Médecins', icon: '👥' }, { id: AdminTab.CONFIG, label: 'Paramétrage', icon: '⚙️' }, { id: AdminTab.SHIFTS, label: 'Gardes', icon: '🛡️' }, { id: AdminTab.PLANNING, label: 'Planning', icon: '📅' }, { id: AdminTab.WISHES, label: 'Choix Médecin', icon: '📝' }].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as AdminTab)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-3">
            <button onClick={() => setShowDeleteModal(true)} disabled={isDeletingAll} className="w-full py-3 bg-slate-700 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">⚠️ Vider la base</button>
            <button onClick={onLogout} className="w-full py-3 bg-slate-800 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest">Déconnexion</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0">
          <h1 className="text-xs font-black uppercase tracking-widest text-slate-400">{activeTab}</h1>
          {isLoading && <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest animate-pulse">Chargement...</div>}
        </header>
        <div className="flex-1 overflow-hidden">
          {activeTab === AdminTab.USERS && <UsersPanel users={users} supabase={supabase} refreshData={refreshData} />}
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
            />
          )}
          {activeTab === AdminTab.SHIFTS && (
            <ShiftsPanel
              shiftDefinitions={shiftDefinitions}
              shiftGlobalSettings={shiftGlobalSettings}
              users={users}
              supabase={supabase}
              refreshData={refreshData}
            />
          )}
          {activeTab === AdminTab.PLANNING && <PlanningPanel choices={allChoices} setChoices={setAllChoices} users={users} activeRound={activeRound} columnConfigs={columnConfigs} headerConfigs={headerConfigs} supabase={supabase} onImport={handleImportCSV} globalClosures={globalClosures} setGlobalClosures={setGlobalClosures} />}
          {activeTab === AdminTab.WISHES && <WishesPanel choices={allChoices} setChoices={setAllChoices} supabase={supabase} onImport={handleImportCSV} activeRound={activeRound} />}
        </div>
      </main>
    </div>
  );
};

const UsersPanel = ({ users, supabase, refreshData }: any) => {
  const [newTri, setNewTri] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('DOCTOR');

  const addUser = async () => {
    if (newTri.length !== 3) return;
    await supabase.from('users').insert({ trigram: newTri.toUpperCase(), password: newPwd || '1234', role: newRole });
    setNewTri(''); setNewPwd(''); refreshData();
  };

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
                <button onClick={async () => { await supabase.from('users').update({ password: pwd }).eq('trigram', u.trigram); setIsEditing(false); refreshData(); }} className="text-green-600 font-bold text-xs">✓</button>
              </div>
            ) : (
              <span className="text-[10px] font-black cursor-pointer hover:text-blue-600" onClick={() => setIsEditing(true)}>{u.password || '----'}</span>
            )}
          </div>
        </div>
        <button onClick={async () => { if(confirm(`Supprimer ${u.trigram} ?`)) { await supabase.from('users').delete().eq('trigram', u.trigram); refreshData(); } }} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-600 transition-all p-2">✕</button>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {users.map((u: any) => <UserCard key={u.trigram} u={u} />)}
      </div>
    </div>
  );
};

const ShiftsPanel = ({ shiftDefinitions, shiftGlobalSettings, supabase, refreshData, users }: any) => {
  return (
    <div className="p-4 md:p-8 overflow-y-auto h-full custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Paramètres Globaux des Gardes</h3>
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={shiftGlobalSettings?.target_substitute_active || false} onChange={async (e) => {
                  await supabase.from('shift_global_settings').update({ target_substitute_active: e.target.checked }).eq('id', 1);
                  refreshData();
                }} className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                <span className="text-xs font-black uppercase text-orange-600">Remplaçant</span>
              </label>
              {shiftGlobalSettings?.target_substitute_active && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[10px] font-black uppercase text-slate-400">Max par jour</span>
                  <input type="number" value={shiftGlobalSettings?.target_substitute_max || 0} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_substitute_max: Number(e.target.value) }).eq('id', 1);
                    refreshData();
                  }} className="w-20 p-2 border rounded-xl text-sm font-bold text-center bg-white" min="0" />
                </div>
              )}
            </div>
            <div className="flex-1 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={shiftGlobalSettings?.target_doctor_active || false} onChange={async (e) => {
                  await supabase.from('shift_global_settings').update({ target_doctor_active: e.target.checked }).eq('id', 1);
                  refreshData();
                }} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                <span className="text-xs font-black uppercase text-blue-600">Médecin</span>
              </label>
              {shiftGlobalSettings?.target_doctor_active && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[10px] font-black uppercase text-slate-400">Max par jour</span>
                  <input type="number" value={shiftGlobalSettings?.target_doctor_max || 0} onChange={async (e) => {
                    await supabase.from('shift_global_settings').update({ target_doctor_max: Number(e.target.value) }).eq('id', 1);
                    refreshData();
                  }} className="w-20 p-2 border rounded-xl text-sm font-bold text-center bg-white" min="0" />
                </div>
              )}
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

const ConfigPanel = ({ round, allRounds, setRounds, selectedRoundId, setSelectedRoundId, columnConfigs, setColumnConfigs, headerConfigs, setHeaderConfigs, shiftGlobalSettings, users, supabase, refreshRounds, onShowHeaderHelp }: any) => {
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
        
        const { error } = await supabase.from('rounds').update(payload).eq('id', selectedRoundId);
        if (error) throw error;
        await refreshRounds();
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
    } catch (e) {
        console.error("Erreur activation tour:", e);
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

    try {
        const isGlobalUpdate = Object.keys(cleanSettings).some(key => 
            ['custom_label', 'custom_header_label', 'custom_type', 'custom_site', 'custom_time_range', 'custom_color'].includes(key)
        );

        let updates: any[] = [];

        if (isGlobalUpdate) {
            // Apply to all rounds for global fields
            allRounds.forEach((r: Round) => {
                selectedColIds.forEach(colId => {
                    // We only have columnConfigs for the selected round in state, 
                    // but upsert will merge with existing DB rows if we only provide the fields we want to change.
                    // Wait, Supabase upsert replaces the whole row if we don't provide all fields?
                    // Actually, if we just want to update, we should probably fetch them or just trust upsert if it's a partial update?
                    // Supabase upsert replaces the entire row. To do a partial update on multiple rows, we should use update().
                    // But since we might need to insert if they don't exist, it's tricky.
                    // Let's just use update() for global fields, assuming they exist, or we can just upsert with the current config from selectedRound.
                    // Actually, the safest way to update specific fields across all rounds is to use a loop of updates.
                });
            });
            
            // Better approach for global fields: use update() with an in() filter
            for (const key of Object.keys(cleanSettings)) {
                if (['custom_label', 'custom_header_label', 'custom_type', 'custom_site', 'custom_time_range', 'custom_color'].includes(key)) {
                    await supabase.from('column_configs')
                        .update({ [key]: cleanSettings[key] })
                        .in('column_id', selectedColIds);
                } else {
                    // For non-global fields (like openings) in a bulk action that mixed them (though UI separates them)
                    await supabase.from('column_configs')
                        .update({ [key]: cleanSettings[key] })
                        .eq('round_id', selectedRoundId)
                        .in('column_id', selectedColIds);
                }
            }
            
            // Also update local state for the current round
            setColumnConfigs((prev: any[]) => {
                return prev.map(c => {
                    if (selectedColIds.includes(c.column_id)) {
                        return { ...c, ...cleanSettings };
                    }
                    return c;
                });
            });

        } else {
            // Apply only to selected round (e.g., openings)
            await supabase.from('column_configs')
                .update(cleanSettings)
                .eq('round_id', selectedRoundId)
                .in('column_id', selectedColIds);
                
            setColumnConfigs((prev: any[]) => {
                return prev.map(c => {
                    if (selectedColIds.includes(c.column_id)) {
                        return { ...c, ...cleanSettings };
                    }
                    return c;
                });
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
         <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="flex flex-col flex-1">
                 <label className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Tour Actif</label>
                 <select value={selectedRoundId} onChange={e => setSelectedRoundId(Number(e.target.value))} className="bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 ring-blue-50 w-full">
                    {allRounds.map((r: Round) => <option key={r.id} value={r.id}>{r.title}</option>)}
                 </select>
             </div>
             {round && !round.isActive && (
                 <button onClick={setRoundActive} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all whitespace-nowrap">Activer</button>
             )}
         </div>
         <div className="flex gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveSubTab('general')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'general' ? 'bg-slate-800 text-white' : 'bg-white border hover:bg-slate-50'}`}>Général</button>
            <button onClick={() => setActiveSubTab('columns')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'columns' ? 'bg-slate-800 text-white' : 'bg-white border hover:bg-slate-50'}`}>Colonnes</button>
         </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        {activeSubTab === 'general' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Access Controls */}
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Accès Titulaires</h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${round.isActiveDoctors ? 'bg-blue-600' : 'bg-slate-200'}`} onClick={() => updateRoundFlags({ isActiveDoctors: !round.isActiveDoctors })}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${round.isActiveDoctors ? 'translate-x-6' : ''}`}></div>
                            </div>
                            <span className={`text-xs font-bold ${round.isActiveDoctors ? 'text-blue-600' : 'text-slate-400'}`}>{round.isActiveDoctors ? 'OUVERT' : 'FERMÉ'}</span>
                        </label>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Accès Remplaçants</h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${round.isActiveSubstitutes ? 'bg-orange-500' : 'bg-slate-200'}`} onClick={() => updateRoundFlags({ isActiveSubstitutes: !round.isActiveSubstitutes })}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${round.isActiveSubstitutes ? 'translate-x-6' : ''}`}></div>
                            </div>
                            <span className={`text-xs font-bold ${round.isActiveSubstitutes ? 'text-orange-600' : 'text-slate-400'}`}>{round.isActiveSubstitutes ? 'OUVERT' : 'FERMÉ'}</span>
                        </label>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Verrouillage Global</h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${round.isLocked ? 'bg-red-500' : 'bg-slate-200'}`} onClick={() => updateRoundFlags({ isLocked: !round.isLocked })}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${round.isLocked ? 'translate-x-6' : ''}`}></div>
                            </div>
                            <span className={`text-xs font-bold ${round.isLocked ? 'text-red-600' : 'text-slate-400'}`}>{round.isLocked ? 'VERROUILLÉ' : 'DÉVERROUILLÉ'}</span>
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
                                    await supabase.from('shift_global_settings').update({ head_doctor_trigram: e.target.value || null }).eq('id', 1);
                                    refreshRounds();
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
                                    await supabase.from('shift_global_settings').update({ head_substitute_trigram: e.target.value || null }).eq('id', 1);
                                    refreshRounds();
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
                        <table className="w-full text-left border-collapse">
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

const PlanningPanel = ({ choices, setChoices, users, activeRound, columnConfigs, headerConfigs, supabase, globalClosures, setGlobalClosures }: any) => {
  const [editingCell, setEditingCell] = useState<{row: number, col: number, month: number, year: number} | null>(null);
  const [selectedUserTrigram, setSelectedUserTrigram] = useState('');
  const [isEditClosuresMode, setIsEditClosuresMode] = useState(false);

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

      const isColClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === null && (gc.month === null || (gc.month === month && gc.year === year)));
      const isCellClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
      if (isColClosed ? !isCellClosed : isCellClosed) {
          alert("Cette case est fermée.");
          return;
      }

      const assignedChoice = choices.find((c: any) => c.row === row && c.col === colId && c.month === month && c.year === year && c.status === 'ASSIGNED');

      if (assignedChoice) {
          if (window.confirm(`Retirer la garde du Dr ${assignedChoice.userTrigram} ?`)) {
              const { error } = await supabase.from('choices').delete().eq('id', assignedChoice.id);
              if (!error) {
                  setChoices((prev: any[]) => prev.filter((c: any) => c.id !== assignedChoice.id));
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

      const pending = choices.find((c: any) => c.row === editingCell.row && c.col === editingCell.col && c.month === editingCell.month && c.year === editingCell.year && c.userTrigram === cleanTri);

      if (pending) {
          const { error } = await supabase.from('choices').update({ status: 'ASSIGNED' }).eq('id', pending.id);
          if (!error) {
              setChoices((prev: any[]) => prev.map((c: any) => c.id === pending.id ? { ...c, status: 'ASSIGNED' } : c));
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
          } else {
              console.error(error);
              alert("Erreur lors de l'attribution");
          }
      }
      setEditingCell(null);
  };

  const handleColumnClick = async (colId: number, month: number, year: number) => {
      if (!isEditClosuresMode) return;
      const existing = globalClosures.find((gc: any) => gc.col_id === colId && gc.row === null && (gc.month === month && gc.year === year || gc.month === null));
      if (existing) {
          await supabase.from('global_closures').delete().eq('id', existing.id);
          setGlobalClosures((prev: any[]) => prev.filter(gc => gc.id !== existing.id));
      } else {
          const { data, error } = await supabase.from('global_closures').insert({ col_id: colId, row: null, month: month + 1, year }).select();
          if (data && !error) setGlobalClosures((prev: any[]) => [...prev, { ...data[0], month: data[0].month - 1 }]);
      }
  };

  return (
    <div className="flex-1 overflow-auto custom-scrollbar p-8 pb-32 relative">
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-3xl border shadow-sm">
            <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Planning Global</h2>
                <p className="text-xs font-bold text-slate-400 mt-1">Gérez les attributions ou fermez des cases pour tous les tours.</p>
            </div>
            <button 
                onClick={() => setIsEditClosuresMode(!isEditClosuresMode)}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${isEditClosuresMode ? 'bg-red-600 text-white shadow-red-200 hover:bg-red-700' : 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800'}`}
            >
                {isEditClosuresMode ? 'Terminer la fermeture' : 'Fermer des cases'}
            </button>
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
            return (
                <div key={`${year}-${month}`} className="space-y-4 mb-8">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{label}</h2>
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0 table-fixed">
                            <MatrixHeader columns={dynamicColumns} isEditClosuresMode={isEditClosuresMode} onColumnClick={handleColumnClick} globalClosures={globalClosures} month={month} year={year} />
                            <tbody>
                                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                    const date = new Date(year, month, day);
                                    const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3).replace('.', '');
                                    const isSunday = date.getDay() === 0;
                                    const isHoliday = isPublicHoliday(date);
                                    const isOffDay = isSunday || isHoliday;
                                    return (
                                        <tr key={day} className={`h-8 hover:bg-slate-50 ${isOffDay ? 'bg-red-50/30' : ''}`}>
                                            <td className={`sticky left-0 border-r border-b text-center z-10 w-16 h-8 font-black ${isOffDay ? 'bg-red-100 text-red-600' : 'bg-white text-slate-900'}`}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-[10px] font-normal opacity-70">{dayName}</span>
                                                    <span className="text-[10px]">{day}</span>
                                                </div>
                                            </td>
                                            {dynamicColumns.map(col => {
                                                const isColClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === null && (gc.month === null || (gc.month === month && gc.year === year)));
                                                const isCellClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === day && gc.month === month && gc.year === year);
                                                const isClosed = isColClosed ? !isCellClosed : isCellClosed;
                                                
                                                const assigned = choices.find((ch: any) => ch.row === day && ch.col === col.id && ch.month === month && ch.year === year && ch.status === 'ASSIGNED');
                                                
                                                let bgColor = col.customColor || '#FFFFFF';
                                                
                                                const timeRange = parseTimeRange(col.timeRange);
                                                const isWeekendTime = isOffDay || (date.getDay() === 6 && timeRange && timeRange.end > 14);
                                                const isWeekendGuard = isWeekendTime && (col.type === 'Consultation' || col.type === 'Téléconsultation') && col.label !== 'PFG' && col.label !== 'TcN';
                                                
                                                if (isClosed) bgColor = '#fee2e2'; // red-100
                                                else if (assigned) {
                                                    bgColor = col.customColor || '#FFFFFF';
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
                                                        onClick={() => handleCellClick(day, col.id, month, year)}
                                                        className={`border-r border-b border-slate-200 text-center relative min-w-[28px] w-[28px] cursor-pointer transition-opacity align-middle ${isEditClosuresMode ? 'hover:bg-red-200' : 'hover:opacity-80'}`} 
                                                        style={style}
                                                    >
                                                        {isClosed && <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-[2px] bg-red-400 rotate-45 absolute"></div><div className="w-full h-[2px] bg-red-400 -rotate-45 absolute"></div></div>}
                                                        {!isClosed && assigned && <span className="text-[9px] font-black text-slate-900 block leading-tight drop-shadow-sm relative z-10">{assigned.userTrigram}</span>}
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
    </div>
  );
};

const WishesPanel = ({ choices, setChoices, supabase, onRequestHelp, activeRound }: any) => {
    const [subTab, setSubTab] = useState<'journal' | 'data'>('journal');
    const [showExportModal, setShowExportModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'ASSIGNED' | 'REFUSED'>('ALL');
    const [isDragging, setIsDragging] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'default', direction: 'asc' });
    
    // Process File Logic (Shared between Input and Drag&Drop)
    const processFileImport = (file: File, importType: 'CLASSIC' | '4D' = 'CLASSIC') => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            const lines = text.split('\n').filter(l => l.trim());
            
            // Skip header if present (assuming ID,Trigramme...)
            const rows = lines.slice(1);
            if (rows.length === 0) return;

            if(!window.confirm(`Importer ${rows.length} lignes ? Cela écrasera les ID existants correspondants.`)) return;

            let upserts: any[] = [];

            if (importType === 'CLASSIC') {
                upserts = rows.map(line => {
                    const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
                    const matches = line.match(regex) || [];
                    const cols = matches.map(m => m.replace(/^"|"$/g, '').trim());

                    if (cols.length < 16) return null;

                    return {
                        id: cols[0],
                        user_trigram: cols[1],
                        user_role: cols[2],
                        round_id: Number(cols[3]),
                        submitted_at: cols[4] ? new Date(cols[4]).toISOString() : new Date().toISOString(),
                        year: Number(cols[5]),
                        month: Number(cols[6]),
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
                    let cols = line.split('\t').map(c => c.trim());
                    if (cols.length < 9) {
                        cols = line.split(';').map(c => c.trim());
                    }
                    if (cols.length < 9) {
                        cols = line.split(',').map(c => c.trim());
                    }
                    
                    if (cols.length < 9) return null;

                    const trigram = cols[0];
                    if (trigram === 'ZZZ' || trigram === 'YYY') return null;

                    const dateParts = cols[1].split('/');
                    if (dateParts.length !== 3) return null;
                    const day = Number(dateParts[0]);
                    const month = Number(dateParts[1]);
                    const year = Number(dateParts[2]);

                    const colId = Number(cols[7]);
                    if (isNaN(colId)) return null;

                    const id = `${trigram}_${activeRound?.id || 1}_${year}_${month}_${day}_${colId}`;

                    return {
                        id: id,
                        user_trigram: trigram,
                        user_role: 'DOCTOR',
                        round_id: activeRound?.id || 1,
                        submitted_at: new Date().toISOString(),
                        year: year,
                        month: month,
                        row: day,
                        col: colId,
                        col_label: cols[8],
                        col_type: 'GUARD',
                        col_time_range: `${cols[2]} - ${cols[4]}`,
                        category: 'normal',
                        group_index: 1,
                        sub_rank: 1,
                        status: 'ASSIGNED'
                    };
                }).filter(x => x && x.id && x.user_trigram);
            }

            if (upserts.length === 0) {
                alert("Aucune donnée valide trouvée.");
                return;
            }

            const { error } = await supabase.from('choices').upsert(upserts);
            if (error) {
                console.error(error);
                alert("Erreur import: " + error.message);
            } else {
                alert("Import réussi !");
                window.location.reload();
            }
        };
        reader.readAsText(file);
    };

    // Import Handlers
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, importType: 'CLASSIC' | '4D' = 'CLASSIC') => {
        const file = e.target.files?.[0];
        if (file) processFileImport(file, importType);
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
            processFileImport(file);
        } else if (file) {
            alert("Veuillez déposer un fichier CSV valide.");
        }
    };

    const generateCSV = (filter: 'PENDING' | 'ASSIGNED' | 'ALL') => {
        let dataToExport = choices;
        if (filter !== 'ALL') {
            dataToExport = choices.filter((c: any) => c.status === filter);
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

    const generate4DExport = () => {
        let validMonths: {month: number, year: number}[] = [];
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
                validMonths.push({ month: m, year: y });
            }
        }

        const dataToExport = choices.filter((c: any) => {
            if (c.status !== 'ASSIGNED') return false;
            if (validMonths.length > 0) {
                return validMonths.some(vm => vm.month === c.month && vm.year === c.year);
            }
            return true;
        });
        
        let period = '';
        if (activeRound) {
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
        if (filterStatus === 'ALL') return choices;
        return choices.filter((c:any) => c.status === filterStatus);
    }, [choices, filterStatus]);

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
                                <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-1 rounded group-hover:bg-green-100">{choices.filter((c:any) => c.status === 'ASSIGNED').length}</span>
                            </button>
                            <button onClick={() => generateCSV('ALL')} className="w-full py-4 px-6 bg-slate-900 text-white rounded-2xl flex items-center justify-between group hover:bg-blue-600 transition-all shadow-lg shadow-slate-200">
                                <span className="font-black text-xs uppercase tracking-widest">Tout Exporter</span>
                                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded">{choices.length}</span>
                            </button>
                            <button onClick={generate4DExport} className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl flex items-center justify-between group hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 mt-2">
                                <span className="font-black text-xs uppercase tracking-widest">Exporter 4D</span>
                                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded">{choices.filter((c:any) => c.status === 'ASSIGNED').length}</span>
                            </button>
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-center">
                            <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest transition-colors">Annuler</button>
                        </div>
                    </div>
                </div>
            )}

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
                             <button onClick={onRequestHelp} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors text-slate-600">Aide SQL</button>
                        </div>
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                            <div className="overflow-auto custom-scrollbar flex-1">
                                <table className="w-full text-left text-sm">
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
                                                                if(!window.confirm("Supprimer ce vœu ?")) return;
                                                                await supabase.from('choices').delete().eq('id', c.id);
                                                                setChoices((prev: any[]) => prev.filter((x: any) => x.id !== c.id));
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

                {subTab === 'data' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                        {/* EXPORT SECTION */}
                        <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col justify-center items-center text-center space-y-6">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Exporter les Données</h3>
                                <p className="text-slate-400 text-sm font-medium mt-2 max-w-xs mx-auto">Téléchargez l'intégralité de la base de choix au format CSV pour Excel ou JSON pour sauvegarde.</p>
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
                    </div>
                )}
            </div>
        </div>
    );
};