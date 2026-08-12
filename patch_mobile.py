import re

with open('App.tsx', 'r') as f:
    content = f.read()

old_mobile_logout = """          {exchangeMode === 'INACTIVE' && (
              <>
                  <button onClick={handleLogout} className="p-2 text-slate-300 hover:text-red-500 md:hidden flex items-center gap-2 ml-2"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2 2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5"/></svg></button>
              </>
          )}"""

new_mobile_logout = """          {exchangeMode === 'INACTIVE' && (
              <div className="flex items-center gap-1">
                  <button onClick={() => setIsTermsModalOpen(true)} className="p-2 text-slate-300 hover:text-blue-500 md:hidden flex items-center gap-2 ml-2" title="Conditions Générales d'Utilisation">
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </button>
                  <button onClick={handleLogout} className="p-2 text-slate-300 hover:text-red-500 md:hidden flex items-center gap-2" title="Déconnexion">
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2 2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5"/></svg>
                  </button>
              </div>
          )}"""

content = content.replace(old_mobile_logout, new_mobile_logout)

with open('App.tsx', 'w') as f:
    f.write(content)
