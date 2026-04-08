import React, { useState, useEffect, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { COLUMNS, isPublicHoliday } from '../constants';
import { MatrixHeader } from './MatrixHeader';

interface VersionsPanelProps {
  supabase: SupabaseClient;
  logAction: (action: string, details: any) => void;
  users: any[];
  activeRound: any;
  columnConfigs: any[];
  headerConfigs: any[];
  globalClosures: any[];
  refreshData?: () => void;
}

const getDefaultColor = (colorClass: string) => {
  const match = colorClass?.match(/bg-\[#([0-9a-fA-F]{6})\]/);
  if (match) return `#${match[1]}`;
  return '#FFFFFF';
};

export const VersionsPanel: React.FC<VersionsPanelProps> = ({ supabase, logAction, users, activeRound, columnConfigs, headerConfigs, globalClosures, refreshData }) => {
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ day: number, month: number, year: number, colId: number, colLabel: string, colType: string } | null>(null);
  const [highlightedTrigram, setHighlightedTrigram] = useState<string | null>(null);

  const fetchVersions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('planning_versions').select('*').order('created_at', { ascending: false });
      if (error) {
        if (error.message.includes('relation "planning_versions" does not exist')) {
          setShowSqlHelp(true);
        } else {
          console.error(error);
        }
      } else {
        setVersions(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette version ?')) return;
    try {
      await supabase.from('planning_versions').delete().eq('id', id);
      logAction('DELETE_VERSION', { id });
      if (selectedVersion?.id === id) setSelectedVersion(null);
      fetchVersions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreVersion = async (version: any) => {
    const pwd = prompt("Mot de passe administrateur requis pour restaurer cette version :");
    if (pwd !== 'admin') {
      if (pwd !== null) alert("Mot de passe incorrect.");
      return;
    }

    if (!window.confirm(`ATTENTION : Restaurer la version "${version.name}" va écraser toutes les gardes actuellement attribuées dans le planning. Voulez-vous continuer ?`)) {
      return;
    }

    try {
      // 1. Delete all current choices
      await supabase.from('choices').delete().not('id', 'is', null);
      
      // 2. Insert version choices
      if (version.data && version.data.length > 0) {
        const { error } = await supabase.from('choices').insert(version.data);
        if (error) throw error;
      }

      logAction('RESTORE_VERSION', { id: version.id, name: version.name });
      alert(`La version "${version.name}" a été restaurée avec succès.`);
      
      if (refreshData) {
        refreshData();
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la restauration de la version.");
    }
  };

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

  if (showSqlHelp) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
          <h2 className="text-xl font-black text-slate-900">Configuration Requise</h2>
          <p className="text-slate-600">
            Pour utiliser le système de versions, vous devez créer la table <strong>planning_versions</strong> dans votre base de données Supabase.
          </p>
          <div className="bg-slate-900 p-4 rounded-xl overflow-x-auto">
            <pre className="text-emerald-400 text-sm font-mono">
{`CREATE TABLE planning_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  data JSONB NOT NULL
);`}
            </pre>
          </div>
          <button onClick={fetchVersions} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs hover:bg-blue-700">
            J'ai créé la table, réessayer
          </button>
        </div>
      </div>
    );
  }

  if (selectedVersion) {
    const choices = selectedVersion.data || [];
    return (
      <div className="flex-1 overflow-auto custom-scrollbar p-8 pb-32 relative">
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-3xl border shadow-sm">
            <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Version : {selectedVersion.name}</h2>
                <p className="text-xs font-bold text-slate-400 mt-1">Sauvegardé le {new Date(selectedVersion.created_at).toLocaleString('fr-FR')} • Lecture seule</p>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={() => handleRestoreVersion(selectedVersion)}
                    className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100"
                >
                    Restaurer la version
                </button>
                <button 
                    onClick={() => setSelectedVersion(null)}
                    className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                >
                    Retour aux versions
                </button>
            </div>
        </div>

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
                const count = choices.filter((c: any) => c.userTrigram === u.trigram && c.status === 'ASSIGNED' && c.month === month && c.year === year).length;
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
                            <div className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest">Compteurs de gardes</div>
                            
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
                            <MatrixHeader columns={dynamicColumns} isEditClosuresMode={false} onColumnClick={() => {}} globalClosures={globalClosures} month={month} year={year} hoveredCell={hoveredCell} />
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
                                        <tr key={day} className={`h-10 md:h-8 hover:bg-slate-50/50 ${isOffDay ? 'bg-red-50/30' : ''}`}>
                                            <td className={`sticky left-0 border-r border-b border-slate-200 text-center z-10 w-20 md:w-16 h-10 md:h-8 font-black ${rowHeaderBg}`}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-[10px] md:text-[8px] font-normal opacity-70">{dayName}</span>
                                                    <span className="text-[12px] md:text-[10px]">{day}</span>
                                                </div>
                                            </td>
                                            {dynamicColumns.map(col => {
                                                const isClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === day && gc.month === month && gc.year === year);
                                                
                                                const isHoveredCol = hoveredCell?.colId === col.id && hoveredCell?.month === month && hoveredCell?.year === year;
                                                const isCrosshair = isHoveredRow || isHoveredCol;
                                                
                                                const assignedList = choices.filter((ch: any) => ch.row === day && ch.col === col.id && ch.month === month && ch.year === year && ch.status === 'ASSIGNED');
                                                const isAssignedToHighlighted = highlightedTrigram && assignedList.some((a: any) => (a.userTrigram || a.user_trigram) === highlightedTrigram);
                                                
                                                let cellStyles = "border-r border-b border-slate-200 relative text-center transition-all min-w-[60px] w-[60px] md:min-w-[28px] md:w-[28px] ";
                                                if (isCrosshair) cellStyles += "after:absolute after:inset-0 after:bg-blue-500/10 after:pointer-events-none ";
                                                let bgColor = '#FFFFFF';
                                                
                                                if (isAssignedToHighlighted) {
                                                    bgColor = '#fde047'; // Yellow 300
                                                    cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-slate-900 font-black shadow-[inset_0_0_0_2px_#facc15]";
                                                } else if (assignedList.length > 0) {
                                                    bgColor = col.customColor || '#FFFFFF';
                                                    cellStyles += " opacity-100 text-slate-900";
                                                } else if (isClosed) {
                                                    bgColor = '#f1f5f9';
                                                    cellStyles += " opacity-40";
                                                } else {
                                                    bgColor = col.customColor || '#FFFFFF';
                                                    cellStyles += " opacity-70";
                                                }
                                                
                                                return (
                                                    <td 
                                                        key={col.id} 
                                                        className={cellStyles}
                                                        style={{ backgroundColor: bgColor }}
                                                        onMouseEnter={() => setHoveredCell({ day, month, year, colId: col.id, colLabel: col.label, colType: col.type })}
                                                        onMouseLeave={() => setHoveredCell(null)}
                                                    >
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            {assignedList.length > 0 ? (
                                                                <div className="flex flex-col items-center justify-center w-full h-full">
                                                                    {assignedList.map((a: any, idx: number) => (
                                                                        <span key={idx} className="text-[10px] md:text-[8px] font-black tracking-tighter leading-none">
                                                                            {a.userTrigram || a.user_trigram}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : isClosed ? (
                                                                <span className="text-[10px] opacity-20">✕</span>
                                                            ) : null}
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
            );
        })}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 overflow-y-auto h-full custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6">Versions du Planning</h3>
          
          {isLoading ? (
            <div className="text-center p-8 text-slate-400">Chargement...</div>
          ) : versions.length === 0 ? (
            <div className="text-center p-8 text-slate-400 font-medium">Aucune version sauvegardée.</div>
          ) : (
            <div className="space-y-4">
              {versions.map(v => (
                <div key={v.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border">
                  <div>
                    <div className="font-black text-slate-900">{v.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Sauvegardé le {new Date(v.created_at).toLocaleString('fr-FR')} • {v.data?.length || 0} gardes attribuées
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedVersion(v)}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                    >
                      Voir le planning
                    </button>
                    <button 
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(v.data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `planning_version_${v.name.replace(/\s+/g, '_')}.json`;
                        a.click();
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Télécharger les données JSON"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(v.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer la version"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
