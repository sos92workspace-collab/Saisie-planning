const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const regex = /<span className="text-sm font-bold text-slate-800 mt-1">\s*\{ab\.requester_choice\s*\?\s*formatRequestDate\(ab\.requester_choice\.row, ab\.requester_choice\.month, ab\.requester_choice\.year, ab\.requester_choice\.col, ab\.requester_choice\.colLabel, true, columnConfigs\)\s*:\s*ab\.shift_snapshot\s*\?\s*formatRequestDate\(ab\.shift_snapshot\.row, ab\.shift_snapshot\.month, ab\.shift_snapshot\.year, ab\.shift_snapshot\.col, ab\.shift_snapshot\.colLabel, true, columnConfigs\)\s*:\s*'Garde supprimée'\}\s*<\/span>/;

const replacement = `<span className="text-sm font-bold text-slate-800 mt-1">
                             {ab.requester_choice 
                               ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs)
                               : ab.shift_snapshot
                                 ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs)
                                 : 'Garde supprimée'}
                         </span>
                         {ab.shift_snapshot?.linked_take && (
                             <div className="mt-2 p-2 bg-teal-50 border border-teal-100 rounded-lg">
                               <div className="text-[9px] font-black text-teal-600 uppercase mb-1">Garde reprise</div>
                               <div className="text-sm font-bold text-slate-800">
                                   {formatRequestDate(ab.shift_snapshot.linked_take.row, ab.shift_snapshot.linked_take.month, ab.shift_snapshot.linked_take.year, ab.shift_snapshot.linked_take.col, ab.shift_snapshot.linked_take.colLabel, false, columnConfigs)}
                               </div>
                             </div>
                         )}`;

content = content.replace(regex, replacement);

fs.writeFileSync('App.tsx', content);
console.log("Updated App.tsx");
