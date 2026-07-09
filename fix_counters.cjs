const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

function fixDoctorAbandons(text) {
  const target = `                         const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           return { user, count: matchedAbandons.length, matchedAbandons };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);`;
                         
  const replacement = `                         const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           const matchedExchanges = requests.filter(r => {
                             if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDate;
                           });
                           return { user, count: matchedAbandons.length + matchedExchanges.length, matchedAbandons, matchedExchanges };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);`;
                         
  return text.replace(target, replacement);
}

function fixSubstituteAbandons(text) {
  const target = `                         const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           return { user, count: matchedAbandons.length, matchedAbandons };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);`;
                         
  const replacement = `                         const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           const matchedExchanges = requests.filter(r => {
                             if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDate;
                           });
                           return { user, count: matchedAbandons.length + matchedExchanges.length, matchedAbandons, matchedExchanges };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);`;
                         
  return text.replace(target, replacement);
}

function fixDoctorTakes(text) {
  const target = `                         const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                           const matchedTakes = takes.filter(t => {
                             if (t.requester_trigram !== user.trigram || t.status !== 'APPROVED') return false;
                             const actionDate = new Date(t.updated_at || t.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           return { user, count: matchedTakes.length, matchedTakes };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);`;
                         
  const replacement = `                         const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                           const matchedTakes = takes.filter(t => {
                             if (t.requester_trigram !== user.trigram || t.status !== 'APPROVED') return false;
                             const actionDate = new Date(t.updated_at || t.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           const matchedExchanges = requests.filter(r => {
                             if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           return { user, count: matchedTakes.length + matchedExchanges.length, matchedTakes, matchedExchanges };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);`;
                         
  return text.replace(target, replacement);
}

function fixSubstituteTakes(text) {
  const target = `                         const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                           const matchedTakes = takes.filter(t => {
                             if (t.requester_trigram !== user.trigram || t.status !== 'APPROVED') return false;
                             const actionDate = new Date(t.updated_at || t.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           return { user, count: matchedTakes.length, matchedTakes };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);`;
                         
  const replacement = `                         const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                           const matchedTakes = takes.filter(t => {
                             if (t.requester_trigram !== user.trigram || t.status !== 'APPROVED') return false;
                             const actionDate = new Date(t.updated_at || t.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           const matchedExchanges = requests.filter(r => {
                             if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                             const actionDate = new Date(r.updated_at || r.created_at);
                             return actionDate > counterResetDateTakes;
                           });
                           return { user, count: matchedTakes.length + matchedExchanges.length, matchedTakes, matchedExchanges };
                         }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);`;
                         
  return text.replace(target, replacement);
}

// Now the map replacements
function fixMapAbandons(text) {
  const target = `                         return userCounts.map(({ user, count, matchedAbandons }) => (`;
  const replacement = `                         return userCounts.map(({ user, count, matchedAbandons, matchedExchanges }) => (`;
  
  // Replace the target twice (once for DOCTOR, once for SUBSTITUTE)
  text = text.replace(target, replacement);
  text = text.replace(target, replacement);
  
  const mapContentTarget = `                                 ))}
                               </div>`;
  const mapContentReplacement = `                                 ))}
                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange : {ex.requester_trigram === user.trigram ? 
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée') :
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs)
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Échange traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')}</div>
                                   </div>
                                 ))}
                               </div>`;
                               
  // Replace mapContentTarget twice in the ABANDONS block (roughly line 1250 and 1300)
  // But mapContentTarget might appear in TAKES as well. Wait, Takes doesn't have formatRequestDate with `true, columnConfigs`.
  // Actually, I can use a more precise regex or string replace.
  
  text = text.replace(
`                                   </div>
                                 ))}
                               </div>`,
`                                   </div>
                                 ))}
                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Abandon) : {ex.requester_trigram === user.trigram ? 
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée') :
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs)
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Échange traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')}</div>
                                   </div>
                                 ))}
                               </div>`
  );
  
  text = text.replace(
`                                   </div>
                                 ))}
                               </div>`,
`                                   </div>
                                 ))}
                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Abandon) : {ex.requester_trigram === user.trigram ? 
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée') :
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs)
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Échange traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')}</div>
                                   </div>
                                 ))}
                               </div>`
  );

  return text;
}

function fixMapTakes(text) {
  const target = `                         return userCounts.map(({ user, count, matchedTakes }) => (`;
  const replacement = `                         return userCounts.map(({ user, count, matchedTakes, matchedExchanges }) => (`;
  
  text = text.replace(target, replacement);
  text = text.replace(target, replacement);
  
  // The map for Takes:
  text = text.replace(
`                                   </div>
                                 ))}
                               </div>`,
`                                   </div>
                                 ))}
                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Reprise) : {ex.requester_trigram === user.trigram ? 
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs) :
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée')
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Échange traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')}</div>
                                   </div>
                                 ))}
                               </div>`
  );
  
  text = text.replace(
`                                   </div>
                                 ))}
                               </div>`,
`                                   </div>
                                 ))}
                                 {matchedExchanges && matchedExchanges.map((ex, idx) => (
                                   <div key={'ex'+idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800">
                                       Échange (Reprise) : {ex.requester_trigram === user.trigram ? 
                                         formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs) :
                                         (ex.requester_choice ? formatRequestDate(ex.requester_choice.row, ex.requester_choice.month, ex.requester_choice.year, ex.requester_choice.col, ex.requester_choice.colLabel, true, columnConfigs) : 'Garde supprimée')
                                       }
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1">Échange traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')}</div>
                                   </div>
                                 ))}
                               </div>`
  );

  return text;
}

content = fixDoctorAbandons(content);
content = fixSubstituteAbandons(content);
content = fixMapAbandons(content);

content = fixDoctorTakes(content);
content = fixSubstituteTakes(content);
content = fixMapTakes(content);

fs.writeFileSync('components/ExchangeRules.tsx', content);
console.log('Fixed');
