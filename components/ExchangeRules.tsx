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

interface ExchangeRuleSet {
  id: string;
  created_at: string;
  name: string;
  modes: Record<number, 'GLOBAL' | 'INDIVIDUAL'>;
  rules: ExchangeRule[];
}

interface ExchangeRulesProps {
  supabase: any;
}

export const ExchangeRules: React.FC<ExchangeRulesProps> = ({ supabase }) => {
  // Global / active state loaded from DB to initialize
  const [activeModes, setActiveModes] = useState<Record<number, 'GLOBAL' | 'INDIVIDUAL'>>({});
  const [activeRules, setActiveRules] = useState<ExchangeRule[]>([]);

  // Editor states
  const [modes, setModes] = useState<Record<number, 'GLOBAL' | 'INDIVIDUAL'>>({});
  const [rules, setRules] = useState<ExchangeRule[]>([]);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set());

  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSourcePeriod, setModalSourcePeriod] = useState<ExchangePeriod>('GLOBAL');
  const [modalSourceCols, setModalSourceCols] = useState<number[]>([]);
  const [modalSelections, setModalSelections] = useState<Set<string>>(new Set()); // Format: "colId-targetPeriod"
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'RULES' | 'REQUESTS' | 'PROFILES'>('REQUESTS');
  const [requests, setRequests] = useState<any[]>([]);
  const [ruleSets, setRuleSets] = useState<ExchangeRuleSet[]>([]);
  const [showSqlHelp, setShowSqlHelp] = useState(false);

  const [saveProfileModalOpen, setSaveProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  const getActiveProfileId = () => {
      const sortedCurrentRules = [...activeRules].sort((a, b) => {
          if (a.source_col_id !== b.source_col_id) return a.source_col_id - b.source_col_id;
          if (a.source_period !== b.source_period) return a.source_period.localeCompare(b.source_period);
          if (a.target_col_id !== b.target_col_id) return a.target_col_id - b.target_col_id;
          return a.target_period.localeCompare(b.target_period);
      });
      const currentRulesStr = JSON.stringify(sortedCurrentRules);
      const currentModesStr = JSON.stringify(activeModes);

      for (const rs of ruleSets) {
          const sortedRsRules = [...(rs.rules || [])].sort((a: any, b: any) => {
              if (a.source_col_id !== b.source_col_id) return a.source_col_id - b.source_col_id;
              if (a.source_period !== b.source_period) return a.source_period.localeCompare(b.source_period);
              if (a.target_col_id !== b.target_col_id) return a.target_col_id - b.target_col_id;
              return a.target_period.localeCompare(b.target_period);
          });
          const rsRulesStr = JSON.stringify(sortedRsRules);
          const rsModesStr = JSON.stringify(rs.modes || {});
          
          if (currentRulesStr === rsRulesStr && currentModesStr === rsModesStr) {
              return rs.id;
          }
      }
      return null;
  };
  const activeProfileId = getActiveProfileId();

  const fetchRulesAndProfiles = async (loadIntoEditor: boolean = false) => {
    setLoading(true);
    setError(null);
    setShowSqlHelp(false);
    try {
      const { data: modesData, error: modesError } = await supabase.from('exchange_modes').select('*');
      if (modesError) throw modesError;
      
      const { data: rulesData, error: rulesError } = await supabase.from('exchange_rules').select('*');
      if (rulesError) throw rulesError;

      const { data: ruleSetsData, error: ruleSetsError } = await supabase.from('exchange_rule_sets').select('*').order('created_at', { ascending: false });
      if (ruleSetsError) {
        if (ruleSetsError.message.includes('relation "exchange_rule_sets" does not exist')) {
            setShowSqlHelp(true);
        } else {
            throw ruleSetsError;
        }
      } else {
          setRuleSets(ruleSetsData || []);
      }

      const modesMap: Record<number, 'GLOBAL' | 'INDIVIDUAL'> = {};
      if (modesData) {
        modesData.forEach((m: any) => {
          modesMap[m.col_id] = m.mode;
        });
      }
      
      setActiveModes(modesMap);
      setActiveRules(rulesData || []);
      
      if (loadIntoEditor) {
          setModes(modesMap);
          setRules(rulesData || []);
          setEditingProfileId(null);
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors du chargement des règles ou profils.");
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
    fetchRulesAndProfiles(true);
    fetchRequests();
  }, []);

  const handleRequestAction = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const req = requests.find(r => r.id === requestId);
      if (!req) return;

      if (action === 'APPROVED') {
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

  const handleModeChange = (colId: number, mode: 'GLOBAL' | 'INDIVIDUAL') => {
    const colsToUpdate = selectedCols.has(colId) ? [...selectedCols] : [colId];
    const newModes = { ...modes };
    colsToUpdate.forEach((c: number) => newModes[c] = mode);
    setModes(newModes);
  };

  const openModal = (colId: number, period: ExchangePeriod) => {
    const colsToEdit = selectedCols.has(colId) ? Array.from(selectedCols) : [colId];
    setModalSourceCols(colsToEdit);
    setModalSourcePeriod(period);
    
    const existingRules = rules.filter(r => r.source_col_id === colsToEdit[0] && r.source_period === period);
    const initialSelections = new Set<string>();
    existingRules.forEach(r => {
      initialSelections.add(`${r.target_col_id}-${r.target_period}`);
    });
    setModalSelections(initialSelections);
    setModalOpen(true);
  };

  const saveModal = () => {
    // 1. Remove rules from React state that match sourceCols and sourcePeriod
    const existingFiltered = rules.filter(r => !(modalSourceCols.includes(r.source_col_id) && r.source_period === modalSourcePeriod));
    
    // 2. Add new selected rules
    const newRulesToInsert: any[] = [];
    modalSourceCols.forEach(colId => {
      modalSelections.forEach(sel => {
        const [targetColIdStr, targetPeriod] = sel.split('-');
        newRulesToInsert.push({
          source_col_id: colId,
          source_period: modalSourcePeriod,
          target_col_id: parseInt(targetColIdStr, 10),
          target_period: targetPeriod as TargetPeriod
        });
      });
    });

    setRules([...existingFiltered, ...newRulesToInsert]);
    setModalOpen(false);
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

  const saveCurrentAsProfile = async () => {
    if (!newProfileName.trim() && !editingProfileId) {
        alert("Veuillez entrer un nom pour le profil.");
        return;
    }
    
    setLoading(true);
    try {
        if (editingProfileId) {
            const { error } = await supabase.from('exchange_rule_sets')
                .update({ modes, rules })
                .eq('id', editingProfileId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('exchange_rule_sets').insert({
                name: newProfileName.trim(),
                modes,
                rules
            });
            if (error) throw error;
        }
        setSaveProfileModalOpen(false);
        setNewProfileName("");
        await fetchRulesAndProfiles(false);
        alert("Profil sauvegardé avec succès.");
    } catch (err: any) {
        console.error(err);
        if (err.message && (err.message.includes('relation "exchange_rule_sets" does not exist') || err.message.includes('row-level security'))) {
            setShowSqlHelp(true);
            setSaveProfileModalOpen(false);
        } else {
            alert("Erreur lors de la sauvegarde du profil : " + err.message);
        }
        setLoading(false);
    }
  };

  const activateProfile = async (profileId: string) => {
    const profile = ruleSets.find(rs => rs.id === profileId);
    if (!profile) return;
    if (!window.confirm(`Activer le profil "${profile.name}" ? Cela écrasera les règles actuellement actives pour TOUT l'applicatif.`)) return;
    
    setLoading(true);
    try {
        await supabase.from('exchange_modes').delete().not('col_id', 'is', null);
        await supabase.from('exchange_rules').delete().not('source_col_id', 'is', null);

        const newModes = profile.modes || {};
        const modeUpserts = [];
        for (const [col_id, mode] of Object.entries(newModes)) {
            modeUpserts.push({ col_id: parseInt(col_id, 10), mode });
        }
        if (modeUpserts.length > 0) {
            await supabase.from('exchange_modes').insert(modeUpserts);
        }

        const newRules = profile.rules || [];
        if (newRules.length > 0) {
            const rulesToInsert = newRules.map((r: any) => ({
                source_col_id: r.source_col_id,
                source_period: r.source_period,
                target_col_id: r.target_col_id,
                target_period: r.target_period
            }));
            await supabase.from('exchange_rules').insert(rulesToInsert);
        }

        alert(`Profil "${profile.name}" activé avec succès.`);
        await fetchRulesAndProfiles(editingProfileId === null);
    } catch (err: any) {
        console.error(err);
        alert("Erreur lors de l'activation du profil : " + err.message);
        setLoading(false);
    }
  };

  const viewProfile = (profileId: string) => {
      const profile = ruleSets.find(rs => rs.id === profileId);
      if (profile) {
          setEditingProfileId(profile.id);
          setModes(profile.modes || {});
          setRules(profile.rules || []);
          setActiveTab('RULES');
      }
  };

  const createNewProfile = () => {
      setEditingProfileId(null);
      setModes(activeModes);
      setRules(activeRules);
      setActiveTab('RULES');
  };

  const deleteProfile = async (profileId: string) => {
    if (!window.confirm("Supprimer ce profil ?")) return;
    try {
        await supabase.from('exchange_rule_sets').delete().eq('id', profileId);
        await fetchRulesAndProfiles();
    } catch(err) {
        console.error(err);
    }
  };

  if (showSqlHelp) {
    return (
      <div className="p-8 max-w-4xl mx-auto h-full overflow-auto text-left">
        <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
          <h2 className="text-xl font-black text-slate-900">Configuration Requise</h2>
          <p className="text-slate-600">
            Pour utiliser plusieurs profils de règles d'échange, vous devez créer la table <strong>exchange_rule_sets</strong> dans votre base de données Supabase, et configurer les politiques de sécurité (RLS).
          </p>
          <div className="bg-slate-900 p-4 rounded-xl overflow-x-auto text-left">
            <pre className="text-emerald-400 text-sm font-mono">
{`CREATE TABLE IF NOT EXISTS exchange_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  modes JSONB NOT NULL,
  rules JSONB NOT NULL
);

ALTER TABLE exchange_rule_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access to exchange profiles" 
ON exchange_rule_sets FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Allow authenticated full access to exchange profiles" 
ON exchange_rule_sets FOR ALL 
TO authenticated USING (true) WITH CHECK (true);`}
            </pre>
          </div>
          <button onClick={fetchRulesAndProfiles} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs hover:bg-blue-700 block mx-auto">
            J'ai créé la table, réessayer
          </button>
        </div>
      </div>
    );
  }

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
            Configuration
          </button>
          <button 
            onClick={() => setActiveTab('PROFILES')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'PROFILES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Profils sauvegardés
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
      ) : activeTab === 'PROFILES' ? (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">
            <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-black text-slate-900 uppercase">Profils Sauvegardés</h3>
                <button onClick={createNewProfile} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase shadow-sm hover:bg-slate-800 transition-colors">
                    + Nouveau Profil
                </button>
            </div>
            
            {ruleSets.length === 0 ? (
                <div className="text-center text-slate-500 font-bold py-12 bg-slate-50 rounded-xl border border-slate-100">Aucun profil enregistré.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ruleSets.map(rs => (
                        <div key={rs.id} className={`border rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all ${rs.id === activeProfileId ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-black text-lg text-slate-900 uppercase">{rs.name}</h4>
                                    {rs.id === activeProfileId && (
                                        <span className="px-2 py-1 bg-blue-600 text-white text-[10px] uppercase font-black tracking-widest rounded-md">Actif</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Créé le {new Date(rs.created_at).toLocaleString('fr-FR')}</p>
                                <p className="text-xs font-bold text-slate-400 mt-2">
                                    {(rs.rules || []).length} règles définies.
                                </p>
                            </div>
                            <div className="flex items-center justify-between mt-auto space-x-2 pt-4 border-t border-slate-100/50">
                                <button onClick={() => deleteProfile(rs.id)} className="px-2 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[10px] font-black uppercase hover:bg-red-50 transition-colors truncate" title="Supprimer">Suppr.</button>
                                <button onClick={() => viewProfile(rs.id)} className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-50 transition-colors w-full" title="Consulter / Modifier ce profil">Voir / Modifier</button>
                                {rs.id !== activeProfileId && (
                                    <button onClick={() => activateProfile(rs.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-blue-700 transition-colors w-full shadow-sm" title="Activer ce profil">Activer</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
             <h3 className="text-sm font-black text-slate-900 uppercase">
                {editingProfileId ? `Édition: ${ruleSets.find(rs => rs.id === editingProfileId)?.name}` : 'Nouvelle Configuration (non sauvegardée)'}
             </h3>
             <div className="flex gap-2">
               {editingProfileId && (
                 <button onClick={() => saveCurrentAsProfile()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-700 shadow-sm transition-colors">
                    <Save size={14} /> Mettre à jour le profil actuel
                 </button>
               )}
               <button onClick={() => {
                   if (editingProfileId) {
                      setEditingProfileId(null);
                      setNewProfileName("");
                   }
                   setSaveProfileModalOpen(true);
                 }} className={`px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 shadow-sm transition-colors ${editingProfileId ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {!editingProfileId && <Save size={14} />} 
                  {editingProfileId ? "Enregistrer sous..." : "Enregistrer dans un nouveau profil"}
               </button>
             </div>
          </div>
          <div className="flex-1 overflow-auto">
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

      {saveProfileModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-black uppercase text-slate-900 mb-4">Sauvegarder le profil</h3>
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nom du profil</label>
                    <input 
                        autoFocus
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Ex: Mon profil de règles 1"
                    />
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setSaveProfileModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 uppercase text-xs tracking-wider">
                        Annuler
                    </button>
                    <button onClick={saveCurrentAsProfile} className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 uppercase text-xs tracking-wider flex items-center gap-2">
                        <Save size={16} /> Sauvegarder
                    </button>
                </div>
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
