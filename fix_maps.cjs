const fs = require('fs');

const exchangeAbandonHtml = `                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Abandon) : {ex.requester_trigram === user.trigram ? 
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée') :
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs)
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Échange traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')}</div>
                                   </div>
                                 ))}`;
                                 
const exchangeTakeHtml = `                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Reprise) : {ex.requester_trigram === user.trigram ? 
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs) :
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée')
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Échange traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')}</div>
                                   </div>
                                 ))}`;

let lines = fs.readFileSync('components/ExchangeRules.tsx', 'utf8').split('\n');

// Find end of matchedAbandons
let newLines = [];
let insideAbandons = false;
let abandonsCount = 0;

let insideTakes = false;
let takesCount = 0;

for (let i = 0; i < lines.length; i++) {
  newLines.push(lines[i]);
  
  if (lines[i].includes('{matchedAbandons.map((ab, idx) => (')) {
    insideAbandons = true;
  }
  
  if (insideAbandons && lines[i].includes('))}')) {
    newLines.push(exchangeAbandonHtml);
    insideAbandons = false;
    abandonsCount++;
  }
  
  if (lines[i].includes('{matchedTakes.map((tk, idx) => (')) {
    insideTakes = true;
  }
  
  if (insideTakes && lines[i].includes('))}')) {
    newLines.push(exchangeTakeHtml);
    insideTakes = false;
    takesCount++;
  }
}

fs.writeFileSync('components/ExchangeRules.tsx', newLines.join('\n'));
console.log('Fixed', abandonsCount, takesCount);
