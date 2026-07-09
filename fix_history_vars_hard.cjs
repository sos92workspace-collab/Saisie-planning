const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

const badStr = "{ab?.processed_by || ex?.processed_by || tk?.processed_by || tk?.updated_by ? 'par ' + (ab?.processed_by || ex?.processed_by || tk?.processed_by || tk?.updated_by) : ''}";

// find each instance and replace with correct one
let idx = content.indexOf(badStr);
while (idx !== -1) {
    let preceding = content.slice(idx - 150, idx);
    let replacement = "";
    if (preceding.includes('ab.updated_at') || preceding.includes('ab.created_at')) {
        replacement = "{ab?.processed_by ? ' par ' + ab.processed_by : ''}";
    } else if (preceding.includes('ex.updated_at') || preceding.includes('ex.created_at')) {
        replacement = "{ex?.processed_by ? ' par ' + ex.processed_by : ''}";
    } else if (preceding.includes('tk.updated_at') || preceding.includes('tk.created_at')) {
        replacement = "{tk?.processed_by ? ' par ' + tk.processed_by : ''}";
    }
    content = content.substring(0, idx) + replacement + content.substring(idx + badStr.length);
    idx = content.indexOf(badStr);
}

fs.writeFileSync('components/ExchangeRules.tsx', content);
