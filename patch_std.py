import re

with open('components/StandardisteDashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace("onLogout: () => void;", "onLogout: () => void;\n  onOpenTerms?: () => void;")
content = content.replace("({ users, supabase, onLogout, currentUserTrigram, activeRound, columnConfigs, globalClosures })", "({ users, supabase, onLogout, currentUserTrigram, activeRound, columnConfigs, globalClosures, onOpenTerms })")

logout_btn = """          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" strokeWidth={2.5} />
            Déconnexion
          </button>"""

cgu_btn = """          <button 
            onClick={onOpenTerms}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:bg-blue-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm mb-3"
          >
            <FileText className="w-4 h-4" strokeWidth={2.5} />
            CGU
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" strokeWidth={2.5} />
            Déconnexion
          </button>"""

content = content.replace(logout_btn, cgu_btn)

with open('components/StandardisteDashboard.tsx', 'w') as f:
    f.write(content)
