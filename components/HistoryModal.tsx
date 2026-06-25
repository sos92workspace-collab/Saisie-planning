import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Target, Zap, Clock, Users, Maximize, Minimize } from 'lucide-react';
import { ArchivePlanningDoctorView } from './ArchivePlanningDoctorView';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    supabase: any;
    currentUserTrigram: string;
    columnConfigs: any[];
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

export function HistoryModal({ isOpen, onClose, supabase, currentUserTrigram, columnConfigs }: HistoryModalProps) {
    const [roundsHistory, setRoundsHistory] = useState<any[]>([]);
    const [exchangesHistory, setExchangesHistory] = useState<any[]>([]);
    const [abandonsHistory, setAbandonsHistory] = useState<any[]>([]);
    const [takesHistory, setTakesHistory] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'ATTRIBUTIONS' | 'EXCHANGES' | 'ABANDONS' | 'TAKES' | 'ARCHIVES'>('ATTRIBUTIONS');
    const [expandedRound, setExpandedRound] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const fetchHistory = async () => {
            setLoading(true);
            const { data: attrData, error: attrError } = await supabase
                .from('assignment_history')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (attrError) {
                console.error("Error fetching assignment history:", attrError);
            } else if (attrData) {
                const processedHistory = attrData.map((hist: any) => {
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

            // Fetch other histories
            const { data: exData } = await supabase
                .from('exchange_requests')
                .select('*, requester_choice:choices!requester_choice_id(*)')
                .eq('requester_trigram', currentUserTrigram)
                .order('created_at', { ascending: false });
            if (exData) setExchangesHistory(exData);

            const { data: abData } = await supabase
                .from('abandon_requests')
                .select('*, requester_choice:choices!choice_id(*)')
                .eq('requester_trigram', currentUserTrigram)
                .order('created_at', { ascending: false });
            if (abData) setAbandonsHistory(abData);

            const { data: tkData } = await supabase
                .from('take_requests')
                .select('*')
                .eq('requester_trigram', currentUserTrigram)
                .order('created_at', { ascending: false });
            if (tkData) setTakesHistory(tkData);

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

    const renderTabContent = () => {
        if (loading) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-800"></div>
                </div>
            );
        }

        if (activeTab === 'ATTRIBUTIONS') {
            return (
                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT PANEL */}
                    <div className="w-1/3 min-w-[280px] max-w-sm flex flex-col border-r border-slate-200 bg-white min-h-0 shrink-0">
                        <div className="flex-1 overflow-y-auto min-h-0 bg-white">
                            {roundsHistory.length === 0 ? (
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

                    {/* RIGHT PANEL */}
                    <div className="flex-1 flex flex-col bg-slate-50 min-h-0">
                        {(() => {
                            const hist = roundsHistory.find(r => r.id === expandedRound);
                            if (!hist) {
                                return (
                                    <div className="flex-1 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-sm text-center px-4">
                                        Sélectionnez un tour pour voir les détails
                                    </div>
                                );
                            }
                            return (
                                <>
                                    <div className="bg-white p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
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

                                    <div className="flex-1 overflow-y-auto p-5 min-h-0 bg-white">
                                        <div className="flex flex-col lg:flex-row gap-8 items-start justify-between min-h-[400px]">
                                            {renderColumn(hist, 'normal', 'GARDE CIBLE (GC)', Target, 'text-orange-600', 'border-orange-600', 'bg-orange-50', 'bg-orange-50/50')}
                                            {renderColumn(hist, 'good_bonus', 'BONNE GARDE (B)', Zap, 'text-emerald-600', 'border-emerald-600', 'bg-emerald-50', 'bg-emerald-50/50')}
                                            {renderColumn(hist, 'bad_bonus', 'GARDE NORMALE (N)', Clock, 'text-indigo-600', 'border-indigo-600', 'bg-indigo-50', 'bg-indigo-50/50')}
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            );
        }

        if (activeTab === 'EXCHANGES') {
            return (
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                    <h3 className="text-lg font-black uppercase text-slate-800 mb-6 flex items-center gap-2"><div className="p-2 bg-blue-100 rounded-lg"><Zap className="w-4 h-4 text-blue-600" /></div> Historique des Demandes d'Échange</h3>
                    {exchangesHistory.length === 0 ? (
                         <div className="text-center text-slate-400 font-bold p-8 bg-white rounded-xl border border-slate-200">Aucun historique d'échange</div>
                    ) : (
                         <div className="space-y-4">
                             {exchangesHistory.map(ex => {
                                 const statusColor = ex.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : ex.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500';
                                 const statusLabels = { 'APPROVED': 'APPROUVE', 'PENDING': 'ATTENTE', 'REJECTED': 'REFUSÉ' };
                                 return (
                                     <div key={`ex-${ex.id}`} className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                         <div className="flex items-center gap-4">
                                             <div className="hidden sm:flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-100 w-16">
                                                 <span className="text-[10px] font-black uppercase text-slate-400">Date</span>
                                                 <span className="text-xs font-bold text-slate-700 mt-1">{new Date(ex.created_at).toLocaleDateString('fr-FR')}</span>
                                             </div>
                                             <div>
                                                 <div className="text-xs text-slate-500 font-bold mb-1">Cession de la Garde:</div>
                                                 <div className="text-sm font-black text-slate-800 bg-orange-50 px-2 py-1 rounded inline-block">
                                                     {ex.requester_choice ? formatCardTitle(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.columnLabel || ex.requester_choice.columnId) : 'N/A'}
                                                 </div>
                                                 <div className="text-xs mt-2 text-slate-500 font-bold mb-1">Pour la Garde cible:</div>
                                                 <div className="text-sm font-black text-slate-800 bg-blue-50 px-2 py-1 rounded inline-block">
                                                     {formatCardTitle(ex.target_row, ex.target_month, ex.target_year, ex.target_col_label || ex.target_col)}
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="flex flex-col items-end gap-2">
                                             <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${statusColor}`}>
                                                 {statusLabels[ex.status as 'APPROVED' | 'PENDING' | 'REJECTED'] || ex.status}
                                             </span>
                                             {ex.reason && <span className="text-xs text-slate-500 italic mt-1 max-w-[200px] text-right truncate" title={ex.reason}>"{ex.reason}"</span>}
                                             <span className="text-[10px] uppercase font-bold text-slate-400">Modif: {formatDate(ex.updated_at || ex.created_at)}</span>
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>
                    )}
                </div>
            );
        }

        if (activeTab === 'ABANDONS') {
            return (
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                    <h3 className="text-lg font-black uppercase text-slate-800 mb-6 flex items-center gap-2"><div className="p-2 bg-red-100 rounded-lg"><X className="w-4 h-4 text-red-600" /></div> Historique des Demandes d'Abandon</h3>
                    {abandonsHistory.length === 0 ? (
                         <div className="text-center text-slate-400 font-bold p-8 bg-white rounded-xl border border-slate-200">Aucun historique d'abandon</div>
                    ) : (
                         <div className="space-y-4">
                             {abandonsHistory.map(ab => {
                                 const choice = ab.requester_choice || (ab.shift_snapshot ? JSON.parse(ab.shift_snapshot) : null);
                                 const statusColor = ab.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : ab.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500';
                                 const statusLabels = { 'APPROVED': 'APPROUVE', 'PENDING': 'ATTENTE', 'REJECTED': 'REFUSÉ' };
                                 return (
                                     <div key={`ab-${ab.id}`} className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                         <div className="flex items-center gap-4">
                                             <div className="hidden sm:flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-100 w-16">
                                                 <span className="text-[10px] font-black uppercase text-slate-400">Date</span>
                                                 <span className="text-xs font-bold text-slate-700 mt-1">{new Date(ab.created_at).toLocaleDateString('fr-FR')}</span>
                                             </div>
                                             <div>
                                                 <div className="text-xs text-slate-500 font-bold mb-1">Garde abandonnée:</div>
                                                 <div className="text-sm font-black text-slate-800 bg-red-50 px-2 py-1 rounded inline-block text-red-800 border border-red-100">
                                                     {choice ? formatCardTitle(choice.row || choice.day, choice.month, choice.year, choice.colLabel || choice.columnLabel || choice.col || choice.columnId) : 'N/A'}
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="flex flex-col items-end gap-2">
                                             <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${statusColor}`}>
                                                 {statusLabels[ab.status as 'APPROVED' | 'PENDING' | 'REJECTED'] || ab.status}
                                             </span>
                                             <span className="text-[10px] uppercase font-bold text-slate-400">Modif: {formatDate(ab.updated_at || ab.created_at)}</span>
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>
                    )}
                </div>
            );
        }

        if (activeTab === 'TAKES') {
            return (
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                    <h3 className="text-lg font-black uppercase text-slate-800 mb-6 flex items-center gap-2"><div className="p-2 bg-emerald-100 rounded-lg"><Target className="w-4 h-4 text-emerald-600" /></div> Historique des Reprises de Garde</h3>
                    {takesHistory.length === 0 ? (
                         <div className="text-center text-slate-400 font-bold p-8 bg-white rounded-xl border border-slate-200">Aucun historique de reprise</div>
                    ) : (
                         <div className="space-y-4">
                             {takesHistory.map(tk => {
                                 const statusColor = tk.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : tk.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500';
                                 const statusLabels = { 'APPROVED': 'APPROUVE', 'PENDING': 'ATTENTE', 'REJECTED': 'REFUSÉ' };
                                 return (
                                     <div key={`tk-${tk.id}`} className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                         <div className="flex items-center gap-4">
                                             <div className="hidden sm:flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-100 w-16">
                                                 <span className="text-[10px] font-black uppercase text-slate-400">Date</span>
                                                 <span className="text-xs font-bold text-slate-700 mt-1">{new Date(tk.created_at).toLocaleDateString('fr-FR')}</span>
                                             </div>
                                             <div>
                                                 <div className="text-xs text-slate-500 font-bold mb-1">Garde demandée:</div>
                                                 <div className="text-sm font-black text-slate-800 bg-emerald-50 px-2 py-1 rounded inline-block text-emerald-800 border border-emerald-100">
                                                     {formatCardTitle(tk.target_row, tk.target_month, tk.target_year, tk.target_col_label || tk.target_col)}
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="flex flex-col items-end gap-2">
                                             <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${statusColor}`}>
                                                 {statusLabels[tk.status as 'APPROVED' | 'PENDING' | 'REJECTED'] || tk.status}
                                             </span>
                                             <span className="text-[10px] uppercase font-bold text-slate-400">Modif: {formatDate(tk.updated_at || tk.created_at)}</span>
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>
                    )}
                </div>
            );
        }

        if (activeTab === 'ARCHIVES') {
            return (
                <ArchivePlanningDoctorView 
                    supabase={supabase} 
                    currentUserTrigram={currentUserTrigram} 
                    columnConfigs={columnConfigs} 
                />
            );
        }

        return null;
    };

    return (
        <div className={`fixed inset-0 z-[500] flex bg-slate-900/50 backdrop-blur-sm shadow-2xl overflow-hidden ${isFullscreen ? 'p-0' : 'p-4 md:p-8'}`}>
            <div className={`bg-white w-full h-full shadow-2xl flex flex-col overflow-hidden ${isFullscreen ? 'rounded-none' : 'rounded-2xl'}`}>
                
                {/* UNIFIED HEADER */}
                <div className="bg-slate-900 p-5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-white/70" />
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">
                            Mes Historiques - {currentUserTrigram}
                        </h2>
                    </div>
                    
                    <div className="flex items-center gap-2 absolute top-4 right-4 sm:static">
                        <button 
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all focus:outline-none"
                            title={isFullscreen ? "Réduire" : "Plein écran"}
                        >
                            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all focus:outline-none"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* TAB BAR */}
                <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-2 md:py-0 overflow-x-auto no-scrollbar flex shrink-0">
                    <div className="flex items-center gap-2 md:gap-8 h-12">
                        {[
                            { id: 'ATTRIBUTIONS', label: 'Attributions' },
                            { id: 'EXCHANGES', label: 'Échanges' },
                            { id: 'ABANDONS', label: 'Abandons' },
                            { id: 'TAKES', label: 'Reprises' },
                            { id: 'ARCHIVES', label: 'Archive Planning' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`h-full flex items-center px-2 py-4 md:py-0 whitespace-nowrap text-xs md:text-sm font-black uppercase tracking-widest relative transition-colors ${
                                    activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"></span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 min-h-0 flex overflow-hidden">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
}
