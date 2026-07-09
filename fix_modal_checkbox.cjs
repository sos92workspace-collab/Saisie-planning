const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const checkboxUI = `
                        </div>
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                id="logInCounter" 
                                checked={logInCounter} 
                                onChange={(e) => setLogInCounter(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="logInCounter" className="text-xs font-bold text-slate-700">Comptabiliser cet ajout dans le compteur du médecin</label>
                        </div>
                        <div className="flex gap-3 pt-2">
`;

content = content.replace(/<\/div>\n                        <div className="flex gap-3 pt-2">/, checkboxUI);

fs.writeFileSync('components/AdminDashboard.tsx', content);
