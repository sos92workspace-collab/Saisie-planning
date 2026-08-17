import re

with open('App.tsx', 'r') as f:
    content = f.read()

login_old = """            <button type="button" onClick={() => setIsTermsModalOpen(true)} className="text-[10px] font-medium text-slate-400 hover:text-slate-700 underline transition-colors">Conditions Générales d'Utilisation (CGU)</button>
            <button type="button" onClick={() => setIsLegalModalOpen(true)} className="text-[10px] font-medium text-slate-400 hover:text-slate-700 underline transition-colors">Mentions légales</button>"""

if login_old in content:
    content = content.replace(login_old, "")
else:
    print("login_old not found")

with open('App.tsx', 'w') as f:
    f.write(content)
