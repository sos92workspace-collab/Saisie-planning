const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// REQUESTS
content = content.replace(/\{requests\.filter\(r => r\.status !== 'PENDING'\)\.sort\(\(a, b\) => new Date\(b\.updated_at \|\| b\.created_at\)\.getTime\(\) - new Date\(a\.updated_at \|\| a\.created_at\)\.getTime\(\)\)\.map\(req => \{\n                  const date = new Date\(req\.updated_at \|\| req\.created_at\)\.toLocaleString\('fr-FR', \{ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' \}\);/g,
  `{requests.filter(r => r.status !== 'PENDING').sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).map(req => {
                  const createdDate = new Date(req.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const updatedDate = new Date(req.updated_at || req.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });`);
                  
content = content.replace(/<span className="text-slate-400 font-mono text-xs mt-1 min-w-\[120px\]">\{date\}<\/span>([\s\S]*?)<span className={`w-fit font-black uppercase text-\[10px\] px-2 py-1 rounded-md \$\{req\.status === 'APPROVED' \? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'\}`}>\n                                \{req\.status === 'APPROVED' \? 'Échange validé' : 'Échange refusé'\}/g,
  `<span className="text-slate-400 font-mono text-xs mt-1 min-w-[120px]">{createdDate}</span>$1<span className={\`w-fit font-black uppercase text-[10px] px-2 py-1 rounded-md \${req.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}\`}>
                                {req.status === 'APPROVED' ? 'Échange validé' : 'Échange refusé'} le {updatedDate} {req.processed_by ? 'par ' + req.processed_by : ''}`);

// ABANDONS
content = content.replace(/\{abandons\.filter\(a => a\.status !== 'PENDING'\)\.sort\(\(a, b\) => new Date\(b\.updated_at \|\| b\.created_at\)\.getTime\(\) - new Date\(a\.updated_at \|\| a\.created_at\)\.getTime\(\)\)\.map\(ab => \{\n                  const date = new Date\(ab\.updated_at \|\| ab\.created_at\)\.toLocaleString\('fr-FR', \{ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' \}\);/g,
  `{abandons.filter(a => a.status !== 'PENDING').sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).map(ab => {
                  const createdDate = new Date(ab.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const updatedDate = new Date(ab.updated_at || ab.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });`);
                  
content = content.replace(/<span className="text-slate-400 font-mono text-xs mt-1 min-w-\[120px\]">\{date\}<\/span>([\s\S]*?)<span className={`w-fit font-black uppercase text-\[10px\] px-2 py-1 rounded-md \$\{ab\.status === 'APPROVED' \? 'bg-rose-100 text-rose-700' : 'bg-red-100 text-red-700'\}`}>\n                                \{ab\.status === 'APPROVED' \? 'Abandon pris en compte' : 'Abandon refusé'\}/g,
  `<span className="text-slate-400 font-mono text-xs mt-1 min-w-[120px]">{createdDate}</span>$1<span className={\`w-fit font-black uppercase text-[10px] px-2 py-1 rounded-md \${ab.status === 'APPROVED' ? 'bg-rose-100 text-rose-700' : 'bg-red-100 text-red-700'}\`}>
                                {ab.status === 'APPROVED' ? 'Abandon pris en compte' : 'Abandon refusé'} le {updatedDate} {ab.processed_by ? 'par ' + ab.processed_by : ''}`);


// TAKES
content = content.replace(/\{standaloneTakes\.filter\(t => t\.status !== 'PENDING'\)\.sort\(\(a, b\) => new Date\(b\.updated_at \|\| b\.created_at\)\.getTime\(\) - new Date\(a\.updated_at \|\| a\.created_at\)\.getTime\(\)\)\.map\(tk => \{\n                  const date = new Date\(tk\.updated_at \|\| tk\.created_at\)\.toLocaleString\('fr-FR', \{ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' \}\);/g,
  `{standaloneTakes.filter(t => t.status !== 'PENDING').sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).map(tk => {
                  const createdDate = new Date(tk.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const updatedDate = new Date(tk.updated_at || tk.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });`);

content = content.replace(/<span className="text-slate-400 font-mono text-xs mt-1 min-w-\[120px\]">\{date\}<\/span>([\s\S]*?)<span className={`w-fit font-black uppercase text-\[10px\] px-2 py-1 rounded-md \$\{tk\.status === 'APPROVED' \? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'\}`}>\n                                \{tk\.status === 'APPROVED' \? 'Ajout validé' : 'Ajout refusé'\}/g,
  `<span className="text-slate-400 font-mono text-xs mt-1 min-w-[120px]">{createdDate}</span>$1<span className={\`w-fit font-black uppercase text-[10px] px-2 py-1 rounded-md \${tk.status === 'APPROVED' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}\`}>
                                {tk.status === 'APPROVED' ? 'Ajout validé' : 'Ajout refusé'} le {updatedDate} {tk.processed_by ? 'par ' + tk.processed_by : ''}`);


fs.writeFileSync('components/ExchangeRules.tsx', content);
