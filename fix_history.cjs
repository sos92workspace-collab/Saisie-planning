const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

content = content.replace(/traité le \{new Date\(([^)]+)\)\.toLocaleDateString\('fr-FR'\)\}/g, "traité le {new Date($1).toLocaleDateString('fr-FR')} {ab?.processed_by || ex?.processed_by || tk?.processed_by || tk?.updated_by ? 'par ' + (ab?.processed_by || ex?.processed_by || tk?.processed_by || tk?.updated_by) : ''}");

// wait, the variables might be different in different map blocks.
fs.writeFileSync('components/ExchangeRules.tsx', content);
