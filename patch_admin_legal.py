import re

with open('components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace("onOpenTerms?: () => void;", "onOpenTerms?: () => void;\n  onOpenLegal?: () => void;")
content = content.replace("({ users, setUsers, rounds, setRounds, supabase, onLogout, currentUserTrigram, onOpenTerms })", "({ users, setUsers, rounds, setRounds, supabase, onLogout, currentUserTrigram, onOpenTerms, onOpenLegal })")

desktop_cgu = """            <button onClick={onOpenTerms} className={`w-full p-3 lg:py-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="CGU">
                <span className={isSidebarCollapsed ? '' : 'lg:hidden'}>📄</span>
                {!isSidebarCollapsed && <span className="hidden lg:inline">CGU</span>}
            </button>"""
desktop_legal = """            <button onClick={onOpenTerms} className={`w-full p-3 lg:py-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="CGU">
                <span className={isSidebarCollapsed ? '' : 'lg:hidden'}>📄</span>
                {!isSidebarCollapsed && <span className="hidden lg:inline">CGU</span>}
            </button>
            <button onClick={onOpenLegal} className={`w-full p-3 lg:py-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="Mentions légales">
                <span className={isSidebarCollapsed ? '' : 'lg:hidden'}>⚖️</span>
                {!isSidebarCollapsed && <span className="hidden lg:inline">Légal</span>}
            </button>"""
content = content.replace(desktop_cgu, desktop_legal)

mobile_cgu = """                  <button onClick={() => { onOpenTerms?.(); setIsMobileMenuOpen(false); }} className="w-full p-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-2">
                      <span>📄 CGU</span>
                  </button>"""
mobile_legal = """                  <button onClick={() => { onOpenTerms?.(); setIsMobileMenuOpen(false); }} className="w-full p-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-2">
                      <span>📄 CGU</span>
                  </button>
                  <button onClick={() => { onOpenLegal?.(); setIsMobileMenuOpen(false); }} className="w-full p-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-2">
                      <span>⚖️ Mentions légales</span>
                  </button>"""
content = content.replace(mobile_cgu, mobile_legal)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
