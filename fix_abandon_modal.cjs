const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const finalAbandonModal = `        {finalAbandonConfirm && (
            <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 p-6">
                        <h3 className="text-white text-lg font-black uppercase tracking-tight">Confirmer l'abandon et la reprise</h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="text-sm font-medium text-slate-700">
                            Vous êtes sur le point de valider l'abandon et la reprise de garde pour le Dr <span className="font-bold text-slate-900">{finalAbandonConfirm.abandonedChoice.userTrigram}</span>.
                        </div>
                        
                        <div className="space-y-3">
                            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                                <div className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Garde abandonnée</div>
                                <div className="text-sm font-bold text-slate-900">
                                    {finalAbandonConfirm.abandonedChoice.row}/{finalAbandonConfirm.abandonedChoice.month + 1}/{finalAbandonConfirm.abandonedChoice.year} • Colonne {finalAbandonConfirm.abandonedChoice.col}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Pénalité : {finalAbandonConfirm.penaltyAmount}€</div>
                            </div>
                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Garde reprise</div>
                                <div className="text-sm font-bold text-slate-900">
                                    {finalAbandonConfirm.replacementCell.row}/{finalAbandonConfirm.replacementCell.month + 1}/{finalAbandonConfirm.replacementCell.year} • Colonne {finalAbandonConfirm.replacementCell.col}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setFinalAbandonConfirm(null)}
                                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={handleFinalAbandonConfirm}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
`;

content = content.replace('{editingCell && (', finalAbandonModal + '{editingCell && (');

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Added finalAbandonConfirm modal");
