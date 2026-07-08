import React, { useState, useEffect, useMemo } from 'react';
import { MatrixHeader } from './MatrixHeader';
import { COLUMNS, parseTimeRange, isPublicHoliday, doShiftsOverlap } from '../constants';
import { ChevronDown } from 'lucide-react';

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

const MonthCounters = ({ month, year, choices, columns, userTrigram }: {
    month: number,
    year: number,
    choices: any[],
    columns: any[],
    userTrigram: string
}) => {
    const [expanded, setExpanded] = useState<string | null>(null);

    const stats = {
        'Consultation': { total: 0, semaine: 0, samediAprem: 0, dimancheJf: 0 },
        'Téléconsultation': { total: 0, semaine: 0, samediAprem: 0, dimancheJf: 0 },
        'Visite': { total: 0, semaine: 0, samediAprem: 0, dimancheJf: 0 },
    };

    const myAssigned = choices.filter(c => 
        c.month === month && 
        c.year === year && 
        c.userTrigram === userTrigram && 
        (c.status === 'ASSIGNED' || c.status === 'VALIDATED')
    );

    myAssigned.forEach(choice => {
        const col = columns.find(c => c.id === choice.col);
        if (!col) return;
        
        const type = col.type as 'Consultation' | 'Téléconsultation' | 'Visite';
        if (!stats[type]) return;

        const date = new Date(year, month, choice.row);
        const isHoliday = isPublicHoliday(date);
        const isSunday = date.getDay() === 0;
        const isSaturday = date.getDay() === 6;
        const timeRange = parseTimeRange(col.timeRange);

        stats[type].total++;

        if (isSunday || isHoliday) {
            stats[type].dimancheJf++;
        } else if (isSaturday && timeRange && timeRange.start >= 12 * 60) {
            stats[type].samediAprem++;
        } else {
            stats[type].semaine++;
        }
    });

    return (
        <div className="flex flex-wrap gap-4 px-4">
            {(['Consultation', 'Téléconsultation', 'Visite'] as const).map(type => {
                const data = stats[type];
                const isExpanded = expanded === type;
                return (
                    <div key={type} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 min-w-[200px]">
                        <button 
                            onClick={() => setExpanded(isExpanded ? null : type)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-700 text-sm">{type}</span>
                                <span className="bg-blue-100 text-blue-700 py-0.5 px-2.5 rounded-full text-xs font-black">{data.total}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                            <div className="px-4 py-3 bg-white border-t border-slate-100 space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Semaine</span>
                                    <span className="font-black text-slate-700">{data.semaine}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Samedi Aprem</span>
                                    <span className="font-black text-slate-700">{data.samediAprem}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Dimanche & JF</span>
                                    <span className="font-black text-slate-700">{data.dimancheJf}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    );
};

const getDefaultColor = (colorClass: string) => {
    const match = colorClass?.match(/bg-\[#([0-9a-fA-F]{6})\]/);
    if (match) return `#${match[1]}`;
    return '#FFFFFF';
};

export const ArchivePlanningDoctorView = ({ supabase, currentUserTrigram, columnConfigs }: any) => {
    const [archivedChoices, setArchivedChoices] = useState<any[]>([]);
    const [archivedClosures, setArchivedClosures] = useState<any[]>([]);
    const [monthSettings, setMonthSettings] = useState<any[]>([]);
    const [myPendingTakes, setMyPendingTakes] = useState<any[]>([]);
    const [myPendingExchanges, setMyPendingExchanges] = useState<any[]>([]);
    const [availableMonths, setAvailableMonths] = useState<{month: number, year: number, label: string}[]>([]);
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Take Mode States
    const [takeMode, setTakeMode] = useState<'INACTIVE' | 'SELECT_TARGET' | 'SELECT_OWN_ABANDON' | 'SELECT_TARGET_ABANDON'>('INACTIVE');
    const [showTakeConfirmModal, setShowTakeConfirmModal] = useState(false);
    const [selectedTargetChoice, setSelectedTargetChoice] = useState<{row: number, col: number, month: number, year: number, colLabel: string, colType: string, colTimeRange: string, colSite: string} | null>(null);
    const [selectedOwnAbandonChoice, setSelectedOwnAbandonChoice] = useState<any>(null);
    const [possibleTargetChoices, setPossibleTargetChoices] = useState<any[]>([]);
    const [hoveredCell, setHoveredCell] = useState<{ day: number, month: number, year: number, colId: number, colLabel: string, colType: string, colSite?: string, colTimeRange?: string } | null>(null);

    const [exchangeRules, setExchangeRules] = useState<any[]>([]);
    const [exchangeModes, setExchangeModes] = useState<Record<number, string>>({});
    const [activeChoices, setActiveChoices] = useState<any[]>([]);

    useEffect(() => {
        const fetchArchived = async () => {
            setLoading(true);
            const data = await fetchAll(supabase, 'archived_choices');
            const dbClosures = await fetchAll(supabase, 'archived_global_closures');
            const dbMonthSettings = await fetchAll(supabase, 'archived_month_settings');
            const myTakesDb = await fetchAll(supabase, 'take_requests', (q) => q.eq('requester_trigram', currentUserTrigram).neq('status', 'ARCHIVED'));
            const myExchangesDb = await fetchAll(supabase, 'exchange_requests', (q) => q.eq('requester_trigram', currentUserTrigram).neq('status', 'ARCHIVED'));
            if (myExchangesDb) setMyPendingExchanges(myExchangesDb);
            const activeChoicesData = await fetchAll(supabase, 'choices');
            if (activeChoicesData) setActiveChoices(activeChoicesData);
            
            const { data: rulesData } = await supabase.from('exchange_rules').select('*');
            if (rulesData) setExchangeRules(rulesData);
            
            const { data: modesData } = await supabase.from('exchange_modes').select('*');
            if (modesData) {
              const modesMap: Record<number, string> = {};
              modesData.forEach((m: any) => modesMap[m.col_id] = m.mode);
              setExchangeModes(modesMap);
            }
            
            if (dbMonthSettings) setMonthSettings(dbMonthSettings);
            if (myTakesDb) setMyPendingTakes(myTakesDb.filter(t => t.status === 'PENDING'));
            
            if (dbClosures) {
               setArchivedClosures(dbClosures.map((c: any) => ({ ...c, month: c.month !== null ? c.month - 1 : null })));
            }
            
            if (data) {
              const parsed = data.map((db: any) => ({
                id: db.id, row: db.row, col: db.col, month: db.month - 1, year: db.year,
                groupIndex: db.group_index, subRank: db.sub_rank, category: db.category,
                userTrigram: db.user_trigram, userRole: db.user_role || 'DOCTOR',
                status: db.status || 'ASSIGNED',
                submittedAt: db.submitted_at, roundId: db.round_id,
                colLabel: db.col_label, colType: db.col_type, colTimeRange: db.col_time_range
              }));
              setArchivedChoices(parsed);
              
              const uniqueDates = new Map<string, {month: number, year: number, label: string}>();
              parsed.forEach((c: any) => {
                  const key = `${c.year}-${c.month}`;
                  if (!uniqueDates.has(key)) {
                      const d = new Date(c.year, c.month, 1);
                      uniqueDates.set(key, { month: c.month, year: c.year, label: d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }) });
                  }
              });
              const sortedMonths = Array.from(uniqueDates.values())
                .filter(m => {
                    const setting = dbMonthSettings?.find((s: any) => s.month === m.month && s.year === m.year);
                    return setting && setting.show_planning === true;
                })
                .sort((a,b) => (a.year - b.year) || (a.month - b.month));
              setAvailableMonths(sortedMonths);
              
              if (sortedMonths.length > 0 && selectedMonths.length === 0) {
                  setSelectedMonths([`${sortedMonths[0].year}-${sortedMonths[0].month}`]);
              }
            }
            setLoading(false);
        };
        fetchArchived();
    }, [supabase]);

    const toggleMonth = (key: string) => {
        setSelectedMonths(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const dynamicColumns = useMemo(() => {
        return COLUMNS.map(col => {
            const config = (columnConfigs || []).find((c: any) => c.column_id === col.id);
            return {
                ...col,
                label: config?.custom_label || col.label,
                headerLabel: config?.custom_header_label || col.headerLabel,
                type: config?.custom_type || col.type,
                site: config?.custom_site || col.site,
                timeRange: config?.custom_time_range || col.timeRange,
                customColor: config?.custom_color || getDefaultColor(col.colorClass) || '#FFFFFF'
            };
        });
    }, [columnConfigs]);

    const overrideMonthsToDisplay = availableMonths.filter(m => selectedMonths.includes(`${m.year}-${m.month}`));
    
    
    const computePossibleTargets = (ownChoice: any) => {
        const d = new Date(ownChoice.year, ownChoice.month, ownChoice.row);
        const dayOfWeek = d.getDay();
        const isHoliday = isPublicHoliday(d);
        let sourcePeriod: 'SEMAINE' | 'SAMEDI' | 'DIMANCHE' = 'SEMAINE';
        if (dayOfWeek === 0 || isHoliday) sourcePeriod = 'DIMANCHE';
        else if (dayOfWeek === 6) sourcePeriod = 'SAMEDI';

        const mode = exchangeModes[ownChoice.col] || 'GLOBAL';
        const activePeriod = mode === 'GLOBAL' ? 'GLOBAL' : sourcePeriod;
        
        const validRules = exchangeRules.filter(r => 
          r.source_col_id === ownChoice.col && 
          r.source_period === activePeriod
        );

        const possibleTargets: any[] = [];

        availableMonths.forEach(({ month, year }) => {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          for (let day = 1; day <= daysInMonth; day++) {
            const targetDate = new Date(year, month, day);
            
            const now = new Date();
            const diffHours = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (diffHours < 48) {
                continue;
            }

            const targetDayOfWeek = targetDate.getDay();
            const targetIsHoliday = isPublicHoliday(targetDate);
            let targetPeriod: 'SEMAINE' | 'SAMEDI' | 'DIMANCHE' = 'SEMAINE';
            if (targetDayOfWeek === 0 || targetIsHoliday) targetPeriod = 'DIMANCHE';
            else if (targetDayOfWeek === 6) targetPeriod = 'SAMEDI';

            COLUMNS.forEach(col => {
              
              
              const isValidRule = validRules.some(r => r.target_col_id === col.id && r.target_period === targetPeriod);
              if (!isValidRule) return;

              const isClosed = archivedClosures.some((gc: any) => gc.col_id === col.id && gc.row === day && gc.month === month && gc.year === year);
              if (isClosed) return;

              const isAssigned = archivedChoices.some((c: any) => c.row === day && c.col === col.id && c.month === month && c.year === year);
              if (isAssigned) return;

              const cfg = columnConfigs?.find((c: any) => c.column_id === col.id);
              const colLabel = cfg?.custom_label || col.label;

              possibleTargets.push({
                row: day,
                col: col.id,
                month,
                year,
                colLabel
              });
            });
          }
        });

        setPossibleTargetChoices(possibleTargets);
    };

    const handleTakeConfirm = async () => {
        if (!selectedTargetChoice) return;
        
        try {
            if (takeMode === 'SELECT_TARGET_ABANDON' && selectedOwnAbandonChoice) {
                const reqTake = {
                    requester_trigram: currentUserTrigram,
                    target_row: selectedTargetChoice.row,
                    target_col: selectedTargetChoice.col,
                    target_month: selectedTargetChoice.month,
                    target_year: selectedTargetChoice.year,
                    target_col_label: selectedTargetChoice.colLabel,
                    status: 'PENDING'
                };
                const reqAbandon = {
                    requester_trigram: currentUserTrigram,
                    shift_snapshot: {
                        row: selectedOwnAbandonChoice.row,
                        month: selectedOwnAbandonChoice.month,
                        year: selectedOwnAbandonChoice.year,
                        col: selectedOwnAbandonChoice.col,
                        colLabel: selectedOwnAbandonChoice.col_label || COLUMNS.find(c => c.id === selectedOwnAbandonChoice.col)?.label
                    },
                    status: 'PENDING'
                };
                
                const { error: errTake } = await supabase.from('take_requests').insert(reqTake);
                if (errTake) throw errTake;
                
                const { error: errAbandon } = await supabase.from('abandon_requests').insert(reqAbandon);
                if (errAbandon) throw errAbandon;
                
                setMyPendingTakes([...myPendingTakes, reqTake]);
                alert("Votre demande d'abandon avec reprise a été envoyée à l'administrateur.");
            } else {
                const { data: existing } = await supabase.from('take_requests')
                    .select('id')
                    .eq('requester_trigram', currentUserTrigram)
                    .eq('target_row', selectedTargetChoice.row)
                    .eq('target_col', selectedTargetChoice.col)
                    .eq('target_month', selectedTargetChoice.month)
                    .eq('target_year', selectedTargetChoice.year)
                    .eq('status', 'PENDING')
                    .maybeSingle();
                    
                if (existing) {
                    alert("Demande déjà existante.");
                    setShowTakeConfirmModal(false);
                    setTakeMode('INACTIVE');
                    return;
                }

                const req = {
                    requester_trigram: currentUserTrigram,
                    target_row: selectedTargetChoice.row,
                    target_col: selectedTargetChoice.col,
                    target_month: selectedTargetChoice.month,
                    target_year: selectedTargetChoice.year,
                    target_col_label: selectedTargetChoice.colLabel,
                    status: 'PENDING'
                };
                const { error } = await supabase.from('take_requests').insert(req);
                if (error) throw error;
                
                setMyPendingTakes([...myPendingTakes, req]);
                alert("Demande de prise de garde envoyée.");
            }
            
            setShowTakeConfirmModal(false);
            if (takeMode === 'SELECT_TARGET_ABANDON') {
                setTakeMode('INACTIVE');
                setSelectedOwnAbandonChoice(null);
            }
            setSelectedTargetChoice(null);
        } catch (e: any) {
            alert("Erreur lors de la demande: " + e.message);
        }
    };

    if (loading) {
        return <div className="flex-1 flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div></div>;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 relative min-w-0 w-full">
            {availableMonths.length > 0 ? (
                <div className="p-4 bg-white border-b shadow-sm z-10 shrink-0 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400 self-center mr-2">Afficher :</span>
                        {availableMonths.map(m => {
                            const key = `${m.year}-${m.month}`;
                            const isSelected = selectedMonths.includes(key);
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleMonth(key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <span className="capitalize">{m.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center text-slate-400 font-bold">Aucune archive disponible.</div>
            )}
            
            {takeMode === 'SELECT_TARGET' && (
                <div className="bg-slate-900 text-white p-4 flex flex-col md:flex-row items-center justify-center gap-4 shadow-lg z-40 shrink-0">
                    <div className="font-bold flex items-center gap-3 text-sm">
                        <span className="w-3 h-3 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.5)]"></span>
                        Sélectionnez une garde vide et ouverte sur le planning pour la prendre
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-4">
                <div className="flex flex-col gap-8 min-w-0 w-full">
                    {overrideMonthsToDisplay.map(m => {
                        const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
                        const isTakesAllowedForThisMonth = monthSettings.find(s => s.month === m.month && s.year === m.year)?.allow_takes;
                        const isAbandonsAllowedForThisMonth = monthSettings.find(s => s.month === m.month && s.year === m.year)?.allow_exchanges;
                        return (
                            <div key={`${m.year}-${m.month}`} className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-w-0 w-full overflow-hidden">
                                <div className="bg-slate-900 text-white p-4 shrink-0 rounded-t-2xl flex flex-col items-center gap-4">
                                    <h3 className="text-lg font-black uppercase tracking-widest text-center">{m.label}</h3>
                                    <div className="flex gap-2">
                                        {isTakesAllowedForThisMonth && (
                                            <button
                                                onClick={() => {
                                                    if (takeMode === 'SELECT_TARGET') setTakeMode('INACTIVE');
                                                    else setTakeMode('SELECT_TARGET');
                                                }}
                                                className={`flex items-center justify-center gap-2 px-6 py-2 border rounded-xl text-xs font-black uppercase transition-all shadow-sm whitespace-nowrap ${takeMode === 'SELECT_TARGET' ? 'bg-teal-500 text-white border-teal-600 hover:bg-teal-600' : 'bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-500 hover:text-white'}`}
                                            >
                                                <span className="hidden md:inline">{takeMode === 'SELECT_TARGET' ? 'Arrêter de prendre des gardes' : 'Prendre des gardes'}</span>
                                                <span className="md:hidden">{takeMode === 'SELECT_TARGET' ? 'Arrêter' : 'Prendre'}</span>
                                            </button>
                                        )}
                                        {isAbandonsAllowedForThisMonth && (
                                            <button
                                                onClick={() => {
                                                    if (takeMode === 'SELECT_OWN_ABANDON' || takeMode === 'SELECT_TARGET_ABANDON') setTakeMode('INACTIVE');
                                                    else setTakeMode('SELECT_OWN_ABANDON');
                                                    setSelectedOwnAbandonChoice(null);
                                                    setPossibleTargetChoices([]);
                                                }}
                                                className={`flex items-center justify-center gap-2 px-6 py-2 border rounded-xl text-xs font-black uppercase transition-all shadow-sm whitespace-nowrap ${takeMode === 'SELECT_OWN_ABANDON' || takeMode === 'SELECT_TARGET_ABANDON' ? 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600' : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-500 hover:text-white'}`}
                                            >
                                                <span className="hidden md:inline">{takeMode === 'SELECT_OWN_ABANDON' || takeMode === 'SELECT_TARGET_ABANDON' ? 'Annuler' : 'Abandonner une garde'}</span>
                                                <span className="md:hidden">{takeMode === 'SELECT_OWN_ABANDON' || takeMode === 'SELECT_TARGET_ABANDON' ? 'Annuler' : 'Abandon'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="p-4 shrink-0 border-b border-slate-100 bg-slate-50">
                                    <MonthCounters month={m.month} year={m.year} choices={archivedChoices} columns={dynamicColumns} userTrigram={currentUserTrigram} />
                                </div>

                                <div className="bg-white rounded-b-2xl overflow-x-auto custom-scrollbar w-full">
                                        <table className="w-max min-w-full border-separate border-spacing-0 table-fixed">
                                        <MatrixHeader columns={dynamicColumns} globalClosures={archivedClosures} month={m.month} year={m.year} closedColumns={[]} hoveredCell={hoveredCell} />
                                        <tbody>
                                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                                const date = new Date(m.year, m.month, day);
                                                const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3).replace('.', '');
                                                const isSunday = date.getDay() === 0;
                                                const isHoliday = isPublicHoliday(date);
                                                const isOffDay = isSunday || isHoliday;
                                                const isWeekend = date.getDay() === 6 || isOffDay;
                                                const rowHeaderBg = isWeekend ? 'bg-red-100 text-red-600' : 'bg-white text-slate-900';

                                                return (
                                                    <tr key={day} className={`h-10 md:h-8 hover:bg-slate-50/50 ${isWeekend ? 'bg-red-100/50' : ''}`}>
                                                        <td className={`sticky left-0 border-r border-b border-slate-200 text-center z-10 w-20 md:w-16 h-10 md:h-8 font-black ${rowHeaderBg}`}>
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className="text-[12px] md:text-[10px] font-normal opacity-70">{dayName}</span>
                                                                <span className="text-[14px] md:text-[12px]">{day}</span>
                                                            </div>
                                                        </td>
                                                        {dynamicColumns.map(col => {
                                                            const isClosed = archivedClosures.some(gc => gc.col_id === col.id && gc.row === day && gc.month === m.month && gc.year === m.year);
                                                            const timeRange = parseTimeRange(col.timeRange);
                                                            const isWeekendTime = isOffDay || (date.getDay() === 6 && timeRange && timeRange.end > 14 * 60);
                                                            const isWeekendGuard = isWeekendTime && (col.type === 'Consultation' || col.type === 'Téléconsultation') && col.label !== 'PFG' && col.label !== 'TcN';
                                                            
                                                            const assigned = archivedChoices.find(c => c.row === day && c.col === col.id && c.month === m.month && c.year === m.year && (c.status === 'ASSIGNED' || c.status === 'VALIDATED'));

                                                            let bgColor = col.customColor || '#FFFFFF';
                                                            let cellStyles = "border-r border-b border-slate-200 text-center relative min-w-[75px] w-[75px] md:min-w-[36px] md:w-[36px] align-middle overflow-hidden transition-all";
                                                            
                                                            const isTargetSelected = selectedTargetChoice?.row === day && selectedTargetChoice?.col === col.id && selectedTargetChoice?.month === m.month && selectedTargetChoice?.year === m.year;
                                                            const existingTake = myPendingTakes.find(tk => tk.target_row === day && tk.target_col === col.id && tk.target_month === m.month && tk.target_year === m.year);

                                                            const isTakesAllowedForThisMonth = monthSettings.find(s => s.month === m.month && s.year === m.year)?.allow_takes;
                                                            
                                                            const targetDateForCheck = new Date(m.year, m.month, day);
                                                            const diffHoursForCheck = (targetDateForCheck.getTime() - new Date().getTime()) / (1000 * 60 * 60);
                                                            const isTooLate = diffHoursForCheck < 48;
                                                            
                                                            let cellTitle: string | undefined = undefined;
                                                            if (isTooLate && takeMode !== 'INACTIVE') {
                                                                cellTitle = "Garde non compatible, délai trop court";
                                                            }
                                                            
                                                            if (isClosed) {
                                                                bgColor = '#fee2e2'; // red-100
                                                            } else if (isTooLate && takeMode !== 'INACTIVE') {
                                                                // Apply grey styling if it's too late
                                                                bgColor = '#f8fafc'; // slate-50
                                                                cellStyles += " opacity-50 grayscale cursor-not-allowed";
                                                                
                                                                if (assigned) {
                                                                    if (assigned.userTrigram === currentUserTrigram) {
                                                                        bgColor = '#fef08a'; // yellow-300
                                                                    } else {
                                                                        bgColor = col.customColor || '#e2e8f0';
                                                                    }
                                                                }
                                                            } else if (takeMode === 'SELECT_OWN_ABANDON') {
                                                                if (assigned && assigned.userTrigram === currentUserTrigram) {
                                                                    bgColor = '#fef08a';
                                                                    cellStyles += " hover:bg-rose-100 cursor-pointer opacity-100 scale-[1.05] z-10 shadow-[inset_0_0_0_2px_#f43f5e]";
                                                                } else if (existingTake) {
                                                                    bgColor = '#14b8a6'; // teal-500
                                                                    cellStyles += " opacity-100 z-10 rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#0f766e] cursor-not-allowed pointer-events-none";
                                                                } else if (assigned) {
                                                                    bgColor = col.customColor || '#FFFFFF';
                                                                    cellStyles += " opacity-20 pointer-events-none";
                                                                } else {
                                                                    bgColor = col.customColor || '#FFFFFF';
                                                                    cellStyles += " opacity-20 pointer-events-none";
                                                                }
                                                            } else if (takeMode === 'SELECT_TARGET_ABANDON') {
                                                                const isOwnAbandon = selectedOwnAbandonChoice?.row === day && selectedOwnAbandonChoice?.col === col.id && selectedOwnAbandonChoice?.month === m.month && selectedOwnAbandonChoice?.year === m.year;
                                                                const isPossibleTarget = possibleTargetChoices.some(c => c.row === day && c.col === col.id && c.month === m.month && c.year === m.year);
                                                                if (isOwnAbandon) {
                                                                    bgColor = '#fef08a';
                                                                    cellStyles += " opacity-100 scale-[1.05] z-10 shadow-[inset_0_0_0_2px_#f43f5e]";
                                                                } else if (isTargetSelected) {
                                                                    bgColor = '#0d9488'; // teal-600
                                                                    cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#0f766e]";
                                                                } else if (existingTake) {
                                                                    bgColor = '#14b8a6'; // teal-500
                                                                    cellStyles += " opacity-100 z-10 rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#0f766e] cursor-not-allowed pointer-events-none";
                                                                } else if (isPossibleTarget && !assigned) {
                                                                    bgColor = col.customColor || '#FFFFFF';
                                                                    cellStyles += " hover:bg-teal-50 cursor-pointer opacity-100 shadow-[inset_0_0_0_2px_#5eead4]";
                                                                } else if (assigned) {
                                                                    bgColor = col.customColor || '#FFFFFF';
                                                                    if (assigned.userTrigram === currentUserTrigram) {
                                                                        bgColor = '#fef08a';
                                                                    }
                                                                    cellStyles += " opacity-20 pointer-events-none";
                                                                } else {
                                                                    bgColor = col.customColor || '#FFFFFF';
                                                                    cellStyles += " opacity-20 pointer-events-none";
                                                                }
                                                            } else if (assigned) {
                                                                if (assigned.userTrigram === currentUserTrigram) {
                                                                    bgColor = '#fef08a'; // yellow-300
                                                                } else {
                                                                    bgColor = col.customColor || '#FFFFFF';
                                                                }
                                                            } else if (takeMode === 'SELECT_TARGET') {
                                                                if (isTargetSelected) {
                                                                    bgColor = '#0d9488'; // teal-600
                                                                    cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#0f766e]";
                                                                } else if (existingTake) {
                                                                    bgColor = '#14b8a6'; // teal-500
                                                                    cellStyles += " opacity-50 rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#0f766e] cursor-not-allowed pointer-events-none";
                                                                } else if (!isTakesAllowedForThisMonth) {
                                                                    bgColor = col.customColor || '#FFFFFF';
                                                                    cellStyles += " opacity-30 cursor-not-allowed grayscale";
                                                                } else {
                                                                    bgColor = col.customColor || '#FFFFFF';
                                                                    cellStyles += " hover:bg-blue-50 cursor-pointer opacity-70";
                                                                }
                                                            } else {
                                                                // Cellule libre - 70% d'opacité
                                                                bgColor = col.customColor ? `${col.customColor}B3` : '#FFFFFFB3';
                                                                if (existingTake) {
                                                                    bgColor = '#14b8a6'; // teal-500
                                                                    cellStyles += " opacity-50 rounded-sm text-white font-black";
                                                                }
                                                            }

                                                            const skipWeekendGradient = isClosed || (takeMode !== 'INACTIVE' && (isTargetSelected || existingTake));
                                                            if (isWeekendGuard && !skipWeekendGradient) {
                                                                bgColor = `linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), ${bgColor}`;
                                                            }

                                                            const style: React.CSSProperties = { background: bgColor };

                                                            return (
                                                                <td 
                                                                    key={col.id} 
                                                                    className={cellStyles} 
                                                                    style={style} title={cellTitle}
                                                                    onMouseEnter={() => setHoveredCell({ day, month: m.month, year: m.year, colId: col.id, colLabel: col.label, colType: col.type, colSite: col.site, colTimeRange: col.timeRange })}
                                                                    onMouseLeave={() => setHoveredCell(null)}
                                                                    onClick={() => {
                                                                        if (isTooLate && takeMode !== 'INACTIVE') return;
                                                                        if (isTooLate && takeMode === 'INACTIVE' && !assigned) {
                                                                            alert("Cette garde est dans moins de 48 heures, action impossible.");
                                                                            return;
                                                                        }
                                                                        if (takeMode === 'INACTIVE') return;

                                                                        const targetDate = new Date(m.year, m.month, day);
                                                                        const diffHours = (targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);

                                                                        if (takeMode === 'SELECT_OWN_ABANDON') {
                                                                            if (assigned && assigned.userTrigram === currentUserTrigram) {
                                                                                if (diffHours < 48) {
                                                                                    alert("Impossible d'abandonner une garde à moins de 48h (Délai dépassé).");
                                                                                    return;
                                                                                }
                                                                                const ownChoice = { row: day, col: col.id, month: m.month, year: m.year, col_label: col.label };
                                                                                setSelectedOwnAbandonChoice(ownChoice);
                                                                                setTakeMode('SELECT_TARGET_ABANDON');
                                                                                computePossibleTargets(ownChoice);
                                                                            }
                                                                            return;
                                                                        }

                                                                        if (takeMode === 'SELECT_TARGET_ABANDON') {
                                                                            const isOwnAbandon = selectedOwnAbandonChoice?.row === day && selectedOwnAbandonChoice?.col === col.id && selectedOwnAbandonChoice?.month === m.month && selectedOwnAbandonChoice?.year === m.year;
                                                                            if (isOwnAbandon) {
                                                                                // Deselect
                                                                                setSelectedOwnAbandonChoice(null);
                                                                                setTakeMode('SELECT_OWN_ABANDON');
                                                                                setPossibleTargetChoices([]);
                                                                                return;
                                                                            }

                                                                            const isPossibleTarget = possibleTargetChoices.some(c => c.row === day && c.col === col.id && c.month === m.month && c.year === m.year);
                                                                            if (isPossibleTarget && !assigned) {
                                                                        const targetTimeRange = col.timeRange;
                                                                        const targetDateObj = targetDate; // already created: new Date(m.year, m.month, day)
                                                                        if (targetTimeRange) {
                                                                            let hasOverlap = false;
                                                                            const myAssignedShifts = [
        ...archivedChoices.filter((c: any) => c.userTrigram === currentUserTrigram && (c.status === 'ASSIGNED' || c.status === 'VALIDATED')),
        ...activeChoices
            .filter((c: any) => (c.userTrigram || c.user_trigram) === currentUserTrigram && (c.status === 'ASSIGNED' || c.status === 'VALIDATED' || c.status === 'PENDING'))
            .map((c: any) => ({ ...c, month: c.month - 1, userTrigram: c.userTrigram || c.user_trigram })),
        ...myPendingTakes.map((t: any) => ({
            row: t.target_row, col: t.target_col, month: t.target_month, year: t.target_year
        })),
        ...myPendingExchanges.map((e: any) => ({
            row: e.target_row, col: e.target_col, month: e.target_month, year: e.target_year
        }))
    ];
                                                                            for (const myChoice of myAssignedShifts) {
                                                                                if (takeMode === 'SELECT_TARGET_ABANDON' && selectedOwnAbandonChoice && myChoice.row === selectedOwnAbandonChoice.row && myChoice.month === selectedOwnAbandonChoice.month && myChoice.year === selectedOwnAbandonChoice.year && myChoice.col === selectedOwnAbandonChoice.col) continue;
                                                                                const myCol = columnConfigs.find(c => c.column_id === myChoice.col) || COLUMNS.find(c => c.id === myChoice.col);
                                                                                if (!myCol || !myCol.timeRange && !myCol.custom_time_range) continue;
                                                                                const myTimeRange = myCol.custom_time_range || myCol.timeRange;
                                                                                const myDateObj = new Date(myChoice.year, myChoice.month, myChoice.row);
                                                                                if (doShiftsOverlap(targetDateObj, targetTimeRange, myDateObj, myTimeRange)) {
                                                                                    hasOverlap = true;
                                                                                    break;
                                                                                }
                                                                            }
                                                                            if (hasOverlap) {
                                                                                alert("Action impossible : vous avez déjà une garde sur des horaires incompatibles.");
                                                                                return;
                                                                            }
                                                                        }

                                                                                setSelectedTargetChoice({ row: day, col: col.id, month: m.month, year: m.year, colLabel: col.label, colType: col.type, colTimeRange: col.timeRange, colSite: col.site });
                                                                                setShowTakeConfirmModal(true);
                                                                            }
                                                                            return;
                                                                        }
                                                                        
                                                                        if (!isTakesAllowedForThisMonth) {
                                                                            alert("La prise de garde n'est pas autorisée pour ce mois.");
                                                                            return;
                                                                        }

                                                                        if (isClosed || assigned) {
                                                                            alert(isClosed ? "Cette garde est fermée." : "Cette garde est déjà assignée.");
                                                                            return;
                                                                        }
                                                                        if (existingTake) {
                                                                            alert("Vous avez déjà demandé cette garde.");
                                                                            return;
                                                                        }
                                                                        
                                                                        if (diffHours < 48) {
                                                                            alert("Impossible de prendre une garde à moins de 48h (Délai dépassé).");
                                                                            return;
                                                                        }
                                                                        const targetTimeRange = col.timeRange;
                                                                        const targetDateObj = targetDate; // already created: new Date(m.year, m.month, day)
                                                                        if (targetTimeRange) {
                                                                            let hasOverlap = false;
                                                                            const myAssignedShifts = [
        ...archivedChoices.filter((c: any) => c.userTrigram === currentUserTrigram && (c.status === 'ASSIGNED' || c.status === 'VALIDATED')),
        ...activeChoices
            .filter((c: any) => (c.userTrigram || c.user_trigram) === currentUserTrigram && (c.status === 'ASSIGNED' || c.status === 'VALIDATED' || c.status === 'PENDING'))
            .map((c: any) => ({ ...c, month: c.month - 1, userTrigram: c.userTrigram || c.user_trigram })),
        ...myPendingTakes.map((t: any) => ({
            row: t.target_row, col: t.target_col, month: t.target_month, year: t.target_year
        })),
        ...myPendingExchanges.map((e: any) => ({
            row: e.target_row, col: e.target_col, month: e.target_month, year: e.target_year
        }))
    ];
                                                                            for (const myChoice of myAssignedShifts) {
                                                                                if (takeMode === 'SELECT_TARGET_ABANDON' && selectedOwnAbandonChoice && myChoice.row === selectedOwnAbandonChoice.row && myChoice.month === selectedOwnAbandonChoice.month && myChoice.year === selectedOwnAbandonChoice.year && myChoice.col === selectedOwnAbandonChoice.col) continue;
                                                                                const myCol = columnConfigs.find(c => c.column_id === myChoice.col) || COLUMNS.find(c => c.id === myChoice.col);
                                                                                if (!myCol || !myCol.timeRange && !myCol.custom_time_range) continue;
                                                                                const myTimeRange = myCol.custom_time_range || myCol.timeRange;
                                                                                const myDateObj = new Date(myChoice.year, myChoice.month, myChoice.row);
                                                                                if (doShiftsOverlap(targetDateObj, targetTimeRange, myDateObj, myTimeRange)) {
                                                                                    hasOverlap = true;
                                                                                    break;
                                                                                }
                                                                            }
                                                                            if (hasOverlap) {
                                                                                alert("Action impossible : vous avez déjà une garde sur des horaires incompatibles.");
                                                                                return;
                                                                            }
                                                                        }


                                                                        setSelectedTargetChoice({ row: day, col: col.id, month: m.month, year: m.year, colLabel: col.label, colType: col.type, colTimeRange: col.timeRange, colSite: col.site });
                                                                        setShowTakeConfirmModal(true);
                                                                    }}
                                                                >
                                                                    {isClosed && (
                                                                        <svg className="absolute inset-0 w-full h-full text-red-400/60 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                                                                            <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="4" />
                                                                            <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="4" />
                                                                        </svg>
                                                                    )}
                                                                    {!isClosed && assigned && (
                                                                        <div className="flex flex-col items-center justify-center gap-[1px] relative h-full w-full">
                                                                            <span className={`text-[14px] md:text-[11px] font-black block leading-none tracking-tighter drop-shadow-sm relative z-10 ${assigned.userTrigram === currentUserTrigram ? 'text-yellow-900' : (existingTake && takeMode !== 'INACTIVE' ? 'text-white' : 'text-slate-900')}`}>
                                                                                {assigned.userTrigram}
                                                                            </span>
                                                                            {takeMode !== 'INACTIVE' && existingTake && (
                                                                                <span className="absolute -top-1 md:-top-2 right-0 text-white font-black drop-shadow-md text-[10px] md:text-[14px] z-10">↙</span>
                                                                            )}
                                                                        </div>
                                                                    )}
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
            </div>
            
            {showTakeConfirmModal && selectedTargetChoice && (
                <div className="fixed inset-0 z-[600] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 shadow-2xl">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full transform transition-all shadow-xl">
                        <h3 className="text-2xl font-black uppercase text-slate-900 mb-6 text-center tracking-tighter">
                            {takeMode === 'SELECT_TARGET_ABANDON' ? 'Abandon et Reprise' : 'Prise de garde'}
                        </h3>
                        
                        <div className="flex flex-col gap-6 mb-8">
                            {takeMode === 'SELECT_TARGET_ABANDON' && selectedOwnAbandonChoice && (
                                <div className="flex items-center gap-4 bg-rose-50 p-4 rounded-xl border border-rose-100">
                                    <div className="flex-1">
                                        <span className="text-[10px] font-black uppercase text-rose-600 tracking-widest block mb-1">Garde abandonnée :</span>
                                        <span className="text-sm font-bold text-slate-800 leading-snug block">
                                            {(() => {
                                                const d = new Date(selectedOwnAbandonChoice.year, selectedOwnAbandonChoice.month, selectedOwnAbandonChoice.row);
                                                const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' });
                                                const formattedDate = `${String(selectedOwnAbandonChoice.row).padStart(2, '0')}/${String(selectedOwnAbandonChoice.month + 1).padStart(2, '0')}/${selectedOwnAbandonChoice.year}`;
                                                
                                                const colCfg = COLUMNS.find(c => c.id === selectedOwnAbandonChoice.col);
                                                let displayCol = selectedOwnAbandonChoice.col_label || colCfg?.label;
                                                if (colCfg?.type === 'Consultation' && !displayCol.startsWith('C')) displayCol = 'C' + displayCol;
                                                else if (colCfg?.type === 'Téléconsultation' && !displayCol.startsWith('Tc')) displayCol = 'Tc' + displayCol;

                                                return (
                                                    <span className="flex flex-col gap-1 mt-1">
                                                        <span className="capitalize text-slate-900">{dayName} {formattedDate}</span>
                                                        <span className="text-rose-700 font-black">Garde {displayCol} {colCfg?.timeRange ? `(${colCfg.timeRange})` : ''} {colCfg?.site ? `- Site ${colCfg.site}` : ''}</span>
                                                    </span>
                                                );
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 bg-teal-50 p-4 rounded-xl border border-teal-100">
                                <div className="flex-1">
                                    <span className="text-[10px] font-black uppercase text-teal-600 tracking-widest block mb-1">Garde ciblée :</span>
                                    <span className="text-sm font-bold text-slate-800 leading-snug block">
                                        {(() => {
                                            const d = new Date(selectedTargetChoice.year, selectedTargetChoice.month, selectedTargetChoice.row);
                                            const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' });
                                            const formattedDate = `${String(selectedTargetChoice.row).padStart(2, '0')}/${String(selectedTargetChoice.month + 1).padStart(2, '0')}/${selectedTargetChoice.year}`;
                                            let displayCol = selectedTargetChoice.colLabel;
                                            if (selectedTargetChoice.colType === 'Consultation' && !displayCol.startsWith('C')) displayCol = 'C' + displayCol;
                                            else if (selectedTargetChoice.colType === 'Téléconsultation' && !displayCol.startsWith('Tc')) displayCol = 'Tc' + displayCol;
                                            return (
                                                <span className="flex flex-col gap-1 mt-1">
                                                    <span className="capitalize text-slate-900">{dayName} {formattedDate}</span>
                                                    <span className="text-teal-700 font-black">Garde {displayCol} {selectedTargetChoice.colTimeRange ? `(${selectedTargetChoice.colTimeRange})` : ''} {selectedTargetChoice.colSite ? `- Site ${selectedTargetChoice.colSite}` : ''}</span>
                                                </span>
                                            );
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
        onClick={() => { setShowTakeConfirmModal(false); setSelectedTargetChoice(null); }}
        className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors"
    >
        Annuler
    </button>
                            <button 
                                onClick={handleTakeConfirm}
                                className={`flex-1 px-4 py-3 ${takeMode === 'SELECT_TARGET_ABANDON' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' : 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20'} text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all flex justify-center items-center gap-2`}
                            >
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
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
                    {hoveredCell.colTimeRange && (
                        <>
                            <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
                            <span className="text-yellow-400 whitespace-nowrap">{hoveredCell.colTimeRange}</span>
                        </>
                    )}
                    {hoveredCell.colSite && (
                        <>
                            <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
                            <span className="text-purple-400 whitespace-nowrap">{hoveredCell.colSite}</span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
