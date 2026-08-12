import re

with open('App.tsx', 'r') as f:
    content = f.read()

# 1. Import LegalModal
content = content.replace(
    "import { TermsModal } from './components/TermsModal';",
    "import { TermsModal } from './components/TermsModal';\nimport { LegalModal } from './components/LegalModal';"
)

# 2. Add state
content = content.replace(
    "const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);",
    "const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);\n  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);"
)

# 3. Add to login view
login_links = """          <div className="flex flex-col gap-5 items-center mt-6">
            <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all text-sm outline-none focus:ring-4 focus:ring-slate-900/20">Saisie via Planning</button>
            <button type="button" onClick={(e) => handleLogin(e, ViewMode.LIST_INPUT)} className="text-[11px] font-bold text-slate-400 hover:text-slate-700 underline transition-colors uppercase tracking-widest outline-none focus:text-slate-700">Saisie via Liste (Téléphone)</button>
            <button type="button" onClick={() => setIsTermsModalOpen(true)} className="text-[10px] font-medium text-slate-400 hover:text-slate-700 underline transition-colors">Conditions Générales d'Utilisation (CGU)</button>
            <button type="button" onClick={() => setIsLegalModalOpen(true)} className="text-[10px] font-medium text-slate-400 hover:text-slate-700 underline transition-colors">Mentions légales</button>
          </div>"""
content = re.sub(r'<div className="flex flex-col gap-5 items-center mt-6">.*?</form>', login_links + '\n        </form>', content, flags=re.DOTALL)

# 4. Add to AdminDashboard and StandardisteDashboard props
content = content.replace(
    "onOpenTerms={() => setIsTermsModalOpen(true)} />",
    "onOpenTerms={() => setIsTermsModalOpen(true)} onOpenLegal={() => setIsLegalModalOpen(true)} />"
)

# 5. Add to Desktop navbar (around line 1868)
old_desktop_cgu = """                  <button onClick={() => setIsTermsModalOpen(true)} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2" title="Conditions Générales d'Utilisation">
                      <span className="text-[10px] font-black uppercase">CGU</span>
                  </button>"""
new_desktop_cgu = """                  <button onClick={() => setIsTermsModalOpen(true)} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2" title="Conditions Générales d'Utilisation">
                      <span className="text-[10px] font-black uppercase">CGU</span>
                  </button>
                  <button onClick={() => setIsLegalModalOpen(true)} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2" title="Mentions légales">
                      <span className="text-[10px] font-black uppercase">Légal</span>
                  </button>"""
content = content.replace(old_desktop_cgu, new_desktop_cgu)

# 6. Add to Mobile navbar (around line 2018)
old_mobile_cgu = """                  <button onClick={() => setIsTermsModalOpen(true)} className="p-2 text-slate-300 hover:text-blue-500 md:hidden flex items-center gap-2 ml-2" title="Conditions Générales d'Utilisation">
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </button>"""
new_mobile_cgu = """                  <button onClick={() => setIsTermsModalOpen(true)} className="p-2 text-slate-300 hover:text-blue-500 md:hidden flex items-center gap-2 ml-2" title="Conditions Générales d'Utilisation">
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </button>
                  <button onClick={() => setIsLegalModalOpen(true)} className="p-2 text-slate-300 hover:text-blue-500 md:hidden flex items-center gap-2" title="Mentions légales">
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  </button>"""
content = content.replace(old_mobile_cgu, new_mobile_cgu)

# 7. Render LegalModal
content = content.replace(
    "<TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />",
    "<TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />\n      <LegalModal isOpen={isLegalModalOpen} onClose={() => setIsLegalModalOpen(false)} />"
)

with open('App.tsx', 'w') as f:
    f.write(content)

