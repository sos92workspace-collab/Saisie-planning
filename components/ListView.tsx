import React, { useState, useMemo } from 'react';
import { Choice, AppStep, ChoiceCategory, ColumnConfig, Unavailability, GuardType, Site } from '../types';
import { COLUMNS } from '../constants';
import { ChevronDown, Plus, AlertCircle, Trash2 } from 'lucide-react';

interface ListViewProps {
    monthsToDisplay: { month: number, year: number, label: string }[];
    dynamicColumns: any[];
    choices: Choice[];
    currentStep: AppStep;
    category: ChoiceCategory;
    trigram: string;
    globalClosures: any[];
    unavailabilities: Unavailability[];
    handleCellClick: (row: number, colId: number, month: number, year: number, isDoubleClick?: boolean, explicitPriority?: number) => void;
    isColOpen: (colId: number, step: AppStep, day: number, month: number, year: number) => boolean;
    isBlockedByUnavailability: (day: number, colId: number, month: number, year: number) => boolean;
    columnConfigs: ColumnConfig[];
    activePriority: number;
}

export const ListView: React.FC<ListViewProps> = ({
    monthsToDisplay,
    dynamicColumns,
    choices,
    currentStep,
    category,
    trigram,
    globalClosures,
    unavailabilities,
    handleCellClick,
    isColOpen,
    isBlockedByUnavailability,
    columnConfigs,
    activePriority
}) => {
    const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);
    const [selectedDay, setSelectedDay] = useState<number | ''>('');
    const [selectedColId, setSelectedColId] = useState<number | ''>('');
    const [isAlternative, setIsAlternative] = useState<boolean>(false);
    const [targetPriority, setTargetPriority] = useState<number | ''>('');

    const selectedMonthObj = monthsToDisplay[selectedMonthIndex];
    const daysInMonth = selectedMonthObj ? new Date(selectedMonthObj.year, selectedMonthObj.month + 1, 0).getDate() : 31;

    const cleanTri = trigram.trim().toUpperCase();
    const userPendingChoices = choices.filter(c => c.status === 'PENDING' && c.userTrigram === cleanTri && c.category === category);
    
    // Get unique group indices for alternatives
    const availablePriorities = Array.from<number>(new Set(userPendingChoices.map(c => c.groupIndex))).sort((a, b) => a - b);

    // Group choices by priority for display
    const groupedChoices: Record<number, Choice[]> = useMemo(() => {
        const groups: { [key: number]: Choice[] } = {};
        userPendingChoices.forEach(c => {
            if (!groups[c.groupIndex]) groups[c.groupIndex] = [];
            groups[c.groupIndex].push(c);
        });
        // Sort each group by subRank
        Object.values(groups).forEach(group => group.sort((a, b) => a.subRank - b.subRank));
        return groups;
    }, [userPendingChoices]);

    const handleAdd = () => {
        if (selectedDay === '' || selectedColId === '') return;
        
        if (isAlternative) {
            if (targetPriority === '') {
                alert("Veuillez sélectionner à quel choix principal cette alternative se rattache.");
                return;
            }
            // Add as an alternative: we pass true for isDoubleClick, or we just pass explicitPriority which ignores isDoubleClick anyway
            handleCellClick(Number(selectedDay), Number(selectedColId), selectedMonthObj.month, selectedMonthObj.year, false, Number(targetPriority));
        } else {
            // Add as a new main choice
            handleCellClick(Number(selectedDay), Number(selectedColId), selectedMonthObj.month, selectedMonthObj.year, false);
        }

        // Reset form partially
        setSelectedColId('');
    };

    const handleRemove = (choice: Choice) => {
        // handleCellClick handles removal if the choice already exists
        handleCellClick(choice.row, choice.col, choice.month, choice.year, false, choice.groupIndex);
    };

    // Filter available columns based on closures and assignments
    const availableColumns = useMemo(() => {
        if (selectedDay === '') return [];
        
        const day = Number(selectedDay);
        
        return dynamicColumns.filter(col => {
            // Check if open
            const open = isColOpen(col.id, currentStep, day, selectedMonthObj.month, selectedMonthObj.year);
            if (!open) return false;

            // Check global closures
            const isClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === day && gc.month === selectedMonthObj.month && gc.year === selectedMonthObj.year);
            if (isClosed) return false;

            // Check if assigned to someone else
            const assignedToOther = choices.find(c => c.row === day && c.col === col.id && c.month === selectedMonthObj.month && c.year === selectedMonthObj.year && c.status === 'ASSIGNED' && c.userTrigram !== cleanTri);
            if (assignedToOther) return false;

            // Check unavailability
            const blocked = isBlockedByUnavailability(day, col.id, selectedMonthObj.month, selectedMonthObj.year);
            if (blocked) return false;

            return true;
        });
    }, [selectedDay, selectedMonthObj, dynamicColumns, isColOpen, currentStep, globalClosures, choices, cleanTri, isBlockedByUnavailability]);

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-6">Saisie sous forme de liste</h2>
            
            <div className="space-y-6">
                {/* Month Selection */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Mois</label>
                    <div className="relative">
                        <select 
                            value={selectedMonthIndex} 
                            onChange={(e) => {
                                setSelectedMonthIndex(Number(e.target.value));
                                setSelectedDay('');
                                setSelectedColId('');
                            }}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 py-3 px-4 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {monthsToDisplay.map((m, idx) => (
                                <option key={idx} value={idx}>{m.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Day Selection */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Jour</label>
                    <div className="relative">
                        <select 
                            value={selectedDay} 
                            onChange={(e) => {
                                setSelectedDay(e.target.value);
                                setSelectedColId('');
                            }}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 py-3 px-4 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="" disabled>Sélectionner un jour</option>
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                const date = new Date(selectedMonthObj.year, selectedMonthObj.month, day);
                                const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
                                return (
                                    <option key={day} value={day}>{day} - {dayName}</option>
                                );
                            })}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Column Selection */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Garde</label>
                    <div className="relative">
                        <select 
                            value={selectedColId} 
                            onChange={(e) => setSelectedColId(e.target.value)}
                            disabled={selectedDay === ''}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 py-3 px-4 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <option value="" disabled>Sélectionner une garde</option>
                            {availableColumns.map(col => (
                                <option key={col.id} value={col.id}>{col.type} - Col {col.id} - {col.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                    {selectedDay !== '' && availableColumns.length === 0 && (
                        <p className="mt-2 text-xs text-red-500 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Aucune garde disponible pour ce jour.
                        </p>
                    )}
                </div>

                {/* Type of Choice */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Type de choix</label>
                    <div className="flex gap-4 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                checked={!isAlternative} 
                                onChange={() => setIsAlternative(false)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="font-bold text-sm">Nouveau Choix Principal</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                checked={isAlternative} 
                                onChange={() => setIsAlternative(true)}
                                disabled={availablePriorities.length === 0}
                                className="w-4 h-4 text-blue-600 disabled:opacity-50"
                            />
                            <span className={`font-bold text-sm ${availablePriorities.length === 0 ? 'opacity-50' : ''}`}>Alternative</span>
                        </label>
                    </div>

                    {isAlternative && (
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Rattacher au choix principal n°</label>
                            <div className="relative">
                                <select 
                                    value={targetPriority} 
                                    onChange={(e) => setTargetPriority(e.target.value)}
                                    className="w-full appearance-none bg-white border border-slate-200 text-slate-900 py-2 px-3 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="" disabled>Sélectionner le choix</option>
                                    {availablePriorities.map(p => (
                                        <option key={p} value={p}>Choix {p}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleAdd}
                    disabled={selectedDay === '' || selectedColId === '' || (isAlternative && targetPriority === '')}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Ajouter ce choix
                </button>
            </div>

            {/* Current Choices List */}
            {Object.keys(groupedChoices).length > 0 && (
                <div className="mt-12">
                    <h3 className="text-lg font-black uppercase tracking-widest text-slate-900 mb-4">Mes choix actuels</h3>
                    <div className="space-y-4">
                        {Object.entries(groupedChoices)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([groupIndex, groupChoices]) => (
                            <div key={groupIndex} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-black text-sm text-slate-700">
                                    Choix {groupIndex}
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {groupChoices.map(choice => {
                                        const colDef = COLUMNS.find(c => c.id === choice.col);
                                        const colConfig = columnConfigs.find(c => c.column_id === choice.col);
                                        const date = new Date(choice.year, choice.month, choice.row);
                                        const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                                        
                                        const finalLabel = choice.colLabel || colConfig?.custom_label || colDef?.label || '';
                                        const finalType = choice.colType || colConfig?.custom_type || colDef?.type || '';
                                        const finalTimeRange = choice.colTimeRange || colConfig?.custom_time_range || colDef?.timeRange || '';
                                        const finalSite = (colConfig as any)?.custom_site || colDef?.site || Site.NONE;

                                        const getSiteAbbr = (site: string) => {
                                            if (site === Site.ANT) return 'ANT';
                                            if (site === Site.BOU) return 'BOU';
                                            if (site === Site.COU) return 'COU';
                                            return site;
                                        };

                                        const isConsultation = finalType === GuardType.CONSULTATION || finalType === GuardType.TELECONSULTATION;
                                        const siteDisplay = isConsultation && finalSite !== Site.NONE ? ` - ${getSiteAbbr(finalSite)}` : '';
                                        const timeDisplay = finalTimeRange ? ` (${finalTimeRange})` : '';

                                        return (
                                            <div key={choice.id} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm ${choice.subRank === 1 ? 'bg-blue-600' : 'bg-slate-400'}`}>
                                                        {choice.subRank === 1 ? choice.groupIndex : `${choice.groupIndex}.${String.fromCharCode(95 + choice.subRank)}`}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 text-sm">
                                                            {finalLabel ? `${finalLabel} - colonne ${choice.col}` : `Colonne ${choice.col}`}
                                                            {siteDisplay}
                                                            {timeDisplay}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-medium capitalize">
                                                            {dayName}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleRemove(choice)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Supprimer ce choix"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
