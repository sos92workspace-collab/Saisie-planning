const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

content = content.replace(/\{ab\?\.processed_by \|\| ex\?\.processed_by \|\| tk\?\.processed_by \|\| tk\?\.updated_by \? 'par ' \+ \(ab\?\.processed_by \|\| ex\?\.processed_by \|\| tk\?\.processed_by \|\| tk\?\.updated_by\) : ''\}/g, function(match, offset, string) {
    // We can just look slightly backwards in the string to see if this is an 'ab', 'ex', or 'tk'
    let preceding = string.slice(offset - 150, offset);
    if (preceding.includes('ab.updated_at') || preceding.includes('ab.created_at')) {
        return "{ab?.processed_by ? 'par ' + ab.processed_by : ''}";
    } else if (preceding.includes('ex.updated_at') || preceding.includes('ex.created_at')) {
        return "{ex?.processed_by ? 'par ' + ex.processed_by : ''}";
    } else if (preceding.includes('tk.updated_at') || preceding.includes('tk.created_at')) {
        return "{tk?.processed_by ? 'par ' + tk.processed_by : ''}";
    }
    return match;
});

fs.writeFileSync('components/ExchangeRules.tsx', content);
