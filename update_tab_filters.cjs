const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

const newVars = `
  const [tabFilterTrigram, setTabFilterTrigram] = useState<string>('');
  const [tabFilterMonthYear, setTabFilterMonthYear] = useState<string>('');
  const [tabFilterType, setTabFilterType] = useState<string>('');
  const [tabFilterCol, setTabFilterCol] = useState<string>('');
  const [tabFilterReqStart, setTabFilterReqStart] = useState<string>('');
  const [tabFilterReqEnd, setTabFilterReqEnd] = useState<string>('');
  const [tabFilterProcStart, setTabFilterProcStart] = useState<string>('');
  const [tabFilterProcEnd, setTabFilterProcEnd] = useState<string>('');

  useEffect(() => {
    setTabFilterTrigram('');
    setTabFilterMonthYear('');
    setTabFilterType('');
    setTabFilterCol('');
    setTabFilterReqStart('');
    setTabFilterReqEnd('');
    setTabFilterProcStart('');
    setTabFilterProcEnd('');
  }, [activeTab]);
`;

content = content.replace(/const \[tabFilterTrigram, setTabFilterTrigram\] = useState<string>\(''\);[\s\S]*?\}, \[activeTab\]\);/, newVars);

const getAvailableReplace = `
  const getAvailableFilterOptions = () => {
    let trigrams = new Set<string>();
    let monthYears = new Set<string>();
    let types = new Set<string>();
    let cols = new Set<string>();

    if (activeTab === 'REQUESTS') {
        requests.forEach(r => {
            if (r.requester_trigram) trigrams.add(r.requester_trigram);
            if (r.target_month && r.target_year) monthYears.add(r.target_month + '-' + r.target_year);
            if (r.requester_choice?.month && r.requester_choice?.year) monthYears.add(r.requester_choice.month + '-' + r.requester_choice.year);
            if (r.target_col_label) types.add(r.target_col_label);
            if (r.requester_choice?.colLabel) types.add(r.requester_choice.colLabel);
            if (r.target_col !== undefined) cols.add(r.target_col.toString());
            if (r.requester_choice?.col !== undefined) cols.add(r.requester_choice.col.toString());
        });
    } else if (activeTab === 'ABANDONS') {
        abandons.forEach(a => {
            if (a.requester_trigram) trigrams.add(a.requester_trigram);
            let choice = a.requester_choice || a.shift_snapshot;
            if (choice) {
                if (choice.month && choice.year) monthYears.add(choice.month + '-' + choice.year);
                if (choice.colLabel) types.add(choice.colLabel);
                if (choice.col !== undefined) cols.add(choice.col.toString());
            }
        });
    } else if (activeTab === 'TAKES') {
        standaloneTakes.forEach(t => {
            if (t.requester_trigram) trigrams.add(t.requester_trigram);
            if (t.target_month && t.target_year) monthYears.add(t.target_month + '-' + t.target_year);
            if (t.target_col_label) types.add(t.target_col_label);
            if (t.target_col !== undefined) cols.add(t.target_col.toString());
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
        types: Array.from(types).sort(),
        cols: Array.from(cols).sort((a,b) => Number(a) - Number(b))
    };
  };
`;

content = content.replace(/const getAvailableFilterOptions = \(\) => \{[\s\S]*?return \{\n[\s\S]*?trigrams: Array\.from\(trigrams\)\.sort\(\),\n[\s\S]*?monthYears: Array\.from\(monthYears\)\.sort\([\s\S]*?\),\n[\s\S]*?types: Array\.from\(types\)\.sort\(\)\n[\s\S]*?\};\n  \};/, getAvailableReplace);

const applyFiltersReplace = `
  const applyTabFilters = (items: any[], type: 'REQUESTS'|'ABANDONS'|'TAKES') => {
      return items.filter(item => {
          let itemTrigram = '';
          let itemMonthYears = [];
          let itemTypes = [];
          let itemCols = [];
          
          let createdDate = new Date(item.created_at);
          let updatedDate = new Date(item.updated_at || item.created_at);

          if (type === 'REQUESTS') {
              itemTrigram = item.requester_trigram;
              if (item.target_month && item.target_year) itemMonthYears.push(item.target_month + '-' + item.target_year);
              if (item.requester_choice?.month && item.requester_choice?.year) itemMonthYears.push(item.requester_choice.month + '-' + item.requester_choice.year);
              if (item.target_col_label) itemTypes.push(item.target_col_label);
              if (item.requester_choice?.colLabel) itemTypes.push(item.requester_choice.colLabel);
              if (item.target_col !== undefined) itemCols.push(item.target_col.toString());
              if (item.requester_choice?.col !== undefined) itemCols.push(item.requester_choice.col.toString());
          } else if (type === 'ABANDONS') {
              itemTrigram = item.requester_trigram;
              let choice = item.requester_choice || item.shift_snapshot;
              if (choice) {
                  if (choice.month && choice.year) itemMonthYears.push(choice.month + '-' + choice.year);
                  if (choice.colLabel) itemTypes.push(choice.colLabel);
                  if (choice.col !== undefined) itemCols.push(choice.col.toString());
              }
          } else if (type === 'TAKES') {
              itemTrigram = item.requester_trigram;
              if (item.target_month && item.target_year) itemMonthYears.push(item.target_month + '-' + item.target_year);
              if (item.target_col_label) itemTypes.push(item.target_col_label);
              if (item.target_col !== undefined) itemCols.push(item.target_col.toString());
          }

          if (tabFilterTrigram && itemTrigram !== tabFilterTrigram) return false;
          if (tabFilterMonthYear && !itemMonthYears.includes(tabFilterMonthYear)) return false;
          if (tabFilterType && !itemTypes.includes(tabFilterType)) return false;
          if (tabFilterCol && !itemCols.includes(tabFilterCol)) return false;

          if (tabFilterReqStart && createdDate < new Date(tabFilterReqStart)) return false;
          if (tabFilterReqEnd) {
             const e = new Date(tabFilterReqEnd);
             e.setHours(23, 59, 59, 999);
             if (createdDate > e) return false;
          }
          if (tabFilterProcStart && updatedDate < new Date(tabFilterProcStart)) return false;
          if (tabFilterProcEnd) {
             const e = new Date(tabFilterProcEnd);
             e.setHours(23, 59, 59, 999);
             if (updatedDate > e) return false;
          }

          return true;
      });
  };
`;

content = content.replace(/const applyTabFilters = \([\s\S]*?return true;\n      \}\);\n  \};/, applyFiltersReplace);

const renderUIReplace = `
  const renderTabFiltersUI = () => {
      const { trigrams, monthYears, types, cols } = getAvailableFilterOptions();
      return (
          <div className="flex flex-col gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Médecin (Trigramme)</label>
                      <select className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={tabFilterTrigram} onChange={e => setTabFilterTrigram(e.target.value)}>
                          <option value="">Tous les médecins</option>
                          {trigrams.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                  </div>
                  <div className="flex-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Mois/Année de Garde</label>
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
                  <div className="flex-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Numéro de colonne</label>
                      <select className="w-full text-sm p-2 border border-slate-200 rounded-lg uppercase" value={tabFilterCol} onChange={e => setTabFilterCol(e.target.value)}>
                          <option value="">Toutes les colonnes</option>
                          {cols.map(c => <option key={c} value={c}>Col. {c}</option>)}
                      </select>
                  </div>
              </div>
              <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-200">
                  <div className="flex-1 flex gap-2">
                      <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Demande (début)</label>
                          <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={tabFilterReqStart} onChange={e => setTabFilterReqStart(e.target.value)} />
                      </div>
                      <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Demande (fin)</label>
                          <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={tabFilterReqEnd} onChange={e => setTabFilterReqEnd(e.target.value)} />
                      </div>
                  </div>
                  <div className="flex-1 flex gap-2">
                      <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Traitement (début)</label>
                          <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={tabFilterProcStart} onChange={e => setTabFilterProcStart(e.target.value)} />
                      </div>
                      <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Traitement (fin)</label>
                          <input type="date" className="w-full text-sm p-2 border border-slate-200 rounded-lg" value={tabFilterProcEnd} onChange={e => setTabFilterProcEnd(e.target.value)} />
                      </div>
                  </div>
              </div>
          </div>
      );
  };
`;

content = content.replace(/const renderTabFiltersUI = \(\) => \{[\s\S]*?return \([\s\S]*?<\/div>\n      \);\n  \};/, renderUIReplace);

fs.writeFileSync('components/ExchangeRules.tsx', content);
