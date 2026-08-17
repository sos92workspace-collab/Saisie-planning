import re

with open('App.tsx', 'r') as f:
    content = f.read()

app_old = """                  <button onClick={() => setIsTermsModalOpen(true)} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2" title="Conditions Générales d'Utilisation">
                      <span className="text-[10px] font-black uppercase">CGU</span>
                  </button>
                  <button onClick={() => setIsLegalModalOpen(true)} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2" title="Mentions légales">
                      <span className="text-[10px] font-black uppercase">Légal</span>
                  </button>"""

if app_old in content:
    content = content.replace(app_old, "")
else:
    print("app_old not found")

with open('App.tsx', 'w') as f:
    f.write(content)

with open('components/StandardisteDashboard.tsx', 'r') as f:
    content_sd = f.read()

sd_old = """          <button 
            onClick={onOpenTerms}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:bg-blue-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm mb-3"
          >
            <FileText className="w-4 h-4" strokeWidth={2.5} />
            CGU
          </button>
          <button 
            onClick={onOpenLegal}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:bg-blue-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm mb-3"
          >
            <Shield className="w-4 h-4" strokeWidth={2.5} />
            Légal
          </button>"""

if sd_old in content_sd:
    content_sd = content_sd.replace(sd_old, "")
else:
    print("sd_old not found")

with open('components/StandardisteDashboard.tsx', 'w') as f:
    f.write(content_sd)
