
import React from 'react';
import { Unavailability } from '../types';

interface MonthInfo {
    month: number;
    year: number;
    label: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  unavailabilities: Unavailability[];
  setUnavailabilities: React.Dispatch<React.SetStateAction<Unavailability[]>>;
  months: MonthInfo[];
  trigram: string;
  supabase: any;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0 à 24

export const UnavailabilityModal: React.FC<Props> = ({ isOpen, onClose, unavailabilities, setUnavailabilities, months, trigram, supabase }) => {
  if (!isOpen) return null;

  const handleFullDayToggle = async (day: number, month: number, year: number) => {
    // Check if currently FULL
    const fullEntry = unavailabilities.find(u => u.day === day && u.month === month && u.year === year && u.period === 'FULL');

    if (fullEntry) {
        // Remove FULL
        await supabase.from('unavailabilities').delete().eq('id', fullEntry.id);
        setUnavailabilities(prev => prev.filter(u => u.id !== fullEntry.id));
    } else {
        // Remove existing partial ranges first
        const existing = unavailabilities.filter(u => u.day === day && u.month === month && u.year === year);
        for (const e of existing) await supabase.from('unavailabilities').delete().eq('id', e.id);

        // Add FULL
        const { data } = await supabase.from('unavailabilities').insert({
            user_trigram: trigram, day, month: month + 1, year, period: 'FULL'
        }).select().single();
        
        if (data) {
            setUnavailabilities(prev => [
                ...prev.filter(u => !(u.day === day && u.month === month && u.year === year)),
                { id: data.id, userTrigram: data.user_trigram, day: data.day, month: data.month - 1, year: data.year, period: data.period }
            ]);
        }
    }
  };

  const addRange = async (day: number, month: number, year: number) => {
    // Default range: 8h - 18h
    const period = '8-18';
    
    const { data } = await supabase.from('unavailabilities').insert({
        user_trigram: trigram, day, month: month + 1, year, period
    }).select().single();

    if (data) {
        setUnavailabilities(prev => [...prev, { 
            id: data.id, userTrigram: data.user_trigram, day: data.day, month: data.month - 1, year: data.year, period: data.period 
        }]);
    }
  };

  const updateRange = async (id: string, newStart: number, newEnd: number) => {
    // Validation: End must be > Start
    if (newEnd <= newStart) return;

    const newPeriod = `${newStart}-${newEnd}`;
    
    await supabase.from('unavailabilities').update({ period: newPeriod }).eq('id', id);
    
    setUnavailabilities(prev => prev.map(u => u.id === id ? { ...u, period: newPeriod } : u));
  };

  const removeRange = async (id: string) => {
    await supabase.from('unavailabilities').delete().eq('id', id);
    setUnavailabilities(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Mes Indisponibilités</h2>
                    <p className="text-sm font-medium text-slate-400">Définissez vos créneaux indisponibles (Min / Max).</p>
                </div>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-slate-700 rounded-full transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50 custom-scrollbar">
            
            {months.map(monthInfo => {
                const daysInMonth = new Date(monthInfo.year, monthInfo.month + 1, 0).getDate();
                
                return (
                    <div key={`${monthInfo.year}-${monthInfo.month}`} className="mb-8 last:mb-0">
                        <div className="flex items-center gap-4 mb-4 sticky top-0 bg-slate-50 z-10 py-2">
                            <h3 className="text-lg font-black uppercase text-slate-800 tracking-widest px-4 py-2 bg-white rounded-lg shadow-sm border">{monthInfo.label}</h3>
                            <div className="h-px bg-slate-200 flex-1"></div>
                        </div>

                        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 text-slate-500">
                                    <tr>
                                        <th className="p-3 text-[10px] font-black uppercase tracking-widest border-b border-r w-24 text-center">Date</th>
                                        <th className="p-3 text-[10px] font-black uppercase tracking-widest border-b border-r text-center w-32">Journée Entière</th>
                                        <th className="p-3 text-[10px] font-black uppercase tracking-widest border-b text-left pl-4">Plages Horaires (Début - Fin)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                        const date = new Date(monthInfo.year, monthInfo.month, day);
                                        const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
                                        const isSunday = date.getDay() === 0;

                                        const dayUnavails = unavailabilities.filter(u => u.day === day && u.month === monthInfo.month && u.year === monthInfo.year);
                                        const isFull = dayUnavails.some(u => u.period === 'FULL');

                                        return (
                                            <tr key={day} className={`hover:bg-slate-50 transition-colors ${isSunday ? 'bg-red-50/30' : ''}`}>
                                                {/* Date */}
                                                <td className={`p-4 border-r text-center font-bold text-xs ${isSunday ? 'text-red-600' : 'text-slate-700'}`}>
                                                    <div className="flex flex-col">
                                                        <span className="text-[14px]">{day}</span>
                                                        <span className="text-[9px] uppercase opacity-60">{dayName}</span>
                                                    </div>
                                                </td>
                                                
                                                {/* Full Day Toggle */}
                                                <td className="p-2 border-r text-center align-middle">
                                                    <button 
                                                        onClick={() => handleFullDayToggle(day, monthInfo.month, monthInfo.year)}
                                                        className={`w-full py-3 rounded-xl transition-all border-2 text-[10px] font-black uppercase ${isFull ? 'bg-red-500 border-red-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                                    >
                                                        {isFull ? 'Bloqué' : 'Disponible'}
                                                    </button>
                                                </td>

                                                {/* Ranges */}
                                                <td className="p-2 align-middle">
                                                    {isFull ? (
                                                        <div className="px-4 py-3 bg-slate-100 rounded-xl text-center border border-dashed border-slate-300 text-slate-400 text-xs font-medium italic">
                                                            Journée complète déclarée indisponible
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            {dayUnavails.map(u => {
                                                                if (u.period === 'FULL') return null;
                                                                const parts = u.period.split('-').map(Number);
                                                                if (parts.length !== 2) return null;
                                                                const [start, end] = parts;

                                                                return (
                                                                    <div key={u.id} className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                                                                        <div className="flex items-center gap-0 bg-white border border-slate-200 rounded-lg shadow-sm p-1">
                                                                            <div className="flex items-center px-2">
                                                                                <span className="text-[9px] font-bold text-slate-400 mr-2 uppercase">De</span>
                                                                                <select 
                                                                                    value={start} 
                                                                                    onChange={(e) => updateRange(u.id, Number(e.target.value), end)}
                                                                                    className="bg-slate-50 font-bold text-sm text-slate-800 p-1 rounded outline-none border-transparent focus:bg-blue-50"
                                                                                >
                                                                                    {HOURS.map(h => h < 24 && (
                                                                                        <option key={h} value={h} disabled={h >= end}>{h}h</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            <div className="w-px h-6 bg-slate-200"></div>
                                                                            <div className="flex items-center px-2">
                                                                                <span className="text-[9px] font-bold text-slate-400 mr-2 uppercase">À</span>
                                                                                <select 
                                                                                    value={end} 
                                                                                    onChange={(e) => updateRange(u.id, start, Number(e.target.value))}
                                                                                    className="bg-slate-50 font-bold text-sm text-slate-800 p-1 rounded outline-none border-transparent focus:bg-blue-50"
                                                                                >
                                                                                    {HOURS.map(h => h > 0 && (
                                                                                        <option key={h} value={h} disabled={h <= start}>{h}h</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => removeRange(u.id)}
                                                                            className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                                                            title="Supprimer cette plage"
                                                                        >
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                            
                                                            <button 
                                                                onClick={() => addRange(day, monthInfo.month, monthInfo.year)}
                                                                className="self-start px-4 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors border border-dashed border-slate-300 hover:border-blue-200 flex items-center gap-2"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 5v14M5 12h14"/></svg>
                                                                Ajouter une plage
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
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

        <div className="p-6 bg-white border-t flex justify-end gap-4 items-center">
            <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-xl">
                Enregistrer & Fermer
            </button>
        </div>
      </div>
    </div>
  );
};
