const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// Inject state
const stateHookStr = `  const [removeMode, setRemoveMode] = useState<'ABANDON'|'ERROR'>('ABANDON');
  const [removePenaltyAmount, setRemovePenaltyAmount] = useState<number>(0);
  const [removeDelayCategory, setRemoveDelayCategory] = useState<string>('');
  const [abandonPenaltiesRules, setAbandonPenaltiesRules] = useState<any[]>([]);`;

content = content.replace(
    "const [confirmAbandonChoice, setConfirmAbandonChoice] = useState<any>(null);",
    "const [confirmAbandonChoice, setConfirmAbandonChoice] = useState<any>(null);\n" + stateHookStr
);

// We need to fetch penalties on open
content = content.replace(
    /setConfirmAbandonChoice\((.*?)\)/g,
    (match, p1) => {
        if (p1 === "null") return match;
        return `{
            setConfirmAbandonChoice(${p1});
            setRemoveMode('ABANDON');
            
            const choice = ${p1};
            let colLabel = columnConfigs.find((c: any) => c.column_id === choice.col)?.custom_label || COLUMNS.find(c => c.id === choice.col)?.label || "0h";
            const hMatch = colLabel.match(/\\((\\d{1,2})h/i);
            const hour = hMatch ? parseInt(hMatch[1], 10) : 0;
            
            const shiftDate = new Date(choice.year, choice.month, choice.row || 1, hour, 0, 0);
            const now = new Date();
            const delayHours = (shiftDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            let category = 'MORE_THAN_48H';
            if (delayHours < 6) category = 'LESS_THAN_6H';
            else if (delayHours < 48) category = 'BETWEEN_6H_AND_48H';
            
            setRemoveDelayCategory(category);
            
            supabase.from('abandon_penalties').select('*').then(({ data }) => {
                if (data) {
                    setAbandonPenaltiesRules(data);
                    const p = data.find((p: any) => p.delay_category === category);
                    if (p) setRemovePenaltyAmount(parseFloat(p.penalty_amount) || 0);
                }
            });
        }`
    }
);

// We need to update the UI
const uiStr = `
            <div className="p-6 space-y-6">
              <p className="text-sm font-medium text-slate-700">
                Vous êtes sur le point de retirer la garde suivante du Dr <span className="font-bold text-slate-900">{confirmAbandonChoice.userTrigram || confirmAbandonChoice.user_trigram}</span> :
              </p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs uppercase font-bold text-slate-400">Date</span>
                  <span className="text-sm font-bold text-slate-800">{String(confirmAbandonChoice.row).padStart(2, '0')}/{String(confirmAbandonChoice.month + 1).padStart(2, '0')}/{confirmAbandonChoice.year}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs uppercase font-bold text-slate-400">Colonne</span>
                  <span className="text-sm font-bold text-slate-800 text-right">
                    Col {confirmAbandonChoice.col}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                  <div className="text-sm font-bold text-slate-700">Motif du retrait :</div>
                  <label className="flex items-start gap-3 cursor-pointer">
                      <input type="radio" name="removeModeEx" checked={removeMode === 'ERROR'} onChange={() => setRemoveMode('ERROR')} className="mt-1" />
                      <div>
                          <div className="text-sm font-bold text-slate-900">Correction d'erreur</div>
                          <div className="text-xs text-slate-500">Ne compte pas comme un abandon. Aucune pénalité, la garde est juste retirée.</div>
                      </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                      <input type="radio" name="removeModeEx" checked={removeMode === 'ABANDON'} onChange={() => setRemoveMode('ABANDON')} className="mt-1" />
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
              </div>
            </div>`;

content = content.replace(
    /<div className="p-6 space-y-4 text-center">[\s\S]*?<\/div>[\s]*<div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">/g,
    uiStr + '\n            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">'
);


// update handleAdminAbandon
const handleAdminAbandonStr = `
  const handleAdminAbandon = async (choice: any) => {
    try {
      const { error: deleteError } = await supabase.from('choices').delete().eq('id', choice.id);
      if (deleteError) throw deleteError;
      
      if (removeMode === 'ERROR') {
          const { error: logError } = await supabase.from('logs').insert([{
            action: 'SUPPRESSION_GARDE',
            details: { mode: 'CORRECTION_ERREUR', user: choice.userTrigram || choice.user_trigram, date: \`\${choice.row}/\${choice.month + 1}/\${choice.year}\`, col: choice.col }
          }]);
      } else {
          const { data: abandonData, error: abandonError } = await supabase.from('abandon_requests').insert([{
            requester_trigram: choice.userTrigram || choice.user_trigram,
            shift_snapshot: {
              row: choice.row,
              month: choice.month + 1,
              year: choice.year,
              col: choice.col,
              colLabel: columnConfigs.find((c: any) => c.column_id === choice.col)?.custom_label || columnConfigs.find((c: any) => c.column_id === choice.col)?.name || choice.col
            },
            status: 'APPROVED',
            updated_at: new Date().toISOString(), processed_by: currentUserTrigram
          }]).select();
          
          if (abandonError) throw abandonError;
          
          if (abandonData && abandonData.length > 0) {
              let colLabel = columnConfigs.find((c: any) => c.column_id === choice.col)?.custom_label || COLUMNS.find(c => c.id === choice.col)?.label || "0h";
              const hMatch = colLabel.match(/\\((\\d{1,2})h/i);
              const hour = hMatch ? parseInt(hMatch[1], 10) : 0;
              const shiftDate = new Date(choice.year, choice.month, choice.row || 1, hour, 0, 0);
              
              const penaltyInsert = {
                  abandon_request_id: abandonData[0].id,
                  user_trigram: choice.userTrigram || choice.user_trigram,
                  shift_date: shiftDate.toISOString(),
                  abandon_date: new Date().toISOString(),
                  delay_hours: 0,
                  penalty_amount: removePenaltyAmount,
                  penalty_category: removeDelayCategory
              };
              
              await supabase.from('applied_penalties').insert([penaltyInsert]);
          }

          const { error: logError } = await supabase.from('logs').insert([{
            action: 'SUPPRESSION_GARDE',
            details: { mode: 'ABANDON', user: choice.userTrigram || choice.user_trigram, date: \`\${choice.row}/\${choice.month + 1}/\${choice.year}\`, col: choice.col }
          }]);
      }

      fetchAssignedChoices();
      if (refreshData) refreshData();
      setConfirmAbandonChoice(null);
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de l'abandon: " + (e.message || JSON.stringify(e)));
    }
  };
`;

content = content.replace(
    /const handleAdminAbandon = async \(choice: any\) => \{[\s\S]*?^\s*\};\n/m,
    handleAdminAbandonStr.trim() + '\n'
);

fs.writeFileSync('components/ExchangeRules.tsx', content);
console.log("ExchangeRules updated.");
