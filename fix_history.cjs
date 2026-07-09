const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

content = content.replace(/const allHistory = \[\n    \.\.\.requests\.filter\(r => r\.status !== 'PENDING'\)\.map\(r => \(\{ type: 'EXCHANGE', data: r, date: new Date\(r\.updated_at \|\| r\.created_at\) \}\)\),\n    \.\.\.abandons\.filter\(a => a\.status !== 'PENDING'\)\.map\(a => \(\{ type: 'ABANDON', data: a, date: new Date\(a\.updated_at \|\| a\.created_at\) \}\)\),\n    \.\.\.standaloneTakes\.filter\(t => t\.status !== 'PENDING'\)\.map\(t => \(\{ type: 'TAKE', data: t, date: new Date\(t\.updated_at \|\| t\.created_at\) \}\)\),\n    \.\.\.adminLogs\.map\(l => \(\{ type: 'ADMIN', data: l, date: new Date\(l\.created_at\) \}\)\)\n  \]\.sort\(\(a, b\) => b\.date\.getTime\(\) - a\.date\.getTime\(\)\);/g, 
  `const allHistory = [
    ...requests.filter(r => r.status !== 'PENDING').map(r => ({ type: 'EXCHANGE', data: r, date: new Date(r.updated_at || r.created_at), created_at: new Date(r.created_at) })),
    ...abandons.filter(a => a.status !== 'PENDING').map(a => ({ type: 'ABANDON', data: a, date: new Date(a.updated_at || a.created_at), created_at: new Date(a.created_at) })),
    ...standaloneTakes.filter(t => t.status !== 'PENDING').map(t => ({ type: 'TAKE', data: t, date: new Date(t.updated_at || t.created_at), created_at: new Date(t.created_at) })),
    ...adminLogs.map(l => ({ type: 'ADMIN', data: l, date: new Date(l.created_at), created_at: new Date(l.created_at) }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());`);

content = content.replace(/const \{ type, data, date \} = item;\n                    const formattedDate = date\.toLocaleString\('fr-FR', \{ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' \}\);/g,
  `const { type, data, date, created_at } = item;
                    const formattedCreatedDate = created_at.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const formattedUpdatedDate = (data.updated_at ? new Date(data.updated_at) : date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });`);

content = content.replace(/<span className="text-slate-400 font-mono text-xs mt-1 min-w-\[120px\]">\{formattedDate\}<\/span>/g,
  `<span className="text-slate-400 font-mono text-xs mt-1 min-w-[120px]">{formattedCreatedDate}</span>`);

// Update EXCHANGE text
content = content.replace(/\{data\.status === 'APPROVED' \? 'Échange validé' : 'Échange refusé'\} \{data\.processed_by \? 'par ' \+ data\.processed_by : ''\}/g,
  `{data.status === 'APPROVED' ? 'Échange validé' : 'Échange refusé'} le {formattedUpdatedDate} {data.processed_by ? 'par ' + data.processed_by : ''}`);

// Update ABANDON text
content = content.replace(/\{data\.status === 'APPROVED' \? 'Abandon pris en compte' : 'Abandon refusé'\}/g,
  `{data.status === 'APPROVED' ? 'Abandon pris en compte' : 'Abandon refusé'} le {formattedUpdatedDate} {data.processed_by ? 'par ' + data.processed_by : ''}`);

// Update TAKE text
content = content.replace(/\{data\.status === 'APPROVED' \? 'Ajout validé' : 'Ajout refusé'\}/g,
  `{data.status === 'APPROVED' ? 'Ajout validé' : 'Ajout refusé'} le {formattedUpdatedDate} {data.processed_by ? 'par ' + data.processed_by : ''}`);


fs.writeFileSync('components/ExchangeRules.tsx', content);
