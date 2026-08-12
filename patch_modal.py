import re

with open('components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

old_block = """                    <button onClick={() => setDeleteMode('ALL')} className={`w-full p-4 border-2 rounded-2xl transition-all ${deleteMode === 'ALL' ? 'border-red-500 bg-red-50' : 'border-slate-100'}`}>
                        <span className="block text-sm font-black uppercase text-red-600">Réinitialiser la base de données</span>
                        <span className="block text-[10px] font-bold text-red-400 mt-1">Supprime TOUS les choix et indisponibilités (les fermetures sont conservées)</span>
                    </button>"""

new_block = """                    <button onClick={() => setDeleteMode('ALL')} className={`w-full p-4 border-2 rounded-2xl transition-all ${deleteMode === 'ALL' ? 'border-red-500 bg-red-50' : 'border-slate-100'}`}>
                        <span className="block text-sm font-black uppercase text-red-600">Réinitialiser la base de données</span>
                        <span className="block text-[10px] font-bold text-red-400 mt-1">Sélectionnez les données à supprimer</span>
                    </button>

                    {deleteMode === 'ALL' && (
                        <div className="flex flex-col gap-2 pl-4 animate-in slide-in-from-top-2">
                            <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                <input type="checkbox" className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                                    checked={resetOptions.choicesDoctors}
                                    onChange={(e) => setResetOptions(prev => ({ ...prev, choicesDoctors: e.target.checked }))}
                                />
                                <span className="text-[10px] font-black uppercase text-slate-700">Choix Médecins (Titulaires & Remplaçants)</span>
                            </label>
                            
                            <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                <input type="checkbox" className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                                    checked={resetOptions.choicesStandardists}
                                    onChange={(e) => setResetOptions(prev => ({ ...prev, choicesStandardists: e.target.checked }))}
                                />
                                <span className="text-[10px] font-black uppercase text-slate-700">Choix Standardistes</span>
                            </label>
                            
                            <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                <input type="checkbox" className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                                    checked={resetOptions.unavailabilities}
                                    onChange={(e) => setResetOptions(prev => ({ ...prev, unavailabilities: e.target.checked }))}
                                />
                                <span className="text-[10px] font-black uppercase text-slate-700">Indisponibilités</span>
                            </label>
                            
                            <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                <input type="checkbox" className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                                    checked={resetOptions.globalClosures}
                                    onChange={(e) => setResetOptions(prev => ({ ...prev, globalClosures: e.target.checked }))}
                                />
                                <span className="text-[10px] font-black uppercase text-slate-700">Fermetures de cases</span>
                            </label>
                        </div>
                    )}"""

content = content.replace(old_block, new_block)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
