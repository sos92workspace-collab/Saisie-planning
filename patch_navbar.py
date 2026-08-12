import re

with open('App.tsx', 'r') as f:
    content = f.read()

# Add a button in the main desktop navigation bar
old_quit = """                  <div className="w-px h-6 bg-slate-200 mx-2"></div>
                  
                  <button onClick={handleLogout} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors shadow-sm flex items-center gap-2" title="Déconnexion">
                      <span className="text-[10px] font-black uppercase">Quitter</span>"""

new_quit = """                  <div className="w-px h-6 bg-slate-200 mx-2"></div>

                  <button onClick={() => setIsTermsModalOpen(true)} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2" title="Conditions Générales d'Utilisation">
                      <span className="text-[10px] font-black uppercase">CGU</span>
                  </button>
                  
                  <button onClick={handleLogout} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors shadow-sm flex items-center gap-2" title="Déconnexion">
                      <span className="text-[10px] font-black uppercase">Quitter</span>"""

content = content.replace(old_quit, new_quit)

with open('App.tsx', 'w') as f:
    f.write(content)
