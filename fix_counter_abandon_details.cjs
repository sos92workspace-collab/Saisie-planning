const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

const regex = /<div className="font-bold text-slate-800">\s*Garde : \{ab\.requester_choice \? formatRequestDate\(ab\.requester_choice\.row, ab\.requester_choice\.month, ab\.requester_choice\.year, ab\.requester_choice\.col, ab\.requester_choice\.colLabel, true, columnConfigs\) : \(ab\.shift_snapshot \? formatRequestDate\(ab\.shift_snapshot\.row, ab\.shift_snapshot\.month, ab\.shift_snapshot\.year, ab\.shift_snapshot\.col, ab\.shift_snapshot\.colLabel, true, columnConfigs\) : 'Garde supprimée'\)\}\s*<\/div>/g;

const replacement = `<div className="font-bold text-slate-800">
                                       Garde : {ab.requester_choice ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs) : (ab.shift_snapshot ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs) : 'Garde supprimée')}
                                       {ab.shift_snapshot?.linked_take && (
                                           <>
                                             {' → '}
                                             <span className="font-bold text-teal-600">Reprise [{formatRequestDate(ab.shift_snapshot.linked_take.row, ab.shift_snapshot.linked_take.month, ab.shift_snapshot.linked_take.year, ab.shift_snapshot.linked_take.col, ab.shift_snapshot.linked_take.colLabel, false, columnConfigs)}]</span>
                                           </>
                                       )}
                                     </div>`;

content = content.replace(regex, replacement);
fs.writeFileSync('components/ExchangeRules.tsx', content);
console.log("Updated ExchangeRules.tsx");
