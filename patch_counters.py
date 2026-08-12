import re

with open('components/ExchangeRules.tsx', 'r') as f:
    content = f.read()

# Add new states
state_addition = """  const [counterStartDate, setCounterStartDate] = useState<string>('');
  const [counterEndDate, setCounterEndDate] = useState<string>('');
"""
content = content.replace("const [usersState, setUsersState] = useState<any[]>([]);", state_addition + "  const [usersState, setUsersState] = useState<any[]>([]);")

# Add the new tab button
tab_btn_old = """          {!isStandardist && (
          <button 
            onClick={() => setActiveTab('RULES')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all border-none whitespace-nowrap ${activeTab === 'RULES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Règles d'équivalence
          </button>
          )}"""
tab_btn_new = """          {!isStandardist && (
            <>
              <button 
                onClick={() => setActiveTab('COMPTEURS')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all border-none whitespace-nowrap ${activeTab === 'COMPTEURS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Compteurs
              </button>
              <button 
                onClick={() => setActiveTab('RULES')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all border-none whitespace-nowrap ${activeTab === 'RULES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Règles d'équivalence
              </button>
            </>
          )}"""
content = content.replace(tab_btn_old, tab_btn_new)
content = content.replace("useState<'RULES' | 'REQUESTS' | 'ABANDONS' | 'TAKES' | 'HISTORIQUE'>('REQUESTS')", "useState<'RULES' | 'REQUESTS' | 'ABANDONS' | 'TAKES' | 'HISTORIQUE' | 'COMPTEURS'>('REQUESTS')")

# Remove the Compteur blocks from REQUESTS, ABANDONS, TAKES
# Since they are large, we can use regex
content = re.sub(r'\{\/\* Compteur Medecin \(Exchanges\) \*\/\}.*?\{\/\* Pending Requests \*\/\}.*?\<div\>', '{/* Pending Requests */}\n          <div>', content, flags=re.DOTALL)
content = re.sub(r'\{\/\* Compteur Medecin \*\/\}.*?\{\/\* Pending Requests \*\/\}.*?\<div\>', '{/* Pending Requests */}\n          <div>', content, flags=re.DOTALL)
content = re.sub(r'\{\/\* Compteur Medecin \(Takes\) \*\/\}.*?\{\/\* Pending Requests \*\/\}.*?\<div\>', '{/* Pending Requests */}\n          <div>', content, flags=re.DOTALL)

with open('components/ExchangeRules.tsx', 'w') as f:
    f.write(content)
