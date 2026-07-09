const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// The merged log part
content = content.replace(/\{data\.status === 'APPROVED' \? 'Échange validé' : 'Échange refusé'\}/g, "{data.status === 'APPROVED' ? 'Échange validé' : 'Échange refusé'} {data.processed_by ? 'par ' + data.processed_by : ''}");
content = content.replace(/\{data\.status === 'APPROVED' \? 'Abandon pris en compte' : 'Abandon refusé'\}/g, "{data.status === 'APPROVED' ? 'Abandon pris en compte' : 'Abandon refusé'} {data.processed_by ? 'par ' + data.processed_by : ''}");
content = content.replace(/\{data\.status === 'APPROVED' \? 'Ajout validé' : 'Ajout refusé'\}/g, "{data.status === 'APPROVED' ? 'Ajout validé' : 'Ajout refusé'} {data.processed_by ? 'par ' + data.processed_by : ''}");

fs.writeFileSync('components/ExchangeRules.tsx', content);
