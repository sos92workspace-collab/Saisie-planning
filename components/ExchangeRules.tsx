import React, { useState, useEffect, useCallback, useRef } from 'react';
import { COLUMNS } from '../constants';
import { ColumnDefinition } from '../types';
import { Save, AlertCircle, Check, MousePointerSquareDashed } from 'lucide-react';

export type ExchangePeriod = 'SEMAINE' | 'SAMEDI' | 'DIMANCHE' | 'GLOBAL';
export type TargetPeriod = 'SEMAINE' | 'SAMEDI' | 'DIMANCHE';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set());
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSourcePeriod, setModalSourcePeriod] = useState<ExchangePeriod>('GLOBAL');
  const [modalSourceCols, setModalSourceCols] = useState<number[]>([]);
  const [modalSelections, setModalSelections] = useState<Set<string>>(new Set()); // Format: "colId-targetPeriod"
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'RULES' | 'REQUESTS'>('REQUESTS');
  const [requests, setRequests] = useState<any[]>([]);

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
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchRequests();
    fetchVersions();
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
            month: req.target_month,
            year: req.target_year
        }).eq('id', req.requester_choice_id);
      }

      await supabase.from('exchange_requests').update({ status: action }).eq('id', requestId);
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du traitement de la demande.");
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

      {activeTab === 'REQUESTS' ? (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">
          
          {/* Pending Requests */}
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 mb-4">Demandes en attente</h3>
            {requests.filter(r => r.status === 'PENDING').length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucune demande en attente.</div>
            ) : (
              <div className="space-y-4">
                {requests.filter(r => r.status === 'PENDING').map(req => (
                  <div key={req.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between bg-white shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Demandeur</div>
                        <div className="font-black text-lg text-slate-900">{req.requester_trigram}</div>
                      </div>
                      
                      <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                        <div className="text-[9px] font-black text-orange-500 uppercase mb-1">Cède</div>
                        <div className="font-bold text-slate-900 text-sm">
                          {req.requester_choice?.row}/{req.requester_choice?.month + 1}/{req.requester_choice?.year} - {req.requester_choice?.colLabel}
                        </div>
                      </div>

                      <div className="text-slate-300">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <div className="text-[9px] font-black text-blue-500 uppercase mb-1">Récupère</div>
                        <div className="font-bold text-slate-900 text-sm">
                          {req.target_row}/{req.target_month + 1}/{req.target_year} - {req.target_col_label}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => handleRequestAction(req.id, 'REJECTED')} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-xs font-black uppercase transition-colors">Refuser</button>
                      <button onClick={() => handleRequestAction(req.id, 'APPROVED')} className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg text-xs font-black uppercase transition-colors shadow-sm">Valider</button>
                    </div>
                  </div>
                ))}
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
                {requests.map(req => {
                  const date = new Date(req.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={`log-${req.id}`} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-xs">{date}</span>
                        <span className="font-bold text-slate-700">Demande initiée par {req.requester_trigram}</span>
                        <span className="text-slate-500">
                          ({req.requester_choice?.row}/{req.requester_choice?.month + 1} ➔ {req.target_row}/{req.target_month + 1})
                        </span>
                      </div>
                      {req.status !== 'PENDING' && (
                        <div className="flex items-center gap-2 ml-4 pl-4 border-l-2 border-slate-200">
                          <span className={`font-black uppercase text-[10px] px-2 py-1 rounded-md ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {req.status === 'APPROVED' ? 'Échange validé' : 'Échange refusé'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
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
                      alert("Snapshot enregistré avec succès !");
                    } catch (err) {
                      console.error(err);
                      if (err instanceof Error) {
                        alert("Erreur lors de la sauvegarde du snapshot : " + err.message);
                      } else if (err && typeof err === 'object' && 'message' in err) {
                        alert("Erreur lors de la sauvegarde du snapshot : " + err.message);
                      } else {
                        alert("Erreur lors de la sauvegarde du snapshot.");
                      }
                    }
                  }}
                  className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-black uppercase rounded-lg shadow-sm"
                >
                  Enregistrer un snapshot
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
              {COLUMNS.map(col => (
                <th key={col.id} className="p-2 border-b border-r border-slate-200 min-w-[80px] text-center">
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => toggleColSelection(col.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedCols.has(col.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent hover:border-blue-400'}`}
                    >
                      <Check size={12} strokeWidth={4} />
                    </button>
                    <div className={`text-xs font-black px-2 py-1 rounded ${col.colorClass} text-slate-900 whitespace-nowrap`}>
                      <span className="opacity-60 mr-1">#{col.id}</span>
                      {col.label}
                    </div>
                  </div>
                </th>
              ))}
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
                  Équivalences pour {modalSourceCols.length > 1 ? `${modalSourceCols.length} colonnes` : `Colonne #${modalSourceCols[0]} - ${COLUMNS.find(c => c.id === modalSourceCols[0])?.label}`}
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
                    {COLUMNS.map(col => (
                      <th key={col.id} className="p-2 border-b border-slate-200 text-center min-w-[60px]">
                        <div className={`text-[10px] font-black px-1.5 py-1 rounded ${col.colorClass} text-slate-900 inline-block whitespace-nowrap`}>
                          <span className="opacity-60 mr-1">#{col.id}</span>
                          {col.label}
                        </div>
                      </th>
                    ))}
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
