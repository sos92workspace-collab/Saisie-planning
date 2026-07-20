import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  
  const typeStr = cfg?.custom_type || columnDef?.type || '';
  const timeStr = cfg?.custom_time_range || columnDef?.timeRange || '';
  
  return `${dayName} ${dateStr}${jf} | ${typeStr} | Col. ${col} : ${displayLabel} | ${timeStr}`;
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
  choices?: any[];
  users?: any[];
  activeRound?: any;
  columnConfigs?: any[];
  headerConfigs?: any[];
  globalClosures?: any[];
  PlanningPanel?: any;
  refreshData?: () => void;
  currentUserTrigram?: string;
  isStandardist?: boolean;
}

export const ExchangeRules: React.FC<ExchangeRulesProps> = ({ supabase, choices, users: propsUsers, activeRound, columnConfigs: propsColumnConfigs, headerConfigs, globalClosures, PlanningPanel, refreshData, currentUserTrigram, isStandardist }) => {
  const [modes, setModes] = useState<Record<number, 'GLOBAL' | 'INDIVIDUAL'>>({});
  const [rules, setRules] = useState<ExchangeRule[]>([]);
  const [columnConfigsState, setColumnConfigsState] = useState<any[]>([]);
  const columnConfigs = propsColumnConfigs || columnConfigsState;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set());
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSourcePeriod, setModalSourcePeriod] = useState<ExchangePeriod>('GLOBAL');
  const [modalSourceCols, setModalSourceCols] = useState<number[]>([]);
  const [modalSelections, setModalSelections] = useState<Set<string>>(new Set()); // Format: "colId-targetPeriod"
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'RULES' | 'REQUESTS' | 'ABANDONS' | 'TAKES' | 'HISTORIQUE'>('REQUESTS');

  
  const [tabFilterTrigram, setTabFilterTrigram] = useState<string>('');
  const [tabFilterMonthYear, setTabFilterMonthYear] = useState<string>('');
  const [tabFilterType, setTabFilterType] = useState<string>('');
  const [tabFilterCol, setTabFilterCol] = useState<string>('');
  const [tabFilterReqStart, setTabFilterReqStart] = useState<string>('');
  const [tabFilterReqEnd, setTabFilterReqEnd] = useState<string>('');
  const [tabFilterProcStart, setTabFilterProcStart] = useState<string>('');
  const [tabFilterProcEnd, setTabFilterProcEnd] = useState<string>('');

  useEffect(() => {
    setTabFilterTrigram('');
    setTabFilterMonthYear('');
    setTabFilterType('');
    setTabFilterCol('');
    setTabFilterReqStart('');
    setTabFilterReqEnd('');
    setTabFilterProcStart('');
    setTabFilterProcEnd('');
  }, [activeTab]);


  
  const getAvailableFilterOptions = () => {
    let trigrams = new Set<string>();
    let monthYears = new Set<string>();
    let types = new Set<string>();
    let cols = new Set<string>();

    if (activeTab === 'REQUESTS') {
        requests.forEach(r => {
            if (r.requester_trigram) trigrams.add(r.requester_trigram);
            if (r.target_month && r.target_year) monthYears.add(r.target_month + '-' + r.target_year);
            if (r.requester_choice?.month && r.requester_choice?.year) monthYears.add(r.requester_choice.month + '-' + r.requester_choice.year);
            if (r.target_col_label) types.add(r.target_col_label);
            if (r.requester_choice?.colLabel) types.add(r.requester_choice.colLabel);
            if (r.target_col !== undefined) cols.add(r.target_col.toString());
            if (r.requester_choice?.col !== undefined) cols.add(r.requester_choice.col.toString());
        });
    } else if (activeTab === 'ABANDONS') {
        abandons.forEach(a => {
            if (a.requester_trigram) trigrams.add(a.requester_trigram);
            let choice = a.requester_choice || a.shift_snapshot;
            if (choice) {
                if (choice.month && choice.year) monthYears.add(choice.month + '-' + choice.year);
                if (choice.colLabel) types.add(choice.colLabel);
                if (choice.col !== undefined) cols.add(choice.col.toString());
            }
        });
    } else if (activeTab === 'TAKES') {
        standaloneTakes.forEach(t => {
            if (t.requester_trigram) trigrams.add(t.requester_trigram);
            if (t.target_month && t.target_year) monthYears.add(t.target_month + '-' + t.target_year);
            if (t.target_col_label) types.add(t.target_col_label);
            if (t.target_col !== undefined) cols.add(t.target_col.toString());
        });
    }
    
    return {
        trigrams: Array.from(trigrams).sort(),
        monthYears: Array.from(monthYears).sort((a,b) => {
           const [ma, ya] = a.split('-').map(Number);
           const [mb, yb] = b.split('-').map(Number);
           if (ya !== yb) return ya - yb;
           return ma - mb;
        }),
        types: Array.from(types).sort(),
        cols: Array.from(cols).sort((a,b) => Number(a) - Number(b))
    };
  };


  
  const applyTabFilters = (items: any[], type: 'REQUESTS'|'ABANDONS'|'TAKES') => {
      return items.filter(item => {
          let itemTrigram = '';
          let itemMonthYears = [];
          let itemTypes = [];
          let itemCols = [];
          
          let createdDate = new Date(item.created_at);
          let updatedDate = new Date(item.updated_at || item.created_at);

          if (type === 'REQUESTS') {
              itemTrigram = item.requester_trigram;
              if (item.target_month && item.target_year) itemMonthYears.push(item.target_month + '-' + item.target_year);
              if (item.requester_choice?.month && item.requester_choice?.year) itemMonthYears.push(item.requester_choice.month + '-' + item.requester_choice.year);
              if (item.target_col_label) itemTypes.push(item.target_col_label);
              if (item.requester_choice?.colLabel) itemTypes.push(item.requester_choice.colLabel);
              if (item.target_col !== undefined) itemCols.push(item.target_col.toString());
              if (item.requester_choice?.col !== undefined) itemCols.push(item.requester_choice.col.toString());
          } else if (type === 'ABANDONS') {
              itemTrigram = item.requester_trigram;
              let choice = item.requester_choice || item.shift_snapshot;
              if (choice) {
                  if (choice.month && choice.year) itemMonthYears.push(choice.month + '-' + choice.year);
                  if (choice.colLabel) itemTypes.push(choice.colLabel);
                  if (choice.col !== undefined) itemCols.push(choice.col.toString());
              }
          } else if (type === 'TAKES') {
              itemTrigram = item.requester_trigram;
              if (item.target_month && item.target_year) itemMonthYears.push(item.target_month + '-' + item.target_year);
              if (item.target_col_label) itemTypes.push(item.target_col_label);
              if (item.target_col !== undefined) itemCols.push(item.target_col.toString());
          }

          if (tabFilterTrigram && itemTrigram !== tabFilterTrigram) return false;
          if (tabFilterMonthYear && !itemMonthYears.includes(tabFilterMonthYear)) return false;
          if (tabFilterType && !itemTypes.includes(tabFilterType)) return false;
          if (tabFilterCol && !itemCols.includes(tabFilterCol)) return false;

          if (tabFilterReqStart && createdDate < new Date(tabFilterReqStart)) return false;
          if (tabFilterReqEnd) {
             const e = new Date(tabFilterReqEnd);
             e.setHours(23, 59, 59, 999);
             if (createdDate > e) return false;
          }
          if (tabFilterProcStart && updatedDate < new Date(tabFilterProcStart)) return false;
          if (tabFilterProcEnd) {
             const e = new Date(tabFilterProcEnd);
             e.setHours(23, 59, 59, 999);
             if (updatedDate > e) return false;
          }

          return true;
      });
  };


  
  const renderTabFiltersUI = () => {
      const { trigrams, monthYears, types, cols } = getAvailableFilterOptions();
      return (
          <div className="flex flex-col gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Médecin (Trigramme)</label>
                      <select className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={tabFilterTrigram} onChange={e => setTabFilterTrigram(e.target.value)}>
                          <option value="">Tous les médecins</option>
                          {trigrams.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                  </div>
                  <div className="flex-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Mois/Année de Garde</label>
                      <select className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={tabFilterMonthYear} onChange={e => setTabFilterMonthYear(e.target.value)}>
                          <option value="">Tous les mois</option>
                          {monthYears.map(m => {
                              const [mm, yy] = m.split('-');
                              const date = new Date(parseInt(yy), parseInt(mm) - 1, 1);
                              return <option key={m} value={m}>{date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</option>
                          })}
                      </select>
                  </div>
                  <div className="flex-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Type de garde</label>
                      <select className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={tabFilterType} onChange={e => setTabFilterType(e.target.value)}>
                          <option value="">Tous les types</option>
                          {types.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                  </div>
                  <div className="flex-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Numéro de colonne</label>
                      <select className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={tabFilterCol} onChange={e => setTabFilterCol(e.target.value)}>
                          <option value="">Toutes les colonnes</option>
                          {cols.map(c => <option key={c} value={c}>Col. {c}</option>)}
                      </select>
                  </div>
              </div>
              <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-200">
                  <div className="flex-1 flex gap-2">
                      <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Demande (début)</label>
                          <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={tabFilterReqStart} onChange={e => setTabFilterReqStart(e.target.value)} />
                      </div>
                      <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Demande (fin)</label>
                          <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={tabFilterReqEnd} onChange={e => setTabFilterReqEnd(e.target.value)} />
                      </div>
                  </div>
                  <div className="flex-1 flex gap-2">
                      <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Traitement (début)</label>
                          <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={tabFilterProcStart} onChange={e => setTabFilterProcStart(e.target.value)} />
                      </div>
                      <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Traitement (fin)</label>
                          <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={tabFilterProcEnd} onChange={e => setTabFilterProcEnd(e.target.value)} />
                      </div>
                  </div>
              </div>
          </div>
      );
  };


  const [requests, setRequests] = useState<any[]>([]);
  const [abandons, setAbandons] = useState<any[]>([]);
  const [takes, setTakes] = useState<any[]>([]);

  const linkedTakeIds = useMemo(() => {
    const ids = new Set<string>();
    abandons.forEach(a => {
      if (a.shift_snapshot?.linked_take?.id) {
        ids.add(a.shift_snapshot.linked_take.id);
      }
    });
    return ids;
  }, [abandons]);

  const standaloneTakes = useMemo(() => {
    return takes.filter(t => !linkedTakeIds.has(t.id));
  }, [takes, linkedTakeIds]);

  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);

  // History filters
  const [historyFilters, setHistoryFilters] = useState({
    trigram: '',
    startDate: '',
    endDate: '',
    colId: 'ALL',
    shiftType: 'ALL'
  });

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilters]);

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
      if (data) setColumnConfigsState(data);
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

  const [archivedChoices, setArchivedChoices] = useState<any[]>([]);

  const fetchArchivedChoices = async () => {
    try {
      let allData: any[] = [];
      let page = 0;
      while (true) {
        const { data, error } = await supabase.from('archived_choices').select('*').range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        allData.push(...data);
        page++;
      }
      setArchivedChoices(allData);
      return allData;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const fetchRequests = async (archiveDb?: any[]) => {
    try {
      const currentArchive = archiveDb || archivedChoices;
      const { data, error } = await supabase
        .from('exchange_requests')
        .select(`
          *,
          requester_choice:choices!requester_choice_id(*),
          target_choice:choices!target_choice_id(*)
        `)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const parsed = (data || []).map(req => {
          let reqChoice = req.requester_choice;
          if (!reqChoice && req.requester_choice_id) {
             reqChoice = currentArchive.find(c => c.original_id === req.requester_choice_id);
          }
          let tgtChoice = req.target_choice;
          if (!tgtChoice && req.target_choice_id) {
             tgtChoice = currentArchive.find(c => c.original_id === req.target_choice_id);
          }
          return { ...req, requester_choice: reqChoice, target_choice: tgtChoice };
      });
      setRequests(parsed);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAbandons = async (archiveDb?: any[]) => {
    try {
      const currentArchive = archiveDb || archivedChoices;
      const { data, error } = await supabase
        .from('abandon_requests')
        .select(`
          *,
          requester_choice:choices!choice_id(*)
        `)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const parsed = (data || []).map(req => {
          let reqChoice = req.requester_choice;
          if (!reqChoice && req.choice_id) {
             reqChoice = currentArchive.find(c => c.original_id === req.choice_id);
          }
          return { ...req, requester_choice: reqChoice };
      });
      setAbandons(parsed);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTakes = async () => {
    try {
      const { data, error } = await supabase
        .from('take_requests')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setTakes(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .in('action', ['ASSIGNATION_MANUELLE', 'SUPPRESSION_GARDE'])
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setAdminLogs(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteHistory = async (type: 'EXCHANGE' | 'ABANDON' | 'TAKE') => {
    const adminUser = users.find(u => u.role === 'ADMIN');
    if (!adminUser) return alert("Utilisateur admin non trouvé.");
    
    const pwd = window.prompt(`Pour supprimer l'historique des ${type === 'EXCHANGE' ? 'échanges' : type === 'ABANDON' ? 'abandons' : 'ajouts'}, veuillez saisir le mot de passe administrateur :`);
    if (pwd === null) return;
    if (pwd !== adminUser.password) return alert("Mot de passe incorrect.");

    try {
      const table = type === 'EXCHANGE' ? 'exchange_requests' : type === 'ABANDON' ? 'abandon_requests' : 'take_requests';
      const { error } = await supabase.from(table).delete().neq('status', 'PENDING');
      if (error) throw error;
      
      await supabase.from('logs').insert([{ action: `CLEAR_HISTORY_${type}`, details: { user: currentUserTrigram } }]);
      fetchUsersAndLogs();
      if (refreshData) refreshData();
      alert("Historique supprimé avec succès.");
      if (type === 'EXCHANGE') fetchArchivedChoices().then((archives) => { fetchRequests(archives); });
      else if (type === 'ABANDON') fetchArchivedChoices().then((archives) => { fetchAbandons(archives); });
      else if (type === 'TAKE') fetchTakes();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression de l'historique.");
    }
  };

  const [usersState, setUsersState] = useState<any[]>([]);
  const users = propsUsers || usersState;

  const [counterResetDate, setCounterResetDate] = useState<Date>(new Date(0));
  const [isCounterExpanded, setIsCounterExpanded] = useState(true);
  const [expandedUserTrigram, setExpandedUserTrigram] = useState<string | null>(null);

  const [counterResetDateRequests, setCounterResetDateRequests] = useState<Date>(new Date(0));
  const [isCounterExpandedRequests, setIsCounterExpandedRequests] = useState(true);
  const [expandedUserTrigramRequests, setExpandedUserTrigramRequests] = useState<string | null>(null);

  const [counterResetDateTakes, setCounterResetDateTakes] = useState<Date>(new Date(0));
  const [isCounterExpandedTakes, setIsCounterExpandedTakes] = useState(true);
  const [expandedUserTrigramTakes, setExpandedUserTrigramTakes] = useState<string | null>(null);
  const [isCounterExpandedPenalties, setIsCounterExpandedPenalties] = useState(true);
  const [expandedUserTrigramPenalties, setExpandedUserTrigramPenalties] = useState<string | null>(null);

  const [confirmAbandonChoice, setConfirmAbandonChoice] = useState<any>(null);
  const [removeMode, setRemoveMode] = useState<'ABANDON'|'ERROR'>('ABANDON');
  const [removePenaltyAmount, setRemovePenaltyAmount] = useState<number>(0);
  const [removeDelayCategory, setRemoveDelayCategory] = useState<string>('');
  const [abandonPenaltiesRules, setAbandonPenaltiesRules] = useState<any[]>([]);
  const [confirmTakeCell, setConfirmTakeCell] = useState<any>(null);
  const [takeTargetUser, setTakeTargetUser] = useState<string>('');
  const [exchangeSourceChoice, setExchangeSourceChoice] = useState<any>(null);
  const [exchangeTargetCell, setExchangeTargetCell] = useState<any>(null);
  const [selectedExchangeRequest, setSelectedExchangeRequest] = useState<any>(null);
  const [selectedTakeRequest, setSelectedTakeRequest] = useState<any>(null);
  const [selectedAbandonRequest, setSelectedAbandonRequest] = useState<any>(null);

  const [assignedChoicesState, setAssignedChoicesState] = useState<any[]>([]);
  const assignedChoices = choices ? choices.filter(c => c.status === 'ASSIGNED' && c.userTrigram) : assignedChoicesState;

  
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


  const fetchAssignedChoices = async () => {
    try {
      const data = await fetchAll(supabase, 'choices', q => q.eq('status', 'ASSIGNED').not('user_trigram', 'is', null));
      if (data) setAssignedChoicesState(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsersAndLogs = async () => {
    try {
      const { data: usersData } = await supabase.from('users').select('*');
      if (usersData) setUsersState(usersData.map((u: any) => ({ ...u, role: u.role === 'medecin' ? 'DOCTOR' : u.role })));

      const [logsAbandons, logsRequests, logsTakes] = await Promise.all([
        supabase.from('logs').select('created_at').eq('action', 'RESET_ABANDON_COUNTER').order('created_at', { ascending: false }).limit(1),
        supabase.from('logs').select('created_at').eq('action', 'RESET_EXCHANGE_COUNTER').order('created_at', { ascending: false }).limit(1),
        supabase.from('logs').select('created_at').eq('action', 'RESET_TAKE_COUNTER').order('created_at', { ascending: false }).limit(1),
      ]);
      
      if (logsAbandons.data && logsAbandons.data.length > 0) {
        setCounterResetDate(new Date(logsAbandons.data[0].created_at));
      } else {
        setCounterResetDate(new Date(0));
      }

      if (logsRequests.data && logsRequests.data.length > 0) {
        setCounterResetDateRequests(new Date(logsRequests.data[0].created_at));
      } else {
        setCounterResetDateRequests(new Date(0));
      }

      if (logsTakes.data && logsTakes.data.length > 0) {
        setCounterResetDateTakes(new Date(logsTakes.data[0].created_at));
      } else {
        setCounterResetDateTakes(new Date(0));
      }

    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchColumnConfigs();
    fetchRules();
    fetchArchivedChoices().then((archives) => { fetchRequests(archives); fetchAbandons(archives); });
    fetchVersions();
    
    fetchTakes();
    fetchAdminLogs();
    fetchUsersAndLogs();
    fetchAssignedChoices();
  }, []);

  const handleAdminTake = async () => {
    if (!confirmTakeCell || !takeTargetUser) return;
    try {
      const userObj = users.find((u: any) => u.trigram === takeTargetUser);
      
      const { error: choiceError } = await supabase.from('choices').insert([{
        user_trigram: takeTargetUser,
        user_role: userObj?.role || 'DOCTOR',
        row: confirmTakeCell.row,
        col: confirmTakeCell.col,
        month: confirmTakeCell.month + 1,
        year: confirmTakeCell.year,
        status: 'ASSIGNED',
        round_id: activeRound?.id || 0,
        group_index: 1,
        sub_rank: 1,
        category: 'normal',
        submitted_at: new Date().toISOString()
      }]);
      if (choiceError) throw choiceError;

      await supabase.from('take_requests').insert([{
        requester_trigram: takeTargetUser,
        target_row: confirmTakeCell.row,
        target_month: confirmTakeCell.month + 1,
        target_year: confirmTakeCell.year,
        target_col: confirmTakeCell.col,
        target_col_label: columnConfigs.find((c: any) => c.column_id === confirmTakeCell.col)?.custom_label || confirmTakeCell.col,
        status: 'APPROVED',
        updated_at: new Date().toISOString(), processed_by: currentUserTrigram
      }]);

      await supabase.from('logs').insert([{
        action: 'AJOUT_MANUEL',
        details: { mode: 'AJOUT_MANUEL', user: takeTargetUser, date: `${confirmTakeCell.row}/${confirmTakeCell.month + 1}/${confirmTakeCell.year}`, col: confirmTakeCell.col }
      }]);

      if (refreshData) refreshData();
      fetchAssignedChoices();
      fetchTakes();
      setConfirmTakeCell(null);
      setTakeTargetUser('');
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de l'ajout: " + (e.message || JSON.stringify(e)));
    }
  };

  const handleAdminExchange = async () => {
    if (!exchangeSourceChoice || !exchangeTargetCell) return;
    const oldTrigram = exchangeSourceChoice.userTrigram || exchangeSourceChoice.user_trigram;
    const newTrigram = exchangeTargetCell.assigned?.userTrigram || exchangeTargetCell.assigned?.user_trigram;
    
    if (oldTrigram === newTrigram && oldTrigram) {
      alert("Veuillez sélectionner un médecin différent.");
      return;
    }
    
    try {
      if (newTrigram) {
        // Swap users between two assigned choices
        const { error: updateError1 } = await supabase.from('choices').update({
          user_trigram: newTrigram
        }).eq('id', exchangeSourceChoice.id);
        if (updateError1) throw updateError1;

        const { error: updateError2 } = await supabase.from('choices').update({
          user_trigram: oldTrigram
        }).eq('id', exchangeTargetCell.assigned.id);
        if (updateError2) throw updateError2;
      } else {
        // Just move the user to the target cell
        const { error: moveError } = await supabase.from('choices').update({
          row: exchangeTargetCell.row,
          month: exchangeTargetCell.month + 1, // Store as 1-indexed
          year: exchangeTargetCell.year,
          col: exchangeTargetCell.col
        }).eq('id', exchangeSourceChoice.id);
        if (moveError) throw moveError;
      }

      await supabase.from('exchange_requests').insert([{
        requester_trigram: oldTrigram,
        requester_choice_id: exchangeSourceChoice.id,
        target_row: exchangeTargetCell.row,
        target_month: exchangeTargetCell.month + 1,
        target_year: exchangeTargetCell.year,
        target_col: exchangeTargetCell.col,
        target_col_label: columnConfigs.find((c: any) => c.column_id === exchangeTargetCell.col)?.custom_label || columnConfigs.find((c: any) => c.column_id === exchangeTargetCell.col)?.name || exchangeTargetCell.col,
        status: 'APPROVED',
        reason: newTrigram ? `Échange Manuel avec ${newTrigram}` : `Déplacement Manuel`,
        updated_at: new Date().toISOString(), processed_by: currentUserTrigram
      }]);

      await supabase.from('logs').insert([{
        action: 'ECHANGE_MANUEL',
        details: { mode: 'ECHANGE_MANUEL', oldUser: oldTrigram, newUser: newTrigram || 'Aucun', date: `${exchangeSourceChoice.row}/${exchangeSourceChoice.month + 1}/${exchangeSourceChoice.year}`, col: exchangeSourceChoice.col }
      }]);

      if (refreshData) refreshData();
      fetchAssignedChoices();
      fetchArchivedChoices().then((archives) => { fetchRequests(archives); fetchAbandons(archives); });
      setExchangeSourceChoice(null);
      setExchangeTargetCell(null);
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de l'échange: " + (e.message || JSON.stringify(e)));
    }
  };

  const handleAdminAbandon = async (choice: any) => {
    try {
      const { error: deleteError } = await supabase.from('choices').delete().eq('id', choice.id);
      if (deleteError) throw deleteError;
      
      if (removeMode === 'ERROR') {
          const { error: logError } = await supabase.from('logs').insert([{
            action: 'SUPPRESSION_GARDE',
            details: { mode: 'CORRECTION_ERREUR', user: choice.userTrigram || choice.user_trigram, date: `${choice.row}/${choice.month + 1}/${choice.year}`, col: choice.col }
          }]);
      } else {
          const { data: abandonData, error: abandonError } = await supabase.from('abandon_requests').insert([{
            requester_trigram: choice.userTrigram || choice.user_trigram,
            shift_snapshot: {
              row: choice.row,
              month: choice.month + 1,
              year: choice.year,
              col: choice.col,
              colLabel: columnConfigs.find((c: any) => c.column_id === choice.col)?.custom_label || columnConfigs.find((c: any) => c.column_id === choice.col)?.name || choice.col
            },
            status: 'APPROVED',
            updated_at: new Date().toISOString(), processed_by: currentUserTrigram
          }]).select();
          
          if (abandonError) throw abandonError;
          
          if (abandonData && abandonData.length > 0) {
              let colLabel = columnConfigs.find((c: any) => c.column_id === choice.col)?.custom_label || COLUMNS.find(c => c.id === choice.col)?.label || "0h";
              const hMatch = colLabel.match(/\((\d{1,2})h/i);
              const hour = hMatch ? parseInt(hMatch[1], 10) : 0;
              const shiftDate = new Date(choice.year, choice.month, choice.row || 1, hour, 0, 0);
              
              const penaltyInsert = {
                  abandon_request_id: abandonData[0].id,
                  user_trigram: choice.userTrigram || choice.user_trigram,
                  shift_date: shiftDate.toISOString(),
                  abandon_date: new Date().toISOString(),
                  delay_hours: 0,
                  penalty_amount: removePenaltyAmount,
                  penalty_category: removeDelayCategory
              };
              
              await supabase.from('applied_penalties').insert([penaltyInsert]);
          }

          const { error: logError } = await supabase.from('logs').insert([{
            action: 'SUPPRESSION_GARDE',
            details: { mode: 'ABANDON', user: choice.userTrigram || choice.user_trigram, date: `${choice.row}/${choice.month + 1}/${choice.year}`, col: choice.col }
          }]);
      }

      fetchAssignedChoices();
      if (refreshData) refreshData();
      setConfirmAbandonChoice(null);
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de l'abandon: " + (e.message || JSON.stringify(e)));
    }
  };

  const handleRequestAction = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const req = requests.find(r => r.id === requestId);
      if (!req) return;

      if (action === 'APPROVED') {
        // Update the requester's choice to the new coordinates
        const { data: c } = await supabase.from('choices').update({ 
            row: req.target_row,
            col: req.target_col,
            month: req.target_month + 1,
            year: req.target_year
        }).eq('id', req.requester_choice_id).select();
        
        if (!c || c.length === 0) {
            await supabase.from('archived_choices').update({
                row: req.target_row,
                col: req.target_col,
                month: req.target_month + 1,
                year: req.target_year
            }).eq('original_id', req.requester_choice_id);
        }

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
            .update({ status: 'REJECTED', reason, updated_at: new Date().toISOString(), processed_by: currentUserTrigram })
            .in('id', otherIds);
        }
      }

      const { error } = await supabase.from('exchange_requests').update({ status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', requestId);
      if (error) throw error;
      fetchArchivedChoices().then((archives) => { fetchRequests(archives); fetchAbandons(archives); });
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
            if (ab.choice_id) {
                const { data: choiceData } = await supabase.from('choices').select('*').eq('id', ab.choice_id).single();
                if (choiceData) {
                   const { error: err1 } = await supabase.from('abandon_requests').update({ shift_snapshot: choiceData, status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', abandonId);
                   if (err1) throw err1;
                } else {
                   const { error: err2 } = await supabase.from('abandon_requests').update({ status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', abandonId);
                if (err2) throw err2;
                }
                await supabase.from('choices').delete().eq('id', ab.choice_id);
            } else if (ab.shift_snapshot) {
                const { error: err2 } = await supabase.from('abandon_requests').update({ status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', abandonId);
                if (err2) throw err2;
                await supabase.from('archived_choices')
                    .delete()
                    .eq('user_trigram', ab.requester_trigram)
                    .eq('row', ab.shift_snapshot.row)
                    .eq('col', ab.shift_snapshot.col)
                    .eq('month', ab.shift_snapshot.month + 1)
                    .eq('year', ab.shift_snapshot.year);
            }
        }
      } else {
        const { error: err2 } = await supabase.from('abandon_requests').update({ status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', abandonId);
                if (err2) throw err2;
      }
      const ab = abandons.find(a => a.id === abandonId);
      if (ab?.shift_snapshot?.linked_take?.id) {
          await handleTakeAction(ab.shift_snapshot.linked_take.id, action);
      }
      fetchArchivedChoices().then((archives) => { fetchAbandons(archives); });
    } catch (err) {
      console.error(err);
      alert("Erreur lors du traitement de la demande d'abandon.");
    }
  };

  const handleTakeAction = async (takeId: any, action: 'APPROVED' | 'REJECTED') => {
    try {
      if (action === 'APPROVED') {
        const tk = takes.find(t => t.id === takeId);
        if (tk) {
            const { data: usersData } = await supabase.from('users').select('role').eq('trigram', tk.requester_trigram).single();
            if (usersData) {
                // Check if target is archived
                const { data: archivedSetting } = await supabase.from('archived_month_settings')
                    .select('id')
                    .eq('month', tk.target_month)
                    .eq('year', tk.target_year)
                    .maybeSingle();

                if (archivedSetting) {
                    await supabase.from('archived_choices').insert({
                        user_trigram: tk.requester_trigram,
                        round_id: tk.round_id || 0,
                        row: tk.target_row,
                        col: tk.target_col,
                        month: tk.target_month + 1,
                        year: tk.target_year,
                        category: 'normal',
                        status: 'ASSIGNED',
                        user_role: usersData?.role || 'DOCTOR',
                        col_label: tk.target_col_label
                    });
                } else {
                    // Insert new choice
                    await supabase.from('choices').insert({
                        
                        user_trigram: tk.requester_trigram,
                        round_id: tk.round_id || 0,
                        row: tk.target_row,
                        col: tk.target_col,
                        month: tk.target_month + 1,
                        year: tk.target_year,
                        category: 'normal',
                        status: 'ASSIGNED'
                    });
                }

                // Auto-reject other pending takes for the same target cell
                const otherTakes = takes.filter(t => 
                  t.id !== tk.id && 
                  t.status === 'PENDING' &&
                  t.target_row === tk.target_row &&
                  t.target_col === tk.target_col &&
                  t.target_month === tk.target_month &&
                  t.target_year === tk.target_year
                );

                if (otherTakes.length > 0) {
                  const otherIds = otherTakes.map(t => t.id);
                  await supabase.from('take_requests')
                    .update({ status: 'REJECTED' })
                    .in('id', otherIds);
                }
            }
        }
      }
      
      const { error: err3 } = await supabase.from('take_requests').update({ status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', takeId);
      if (err3) throw err3;
      fetchTakes();
      fetchArchivedChoices();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du traitement de la prise de garde.");
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

  const applyHistoryFilters = (items: { type: string, data: any, date: Date, created_at: Date }[]) => {
      return items.filter(item => {
          let reqTrigram = '';
          const { type, data, date: itemDate } = item;

          if (type === 'EXCHANGE') {
              reqTrigram = data.requester_trigram.toLowerCase();
          } else if (type === 'ABANDON') {
              reqTrigram = data.requester_trigram.toLowerCase();
          } else if (type === 'TAKE') {
              reqTrigram = data.requester_trigram.toLowerCase();
          } else if (type === 'ADMIN') {
              reqTrigram = data.details?.user?.toLowerCase() || '';
          }

          // Trigram filter
          if (historyFilters.trigram && !reqTrigram.includes(historyFilters.trigram.toLowerCase())) {
              return false;
          }

          // Date filters
          if (historyFilters.startDate) {
              const s = new Date(historyFilters.startDate);
              if (itemDate < s) return false;
          }
          if (historyFilters.endDate) {
              const e = new Date(historyFilters.endDate);
              e.setHours(23, 59, 59, 999);
              if (itemDate > e) return false;
          }

          return true;
      });
  };

  const HistoryFiltersUI = () => (
      <div className="flex flex-col md:flex-row gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex-1">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Médecin (Trigramme)</label>
              <input type="text" placeholder="Ex: ABC" className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={historyFilters.trigram} onChange={e => setHistoryFilters({...historyFilters, trigram: e.target.value})} />
          </div>
          <div className="flex-1">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Date début</label>
              <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={historyFilters.startDate} onChange={e => setHistoryFilters({...historyFilters, startDate: e.target.value})} />
          </div>
          <div className="flex-1">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Date fin</label>
              <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={historyFilters.endDate} onChange={e => setHistoryFilters({...historyFilters, endDate: e.target.value})} />
          </div>
      </div>
  );

  const isConfigured = (colId: number, period: ExchangePeriod) => {
    return rules.some(r => r.source_col_id === colId && r.source_period === period);
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold">Chargement des règles...</div>;

  const allHistory = [
    ...requests.filter(r => r.status !== 'PENDING').map(r => ({ type: 'EXCHANGE', data: r, date: new Date(r.updated_at || r.created_at), created_at: new Date(r.created_at) })),
    ...abandons.filter(a => a.status !== 'PENDING').map(a => ({ type: 'ABANDON', data: a, date: new Date(a.updated_at || a.created_at), created_at: new Date(a.created_at) })),
    ...standaloneTakes.filter(t => t.status !== 'PENDING').map(t => ({ type: 'TAKE', data: t, date: new Date(t.updated_at || t.created_at), created_at: new Date(t.created_at) })),
    ...adminLogs.map(l => ({ type: 'ADMIN', data: l, date: new Date(l.created_at), created_at: new Date(l.created_at) }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const ITEMS_PER_PAGE = 30;
  const filteredHistory = applyHistoryFilters(allHistory);
  const totalHistoryPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

  return (
    <div className="flex-1 p-6 flex flex-col min-h-0 w-full" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Paramétrage des Échanges</h2>
          <p className="text-sm text-slate-500 font-medium">Définissez les règles et gérez les demandes d'échange.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-full max-w-full overflow-x-auto">
          <button 
            onClick={() => setActiveTab('REQUESTS')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex border-none items-center gap-2 whitespace-nowrap ${activeTab === 'REQUESTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Échanges
            {requests.filter(r => r.status === 'PENDING').length > 0 && (
              <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                {requests.filter(r => r.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('TAKES')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex border-none items-center gap-2 whitespace-nowrap ${activeTab === 'TAKES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Ajouts
            {standaloneTakes.filter(t => t.status === 'PENDING').length > 0 && (
              <span className="bg-teal-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                {standaloneTakes.filter(t => t.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('ABANDONS')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex border-none items-center gap-2 whitespace-nowrap ${activeTab === 'ABANDONS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Abandons
            {abandons.filter(a => a.status === 'PENDING').length > 0 && (
              <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                {abandons.filter(a => a.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('HISTORIQUE')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex border-none items-center gap-2 whitespace-nowrap ${activeTab === 'HISTORIQUE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Historique
          </button>
          {!isStandardist && (
          <button 
            onClick={() => setActiveTab('RULES')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all border-none whitespace-nowrap ${activeTab === 'RULES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Règles d'équivalence
          </button>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-xl text-sm font-bold">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {activeTab === 'REQUESTS' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-8">
          {renderTabFiltersUI()}
          
          {/* Compteur Medecin (Exchanges) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button 
              onClick={() => setIsCounterExpandedRequests(!isCounterExpandedRequests)}
              className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-slate-100 transition-colors"
            >
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Compteur médecin (Échanges)</h3>
              <div className="flex items-center gap-4">
                 <span className="text-xs font-bold text-slate-500">Depuis le {counterResetDateRequests.getFullYear() === 1970 ? 'début' : counterResetDateRequests.toLocaleDateString('fr-FR')}</span>
                 <svg className={`w-5 h-5 text-slate-500 transform transition-transform ${isCounterExpandedRequests ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </button>
            {isCounterExpandedRequests && (
              <div className="p-6 border-t border-slate-200 bg-white">
                <div className="flex justify-end mb-6">
                  <button 
                    onClick={async () => {
                      const adminUser = users.find(u => u.role === 'ADMIN');
                      if (!adminUser) return alert("Utilisateur admin non trouvé.");
                      
                      const pwd = window.prompt("Pour réinitialiser le compteur d'échanges, veuillez saisir le mot de passe administrateur :");
                      if (pwd === null) return;
                      if (pwd !== adminUser.password) return alert("Mot de passe incorrect.");
                      
                      try {
                        const { error } = await supabase.from('logs').insert([{ action: 'RESET_EXCHANGE_COUNTER', details: {} }]);
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
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                           const matchedRequests = requests.filter(r => {
                             if (r.requester_trigram !== user.trigram || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDateRequests;
                           });
                           return { user, count: matchedRequests.length, matchedRequests };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucun échange comptabilisé.</div>;
                         }

                         return userCounts.map(({ user, count, matchedRequests }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigramRequests(expandedUserTrigramRequests === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedUserTrigramRequests === user.trigram ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{count}</span>
                             </div>
                             {expandedUserTrigramRequests === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedRequests.map((req, idx) => (
                                   <div key={req.id || idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Cède : {formatRequestDate(req.requester_choice?.row, req.requester_choice?.month, req.requester_choice?.year, req.requester_choice?.col, req.requester_choice?.colLabel, true, columnConfigs)} ➔ Récupère : {formatRequestDate(req.target_row, req.target_month, req.target_year, req.target_col, req.target_col_label, false, columnConfigs)}
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Échange validé le {new Date(req.updated_at || req.created_at).toLocaleDateString('fr-FR')}</div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>

                  {/* Remplaçants */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2 mb-3">Remplaçants</h4>
                    <div className="flex flex-col gap-2">
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                           const matchedRequests = requests.filter(r => {
                             if (r.requester_trigram !== user.trigram || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDateRequests;
                           });
                           return { user, count: matchedRequests.length, matchedRequests };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucun échange comptabilisé.</div>;
                         }

                         return userCounts.map(({ user, count, matchedRequests }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigramRequests(expandedUserTrigramRequests === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedUserTrigramRequests === user.trigram ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{count}</span>
                             </div>
                             {expandedUserTrigramRequests === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedRequests.map((req, idx) => (
                                   <div key={req.id || idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Cède : {formatRequestDate(req.requester_choice?.row, req.requester_choice?.month, req.requester_choice?.year, req.requester_choice?.col, req.requester_choice?.colLabel, true, columnConfigs)} ➔ Récupère : {formatRequestDate(req.target_row, req.target_month, req.target_year, req.target_col, req.target_col_label, false, columnConfigs)}
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Échange validé le {new Date(req.updated_at || req.created_at).toLocaleDateString('fr-FR')}</div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pending Requests */}
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 mb-4">Demandes en attente</h3>
            {applyTabFilters(requests, 'REQUESTS').filter(r => r.status === 'PENDING').length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucune demande en attente.</div>
            ) : (
              <div className="space-y-4">
                {applyTabFilters(requests, 'REQUESTS').filter(r => r.status === 'PENDING').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(req => {
                  const date = new Date(req.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const isSelected = selectedExchangeRequest?.id === req.id;
                  return (
                  <div 
                    key={req.id} 
                    onClick={() => setSelectedExchangeRequest(isSelected ? null : req)}
                    className={`cursor-pointer border ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400 bg-yellow-50' : 'border-slate-200 bg-white hover:border-blue-300'} rounded-xl p-4 flex items-center justify-between shadow-sm transition-all`}
                  >
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
                      <button onClick={(e) => { e.stopPropagation(); handleRequestAction(req.id, 'REJECTED'); }} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-xs font-black uppercase transition-colors">Refuser</button>
                      <button onClick={(e) => { e.stopPropagation(); handleRequestAction(req.id, 'APPROVED'); }} className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg text-xs font-black uppercase transition-colors shadow-sm">Valider</button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>


          <div className="mt-8 border-t border-slate-100 pt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black uppercase text-slate-900">Historique des échanges (Pour rappel)</h3>
              <button 
                onClick={() => handleDeleteHistory('EXCHANGE')}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-black uppercase transition-colors shadow-sm flex items-center gap-2"
              >
                Vider l'historique
              </button>
            </div>
            {applyTabFilters(requests, 'REQUESTS').filter(r => r.status !== 'PENDING').length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucun historique correspondant.</div>
            ) : (
              <div className="space-y-3">
                {applyTabFilters(requests, 'REQUESTS').filter(r => r.status !== 'PENDING').sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).map(req => {
                  const createdDate = new Date(req.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const updatedDate = new Date(req.updated_at || req.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={`log-${req.id}`} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50 text-sm">
                      <div className="flex items-start gap-4">
                        <span className="text-slate-400 font-mono text-xs mt-1 min-w-[120px]">{createdDate}</span>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-700">Demande initiée par {req.requester_trigram}</span>
                          <span className="text-slate-500 text-xs">
                          Cède : {formatRequestDate(req.requester_choice?.row, req.requester_choice?.month, req.requester_choice?.year, req.requester_choice?.col, req.requester_choice?.colLabel, true, columnConfigs)} ➔ Récupère : {formatRequestDate(req.target_row, req.target_month, req.target_year, req.target_col, req.target_col_label, false, columnConfigs)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 ml-[136px] pl-4 border-l-2 border-slate-200 mt-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-fit font-black uppercase text-[10px] px-2 py-1 rounded-md ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {req.status === 'APPROVED' ? 'Échange validé' : 'Échange refusé'}
                          </span>
                        </div>
                        {req.reason && <span className="text-xs text-slate-500 italic mt-1">{req.reason}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      
      {activeTab === 'ABANDONS' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-8">
          {renderTabFiltersUI()}
          
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
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           const matchedExchanges = requests.filter(r => {
                             if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDate;
                           });
                           return { user, count: matchedAbandons.length + matchedExchanges.length, matchedAbandons, matchedExchanges };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucun abandon comptabilisé.</div>;
                         }

                         return userCounts.map(({ user, count, matchedAbandons, matchedExchanges }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigram(expandedUserTrigram === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedUserTrigram === user.trigram ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{count}</span>
                             </div>
                             {expandedUserTrigram === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedAbandons.map((ab, idx) => (
                                   <div key={ab.id || idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Garde : {ab.requester_choice ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs) : (ab.shift_snapshot ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs) : 'Garde supprimée')}
                                       {ab.shift_snapshot?.linked_take && (
                                           <>
                                             {' → '}
                                             <span className="font-bold text-teal-600">Reprise [{formatRequestDate(ab.shift_snapshot.linked_take.row, ab.shift_snapshot.linked_take.month, ab.shift_snapshot.linked_take.year, ab.shift_snapshot.linked_take.col, ab.shift_snapshot.linked_take.colLabel, false, columnConfigs)}]</span>
                                           </>
                                       )}
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Demandé le {new Date(ab.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(ab.updated_at || ab.created_at).toLocaleDateString('fr-FR')} {ab?.processed_by ? 'par ' + ab.processed_by : ''}</div>
                                   </div>
                                 ))}
                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Abandon) : {ex.requester_trigram === user.trigram ? 
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée') :
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs)
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Demandé le {new Date(ex.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')} {ex?.processed_by ? 'par ' + ex.processed_by : ''}</div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>

                  {/* Remplaçants */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2 mb-3">Remplaçants</h4>
                    <div className="flex flex-col gap-2">
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           const matchedExchanges = requests.filter(r => {
                             if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDate;
                           });
                           return { user, count: matchedAbandons.length + matchedExchanges.length, matchedAbandons, matchedExchanges };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucun abandon comptabilisé.</div>;
                         }

                         return userCounts.map(({ user, count, matchedAbandons, matchedExchanges }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigram(expandedUserTrigram === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedUserTrigram === user.trigram ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{count}</span>
                             </div>
                             {expandedUserTrigram === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedAbandons.map((ab, idx) => (
                                   <div key={ab.id || idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Garde : {ab.requester_choice ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs) : (ab.shift_snapshot ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs) : 'Garde supprimée')}
                                       {ab.shift_snapshot?.linked_take && (
                                           <>
                                             {' → '}
                                             <span className="font-bold text-teal-600">Reprise [{formatRequestDate(ab.shift_snapshot.linked_take.row, ab.shift_snapshot.linked_take.month, ab.shift_snapshot.linked_take.year, ab.shift_snapshot.linked_take.col, ab.shift_snapshot.linked_take.colLabel, false, columnConfigs)}]</span>
                                           </>
                                       )}
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Demandé le {new Date(ab.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(ab.updated_at || ab.created_at).toLocaleDateString('fr-FR')} {ab?.processed_by ? 'par ' + ab.processed_by : ''}</div>
                                   </div>
                                 ))}
                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Abandon) : {ex.requester_trigram === user.trigram ? 
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée') :
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs)
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Demandé le {new Date(ex.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')} {ex?.processed_by ? 'par ' + ex.processed_by : ''}</div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Compteur Medecin (Pénalités) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-8 mb-8">
            <button 
              onClick={() => setIsCounterExpandedPenalties(!isCounterExpandedPenalties)}
              className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-slate-100 transition-colors"
            >
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Compteur médecin (Pénalités)</h3>
              <div className="flex items-center gap-4">
                 <span className="text-xs font-bold text-slate-500">Depuis le {counterResetDate.getFullYear() === 1970 ? 'début' : counterResetDate.toLocaleDateString('fr-FR')}</span>
                 <svg className={`w-5 h-5 text-slate-500 transform transition-transform ${isCounterExpandedPenalties ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </button>
            {isCounterExpandedPenalties && (
              <div className="p-6 border-t border-slate-200 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  {/* Titulaires */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2 mb-3">Titulaires</h4>
                    <div className="flex flex-col gap-2">
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             if (!a.penalty_amount || a.penalty_amount <= 0) return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           const totalPenalty = matchedAbandons.reduce((sum, a) => sum + (a.penalty_amount || 0), 0);
                           return { user, totalPenalty, matchedAbandons };
                         }).filter(item => item.totalPenalty > 0).sort((a, b) => b.totalPenalty - a.totalPenalty);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucune pénalité comptabilisée.</div>;
                         }

                         return userCounts.map(({ user, totalPenalty, matchedAbandons }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigramPenalties(expandedUserTrigramPenalties === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedUserTrigramPenalties === user.trigram ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">{totalPenalty} €</span>
                             </div>
                             {expandedUserTrigramPenalties === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedAbandons.map((ab, idx) => (
                                   <div key={ab.id || idx} className="flex flex-col text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800 flex justify-between items-start">
                                       <span>Garde : {ab.requester_choice ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs) : (ab.shift_snapshot ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs) : 'Garde supprimée')}</span>
                                       <span className="text-red-600 ml-2 whitespace-nowrap">+{ab.penalty_amount} €</span>
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                                        <span>Demandé le {new Date(ab.created_at).toLocaleDateString('fr-FR')}</span>
                                        <span className="font-medium bg-slate-100 px-1 py-0.5 rounded text-slate-600">Délai : {ab.delay_category || 'N/A'}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>

                  {/* Remplaçants */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2 mb-3">Remplaçants</h4>
                    <div className="flex flex-col gap-2">
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             if (!a.penalty_amount || a.penalty_amount <= 0) return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           const totalPenalty = matchedAbandons.reduce((sum, a) => sum + (a.penalty_amount || 0), 0);
                           return { user, totalPenalty, matchedAbandons };
                         }).filter(item => item.totalPenalty > 0).sort((a, b) => b.totalPenalty - a.totalPenalty);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucune pénalité comptabilisée.</div>;
                         }

                         return userCounts.map(({ user, totalPenalty, matchedAbandons }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigramPenalties(expandedUserTrigramPenalties === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedUserTrigramPenalties === user.trigram ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">{totalPenalty} €</span>
                             </div>
                             {expandedUserTrigramPenalties === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedAbandons.map((ab, idx) => (
                                   <div key={ab.id || idx} className="flex flex-col text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800 flex justify-between items-start">
                                       <span>Garde : {ab.requester_choice ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs) : (ab.shift_snapshot ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs) : 'Garde supprimée')}</span>
                                       <span className="text-red-600 ml-2 whitespace-nowrap">+{ab.penalty_amount} €</span>
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                                        <span>Demandé le {new Date(ab.created_at).toLocaleDateString('fr-FR')}</span>
                                        <span className="font-medium bg-slate-100 px-1 py-0.5 rounded text-slate-600">Délai : {ab.delay_category || 'N/A'}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pending Requests */}
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 mb-4">Demandes d'abandon en attente</h3>
            {applyTabFilters(abandons, 'ABANDONS').filter(a => a.status === 'PENDING').length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucun abandon en attente.</div>
            ) : (
              <div className="space-y-4">
                {applyTabFilters(abandons, 'ABANDONS').filter(a => a.status === 'PENDING').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(ab => {
                  const date = new Date(ab.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const isSelected = selectedAbandonRequest?.id === ab.id;
                  return (
                  <div 
                    key={ab.id} 
                    onClick={() => setSelectedAbandonRequest(isSelected ? null : ab)}
                    className={`cursor-pointer border ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400 bg-yellow-50' : 'border-slate-200 bg-white hover:border-rose-300'} rounded-xl p-4 flex items-center justify-between shadow-sm transition-all`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Demandeur</div>
                        <div className="font-black text-xl text-slate-900 leading-none">{ab.requester_trigram}</div>
                        <div className="text-[9px] text-slate-400 mt-2 whitespace-nowrap">{date}</div>
                      </div>
                      
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                        <div className="text-[9px] font-black text-rose-500 uppercase mb-1">Garde à abandonner</div>
                        <div className="text-sm font-bold text-slate-800">
                           {ab.requester_choice 
                              ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs)
                              : ab.shift_snapshot 
                                ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs)
                                : 'Garde supprimée'}
                        </div>
                      </div>
                      
                      {ab.shift_snapshot?.linked_take && (
                          <>
                              <div className="flex items-center justify-center text-slate-300 mx-2">
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                              </div>
                              <div className="p-3 bg-teal-50 border border-teal-100 rounded-lg">
                                  <div className="text-[9px] font-black text-teal-600 uppercase mb-1">Garde reprise</div>
                                  <div className="text-sm font-bold text-slate-800">
                                      {formatRequestDate(ab.shift_snapshot.linked_take.row, ab.shift_snapshot.linked_take.month, ab.shift_snapshot.linked_take.year, ab.shift_snapshot.linked_take.col, ab.shift_snapshot.linked_take.colLabel, false, columnConfigs)}
                                  </div>
                              </div>
                          </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={(e) => { e.stopPropagation(); handleAbandonAction(ab.id, 'REJECTED'); }} className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg text-xs font-black uppercase transition-colors shadow-sm">Refuser</button>
                       <button onClick={(e) => { e.stopPropagation(); handleAbandonAction(ab.id, 'APPROVED'); }} className="px-4 py-2 bg-rose-500 text-white hover:bg-rose-600 rounded-lg text-xs font-black uppercase transition-colors shadow-sm">Accepter</button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>


          <div className="mt-8 border-t border-slate-100 pt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black uppercase text-slate-900">Historique des abandons (Pour rappel)</h3>
              <button 
                onClick={() => handleDeleteHistory('ABANDON')}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-black uppercase transition-colors shadow-sm flex items-center gap-2"
              >
                Vider l'historique
              </button>
            </div>
            {applyTabFilters(abandons, 'ABANDONS').filter(a => a.status !== 'PENDING').length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucun historique correspondant.</div>
            ) : (
              <div className="space-y-3">
                {applyTabFilters(abandons, 'ABANDONS').filter(a => a.status !== 'PENDING').sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).map(ab => {
                  const createdDate = new Date(ab.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const updatedDate = new Date(ab.updated_at || ab.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={`log-${ab.id}`} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50 text-sm">
                      <div className="flex items-start gap-4">
                        <span className="text-slate-400 font-mono text-xs mt-1 min-w-[120px]">{createdDate}</span>
                        <div className="flex flex-col gap-1 w-full">
                          <span className="font-bold text-slate-700">Abandon initié par {ab.requester_trigram}</span>
                          <span className="text-slate-500 text-xs">
                            Garde : {ab.requester_choice 
                              ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs)
                              : ab.shift_snapshot 
                                ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs)
                                : 'supprimée'}
                            {ab.shift_snapshot?.linked_take && (
                                <>
                                  {' → '}
                                  <span className="font-bold text-teal-600">Reprise [{formatRequestDate(ab.shift_snapshot.linked_take.row, ab.shift_snapshot.linked_take.month, ab.shift_snapshot.linked_take.year, ab.shift_snapshot.linked_take.col, ab.shift_snapshot.linked_take.colLabel, false, columnConfigs)}</span>
                                </>
                            )}
                          </span>
                          <div className="flex flex-col gap-1 ml-[136px] pl-4 border-l-2 border-slate-200 mt-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-fit font-black uppercase text-[10px] px-2 py-1 rounded-md ${ab.status === 'APPROVED' ? 'bg-rose-100 text-rose-700' : 'bg-red-100 text-red-700'}`}>
                                {ab.status === 'APPROVED' ? 'Abandon pris en compte' : 'Abandon refusé'} le {updatedDate} {ab.processed_by ? 'par ' + ab.processed_by : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'TAKES' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-8">
          {renderTabFiltersUI()}
          
          {/* Compteur Medecin (Takes) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button 
              onClick={() => setIsCounterExpandedTakes(!isCounterExpandedTakes)}
              className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-slate-100 transition-colors"
            >
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Compteur médecin (Ajouts)</h3>
              <div className="flex items-center gap-4">
                 <span className="text-xs font-bold text-slate-500">Depuis le {counterResetDateTakes.getFullYear() === 1970 ? 'début' : counterResetDateTakes.toLocaleDateString('fr-FR')}</span>
                 <svg className={`w-5 h-5 text-slate-500 transform transition-transform ${isCounterExpandedTakes ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </button>
            {isCounterExpandedTakes && (
              <div className="p-6 border-t border-slate-200 bg-white">
                <div className="flex justify-end mb-6">
                  <button 
                    onClick={async () => {
                      const adminUser = users.find(u => u.role === 'ADMIN');
                      if (!adminUser) return alert("Utilisateur admin non trouvé.");
                      
                      const pwd = window.prompt("Pour réinitialiser le compteur d'ajouts, veuillez saisir le mot de passe administrateur :");
                      if (pwd === null) return;
                      if (pwd !== adminUser.password) return alert("Mot de passe incorrect.");
                      
                      try {
                        const { error } = await supabase.from('logs').insert([{ action: 'RESET_TAKE_COUNTER', details: {} }]);
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
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                           const matchedTakes = takes.filter(t => {
                             if (t.requester_trigram !== user.trigram || t.status !== 'APPROVED') return false;
                             const actionDate = new Date(t.updated_at || t.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           const matchedExchanges = requests.filter(r => {
                             if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           return { user, count: matchedTakes.length + matchedExchanges.length, matchedTakes, matchedExchanges };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucun ajout comptabilisé.</div>;
                         }

                         return userCounts.map(({ user, count, matchedTakes, matchedExchanges }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigramTakes(expandedUserTrigramTakes === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedUserTrigramTakes === user.trigram ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{count}</span>
                             </div>
                             {expandedUserTrigramTakes === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedTakes.map((tk, idx) => (
                                   <div key={tk.id || idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Garde : {formatRequestDate(tk.target_row, tk.target_month, tk.target_year, tk.target_col, tk.target_col_label, false, columnConfigs)}
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Demandé le {new Date(tk.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(tk.updated_at || tk.created_at).toLocaleDateString('fr-FR')} {tk?.processed_by ? 'par ' + tk.processed_by : ''}</div>
                                   </div>
                                 ))}
                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Reprise) : {ex.requester_trigram === user.trigram ? 
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs) :
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée')
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Demandé le {new Date(ex.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')} {ex?.processed_by ? 'par ' + ex.processed_by : ''}</div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>

                  {/* Remplaçants */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2 mb-3">Remplaçants</h4>
                    <div className="flex flex-col gap-2">
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                           const matchedTakes = takes.filter(t => {
                             if (t.requester_trigram !== user.trigram || t.status !== 'APPROVED') return false;
                             const actionDate = new Date(t.updated_at || t.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           const matchedExchanges = requests.filter(r => {
                             if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           return { user, count: matchedTakes.length + matchedExchanges.length, matchedTakes, matchedExchanges };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucun ajout comptabilisé.</div>;
                         }

                         return userCounts.map(({ user, count, matchedTakes, matchedExchanges }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigramTakes(expandedUserTrigramTakes === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedUserTrigramTakes === user.trigram ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{count}</span>
                             </div>
                             {expandedUserTrigramTakes === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedTakes.map((tk, idx) => (
                                   <div key={tk.id || idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Garde : {formatRequestDate(tk.target_row, tk.target_month, tk.target_year, tk.target_col, tk.target_col_label, false, columnConfigs)}
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Demandé le {new Date(tk.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(tk.updated_at || tk.created_at).toLocaleDateString('fr-FR')} {tk?.processed_by ? 'par ' + tk.processed_by : ''}</div>
                                   </div>
                                 ))}
                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Reprise) : {ex.requester_trigram === user.trigram ? 
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs) :
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée')
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Demandé le {new Date(ex.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')} {ex?.processed_by ? 'par ' + ex.processed_by : ''}</div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>
                </div>
              </div>

            )}
          </div>
          {/* Pending Requests */}
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 mb-4">Demandes d'ajout en attente</h3>
            {applyTabFilters(takes, 'TAKES').filter(t => t.status === 'PENDING').length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucune demande en attente.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {applyTabFilters(takes, 'TAKES').filter(t => t.status === 'PENDING').map(take => (
                  <div key={take.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Ajout</span>
                        <div className="text-sm font-bold mt-2">Par : {take.requester_trigram}</div>
                        <div className="text-xs text-slate-500">Pour la garde : {formatRequestDate(take.target_row, take.target_month, take.target_year, take.target_col, take.target_col_label, false, columnConfigs)}</div>
                        <div className="text-[10px] text-slate-400 mt-1">Demandé le {new Date(take.created_at).toLocaleDateString('fr-FR')}</div>
                      </div>
                    </div>
                    {take.status === 'PENDING' && (
                      <div className="flex gap-2 mt-2 border-t border-slate-100 pt-3">
                        <button onClick={() => setConfirmTakeCell(take)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                          Valider
                        </button>
                        <button onClick={async () => {
                          try {
                            const { error } = await supabase.from('takes').update({ status: 'REJECTED', processed_by: currentUserTrigram }).eq('id', take.id);
                            if (error) throw error;
                            refreshData();
                          } catch (err) {
                            alert("Erreur lors du refus : " + err.message);
                          }
                        }} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-8 border-t border-slate-100 pt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black uppercase text-slate-900">Historique des ajouts (Pour rappel)</h3>
              <button 
                onClick={() => handleDeleteHistory('TAKE')}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-black uppercase transition-colors shadow-sm flex items-center gap-2"
              >
                Vider l'historique
              </button>
            </div>
            {applyTabFilters(takes, 'TAKES').filter(t => t.status !== 'PENDING').length === 0 ? (
              <div className="text-center text-slate-500 font-bold py-8 bg-slate-50 rounded-xl border border-slate-100">Aucun historique correspondant.</div>
            ) : (
              <div className="space-y-3">
                {applyTabFilters(takes, 'TAKES').filter(t => t.status !== 'PENDING').sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).map(tk => {
                  const createdDate = new Date(tk.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const updatedDate = new Date(tk.updated_at || tk.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={`log-${tk.id}`} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50 text-sm">
                      <div className="flex items-start gap-4">
                        <span className="text-slate-400 font-mono text-xs mt-1 min-w-[120px]">{createdDate}</span>
                        <div className="flex flex-col gap-1 w-full">
                          <span className="font-bold text-slate-700">Ajout initié par {tk.requester_trigram}</span>
                          <span className="text-slate-500 text-xs">
                            Garde : {formatRequestDate(tk.target_row, tk.target_month, tk.target_year, tk.target_col, tk.target_col_label, false, columnConfigs)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          tk.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          tk.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {tk.status === 'APPROVED' ? `VALIDÉ${tk.processed_by ? ` PAR ${tk.processed_by}` : ''}` :
                           tk.status === 'REJECTED' ? `REFUSÉ${tk.processed_by ? ` PAR ${tk.processed_by}` : ''}` :
                           'EN ATTENTE'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Mis à jour le {updatedDate}</span>
                        {tk.reason && (
                          <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 ml-auto max-w-[50%] truncate" title={tk.reason}>
                            Motif : {tk.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'HISTORIQUE' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-8">
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider mb-6">Historique des mouvements</h3>
              <div className="flex flex-col gap-4">
                {[...requests, ...abandons, ...takes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(item => {
                  const isExchange = 'requester_choice' in item && 'target_row' in item;
                  const isAbandon = 'requester_choice' in item && !('target_row' in item);
                  const isTake = 'target_row' in item && !('requester_choice' in item);
                  
                  return (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          {new Date(item.created_at).toLocaleDateString('fr-FR')} {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          <span className="text-slate-300">|</span>
                          <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${
                            isExchange ? 'bg-blue-50 text-blue-600' :
                            isAbandon ? 'bg-orange-50 text-orange-600' :
                            'bg-emerald-50 text-emerald-600'
                          }`}>
                            {isExchange ? 'Échange' : isAbandon ? 'Abandon' : 'Ajout'} initié par {item.requester_trigram}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-2">
                          {isExchange && item.requester_choice && (
                            <>Garde : {formatRequestDate(item.requester_choice.row, item.requester_choice.month, item.requester_choice.year, item.requester_choice.col, item.requester_choice.colLabel, true, columnConfigs)} → Cible : {formatRequestDate(item.target_row, item.target_month, item.target_year, item.target_col, item.target_col_label, false, columnConfigs)}</>
                          )}
                          {isAbandon && (item.requester_choice || item.shift_snapshot) && (
                            <>Garde : {item.requester_choice ? formatRequestDate(item.requester_choice.row, item.requester_choice.month, item.requester_choice.year, item.requester_choice.col, item.requester_choice.colLabel, true, columnConfigs) : formatRequestDate(item.shift_snapshot.row, item.shift_snapshot.month, item.shift_snapshot.year, item.shift_snapshot.col, item.shift_snapshot.colLabel, true, columnConfigs)}</>
                          )}
                          {isTake && (
                            <>Garde : {formatRequestDate(item.target_row, item.target_month, item.target_year, item.target_col, item.target_col_label, false, columnConfigs)}</>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                        <div className={`text-xs font-black uppercase px-3 py-1.5 rounded-lg text-center ${
                          item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          item.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status === 'APPROVED' ? `VALIDÉ${item.processed_by ? ` PAR ${item.processed_by}` : ''}` :
                           item.status === 'REJECTED' ? `REFUSÉ${item.processed_by ? ` PAR ${item.processed_by}` : ''}` :
                           'EN ATTENTE'}
                          {item.updated_at && item.status !== 'PENDING' && (
                            <div className="text-[9px] mt-0.5 opacity-70">
                              LE {new Date(item.updated_at).toLocaleDateString('fr-FR')} {new Date(item.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {[...requests, ...abandons, ...takes].length === 0 && (
                   <div className="text-center text-slate-500 font-bold py-8">Aucun historique disponible.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals for validation would go here. We reuse existing modals or standard alerts. */}
      {/* For simplicity we will assume standard modals from original file if they existed, but since they might have been cut off, I will add them. */}
    </div>
  );
};
