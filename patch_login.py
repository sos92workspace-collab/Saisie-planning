import re

with open('App.tsx', 'r') as f:
    content = f.read()

# 1. Modify the login form buttons
old_login_buttons = """          <div className="flex flex-col gap-5 items-center mt-6">
            <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all text-sm outline-none focus:ring-4 focus:ring-slate-900/20">Saisie via Planning</button>
            <button type="button" onClick={(e) => handleLogin(e, ViewMode.LIST_INPUT)} className="text-[11px] font-bold text-slate-400 hover:text-slate-700 underline transition-colors uppercase tracking-widest outline-none focus:text-slate-700">Saisie via Liste (Téléphone)</button>
            <button type="button" onClick={() => setIsTermsModalOpen(true)} className="text-[10px] font-medium text-slate-400 hover:text-slate-700 underline transition-colors">Conditions Générales d'Utilisation (CGU)</button>
            <button type="button" onClick={() => setIsLegalModalOpen(true)} className="text-[10px] font-medium text-slate-400 hover:text-slate-700 underline transition-colors">Mentions légales</button>
          </div>"""

new_login_buttons = """          <div className="flex flex-col gap-5 items-center mt-6">
            <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all text-sm outline-none focus:ring-4 focus:ring-slate-900/20">Connexion</button>
            <button type="button" onClick={() => setIsTermsModalOpen(true)} className="text-[10px] font-medium text-slate-400 hover:text-slate-700 underline transition-colors">Conditions Générales d'Utilisation (CGU)</button>
            <button type="button" onClick={() => setIsLegalModalOpen(true)} className="text-[10px] font-medium text-slate-400 hover:text-slate-700 underline transition-colors">Mentions légales</button>
          </div>"""

content = content.replace(old_login_buttons, new_login_buttons)

with open('App.tsx', 'w') as f:
    f.write(content)
