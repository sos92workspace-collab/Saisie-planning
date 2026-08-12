import re

with open('App.tsx', 'r') as f:
    content = f.read()

# Add import
if "import { TermsModal }" not in content:
    content = content.replace("import { HistoryModal } from './components/HistoryModal';", "import { HistoryModal } from './components/HistoryModal';\nimport { TermsModal } from './components/TermsModal';")

# Add state
if "const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);" not in content:
    content = content.replace("const [showHistoryModal, setShowHistoryModal] = useState(false);", "const [showHistoryModal, setShowHistoryModal] = useState(false);\n  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);")

# Add to login view
login_links = """          <div className="flex flex-col gap-5 items-center mt-6">
            <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all text-sm outline-none focus:ring-4 focus:ring-slate-900/20">Saisie via Planning</button>
            <button type="button" onClick={(e) => handleLogin(e, ViewMode.LIST_INPUT)} className="text-[11px] font-bold text-slate-400 hover:text-slate-700 underline transition-colors uppercase tracking-widest outline-none focus:text-slate-700">Saisie via Liste (Téléphone)</button>
            <button type="button" onClick={() => setIsTermsModalOpen(true)} className="text-[10px] font-medium text-slate-400 hover:text-slate-700 underline transition-colors">Conditions Générales d'Utilisation (CGU)</button>
          </div>"""
content = re.sub(r'<div className="flex flex-col gap-5 items-center mt-6">.*?</form>', login_links + '\n        </form>', content, flags=re.DOTALL)

# Add TermsModal component at the end of the return statement
# just before the closing </div> of the app
modal_content = """      {/* Chat Assistant */}
      <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />"""
content = content.replace("{/* Chat Assistant */}", modal_content)

with open('App.tsx', 'w') as f:
    f.write(content)
