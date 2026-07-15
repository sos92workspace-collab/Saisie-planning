const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const bannerStr = `
        {pendingReplacementAction && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg font-bold flex items-center gap-4 animate-in slide-in-from-top-4">
                <span>Veuillez sélectionner la nouvelle garde pour le Dr {pendingReplacementAction.abandonedChoice.userTrigram}</span>
                <button onClick={() => setPendingReplacementAction(null)} className="p-1 hover:bg-blue-700 rounded-full bg-blue-800/50"><X className="w-4 h-4" /></button>
            </div>
        )}
        
        {finalAbandonConfirm && (
            <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 p-6 flex justify-between items-center">
                        <div>
                            <h3 className="text-white font-black text-lg uppercase tracking-widest">Confirmer l'abandon avec remplacement</h3>
                            <p className="text-slate-400 text-sm mt-1">Dr {finalAbandonConfirm.abandonedChoice.userTrigram}</p>
                        </div>
                        <button onClick={() => setFinalAbandonConfirm(null)} className="text-slate-400 hover:text-white p-2 bg-white/5 rounded-full"><X className="w-5 h-5"/></button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                                <div className="text-xs uppercase font-bold tracking-widest text-red-500 mb-1">Garde abandonnée</div>
                                <div className="font-bold text-red-900">{String(finalAbandonConfirm.abandonedChoice.row).padStart(2,'0')}/{String(finalAbandonConfirm.abandonedChoice.month + 1).padStart(2,'0')}/{finalAbandonConfirm.abandonedChoice.year}</div>
                                <div className="text-sm font-medium text-red-700 mt-1">Col {finalAbandonConfirm.abandonedChoice.col}</div>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                <div className="text-xs uppercase font-bold tracking-widest text-emerald-500 mb-1">Nouvelle garde</div>
                                <div className="font-bold text-emerald-900">{String(finalAbandonConfirm.replacementCell.row).padStart(2,'0')}/{String(finalAbandonConfirm.replacementCell.month + 1).padStart(2,'0')}/{finalAbandonConfirm.replacementCell.year}</div>
                                <div className="text-sm font-medium text-emerald-700 mt-1">Col {finalAbandonConfirm.replacementCell.col}</div>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-widest">Pénalité financière appliquée</div>
                            
                            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                <div className="text-sm font-medium text-slate-700">Délai : <span className="font-bold">{finalAbandonConfirm.penaltyCategory === 'MORE_THAN_48H' ? '> 48h' : finalAbandonConfirm.penaltyCategory === 'BETWEEN_6H_AND_48H' ? 'Entre 6h et 48h' : '< 6h'}</span></div>
                                <div className="text-lg font-black text-rose-600">{finalAbandonConfirm.penaltyAmount} €</div>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setFinalAbandonConfirm(null)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50">Annuler</button>
                            <button onClick={handleFinalAbandonConfirm} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-blue-200 hover:bg-blue-700">Valider</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
`;

content = content.replace(
    /(<div className="w-full max-w-\[100vw\] overflow-hidden relative">)/,
    bannerStr + '\n$1'
);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Injected UI components");
