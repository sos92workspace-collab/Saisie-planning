import React, { useState, useEffect, useMemo } from 'react';
import { MatrixHeader } from './MatrixHeader';
import { COLUMNS, parseTimeRange, isPublicHoliday } from '../constants';
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
    const [availableMonths, setAvailableMonths] = useState<{month: number, year: number, label: string}[]>([]);
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchArchived = async () => {
            setLoading(true);
            const data = await fetchAll(supabase, 'archived_choices');
            const dbClosures = await fetchAll(supabase, 'archived_global_closures');
            
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
              const sortedMonths = Array.from(uniqueDates.values()).sort((a,b) => (a.year - b.year) || (a.month - b.month));
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

    if (loading) {
        return <div className="flex-1 flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div></div>;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
            {availableMonths.length > 0 ? (
                <div className="p-4 bg-white border-b shadow-sm z-10 shrink-0">
                    <div className="flex flex-wrap gap-2">
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

            <div className="flex-1 overflow-y-auto p-4 space-y-8">
                {overrideMonthsToDisplay.map(m => {
                    const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
                    return (
                        <div key={`${m.year}-${m.month}`} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            <div className="bg-slate-900 text-white p-4 shrink-0">
                                <h3 className="text-lg font-black uppercase tracking-widest text-center">{m.label}</h3>
                            </div>
                            
                            <div className="p-4 shrink-0 border-b border-slate-100 bg-slate-50">
                                <MonthCounters month={m.month} year={m.year} choices={archivedChoices} columns={dynamicColumns} userTrigram={currentUserTrigram} />
                            </div>

                            <div className="flex-1 overflow-auto bg-white custom-scrollbar max-h-[70vh]">
                                <div className="inline-block min-w-full p-4">
                                    <table className="w-max min-w-full border-separate border-spacing-0 table-fixed">
                                        <MatrixHeader columns={dynamicColumns} globalClosures={archivedClosures} month={m.month} year={m.year} closedColumns={[]} hoveredCell={null} />
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
                                                            if (isClosed) {
                                                                bgColor = '#fee2e2'; // red-100
                                                            } else if (assigned) {
                                                                if (assigned.userTrigram === currentUserTrigram) {
                                                                    bgColor = '#fef08a'; // yellow-300
                                                                } else {
                                                                    bgColor = col.customColor || '#FFFFFF';
                                                                }
                                                            } else {
                                                                // Cellule libre - 70% d'opacité
                                                                bgColor = col.customColor ? `${col.customColor}B3` : '#FFFFFFB3';
                                                            }

                                                            if (isWeekendGuard) {
                                                                bgColor = `linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), ${bgColor}`;
                                                            }

                                                            const style: React.CSSProperties = { background: bgColor };

                                                            return (
                                                                <td key={col.id} className="border-r border-b border-slate-200 text-center relative min-w-[75px] w-[75px] md:min-w-[36px] md:w-[36px] align-middle overflow-hidden" style={style}>
                                                                    {isClosed && (
                                                                        <svg className="absolute inset-0 w-full h-full text-red-400/60 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                                                                            <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="4" />
                                                                            <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="4" />
                                                                        </svg>
                                                                    )}
                                                                    {!isClosed && assigned && (
                                                                        <span className={`text-[14px] md:text-[11px] font-black block leading-none tracking-tighter drop-shadow-sm relative z-10 ${assigned.userTrigram === currentUserTrigram ? 'text-yellow-900' : 'text-slate-900'}`}>
                                                                            {assigned.userTrigram}
                                                                        </span>
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
