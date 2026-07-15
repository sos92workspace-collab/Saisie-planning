const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const targetStr = `                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                id="logInCounterRemove" 
                                checked={logInCounter} 
                                onChange={(e) => setLogInCounter(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="logInCounterRemove" className="text-xs font-bold text-slate-700">Comptabiliser cet abandon dans le compteur du médecin</label>
                        </div>`;

const replacementStr = `    <div className="space-y-4">
        <div className="text-sm font-bold text-slate-700">Motif du retrait :</div>
        <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="removeMode" checked={removeMode === 'ERROR'} onChange={() => setRemoveMode('ERROR')} className="mt-1" />
            <div>
                <div className="text-sm font-bold text-slate-900">Correction d'erreur</div>
                <div className="text-xs text-slate-500">Ne compte pas comme un abandon. Aucune pénalité, la garde est juste retirée.</div>
            </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="removeMode" checked={removeMode === 'ABANDON'} onChange={() => setRemoveMode('ABANDON')} className="mt-1" />
            <div>
                <div className="text-sm font-bold text-slate-900">Abandon de garde</div>
                <div className="text-xs text-slate-500">Comptabilise l'abandon et applique une pénalité financière.</div>
            </div>
        </label>
        
        {removeMode === 'ABANDON' && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-widest">Détails de la pénalité</div>
                
                <div className="text-xs text-slate-600 mb-3">
                    Catégorie de délai : <span className="font-bold">
                        {removeDelayCategory === 'MORE_THAN_48H' ? '> 48h' : removeDelayCategory === 'BETWEEN_6H_AND_48H' ? 'Entre 6h et 48h' : '< 6h'}
                    </span>
                </div>
                
                <label className="block text-xs font-bold text-slate-700 mb-1">Montant à appliquer (€)</label>
                <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        min="0"
                        value={removePenaltyAmount}
                        onChange={e => setRemovePenaltyAmount(parseFloat(e.target.value) || 0)}
                        className="w-24 p-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
                    />
                    <span className="text-sm text-slate-500 font-bold">€</span>
                </div>
                
                <div className="mt-3 text-[10px] text-slate-500">
                    Suggéré selon les règles :<br/>
                    {abandonPenaltiesRules.map(r => (
                        <div key={r.id}>- {r.delay_category === 'MORE_THAN_48H' ? '> 48h' : r.delay_category === 'BETWEEN_6H_AND_48H' ? '48h - 6h' : '< 6h'} : {r.penalty_amount}€</div>
                    ))}
                </div>
                
                <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-xs font-medium border border-yellow-200 flex items-start gap-2">
                    <span className="text-base leading-none">💡</span>
                    <span>Pour conserver l'équilibre du planning, n'oubliez pas d'assigner une nouvelle garde de remplacement au médecin, ou demandez-lui d'en prendre une via la bourse d'échanges.</span>
                </div>
            </div>
        )}
    </div>`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Modal UI updated");
} else {
    console.log("Target string not found, dumping a fragment:");
    const lines = content.split('\n');
    const idx = lines.findIndex(l => l.includes('logInCounterRemove'));
    console.log(lines.slice(idx-5, idx+5).join('\n'));
}
