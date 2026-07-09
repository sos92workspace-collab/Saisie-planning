const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// Replace Takes history dates
content = content.replace(/Ajout validé le \{new Date\(tk\.updated_at \|\| tk\.created_at\)\.toLocaleDateString\('fr-FR'\)\}/g, "Demandé le {new Date(tk.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(tk.updated_at || tk.created_at).toLocaleDateString('fr-FR')}");
content = content.replace(/Garde \[\{formatRequestDate/g, "Garde : {formatRequestDate");
content = content.replace(/ \}\]/g, " }");

fs.writeFileSync('components/ExchangeRules.tsx', content);
