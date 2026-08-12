import re

with open('components/StandardisteDashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace("onOpenTerms?: () => void;", "onOpenTerms?: () => void;\n  onOpenLegal?: () => void;")
content = content.replace("({ users, supabase, onLogout, currentUserTrigram, activeRound, columnConfigs, globalClosures, onOpenTerms })", "({ users, supabase, onLogout, currentUserTrigram, activeRound, columnConfigs, globalClosures, onOpenTerms, onOpenLegal })")

cgu_btn = """          <button 
            onClick={onOpenTerms}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:bg-blue-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm mb-3"
          >
            <FileText className="w-4 h-4" strokeWidth={2.5} />
            CGU
          </button>"""
legal_btn = """          <button 
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

content = content.replace(cgu_btn, legal_btn)

with open('components/StandardisteDashboard.tsx', 'w') as f:
    f.write(content)
