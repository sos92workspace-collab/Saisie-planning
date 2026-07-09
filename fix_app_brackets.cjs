const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf8');

content = content.replace(/Cède \[\{/g, 'Cède : {');
content = content.replace(/\} \]\➔ Récupère \[\{/g, '} ➔ Récupère : {');
content = content.replace(/\} \] ➔ Récupère \[\{/g, '} ➔ Récupère : {');
content = content.replace(/\] ➔ Récupère \[\{/g, ' ➔ Récupère : {');
content = content.replace(/\}\]/g, '}');
content = content.replace(/Garde \[\{/g, 'Garde : {');

fs.writeFileSync('App.tsx', content);
