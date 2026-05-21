import React, { useState, useEffect, useCallback, useRef } from 'react';
import { COLUMNS, isPublicHoliday } from '../constants';
import { ColumnDefinition } from '../types';
import { Save, AlertCircle, Check, MousePointerSquareDashed } from 'lucide-react';

export type ExchangePeriod = 'SEMAINE' | 'SAMEDI' | 'DIMANCHE' | 'GLOBAL';
export type TargetPeriod = 'SEMAINE' | 'SAMEDI' | 'DIMANCHE';

const formatRequestDate = (day: number | undefined, month: number | undefined, year: number | undefined, col: number | undefined, colLabel: string | undefined, is1IndexedMonth: boolean = false, columnConfigs: any[] = []) => {
  if (day == null || month == null || year == null || col == null) return '';
  const adjustedMonth = is1IndexedMonth ? month - 1 : month;
  const d = new Date(year, adjustedMonth, day);
  const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' }).toUpperCase();
  const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const jf = isPublicHoliday(d) ? ' - JF' : '';
  const columnDef = COLUMNS.find(c => c.id === col);
  const cfg = columnConfigs.find(c => c.column_id === col);
  const displayLabel = colLabel || cfg?.custom_label || columnDef?.label || '';
  const typeInfos = columnDef ? ` | ${cfg?.custom_type || columnDef.type} ${cfg?.custom_time_range || columnDef.timeRange}` : '';
  return `Col. ${col} : ${displayLabel} - ${dayName} ${dateStr}${jf}${typeInfos}`;
};

export interface ExchangeMode {
  col_id: number;
  mode: 'GLOBAL' | 'INDIVIDUAL';
}

export interface ExchangeRule {
  source_col_id: number;
  source_period: ExchangePeriod;
  target_col_id: number;
  target_period: TargetPeriod;
}

interface ExchangeRulesProps {
  supabase: any;
}

export const ExchangeRules: React.FC<ExchangeRulesProps> = ({ supabase }) => {
  const [modes, setModes] = useState<Record<number, 'GLOBAL' | 'INDIVIDUAL'>>({});
  const [rules, setRules] = useState<ExchangeRule[]>([]);
  const [columnConfigs, setColumnConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set());
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSourcePeriod, setModalSourcePeriod] = useState<ExchangePeriod>('GLOBAL');
  const [modalSourceCols, setModalSourceCols] = useState<number[]>([]);
  const [modalSelections, setModalSelections] = useState<Set<string>>(new Set()); // Format: "colId-targetPeriod"
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'RULES' | 'REQUESTS' | 'ABANDONS'>('REQUESTS');
  const [requests, setRequests] = useState<any[]>([]);
  const [abandons, setAbandons] = useState<any[]>([]);

  // Versioning state
  const [exchangeVersions, setExchangeVersions] = useState<any[]>([]);
  const selectedVersionIdRef = useRef<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const fetchVersions = async () => {
    try {
      const { data, error } = await supabase.from('exchange_rule_versions').select('*').order('created_at', { ascending: false });
      if (data) setExchangeVersions(data);
    } catch (e) { console.error(e); }
  };

  const fetchColumnConfigs = async () => {
    try {
      const { data } = await supabase.from('column_configs').select('*');
      if (data) setColumnConfigs(data);
    } catch (e) { console.error(e); }
  };

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: modesData, error: modesError } = await supabase.from('exchange_modes').select('*');
      if (modesError) throw modesError;
      
      const { data: rulesData, error: rulesError } = await supabase.from('exchange_rules').select('*');
      if (rulesError) throw rulesError;

      const modesMap: Record<number, 'GLOBAL' | 'INDIVIDUAL'> = {};
      if (modesData) {
        modesData.forEach((m: any) => {
          modesMap[m.col_id] = m.mode;
        });
      }
      setModes(modesMap);
      setRules(rulesData || []);
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors du chargement des règles. Avez-vous exécuté le script SQL pour créer les tables ?");
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('exchange_requests')
        .select(`
          *,
          requester_choice:choices!requester_choice_id(*),
          target_choice:choices!target_choice_id(*)
        `)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAbandons = async () => {
    try {
      const { data, error } = await supabase
        .from('abandon_requests')
        .select(`
          *,
          requester_choice:choices!choice_id(*)
        `)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setAbandons(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const [users, setUsers] = useState<any[]>([]);
  const [counterResetDate, setCounterResetDate] = useState<Date>(new Date(0));
  const [isCounterExpanded, setIsCounterExpanded] = useState(false);

  const fetchUsersAndLogs = async () => {
    try {
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData) setUsers(usersData);

      const { data: logsData } = await supabase.from('logs')
        .select('created_at')
        .eq('action', 'RESET_ABANDON_COUNTER')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (logsData && logsData.length > 0) {
        setCounterResetDate(new Date(logsData[0].created_at));
      } else {
        setCounterResetDate(new Date(0));
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchColumnConfigs();
    fetchRules();
    fetchRequests();
    fetchVersions();
    fetchAbandons();
    fetchUsersAndLogs();
  }, []);

  const handleRequestAction = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const req = requests.find(r => r.id === requestId);
      if (!req) return;

      if (action === 'APPROVED') {
        // Update the requester's choice to the new coordinates
        await supabase.from('choices').update({ 
            row: req.target_row,
            col: req.target_col,
            month: req.target_month + 1,
            year: req.target_year
        }).eq('id', req.requester_choice_id);

        // Auto-reject other pending requests for the same target cell
        const otherRequests = requests.filter(r => 
          r.id !== req.id && 
          r.status === 'PENDING' &&
          r.target_row === req.target_row &&
          r.target_col === req.target_col &&
          r.target_month === req.target_month &&
          r.target_year === req.target_year
        );

        if (otherRequests.length > 0) {
          const reason = `Refusé car attribué à ${req.requester_trigram}`;
          const otherIds = otherRequests.map(r => r.id);
          await supabase.from('exchange_requests')
            .update({ status: 'REJECTED', reason, updated_at: new Date().toISOString() })
            .in('id', otherIds);
        }
      }

      await supabase.from('exchange_requests').update({ status: action, updated_at: new Date().toISOString() }).eq('id', requestId);
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du traitement de la demande.");
    }
  };

  const handleAbandonAction = async (abandonId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      if (action === 'APPROVED') {
        const ab = abandons.find(a => a.id === abandonId);
        if (ab) {
            // Delete the choice if approved
            await supabase.from('choices').delete().eq('id', ab.choice_id);
        }
      }
      await supabase.from('abandon_requests').update({ status: action, updated_at: new Date().toISOString() }).eq('id', abandonId);
      fetchAbandons();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du traitement de la demande d'abandon.");
    }
  };

  const toggleColSelection = (colId: number) => {
    const newSet = new Set(selectedCols);
    if (newSet.has(colId)) newSet.delete(colId);
    else newSet.add(colId);
    setSelectedCols(newSet);
  };

  const handleModeChange = async (colId: number, mode: 'GLOBAL' | 'INDIVIDUAL') => {
    // If multiple selected and this col is selected, apply to all selected
    const colsToUpdate = selectedCols.has(colId) ? [...selectedCols] : [colId];
    
    const newModes = { ...modes };
    colsToUpdate.forEach((c: number) => newModes[c] = mode);
    setModes(newModes);

    try {
      if (selectedVersionIdRef.current) {
        const dump = { modes: newModes, rules };
        const { error } = await supabase.from('exchange_rule_versions').update({ rules_data: dump }).eq('id', selectedVersionIdRef.current);
        if (error) throw error;
      } else {
        const upserts = colsToUpdate.map(c => ({ col_id: c, mode }));
        const { error } = await supabase.from('exchange_modes').upsert(upserts);
        if (error) throw error;
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        alert("Erreur lors de la sauvegarde du mode. " + err.message);
      } else if (err && typeof err === 'object' && 'message' in err) {
        alert("Erreur lors de la sauvegarde du mode. " + err.message);
      } else {
        alert("Erreur lors de la sauvegarde du mode.");
      }
    }
  };

  const openModal = (colId: number, period: ExchangePeriod) => {
    const colsToEdit = selectedCols.has(colId) ? Array.from(selectedCols) : [colId];
    setModalSourceCols(colsToEdit);
    setModalSourcePeriod(period);
    
    // Load existing selections for the FIRST column in the selection (to initialize the modal)
    const existingRules = rules.filter(r => r.source_col_id === colsToEdit[0] && r.source_period === period);
    const initialSelections = new Set<string>();
    existingRules.forEach(r => {
      initialSelections.add(`${r.target_col_id}-${r.target_period}`);
    });
    setModalSelections(initialSelections);
    setModalOpen(true);
  };

  const saveModal = async () => {
    try {
      const updatedRules = rules.filter(r => !(modalSourceCols.includes(r.source_col_id) && r.source_period === modalSourcePeriod));
      const newRulesToInsert: any[] = [];
      modalSourceCols.forEach(colId => {
        modalSelections.forEach(sel => {
          const [targetColIdStr, targetPeriod] = sel.split('-');
          newRulesToInsert.push({
            source_col_id: colId,
            source_period: modalSourcePeriod,
            target_col_id: parseInt(targetColIdStr, 10),
            target_period: targetPeriod
          });
        });
      });

      const finalRules = [...updatedRules, ...newRulesToInsert];
      setRules(finalRules);

      if (selectedVersionIdRef.current) {
        const dump = { modes, rules: finalRules };
        const { error } = await supabase.from('exchange_rule_versions').update({ rules_data: dump }).eq('id', selectedVersionIdRef.current);
        if (error) throw error;
      } else {
        // 1. Delete existing rules for the selected source columns and period
        for (const colId of modalSourceCols) {
          const { error: delError } = await supabase.from('exchange_rules')
            .delete()
            .eq('source_col_id', colId)
            .eq('source_period', modalSourcePeriod);
          if (delError) throw delError;
        }

        // 2. Insert new rules
        if (newRulesToInsert.length > 0) {
          const { error: insError } = await supabase.from('exchange_rules').insert(newRulesToInsert);
          if (insError) throw insError;
        }
      }

      setModalOpen(false);
      // We don't fetchRules() here to avoid replacing version edit buffer, or we do it safely:
      if (!selectedVersionIdRef.current) {
        fetchRules(); // Refresh only if live
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        alert("Erreur lors de la sauvegarde des règles : " + err.message);
      } else if (err && typeof err === 'object' && 'message' in err) {
        alert("Erreur lors de la sauvegarde des règles : " + err.message);
      } else {
        alert("Erreur lors de la sauvegarde des règles.");
      }
    }
  };

  const handleCellMouseDown = (colId: number, period: TargetPeriod) => {
    setIsDragging(true);
    const key = `${colId}-${period}`;
    const newValue = !modalSelections.has(key);
    setDragValue(newValue);
    updateSelection(key, newValue);
  };

  const handleCellMouseEnter = (colId: number, period: TargetPeriod) => {
    if (isDragging) {
      const key = `${colId}-${period}`;
      updateSelection(key, dragValue);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateSelection = (key: string, value: boolean) => {
    setModalSelections(prev => {
      const next = new Set(prev);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const isConfigured = (colId: number, period: ExchangePeriod) => {
    return rules.some(r => r.source_col_id === colId && r.source_period === period);
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold">Chargement des règles...</div>;

  return (
    <div className="p-6 h-full flex flex-col" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Paramétrage des Échanges</h2>
          <p className="text-sm text-slate-500 font-medium">Définissez les règles et gérez les demandes d'échange.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('REQUESTS')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'REQUESTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Demandes
            {requests.filter(r => r.status === 'PENDING').length > 0 && (
              <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                {requests.filter(r => r.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('ABANDONS')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'ABANDONS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Abandons
            {abandons.filter(a => a.status === 'PENDING').length > 0 && (
              <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                {abandons.filter(a => a.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('RULES')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'RULES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Règles d'équivalence
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-xl text-sm font-bold">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {activeTab === 'REQUESTS' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">
          
          {/* Pending Requests */}
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 mb-4">Demandes en attente</h3>
            {requests.filter(r => r.status === 'PENDING').length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucune demande en attente.</div>
            ) : (
              <div className="space-y-4">
                {requests.filter(r => r.status === 'PENDING').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(req => {
                  const date = new Date(req.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                  <div key={req.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between bg-white shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Demandeur</div>
                        <div className="font-black text-xl text-slate-900 leading-none">{req.requester_trigram}</div>
                        <div className="text-[9px] text-slate-400 mt-2 whitespace-nowrap">{date}</div>
                      </div>
                      
                      <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                        <div className="text-[9px] font-black text-orange-500 uppercase mb-1">Cède</div>
                        <div className="font-bold text-slate-900 text-sm">
                          {formatRequestDate(req.requester_choice?.row, req.requester_choice?.month, req.requester_choice?.year, req.requester_choice?.col, req.requester_choice?.colLabel, true, columnConfigs)}
                        </div>
                      </div>

                      <div className="text-slate-300">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <div className="text-[9px] font-black text-blue-500 uppercase mb-1">Récupère</div>
                        <div className="font-bold text-slate-900 text-sm">
                          {formatRequestDate(req.target_row, req.target_month, req.target_year, req.target_col, req.target_col_label, false, columnConfigs)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => handleRequestAction(req.id, 'REJECTED')} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-xs font-black uppercase transition-colors">Refuser</button>
                      <button onClick={() => handleRequestAction(req.id, 'APPROVED')} className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg text-xs font-black uppercase transition-colors shadow-sm">Valider</button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>

          {/* History Logs */}
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 mb-4">Historique des actions</h3>
            {requests.length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucun historique.</div>
            ) : (
              <div className="space-y-3">
                {[...requests].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(req => {
                  const date = new Date(req.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={`log-${req.id}`} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50 text-sm">
                      <div className="flex items-start gap-4">
                        <span className="text-slate-400 font-mono text-xs mt-1 min-w-[120px]">{date}</span>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-700">Demande initiée par {req.requester_trigram}</span>
                          <span className="text-slate-500 text-xs">
                          Cède [{formatRequestDate(req.requester_choice?.row, req.requester_choice?.month, req.requester_choice?.year, req.requester_choice?.col, req.requester_choice?.colLabel, true, columnConfigs)}] ➔ Récupère [{formatRequestDate(req.target_row, req.target_month, req.target_year, req.target_col, req.target_col_label, false, columnConfigs)}]
                          </span>
                        </div>
                      </div>
                      {req.status !== 'PENDING' && (
                        <div className="flex flex-col gap-1 ml-[136px] pl-4 border-l-2 border-slate-200 mt-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-fit font-black uppercase text-[10px] px-2 py-1 rounded-md ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {req.status === 'APPROVED' ? 'Échange validé' : 'Échange refusé'}
                            </span>
                            {req.updated_at && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                le {new Date(req.updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          {req.reason && <span className="text-xs text-slate-500 italic mt-1">{req.reason}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      
      {activeTab === 'ABANDONS' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">
          
          {/* Compteur Medecin */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button 
              onClick={() => setIsCounterExpanded(!isCounterExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-slate-100 transition-colors"
            >
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Compteur médecin (Abandons)</h3>
              <div className="flex items-center gap-4">
                 <span className="text-xs font-bold text-slate-500">Depuis le {counterResetDate.getFullYear() === 1970 ? 'début' : counterResetDate.toLocaleDateString('fr-FR')}</span>
                 <svg className={`w-5 h-5 text-slate-500 transform transition-transform ${isCounterExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </button>
            {isCounterExpanded && (
              <div className="p-6 border-t border-slate-200 bg-white">
                <div className="flex justify-end mb-6">
                  <button 
                    onClick={async () => {
                      const adminUser = users.find(u => u.role === 'ADMIN');
                      if (!adminUser) return alert("Utilisateur admin non trouvé.");
                      
                      const pwd = window.prompt("Pour réinitialiser le compteur, veuillez saisir le mot de passe administrateur :");
                      if (pwd === null) return;
                      if (pwd !== adminUser.password) return alert("Mot de passe incorrect.");
                      
                      try {
                        const { error } = await supabase.from('logs').insert([{ action: 'RESET_ABANDON_COUNTER', details: {} }]);
                        if (error) throw error;
                        fetchUsersAndLogs();
                        alert("Compteur réinitialisé avec succès.");
                      } catch (err) {
                        console.error(err);
                        alert("Erreur lors de la réinitialisation.");
                      }
                    }}
                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-black uppercase transition-colors shadow-sm"
                  >
                    Réinitialiser le compteur
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Titulaires */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2 mb-3">Titulaires</h4>
                    <div className="flex flex-col gap-2">
                       {users.filter(u => u.role === 'DOCTOR').sort((a,b) => a.trigram.localeCompare(b.trigram)).map(user => {
                          const count = abandons.filter(a => {
                            if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                            const actionDate = new Date(a.updated_at || a.created_at);
                            return actionDate > counterResetDate;
                          }).length;
                          return (
                            <div key={user.trigram} className="flex items-center justify-between py-1">
                              <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${count > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>{count}</span>
                            </div>
                          )
                       })}
                    </div>
                  </div>

                  {/* Remplaçants */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2 mb-3">Remplaçants</h4>
                    <div className="flex flex-col gap-2">
                       {users.filter(u => u.role === 'SUBSTITUTE').sort((a,b) => a.trigram.localeCompare(b.trigram)).map(user => {
                          const count = abandons.filter(a => {
                            if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                            const actionDate = new Date(a.updated_at || a.created_at);
                            return actionDate > counterResetDate;
                          }).length;
                          return (
                            <div key={user.trigram} className="flex items-center justify-between py-1">
                              <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${count > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>{count}</span>
                            </div>
                          )
                       })}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Pending Abandons */}
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 mb-4">Demandes d'abandon en attente</h3>
            {abandons.filter(a => a.status === 'PENDING').length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucun abandon en attente.</div>
            ) : (
              <div className="space-y-4">
                {abandons.filter(a => a.status === 'PENDING').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(ab => {
                  const date = new Date(ab.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                  <div key={ab.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between bg-white shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Demandeur</div>
                        <div className="font-black text-xl text-slate-900 leading-none">{ab.requester_trigram}</div>
                        <div className="text-[9px] text-slate-400 mt-2 whitespace-nowrap">{date}</div>
                      </div>
                      
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                        <div className="text-[9px] font-black text-rose-500 uppercase mb-1">Garde à abandonner</div>
                        <div className="text-sm font-bold text-slate-800">
                           {formatRequestDate(ab.requester_choice?.row, ab.requester_choice?.month, ab.requester_choice?.year, ab.requester_choice?.col, ab.requester_choice?.colLabel, true, columnConfigs)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => handleAbandonAction(ab.id, 'REJECTED')} className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg text-xs font-black uppercase transition-colors shadow-sm">Refuser</button>
                       <button onClick={() => handleAbandonAction(ab.id, 'APPROVED')} className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg text-xs font-black uppercase transition-colors shadow-sm">Prise en compte</button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>

          {/* History Logs */}
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 mb-4">Historique des abandons</h3>
            {abandons.length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucun historique.</div>
            ) : (
              <div className="space-y-3">
                {[...abandons].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(ab => {
                  const date = new Date(ab.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={`log-${ab.id}`} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50 text-sm">
                      <div className="flex items-start gap-4">
                        <span className="text-slate-400 font-mono text-xs mt-1 min-w-[120px]">{date}</span>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-700">Demande initiée par {ab.requester_trigram}</span>
                          <span className="text-slate-500 text-xs">
                          Garde [{formatRequestDate(ab.requester_choice?.row, ab.requester_choice?.month, ab.requester_choice?.year, ab.requester_choice?.col, ab.requester_choice?.colLabel, true, columnConfigs)}]
                          </span>
                        </div>
                      </div>
                      {ab.status !== 'PENDING' && (
                        <div className="flex flex-col gap-1 ml-[136px] pl-4 border-l-2 border-slate-200 mt-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-fit font-black uppercase text-[10px] px-2 py-1 rounded-md ${ab.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {ab.status === 'APPROVED' ? 'Traité' : 'Abandon refusé'}
                            </span>
                            {ab.updated_at && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                le {new Date(ab.updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'RULES' && (
        <div className="flex-1 flex flex-col gap-4">
          
          {/* VERSION MANAGER */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs font-black uppercase text-slate-500">Version du paramétrage :</span>
              <select 
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-lg px-4 py-2 outline-none focus:ring-2 ring-blue-500 cursor-pointer"
                value={selectedVersionId || 'active'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'active') {
                    setSelectedVersionId(null);
                    selectedVersionIdRef.current = null;
                    fetchRules(); // Reload from live
                  } else {
                    const version = exchangeVersions.find(v => v.id === val);
                    if (version) {
                      setSelectedVersionId(val);
                      selectedVersionIdRef.current = val;
                      // In memory update of the grid preview
                      const parsed = version.rules_data || { modes: {}, rules: [] };
                      setModes(parsed.modes || {});
                      setRules(parsed.rules || []);
                    }
                  }
                }}
              >
                <option value="active">🟢 Configuration en ligne (Active)</option>
                {exchangeVersions.length > 0 && (
                  <optgroup label="Versions sauvegardées">
                    {exchangeVersions.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({new Date(v.created_at).toLocaleDateString('fr-FR')})</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="flex gap-2">
              {selectedVersionId ? (
                <>
                  <button 
                    onClick={async () => {
                      if(!window.confirm("Remplacer la configuration en ligne par cette version ?")) return;
                      const v = exchangeVersions.find(ver => ver.id === selectedVersionId);
                      if (!v) return;
                      const parsed = v.rules_data || { modes: {}, rules: [] };
                      
                      try {
                        // 1. Clear active
                        const { error: err1 } = await supabase.from('exchange_modes').delete().not('col_id', 'is', null);
                        if (err1) throw err1;
                        const { error: err2 } = await supabase.from('exchange_rules').delete().not('source_col_id', 'is', null);
                        if (err2) throw err2;
                        
                        // 2. Insert new
                        const modeUpserts = Object.keys(parsed.modes).map(k => ({ col_id: parseInt(k, 10), mode: parsed.modes[k] }));
                        if (modeUpserts.length > 0) {
                          const { error: err3 } = await supabase.from('exchange_modes').insert(modeUpserts);
                          if (err3) throw err3;
                        }
                        if (parsed.rules && parsed.rules.length > 0) {
                          const { error: err4 } = await supabase.from('exchange_rules').insert(parsed.rules);
                          if (err4) throw err4;
                        }
                        
                        alert("Configuration en ligne mise à jour !");
                        setSelectedVersionId(null);
                        selectedVersionIdRef.current = null;
                        fetchRules();
                      } catch (err) {
                        console.error(err);
                        if (err instanceof Error) {
                          alert("Erreur lors de l'application de la version : " + err.message);
                        } else if (err && typeof err === 'object' && 'message' in err) {
                          alert("Erreur lors de l'application de la version : " + err.message);
                        } else {
                          alert("Erreur lors de l'application de la version.");
                        }
                      }
                    }}
                    className="px-4 py-2 bg-emerald-500 text-white text-xs font-black uppercase rounded-lg hover:bg-emerald-600 shadow-sm"
                  >
                    Définir comme Active
                  </button>
                  <button 
                    onClick={async () => {
                      if(!window.confirm("Supprimer cette version ?")) return;
                      try {
                        const { error } = await supabase.from('exchange_rule_versions').delete().eq('id', selectedVersionId);
                        if (error) throw error;
                        setSelectedVersionId(null);
                        selectedVersionIdRef.current = null;
                        fetchVersions();
                        fetchRules();
                      } catch (err) {
                        console.error(err);
                        if (err instanceof Error) {
                          alert("Erreur lors de la suppression : " + err.message);
                        } else if (err && typeof err === 'object' && 'message' in err) {
                          alert("Erreur lors de la suppression : " + err.message);
                        } else {
                          alert("Erreur.");
                        }
                      }
                    }}
                    className="px-4 py-2 bg-red-50 text-red-600 hover:text-white hover:bg-red-600 text-xs font-black uppercase rounded-lg"
                  >
                    Supprimer
                  </button>
                </>
              ) : (
                <button 
                  onClick={async () => {
                    const name = window.prompt("Nom de la version :");
                    if (!name) return;
                    const dump = { modes, rules };
                    try {
                      const { error } = await supabase.from('exchange_rule_versions').insert([{ name, is_active: false, rules_data: dump }]);
                      if (error) throw error;
                      fetchVersions();
                      alert("Version enregistrée avec succès !");
                    } catch (err) {
                      console.error(err);
                      if (err instanceof Error) {
                        alert("Erreur lors de la sauvegarde de la version : " + err.message);
                      } else if (err && typeof err === 'object' && 'message' in err) {
                        alert("Erreur lors de la sauvegarde de la version : " + err.message);
                      } else {
                        alert("Erreur lors de la sauvegarde de la version.");
                      }
                    }
                  }}
                  className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-black uppercase rounded-lg shadow-sm"
                >
                  Enregistrer une version
                </button>
              )}
            </div>
          </div>

          <div className={`overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm ${selectedVersionId ? 'ring-4 ring-amber-100 border-amber-300' : ''}`}>
            {selectedVersionId && (
              <div className="bg-amber-50 px-4 py-2 text-amber-700 text-xs font-bold flex items-center justify-center border-b border-amber-200 sticky left-0 z-40">
                Vous consultez/modifiez une version sauvegardée. Appliquez-la pour la rendre active.
              </div>
            )}
          <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
            <tr>
              <th className="p-3 border-b border-r border-slate-200 bg-slate-100 min-w-[150px] sticky left-0 z-30">
                <div className="text-[10px] font-black uppercase text-slate-500">Période \ Colonne</div>
              </th>
              {COLUMNS.map(col => {
                const cfg = columnConfigs.find(c => c.column_id === col.id);
                const displayLabel = cfg?.custom_label || col.label;
                const displayColorStyle = cfg?.custom_color ? { backgroundColor: cfg.custom_color } : {};
                const displayColorClass = cfg?.custom_color ? '' : col.colorClass;
                return (
                <th key={col.id} className="p-2 border-b border-r border-slate-200 min-w-[80px] text-center">
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => toggleColSelection(col.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedCols.has(col.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent hover:border-blue-400'}`}
                    >
                      <Check size={12} strokeWidth={4} />
                    </button>
                    <div 
                      className={`text-xs font-black px-2 py-1 rounded text-slate-900 whitespace-nowrap ${displayColorClass}`}
                      style={displayColorStyle}
                    >
                      <span className="opacity-60 mr-1">#{col.id}</span>
                      {displayLabel}
                    </div>
                  </div>
                </th>
              )})}
            </tr>
          </thead>
          <tbody>
            {/* MODE ROW */}
            <tr>
              <td className="p-3 border-b border-r border-slate-200 bg-slate-50 font-bold text-xs uppercase sticky left-0 z-10">
                Mode
              </td>
              {COLUMNS.map(col => {
                const mode = modes[col.id] || 'GLOBAL';
                return (
                  <td key={col.id} className="p-2 border-b border-r border-slate-200 text-center">
                    <select 
                      value={mode}
                      onChange={(e) => handleModeChange(col.id, e.target.value as 'GLOBAL' | 'INDIVIDUAL')}
                      className="text-[10px] font-bold uppercase bg-slate-100 border border-slate-200 rounded p-1 outline-none cursor-pointer"
                    >
                      <option value="GLOBAL">Global</option>
                      <option value="INDIVIDUAL">Par moment</option>
                    </select>
                  </td>
                );
              })}
            </tr>

            {/* GLOBAL ROW */}
            <tr>
              <td className="p-3 border-b border-r border-slate-200 bg-slate-50 font-bold text-xs uppercase sticky left-0 z-10">
                Global
              </td>
              {COLUMNS.map(col => {
                const mode = modes[col.id] || 'GLOBAL';
                const isActive = mode === 'GLOBAL';
                const configured = isConfigured(col.id, 'GLOBAL');
                return (
                  <td key={col.id} className={`p-2 border-b border-r border-slate-200 text-center transition-colors ${isActive ? 'hover:bg-slate-50 cursor-pointer' : 'bg-slate-100 opacity-50'}`}
                      onClick={() => isActive && openModal(col.id, 'GLOBAL')}>
                    {isActive && (
                      <div className={`w-6 h-6 mx-auto rounded-md border ${configured ? 'bg-green-500 border-green-600 shadow-sm' : 'bg-white border-slate-300 border-dashed'}`}></div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* SEMAINE ROW */}
            <tr>
              <td className="p-3 border-b border-r border-slate-200 bg-slate-50 font-bold text-xs uppercase sticky left-0 z-10">
                Semaine
              </td>
              {COLUMNS.map(col => {
                const mode = modes[col.id] || 'GLOBAL';
                const isActive = mode === 'INDIVIDUAL';
                const configured = isConfigured(col.id, 'SEMAINE');
                return (
                  <td key={col.id} className={`p-2 border-b border-r border-slate-200 text-center transition-colors ${isActive ? 'hover:bg-slate-50 cursor-pointer' : 'bg-slate-100 opacity-50'}`}
                      onClick={() => isActive && openModal(col.id, 'SEMAINE')}>
                    {isActive && (
                      <div className={`w-6 h-6 mx-auto rounded-md border ${configured ? 'bg-green-500 border-green-600 shadow-sm' : 'bg-white border-slate-300 border-dashed'}`}></div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* SAMEDI ROW */}
            <tr>
              <td className="p-3 border-b border-r border-slate-200 bg-slate-50 font-bold text-xs uppercase sticky left-0 z-10">
                Samedi
              </td>
              {COLUMNS.map(col => {
                const mode = modes[col.id] || 'GLOBAL';
                const isActive = mode === 'INDIVIDUAL';
                const configured = isConfigured(col.id, 'SAMEDI');
                return (
                  <td key={col.id} className={`p-2 border-b border-r border-slate-200 text-center transition-colors ${isActive ? 'hover:bg-slate-50 cursor-pointer' : 'bg-slate-100 opacity-50'}`}
                      onClick={() => isActive && openModal(col.id, 'SAMEDI')}>
                    {isActive && (
                      <div className={`w-6 h-6 mx-auto rounded-md border ${configured ? 'bg-green-500 border-green-600 shadow-sm' : 'bg-white border-slate-300 border-dashed'}`}></div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* DIMANCHE ROW */}
            <tr>
              <td className="p-3 border-b border-r border-slate-200 bg-slate-50 font-bold text-xs uppercase sticky left-0 z-10">
                Dimanche / JF
              </td>
              {COLUMNS.map(col => {
                const mode = modes[col.id] || 'GLOBAL';
                const isActive = mode === 'INDIVIDUAL';
                const configured = isConfigured(col.id, 'DIMANCHE');
                return (
                  <td key={col.id} className={`p-2 border-b border-r border-slate-200 text-center transition-colors ${isActive ? 'hover:bg-slate-50 cursor-pointer' : 'bg-slate-100 opacity-50'}`}
                      onClick={() => isActive && openModal(col.id, 'DIMANCHE')}>
                    {isActive && (
                      <div className={`w-6 h-6 mx-auto rounded-md border ${configured ? 'bg-green-500 border-green-600 shadow-sm' : 'bg-white border-slate-300 border-dashed'}`}></div>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onMouseUp={handleMouseUp}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-xl font-black uppercase text-slate-900">
                  Équivalences pour {modalSourceCols.length > 1 ? `${modalSourceCols.length} colonnes` : `Colonne #${modalSourceCols[0]} - ${columnConfigs.find(c => c.column_id === modalSourceCols[0])?.custom_label || COLUMNS.find(c => c.id === modalSourceCols[0])?.label}`}
                </h3>
                <p className="text-sm font-bold text-slate-500 mt-1">
                  Période source : <span className="text-blue-600">{modalSourcePeriod}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mr-4 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  <MousePointerSquareDashed size={14} />
                  Maintenez le clic pour sélectionner rapidement
                </div>
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 uppercase">Annuler</button>
                <button onClick={saveModal} className="px-6 py-2 bg-blue-600 text-white text-sm font-black uppercase rounded-xl hover:bg-blue-700 shadow-lg flex items-center gap-2">
                  <Save size={16} /> Enregistrer
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-50/50 select-none">
              <table className="w-full text-left border-collapse bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 border-b border-r border-slate-200 font-black text-xs uppercase text-slate-500 sticky left-0 z-10 bg-slate-100">Cible</th>
                    {COLUMNS.map(col => {
                      const cfg = columnConfigs.find(c => c.column_id === col.id);
                      const displayLabel = cfg?.custom_label || col.label;
                      const displayColorStyle = cfg?.custom_color ? { backgroundColor: cfg.custom_color } : {};
                      const displayColorClass = cfg?.custom_color ? '' : col.colorClass;
                      return (
                      <th key={col.id} className="p-2 border-b border-slate-200 text-center min-w-[60px]">
                        <div 
                           className={`text-[10px] font-black px-1.5 py-1 rounded text-slate-900 inline-block whitespace-nowrap ${displayColorClass}`}
                           style={displayColorStyle}
                        >
                          <span className="opacity-60 mr-1">#{col.id}</span>
                          {displayLabel}
                        </div>
                      </th>
                    )})}
                  </tr>
                </thead>
                <tbody>
                  {(['SEMAINE', 'SAMEDI', 'DIMANCHE'] as TargetPeriod[]).map(period => (
                    <tr key={period}>
                      <td className="p-3 border-b border-r border-slate-200 font-bold text-xs uppercase text-slate-700 sticky left-0 z-10 bg-white">
                        {period === 'DIMANCHE' ? 'Dimanche/JF' : period}
                      </td>
                      {COLUMNS.map(col => {
                        const key = `${col.id}-${period}`;
                        const isSelected = modalSelections.has(key);
                        return (
                          <td 
                            key={col.id} 
                            className={`p-1 border-b border-slate-100 text-center cursor-pointer transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-slate-50'}`}
                            onMouseDown={() => handleCellMouseDown(col.id, period)}
                            onMouseEnter={() => handleCellMouseEnter(col.id, period)}
                          >
                            <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center transition-all ${isSelected ? 'bg-green-500 text-white shadow-sm scale-110' : 'bg-slate-100 text-transparent'}`}>
                              <Check size={14} strokeWidth={4} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
