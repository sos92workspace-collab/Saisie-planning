import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Target, Zap, Clock, Users } from 'lucide-react';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    supabase: any;
    currentUserTrigram: string;
}

const normalizeCategory = (cat: string) => {
    if (cat === 'bon_bonus' || cat === 'good_bonus') return 'good_bonus';
    if (cat === 'mauvais_bonus' || cat === 'bad_bonus') return 'bad_bonus';
    return 'normal';
};

const formatCardTitle = (day: number, month: number, year: number, colLabel: string) => {
    const date = new Date(year, month - 1, day);
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const dayName = days[date.getDay()];
    const dd = day < 10 ? '0'+day : day;
    const mm = month < 10 ? '0'+month : month;
    return `${dayName} ${dd}/${mm} (Col ${colLabel})`;
};

export function HistoryModal({ isOpen, onClose, supabase, currentUserTrigram }: HistoryModalProps) {
    const [roundsHistory, setRoundsHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedRound, setExpandedRound] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const fetchHistory = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('assignment_history')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("Error fetching history:", error);
            } else if (data) {
                const processedHistory = data.map((hist: any) => {
                    const userFinalState = (hist.final_state || []).filter((c: any) => 
                        (c.userTrigram === currentUserTrigram || c.trigramme === currentUserTrigram) && c.status !== 'PENDING'
                    );
                    
                    return {
                        id: hist.id,
                        created_at: hist.created_at,
                        round_type: hist.round_type,
                        finalState: userFinalState
                    };
                }).filter((hist: any) => hist.finalState.length > 0);

                setRoundsHistory(processedHistory);
                if (processedHistory.length > 0) {
                     setExpandedRound(processedHistory[0].id);
                }
            }
            setLoading(false);
        };

        fetchHistory();
    }, [isOpen, supabase, currentUserTrigram]);

    if (!isOpen) return null;

    const toggleRound = (id: string) => {
        setExpandedRound(prev => prev === id ? null : id);
    };

    const formatDate = (dateStr: string) => {
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(new Date(dateStr));
    };

    const renderCard = (choice: any, statusType: 'ASSIGNED' | 'PENDING' | 'REFUSED', colorClass: string, bgColorClass: string, lightColorClass: string) => {
         const title = formatCardTitle(choice.day, choice.month, choice.year, choice.columnLabel || choice.columnId);
         
         if (statusType === 'ASSIGNED') {
              return (
                   <div key={choice.id} className="bg-white rounded-lg border border-slate-100 shadow-sm mb-3 flex flex-col p-3">
                        <div className="flex justify-between items-start mb-2">
                             <div className={`font-bold text-sm ${colorClass}`}>{title}</div>
                             <div className="text-[10px] text-slate-400 font-bold tracking-widest">P:{choice.priority || '-'} S:{choice.subPriority || '-'}</div>
                        </div>
                        <div className="flex justify-between items-end">
                             <div className="text-xs font-medium text-slate-500">{choice.shiftType}</div>
                             <div className="bg-green-50 text-green-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded">ATTRIBUÉ</div>
                        </div>
                   </div>
              );
         } else if (statusType === 'REFUSED') {
              return (
                   <div key={choice.id} className="bg-white rounded-lg border border-slate-100 shadow-sm mb-3 flex flex-col p-3 opacity-60">
                        <div className="flex justify-between items-start mb-2">
                             <div className="font-bold text-sm text-slate-400 line-through">{title}</div>
                             <div className="text-[10px] text-slate-400 font-bold tracking-widest">P:{choice.priority || '-'} S:{choice.subPriority || '-'}</div>
                        </div>
                        <div className="flex justify-between items-end">
                             <div className="text-xs font-medium text-slate-400">{choice.shiftType}</div>
                             <div className="bg-red-50 text-red-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                 {choice.status === 'REMOVED' || choice.status === 'ARCHIVED' ? 'SUPPRIMÉ' : 'REFUSÉ'}
                             </div>
                        </div>
                        {choice.removeReason && (
                             <div className="mt-2 text-[10px] font-bold text-red-600 bg-red-50/50 p-1.5 rounded-md border border-red-100 italic">
                                  Motif: {choice.removeReason}
                             </div>
                        )}
                   </div>
              );
         } else {
              // Pending
              return (
                   <div key={choice.id} className="bg-white rounded-lg border border-slate-100 shadow-sm mb-3 flex flex-col p-3 opacity-80">
                        <div className="flex justify-between items-start mb-2">
                             <div className={`font-bold text-sm ${colorClass}`}>{title}</div>
                             <div className="text-[10px] text-slate-400 font-bold tracking-widest">P:{choice.priority || '-'} S:{choice.subPriority || '-'}</div>
                        </div>
                        <div className="flex justify-between items-end">
                             <div className="text-xs font-medium text-slate-500">{choice.shiftType}</div>
                             <div className="bg-slate-100 text-slate-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded">ATTENTE</div>
                        </div>
                   </div>
              );
         }
    };

    const renderColumn = (hist: any, category: string, title: string, Icon: any, colorClass: string, borderColorClass: string, bgColorClass: string, lightColorClass: string) => {
         const choices = hist.finalState.filter((c: any) => normalizeCategory(c.category) === category);
         const assigned = choices.filter((c: any) => c.status === 'ASSIGNED');
         const pending = choices.filter((c: any) => c.status === 'PENDING');
         const refused = choices.filter((c: any) => c.status === 'REFUSED' || c.status === 'REFUSED_ALTERNATIVE' || c.status === 'REMOVED' || c.status === 'ARCHIVED');
         
         return (
              <div className="flex-1 min-w-[280px]">
                   <div className={`flex items-center gap-2 mb-4 uppercase tracking-widest font-black text-xs ${colorClass}`}>
                       <Icon className="w-4 h-4" />
                       {title}
                   </div>
                   
                   {choices.length === 0 ? (
                       <div className="text-sm italic text-slate-400">Aucune</div>
                   ) : (
                       <div className="space-y-6">
                           {assigned.length > 0 && (
                               <div>
                                   <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Attribuées</div>
                                   {assigned.map((c: any) => renderCard(c, 'ASSIGNED', colorClass, bgColorClass, lightColorClass))}
                               </div>
                           )}
                           
                           {pending.length > 0 && (
                               <div>
                                   <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">En Attente</div>
                                   {pending.map((c: any) => renderCard(c, 'PENDING', colorClass, bgColorClass, lightColorClass))}
                               </div>
                           )}

                           {refused.length > 0 && (
                               <div>
                                   <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Refusées</div>
                                   {refused.map((c: any) => renderCard(c, 'REFUSED', colorClass, bgColorClass, lightColorClass))}
                               </div>
                           )}
                       </div>
                   )}
              </div>
         );
    };

    return (
        <div className="fixed inset-0 z-[500] flex p-4 md:p-8 bg-slate-900/50 backdrop-blur-sm shadow-2xl overflow-hidden">
            <div className="bg-white w-full h-full rounded-2xl shadow-2xl flex overflow-hidden">
                
                {/* COLONNE GAUCHE (MASTER - Barre latérale) */}
                <div className="w-1/3 min-w-[280px] max-w-sm flex flex-col border-r border-slate-200 bg-white min-h-0 shrink-0">
                    <div className="p-5 border-b border-slate-200 bg-slate-900 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-white/70" />
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">
                                {currentUserTrigram}
                            </h2>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all focus:outline-none"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto min-h-0 bg-white">
                        {loading ? (
                            <div className="flex items-center justify-center p-12">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-slate-800"></div>
                            </div>
                        ) : roundsHistory.length === 0 ? (
                            <div className="text-center text-slate-400 font-bold p-8 text-sm">
                                Aucun historique
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {roundsHistory.map((hist) => {
                                    const isSelected = expandedRound === hist.id;
                                    return (
                                        <button 
                                            key={hist.id}
                                            onClick={() => setExpandedRound(hist.id)}
                                            className={`w-full text-left p-5 border-b border-slate-100 flex items-center justify-between focus:outline-none transition-colors ${
                                                isSelected 
                                                ? 'bg-slate-50 border-l-4 border-l-blue-500 pl-4' 
                                                : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                            }`}
                                        >
                                            <div className="flex flex-col">
                                                <h3 className={`text-sm font-black uppercase tracking-wide ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                                    {hist.round_type.replace(/_/g, ' ')}
                                                </h3>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                    {formatDate(hist.created_at)}
                                                </span>
                                            </div>
                                            <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-blue-500' : 'text-slate-300'}`} />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* COLONNE DROITE (DETAIL - Contenu) */}
                <div className="flex-1 flex flex-col bg-slate-50 min-h-0">
                    {(() => {
                        const hist = roundsHistory.find(r => r.id === expandedRound);
                        if (!hist) {
                            return (
                                <div className="flex-1 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-sm">
                                    Sélectionnez un tour pour voir les détails
                                </div>
                            );
                        }
                        return (
                            <>
                                <div className="bg-white p-5 lg:p-8 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                            <Target className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                                {hist.round_type.replace(/_/g, ' ')}
                                            </h2>
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                                Attributions & Attentes
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-slate-400 uppercase bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" />
                                        {formatDate(hist.created_at)}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-5 lg:p-8 min-h-0 bg-white">
                                    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start justify-between min-h-[400px]">
                                        {renderColumn(hist, 'bad_bonus', 'GARDE CIBLE (GC)', Target, 'text-blue-600', 'border-blue-600', 'bg-blue-50', 'bg-blue-50/50')}
                                        {renderColumn(hist, 'good_bonus', 'BONNE GARDE (B)', Zap, 'text-purple-600', 'border-purple-600', 'bg-purple-50', 'bg-purple-50/50')}
                                        {renderColumn(hist, 'normal', 'GARDE NORMALE (N)', Clock, 'text-orange-600', 'border-orange-600', 'bg-orange-50', 'bg-orange-50/50')}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
