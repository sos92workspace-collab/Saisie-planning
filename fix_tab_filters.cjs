const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// Inject state variables
const stateVars = `
  const [tabFilterTrigram, setTabFilterTrigram] = useState<string>('');
  const [tabFilterMonthYear, setTabFilterMonthYear] = useState<string>('');
  const [tabFilterType, setTabFilterType] = useState<string>('');

  useEffect(() => {
    setTabFilterTrigram('');
    setTabFilterMonthYear('');
    setTabFilterType('');
  }, [activeTab]);

  const getAvailableFilterOptions = () => {
    let trigrams = new Set<string>();
    let monthYears = new Set<string>();
    let types = new Set<string>();

    if (activeTab === 'REQUESTS') {
        requests.forEach(r => {
            if (r.requester_trigram) trigrams.add(r.requester_trigram);
            if (r.target_month && r.target_year) monthYears.add(r.target_month + '-' + r.target_year);
            if (r.requester_choice?.month && r.requester_choice?.year) monthYears.add(r.requester_choice.month + '-' + r.requester_choice.year);
            if (r.target_col_label) types.add(r.target_col_label);
            if (r.requester_choice?.colLabel) types.add(r.requester_choice.colLabel);
        });
    } else if (activeTab === 'ABANDONS') {
        abandons.forEach(a => {
            if (a.requester_trigram) trigrams.add(a.requester_trigram);
            let choice = a.requester_choice || a.shift_snapshot;
            if (choice) {
                if (choice.month && choice.year) monthYears.add(choice.month + '-' + choice.year);
                if (choice.colLabel) types.add(choice.colLabel);
            }
        });
    } else if (activeTab === 'TAKES') {
        standaloneTakes.forEach(t => {
            if (t.requester_trigram) trigrams.add(t.requester_trigram);
            if (t.target_month && t.target_year) monthYears.add(t.target_month + '-' + t.target_year);
            if (t.target_col_label) types.add(t.target_col_label);
        });
    }
    
    return {
        trigrams: Array.from(trigrams).sort(),
        monthYears: Array.from(monthYears).sort((a,b) => {
           const [ma, ya] = a.split('-').map(Number);
           const [mb, yb] = b.split('-').map(Number);
           if (ya !== yb) return ya - yb;
           return ma - mb;
        }),
        types: Array.from(types).sort()
    };
  };

  const applyTabFilters = (items: any[], type: 'REQUESTS'|'ABANDONS'|'TAKES') => {
      return items.filter(item => {
          let itemTrigram = '';
          let itemMonthYears = [];
          let itemTypes = [];

          if (type === 'REQUESTS') {
              itemTrigram = item.requester_trigram;
              if (item.target_month && item.target_year) itemMonthYears.push(item.target_month + '-' + item.target_year);
              if (item.requester_choice?.month && item.requester_choice?.year) itemMonthYears.push(item.requester_choice.month + '-' + item.requester_choice.year);
              if (item.target_col_label) itemTypes.push(item.target_col_label);
              if (item.requester_choice?.colLabel) itemTypes.push(item.requester_choice.colLabel);
          } else if (type === 'ABANDONS') {
              itemTrigram = item.requester_trigram;
              let choice = item.requester_choice || item.shift_snapshot;
              if (choice) {
                  if (choice.month && choice.year) itemMonthYears.push(choice.month + '-' + choice.year);
                  if (choice.colLabel) itemTypes.push(choice.colLabel);
              }
          } else if (type === 'TAKES') {
              itemTrigram = item.requester_trigram;
              if (item.target_month && item.target_year) itemMonthYears.push(item.target_month + '-' + item.target_year);
              if (item.target_col_label) itemTypes.push(item.target_col_label);
          }

          if (tabFilterTrigram && itemTrigram !== tabFilterTrigram) return false;
          if (tabFilterMonthYear && !itemMonthYears.includes(tabFilterMonthYear)) return false;
          if (tabFilterType && !itemTypes.includes(tabFilterType)) return false;

          return true;
      });
  };

  const renderTabFiltersUI = () => {
      const { trigrams, monthYears, types } = getAvailableFilterOptions();
      return (
          <div className="flex flex-col md:flex-row gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Médecin (Trigramme)</label>
                  <select className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={tabFilterTrigram} onChange={e => setTabFilterTrigram(e.target.value)}>
                      <option value="">Tous les médecins</option>
                      {trigrams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
              </div>
              <div className="flex-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Mois/Année</label>
                  <select className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={tabFilterMonthYear} onChange={e => setTabFilterMonthYear(e.target.value)}>
                      <option value="">Tous les mois</option>
                      {monthYears.map(m => {
                          const [mm, yy] = m.split('-');
                          const date = new Date(parseInt(yy), parseInt(mm) - 1, 1);
                          return <option key={m} value={m}>{date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</option>
                      })}
                  </select>
              </div>
              <div className="flex-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Type de garde</label>
                  <select className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={tabFilterType} onChange={e => setTabFilterType(e.target.value)}>
                      <option value="">Tous les types</option>
                      {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
              </div>
          </div>
      );
  };
`;

content = content.replace(/const \[activeTab, setActiveTab\] = useState[^;]+;/g, "const [activeTab, setActiveTab] = useState<'RULES' | 'REQUESTS' | 'ABANDONS' | 'TAKES' | 'HISTORIQUE'>('REQUESTS');\n" + stateVars);

// Now apply filters in the render

// REQUESTS
content = content.replace(/\{requests\.filter\(r => r\.status === 'PENDING'\)\.length === 0/g, "{applyTabFilters(requests, 'REQUESTS').filter(r => r.status === 'PENDING').length === 0");
content = content.replace(/\{requests\.filter\(r => r\.status === 'PENDING'\)\.sort/g, "{applyTabFilters(requests, 'REQUESTS').filter(r => r.status === 'PENDING').sort");
content = content.replace(/\{requests\.filter\(r => r\.status !== 'PENDING'\)\.length === 0/g, "{applyTabFilters(requests, 'REQUESTS').filter(r => r.status !== 'PENDING').length === 0");
content = content.replace(/\{requests\.filter\(r => r\.status !== 'PENDING'\)\.sort/g, "{applyTabFilters(requests, 'REQUESTS').filter(r => r.status !== 'PENDING').sort");

// ABANDONS
content = content.replace(/\{abandons\.filter\(a => a\.status === 'PENDING'\)\.length === 0/g, "{applyTabFilters(abandons, 'ABANDONS').filter(a => a.status === 'PENDING').length === 0");
content = content.replace(/\{abandons\.filter\(a => a\.status === 'PENDING'\)\.sort/g, "{applyTabFilters(abandons, 'ABANDONS').filter(a => a.status === 'PENDING').sort");
content = content.replace(/\{abandons\.filter\(a => a\.status !== 'PENDING'\)\.length === 0/g, "{applyTabFilters(abandons, 'ABANDONS').filter(a => a.status !== 'PENDING').length === 0");
content = content.replace(/\{abandons\.filter\(a => a\.status !== 'PENDING'\)\.sort/g, "{applyTabFilters(abandons, 'ABANDONS').filter(a => a.status !== 'PENDING').sort");

// TAKES
content = content.replace(/\{standaloneTakes\.filter\(t => t\.status === 'PENDING'\)\.length === 0/g, "{applyTabFilters(standaloneTakes, 'TAKES').filter(t => t.status === 'PENDING').length === 0");
content = content.replace(/\{standaloneTakes\.filter\(t => t\.status === 'PENDING'\)\.sort/g, "{applyTabFilters(standaloneTakes, 'TAKES').filter(t => t.status === 'PENDING').sort");
content = content.replace(/\{standaloneTakes\.filter\(t => t\.status !== 'PENDING'\)\.length === 0/g, "{applyTabFilters(standaloneTakes, 'TAKES').filter(t => t.status !== 'PENDING').length === 0");
content = content.replace(/\{standaloneTakes\.filter\(t => t\.status !== 'PENDING'\)\.sort/g, "{applyTabFilters(standaloneTakes, 'TAKES').filter(t => t.status !== 'PENDING').sort");


// Insert renderTabFiltersUI() right after {activeTab === 'X' && ( ... )}

content = content.replace(/\{activeTab === 'REQUESTS' && \(\n        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">/g, 
`{activeTab === 'REQUESTS' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">
          {renderTabFiltersUI()}`);

content = content.replace(/\{activeTab === 'ABANDONS' && \(\n        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">/g, 
`{activeTab === 'ABANDONS' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">
          {renderTabFiltersUI()}`);

content = content.replace(/\{activeTab === 'TAKES' && \(\n        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">/g, 
`{activeTab === 'TAKES' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">
          {renderTabFiltersUI()}`);

fs.writeFileSync('components/ExchangeRules.tsx', content);
