const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// Replace `Cède [{` with `Cède : {`
content = content.replace(/Cède \[\{/g, 'Cède : {');
// Replace `} ➔ Récupère [{` with `} ➔ Récupère : {` (or wait, the regex I ran returned `Cède [{formatRequestDate...} ➔ Récupère [{formatRequestDate...}` without closing brackets because of the previous `}]` -> `}` replacement).
content = content.replace(/\} ➔ Récupère \[\{/g, '} ➔ Récupère : {');
content = content.replace(/➔ Récupère \[\{/g, '➔ Récupère : {');

content = content.replace(/Garde \[\{/g, 'Garde : {');

fs.writeFileSync('components/ExchangeRules.tsx', content);
