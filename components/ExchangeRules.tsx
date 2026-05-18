import React, { useState, useEffect, useCallback, useRef } from 'react';
import { COLUMNS } from '../constants';
import { ColumnDefinition } from '../types';
import { Save, AlertCircle, Check, MousePointerSquareDashed } from 'lucide-react';

export type ExchangePeriod = 'SEMAINE' | 'SAMEDI' | 'DIMANCHE' | 'GLOBAL';
export type TargetPeriod = 'SEMAINE' | 'SAMEDI' | 'DIMANCHE';

export interface ExchangeRuleSet {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface ExchangeMode {
  id?: string;
  set_id: string;
  col_id: number;
  mode: 'GLOBAL' | 'INDIVIDUAL';
}

export interface ExchangeRule {
  id?: string;
  set_id: string;
  source_col_id: number;
  source_period: ExchangePeriod;
  target_col_id: number;
  target_period: TargetPeriod;
}

interface ExchangeRulesProps {
  supabase: any;
}

export const ExchangeRules: React.FC<ExchangeRulesProps> = ({ supabase }) => {
  const [ruleSets, setRuleSets] = useState<ExchangeRuleSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  
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

  const [activeTab, setActiveTab] = useState<'RULES' | 'REQUESTS'>('RULES'); // Defaulted to RULES
  const [requests, setRequests] = useState<any[]>([]);

  const fetchRuleSets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('exchange_rule_sets').select('*').order('created_at', { ascending: true });
      if (error) {
        // Fallback for missing table
        console.warn("exchange_rule_sets table might be missing.", error);
        setError("La table exchange_rule_sets est introuvable. Veuillez exécuter le script SQL fourni.");
        return;
      }
      setRuleSets(data || []);
      if (data && data.length > 0) {
        if (!selectedSetId || !data.find(s => s.id === selectedSetId)) {
          const activeSet = data.find(s => s.is_active);
          setSelectedSetId(activeSet ? activeSet.id : data[0].id);
        }
      } else {
        setSelectedSetId(null);
        setModes({});
        setRules([]);
      }
    } catch (err) {
      console.error(err);
      setError("Erreur de chargement des règles d'équivalence.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRulesForSet = async (setId: string) => {
    setLoading(true);
    try {
      const { data: modesData, error: modesError } = await supabase.from('exchange_modes').select('*').eq('set_id', setId);
      if (modesError) throw modesError;
      
      const { data: rulesData, error: rulesError } = await supabase.from('exchange_rules').select('*').eq('set_id', setId);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuleSets();
    fetchRequests();
  }, []);

  useEffect(() => {
    if (selectedSetId) {
      fetchRulesForSet(selectedSetId);
    }
  }, [selectedSetId]);

  const handleCreateSet = async () => {
    const name = prompt("Nom de la nouvelle règle d'équivalence ?");
    if (!name?.trim()) return;
    try {
      const { data, error } = await supabase.from('exchange_rule_sets').insert([{ name: name.trim() }]).select();
      if (error) throw error;
      if (data && data.length > 0) {
        await fetchRuleSets();
        setSelectedSetId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création.");
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette règle d'équivalence ?")) return;
    try {
      const { error } = await supabase.from('exchange_rule_sets').delete().eq('id', setId);
      if (error) throw error;
      await fetchRuleSets();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression.");
    }
  };

  const handleActivateSet = async (setId: string) => {
    try {
      const allIds = ruleSets.map(r => r.id);
      if (allIds.length > 0) {
        await supabase.from('exchange_rule_sets').update({ is_active: false }).in('id', allIds);
      }
      await supabase.from('exchange_rule_sets').update({ is_active: true }).eq('id', setId);
      await fetchRuleSets();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'activation.");
    }
  };

  const handleRenameSet = async (setId: string, currentName: string) => {
    const name = prompt("Nouveau nom :", currentName);
    if (!name?.trim() || name === currentName) return;
    try {
      const { error } = await supabase.from('exchange_rule_sets').update({ name: name.trim() }).eq('id', setId);
      if (error) throw error;
      await fetchRuleSets();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du renommage.");
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
    if (!selectedSetId) return;
    const colsToUpdate = selectedCols.has(colId) ? [...selectedCols] : [colId];
    
    const newModes = { ...modes };
    colsToUpdate.forEach((c: number) => newModes[c] = mode);
    setModes(newModes);

    try {
      const upserts = colsToUpdate.map(c => ({ set_id: selectedSetId, col_id: c, mode }));
      await supabase.from('exchange_modes').upsert(upserts, { onConflict: 'set_id,col_id' });
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde du mode.");
    }
  };

  const openModal = (colId: number, period: ExchangePeriod) => {
    if (!selectedSetId) return;
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
    if (!selectedSetId) return;
    try {
      // 1. Delete existing rules for the selected source columns and period
      for (const colId of modalSourceCols) {
        await supabase.from('exchange_rules')
          .delete()
          .eq('set_id', selectedSetId)
          .eq('source_col_id', colId)
          .eq('source_period', modalSourcePeriod);
      }

      // 2. Insert new rules
      const newRulesToInsert: any[] = [];
      modalSourceCols.forEach(colId => {
        modalSelections.forEach(sel => {
          const [targetColIdStr, targetPeriod] = sel.split('-');
          newRulesToInsert.push({
            set_id: selectedSetId,
            source_col_id: colId,
            source_period: modalSourcePeriod,
            target_col_id: parseInt(targetColIdStr, 10),
            target_period: targetPeriod
          });
        });
      });

      if (newRulesToInsert.length > 0) {
        await supabase.from('exchange_rules').insert(newRulesToInsert);
      }

      setModalOpen(false);
      fetchRulesForSet(selectedSetId); // Refresh
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde des règles.");
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
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200 shrink-0 gap-4">
             <div className="flex flex-wrap items-center gap-2 flex-1">
               {ruleSets.map(set => (
                  <button key={set.id} onClick={() => setSelectedSetId(set.id)} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap border transition-all ${selectedSetId === set.id ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {set.name} {set.is_active && <span className="ml-2 text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Actif</span>}
                  </button>
               ))}
               <button onClick={handleCreateSet} className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent transition-all">
                 + Nouvelle Règle
               </button>
             </div>
             {selectedSetId && (
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {!ruleSets.find(s => s.id === selectedSetId)?.is_active && (
                    <button onClick={() => handleActivateSet(selectedSetId)} className="px-3 py-1.5 bg-green-500 text-white hover:bg-green-600 rounded-lg text-xs font-black uppercase transition-colors shadow-sm">
                      Définir comme Actif
                    </button>
                  )}
                  <button onClick={() => handleRenameSet(selectedSetId, ruleSets.find(s => s.id === selectedSetId)?.name || '')} className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold uppercase transition-colors">
                    Renommer
                  </button>
                  <button onClick={() => handleDeleteSet(selectedSetId)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold uppercase transition-colors">
                    Supprimer
                  </button>
                </div>
             )}
          </div>
          
          <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm relative">
            {!selectedSetId ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-bold p-8 text-center flex-col gap-4">
                <div className="bg-slate-50 p-4 rounded-full border border-slate-100">
                  <AlertCircle size={32} className="text-slate-400" />
                </div>
                <p>Aucun paramétrage sélectionné.<br/><span className="text-sm font-medium">Veuillez créer ou sélectionner un jeu de règles ci-dessus.</span></p>
              </div>
            ) : (
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
            )}
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
