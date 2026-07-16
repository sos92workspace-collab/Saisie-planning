const fs = require('fs');
let code = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

if (!code.includes('isCounterExpandedPenalties')) {
  // Add state variables
  code = code.replace(
    /const \[expandedUserTrigramTakes, setExpandedUserTrigramTakes\] = useState<string \| null>\(null\);/,
    `const [expandedUserTrigramTakes, setExpandedUserTrigramTakes] = useState<string | null>(null);
  const [isCounterExpandedPenalties, setIsCounterExpandedPenalties] = useState(true);
  const [expandedUserTrigramPenalties, setExpandedUserTrigramPenalties] = useState<string | null>(null);`
  );

  const blockToInsert = `

          {/* Compteur Medecin (Pénalités) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-8">
            <button 
              onClick={() => setIsCounterExpandedPenalties(!isCounterExpandedPenalties)}
              className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-slate-100 transition-colors"
            >
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Compteur médecin (Pénalités)</h3>
              <div className="flex items-center gap-4">
                 <span className="text-xs font-bold text-slate-500">Depuis le {counterResetDate.getFullYear() === 1970 ? 'début' : counterResetDate.toLocaleDateString('fr-FR')}</span>
                 <svg className={\`w-5 h-5 text-slate-500 transform transition-transform \${isCounterExpandedPenalties ? 'rotate-180' : ''}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </button>
            {isCounterExpandedPenalties && (
              <div className="p-6 border-t border-slate-200 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  {/* Titulaires */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2 mb-3">Titulaires</h4>
                    <div className="flex flex-col gap-2">
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             if (!a.penalty_amount || a.penalty_amount <= 0) return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           const totalPenalty = matchedAbandons.reduce((sum, a) => sum + (a.penalty_amount || 0), 0);
                           return { user, totalPenalty, matchedAbandons };
                         }).filter(item => item.totalPenalty > 0).sort((a, b) => b.totalPenalty - a.totalPenalty);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucune pénalité comptabilisée.</div>;
                         }

                         return userCounts.map(({ user, totalPenalty, matchedAbandons }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigramPenalties(expandedUserTrigramPenalties === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={\`w-4 h-4 text-slate-400 transition-transform \${expandedUserTrigramPenalties === user.trigram ? 'rotate-180' : ''}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">{totalPenalty} €</span>
                             </div>
                             {expandedUserTrigramPenalties === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedAbandons.map((ab, idx) => (
                                   <div key={ab.id || idx} className="flex flex-col text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800 flex justify-between items-start">
                                       <span>Garde : {ab.requester_choice ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs) : (ab.shift_snapshot ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs) : 'Garde supprimée')}</span>
                                       <span className="text-red-600 ml-2 whitespace-nowrap">+{ab.penalty_amount} €</span>
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                                        <span>Demandé le {new Date(ab.created_at).toLocaleDateString('fr-FR')}</span>
                                        <span className="font-medium bg-slate-100 px-1 py-0.5 rounded text-slate-600">Délai : {ab.delay_category || 'N/A'}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>

                  {/* Remplaçants */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2 mb-3">Remplaçants</h4>
                    <div className="flex flex-col gap-2">
                       {(() => {
                         const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                           const matchedAbandons = abandons.filter(a => {
                             if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                             if (!a.penalty_amount || a.penalty_amount <= 0) return false;
                             const actionDate = new Date(a.updated_at || a.created_at);
                             return actionDate > counterResetDate;
                           });
                           const totalPenalty = matchedAbandons.reduce((sum, a) => sum + (a.penalty_amount || 0), 0);
                           return { user, totalPenalty, matchedAbandons };
                         }).filter(item => item.totalPenalty > 0).sort((a, b) => b.totalPenalty - a.totalPenalty);

                         if (userCounts.length === 0) {
                           return <div className="text-xs text-slate-500 italic py-1">Aucune pénalité comptabilisée.</div>;
                         }

                         return userCounts.map(({ user, totalPenalty, matchedAbandons }) => (
                           <div key={user.trigram} className="flex flex-col border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                             <div 
                               className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1"
                               onClick={() => setExpandedUserTrigramPenalties(expandedUserTrigramPenalties === user.trigram ? null : user.trigram)}
                             >
                               <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                 {user.trigram}
                                 <svg className={\`w-4 h-4 text-slate-400 transition-transform \${expandedUserTrigramPenalties === user.trigram ? 'rotate-180' : ''}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                               <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">{totalPenalty} €</span>
                             </div>
                             {expandedUserTrigramPenalties === user.trigram && (
                               <div className="flex flex-col gap-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                                 {matchedAbandons.map((ab, idx) => (
                                   <div key={ab.id || idx} className="flex flex-col text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                     <div className="font-bold text-slate-800 flex justify-between items-start">
                                       <span>Garde : {ab.requester_choice ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs) : (ab.shift_snapshot ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs) : 'Garde supprimée')}</span>
                                       <span className="text-red-600 ml-2 whitespace-nowrap">+{ab.penalty_amount} €</span>
                                     </div>
                                     <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                                        <span>Demandé le {new Date(ab.created_at).toLocaleDateString('fr-FR')}</span>
                                        <span className="font-medium bg-slate-100 px-1 py-0.5 rounded text-slate-600">Délai : {ab.delay_category || 'N/A'}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         ));
                       })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>`;

  const regex = /(<div className="flex justify-end mb-6">\s*<button\s*onClick=\{async \(\) => \{\s*const adminUser = users\.find\(u => u\.role === 'ADMIN'\);\s*if \(!adminUser\) return alert\("Utilisateur admin non trouvé\."\);\s*const pwd = window\.prompt\("Pour réinitialiser le compteur, veuillez saisir le mot de passe administrateur :"\);\s*if \(pwd === null\) return;\s*if \(pwd !== adminUser\.password\) return alert\("Mot de passe incorrect\."\);\s*try \{\s*const \{ error \} = await supabase\.from\('logs'\)\.insert\(\[\{ action: 'RESET_ABANDON_COUNTER', details: \{\} \}\]\);\s*if \(error\) throw error;\s*setCounterResetDate\(new Date\(\)\);\s*\} catch \(err\) \{\s*console\.error\(err\);\s*alert\("Erreur lors de la réinitialisation\."\);\s*\}\s*\}\}\s*className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 transition-colors rounded-lg text-xs font-bold uppercase tracking-wider"\s*>\s*Réinitialiser le compteur\s*<\/button>\s*<\/div>\s*<div className="grid grid-cols-1 md:grid-cols-2 gap-8">\s*\{\/\* Titulaires \*\/\}\s*<div>[\s\S]*?\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}\s*<\/div>)/;

  const match = code.match(regex);
  if (match) {
    code = code.replace(match[0], match[0] + blockToInsert);
    fs.writeFileSync('components/ExchangeRules.tsx', code);
    console.log("Successfully inserted penalty counters");
  } else {
    console.log("Could not find the target block to insert after");
  }
} else {
  console.log("Already inserted");
}
