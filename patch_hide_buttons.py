import re

with open('components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Desktop sidebar buttons
desktop_old = """            <button onClick={onOpenTerms} className={`w-full p-3 lg:py-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="CGU">
                <span className={isSidebarCollapsed ? '' : 'lg:hidden'}>📄</span>
                {!isSidebarCollapsed && <span className="hidden lg:inline">CGU</span>}
            </button>
            <button onClick={onOpenLegal} className={`w-full p-3 lg:py-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:block'}`} title="Mentions légales">
                <span className={isSidebarCollapsed ? '' : 'lg:hidden'}>⚖️</span>
                {!isSidebarCollapsed && <span className="hidden lg:inline">Légal</span>}
            </button>"""

if desktop_old in content:
    content = content.replace(desktop_old, "")
else:
    print("Desktop old not found")

# Mobile menu buttons
mobile_old = """                  <button onClick={() => { onOpenTerms?.(); setIsMobileMenuOpen(false); }} className="w-full p-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-2">
                      <span>📄 CGU</span>
                  </button>
                  <button onClick={() => { onOpenLegal?.(); setIsMobileMenuOpen(false); }} className="w-full p-3 bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-2">
                      <span>⚖️ Mentions légales</span>
                  </button>"""

if mobile_old in content:
    content = content.replace(mobile_old, "")
else:
    print("Mobile old not found")

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
