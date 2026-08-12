import re

with open('components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace("onLogout: () => void;", "onLogout: () => void;\n  onOpenTerms?: () => void;")
content = content.replace("({ users, setUsers, rounds, setRounds, supabase, onLogout, currentUserTrigram })", "({ users, setUsers, rounds, setRounds, supabase, onLogout, currentUserTrigram, onOpenTerms })")

desktop_logout = """            <button onClick={onLogout} className={`w-full p-3 lg:py-3 bg-slate-800 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="Déconnexion">"""
desktop_cgu = """            <button onClick={onOpenTerms} className={`w-full p-3 lg:py-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="CGU">
                <span className={isSidebarCollapsed ? '' : 'lg:hidden'}>📄</span>
                {!isSidebarCollapsed && <span className="hidden lg:inline">CGU</span>}
            </button>
            <button onClick={onLogout} className={`w-full p-3 lg:py-3 bg-slate-800 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="Déconnexion">"""

content = content.replace(desktop_logout, desktop_cgu)

mobile_logout = """                  <button onClick={onLogout} className="w-full p-3 bg-slate-800 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-2">"""
mobile_cgu = """                  <button onClick={() => { onOpenTerms?.(); setIsMobileMenuOpen(false); }} className="w-full p-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-2">
                      <span>📄 CGU</span>
                  </button>
                  <button onClick={onLogout} className="w-full p-3 bg-slate-800 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-2">"""

content = content.replace(mobile_logout, mobile_cgu)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
