const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const regex = /const PenaltiesPanel = \(\{ supabase, logAction \}: any\) => \{[\s\S]*?const LogsTabPanel/m;

const replacement = `const PenaltiesPanel = ({ supabase, logAction, columnConfigs }: any) => {
  const [penalties, setPenalties] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedPenalties, setAppliedPenalties] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [counterResetDate, setCounterResetDate] = useState<Date>(new Date(0));
  const [expandedUserTrigram, setExpandedUserTrigram] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchPenalties = async () => {
      try {
        const { data, error: fetchError } = await supabase.from('abandon_penalties').select('*');
        if (fetchError) throw fetchError;
        if (data && data.length > 0) {
            setPenalties(data);
        } else {
            const defaults = [
                { delay_category: 'MORE_THAN_48H', penalty_amount: 0 },
                { delay_category: 'BETWEEN_6H_AND_48H', penalty_amount: 30 },
                { delay_category: 'LESS_THAN_6H', penalty_amount: 50 }
            ];
            const { data: inserted, error: insertError } = await supabase.from('abandon_penalties').insert(defaults).select('*');
            if (insertError) throw insertError;
            setPenalties(inserted);
        }

        const { data: usersData } = await supabase.from('users').select('*');
        if (usersData) setUsers(usersData);

        const { data: logsData } = await supabase.from('logs').select('created_at').eq('action', 'RESET_PENALTIES_COUNTER').order('created_at', { ascending: false }).limit(1);
        if (logsData && logsData.length > 0) {
          setCounterResetDate(new Date(logsData[0].created_at));
        } else {
          setCounterResetDate(new Date(0));
        }

        const { data: applied } = await supabase.from('applied_penalties').select('*, abandon_request:abandon_requests(*)');
        const { data: abandons } = await supabase.from('abandon_requests').select('*, requester_choice:choices!choice_id(*)').eq('status', 'APPROVED');
        
        const toInsert = [];
        if (abandons) {
          for (const req of abandons) {
            const isAlreadyApplied = applied?.some(p => p.abandon_request_id === req.id);
            if (isAlreadyApplied) continue;

            const shiftDate = new Date(req.shift_snapshot ? req.shift_snapshot.year : req.requester_choice.year, req.shift_snapshot ? req.shift_snapshot.month - 1 : req.requester_choice.month - 1, req.shift_snapshot ? req.shift_snapshot.row : req.requester_choice.row);
            const abandonDate = new Date(req.created_at);
            const delayHours = (shiftDate.getTime() - abandonDate.getTime()) / (1000 * 60 * 60);

            let category = 'MORE_THAN_48H';
            if (delayHours < 6) category = 'LESS_THAN_6H';
            else if (delayHours < 48) category = 'BETWEEN_6H_AND_48H';

            let amount = 0;
            if (data && data.length > 0) {
                const penaltyConfig = data.find(p => p.delay_category === category);
                if (penaltyConfig) amount = penaltyConfig.penalty_amount;
            }

            toInsert.push({
                abandon_request_id: req.id,
                user_trigram: req.requester_trigram,
                shift_date: shiftDate.toISOString(),
                abandon_date: abandonDate.toISOString(),
                delay_hours: delayHours,
                penalty_amount: amount,
                penalty_category: category
            });
          }
        }
        
        if (toInsert.length > 0) {
            await supabase.from('applied_penalties').insert(toInsert);
            const { data: finalApplied } = await supabase.from('applied_penalties').select('*, abandon_request:abandon_requests(*, requester_choice:choices!choice_id(*))');
            setAppliedPenalties(finalApplied || []);
        } else {
            const { data: finalApplied } = await supabase.from('applied_penalties').select('*, abandon_request:abandon_requests(*, requester_choice:choices!choice_id(*))');
            setAppliedPenalties(finalApplied || []);
        }
      } catch (e) {
          console.error("Error syncing applied penalties", e);
      }
    };
    fetchPenalties();
  }, [supabase]);

  const handleAmountChange = (id: number, amount: string) => {
    setPenalties(prev => prev.map(p => p.id === id ? { ...p, penalty_amount: amount } : p));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const penalty of penalties) {
      await supabase.from('abandon_penalties').update({ penalty_amount: parseFloat(penalty.penalty_amount) || 0 }).eq('id', penalty.id);
    }
    logAction('PENALTIES_UPDATE', "Mise à jour des pénalités d'abandon");
    setSaving(false);
    alert('Pénalités enregistrées avec succès.');
  };

  const handleResetCounter = async () => {
    const adminUser = users.find(u => u.role === 'ADMIN');
    if (!adminUser) return alert("Utilisateur admin non trouvé.");
    
    const pwd = window.prompt("Pour réinitialiser le compteur des pénalités, veuillez saisir le mot de passe administrateur :");
    if (pwd === null) return;
    if (pwd !== adminUser.password) return alert("Mot de passe incorrect.");
    
    try {
      const { error } = await supabase.from('logs').insert([{ action: 'RESET_PENALTIES_COUNTER', details: {} }]);
      if (error) throw error;
      setCounterResetDate(new Date());
      alert("Compteur réinitialisé avec succès.");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la réinitialisation.");
    }
  };

  const getLabel = (category: string) => {
    switch(category) {
      case 'MORE_THAN_48H': return 'Abandon supérieur à 48 heures';
      case 'BETWEEN_6H_AND_48H': return 'Abandon entre 48h et 6h avant la garde';
      case 'LESS_THAN_6H': return 'Abandon inférieur à 6 heures';
      default: return category;
    }
  };

  const formatRequestDate = (row: number, month: number, year: number, colId: number, colLabel: string, includeDate: boolean, configs: any[]) => {
      let finalLabel = colLabel;
      const customConf = configs?.find((c: any) => c.column_id === colId);
      if (customConf?.custom_label) {
          finalLabel = customConf.custom_label;
      }
      
      const date = new Date(year, month - 1, row);
      const days = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
      let dStr = '';
      if (includeDate) {
          dStr = \`\${days[date.getDay()]} \${row.toString().padStart(2, '0')}/\${month.toString().padStart(2, '0')}/\${year} | \`;
      }
      return \`\${dStr}Col. \${colId} : \${finalLabel}\`;
  };

  const ranking = React.useMemo(() => {
      let filtered = appliedPenalties.filter(p => p.penalty_amount > 0);
      const effStartDate = startDate ? new Date(startDate) : counterResetDate;
      filtered = filtered.filter(p => new Date(p.shift_date) >= effStartDate);
      
      if (endDate) {
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          filtered = filtered.filter(p => new Date(p.shift_date) < end);
      }
      
      const userTotals: Record<string, { total: number, items: any[] }> = {};
      filtered.forEach(p => {
          if (!userTotals[p.user_trigram]) {
              userTotals[p.user_trigram] = { total: 0, items: [] };
          }
          userTotals[p.user_trigram].total += parseFloat(p.penalty_amount);
          userTotals[p.user_trigram].items.push(p);
      });
      
      return Object.entries(userTotals)
          .map(([trigram, data]) => ({ trigram, total: data.total, items: data.items.sort((a, b) => new Date(b.abandon_date).getTime() - new Date(a.abandon_date).getTime()) }))
          .sort((a, b) => b.total - a.total);
  }, [appliedPenalties, startDate, endDate, counterResetDate]);

  return (
    <div className="space-y-8 p-4 md:p-8 h-full overflow-y-auto custom-scrollbar pb-24">
      <div className="bg-white rounded-[40px] shadow-sm p-8 md:p-12 border border-slate-100 max-w-2xl mx-auto mt-8">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">💸</span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Pénalités d'abandon</h2>
          <p className="text-sm text-slate-500 mt-2">Définissez les pénalités financières en cas d'abandon de garde.</p>
        </div>

        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm mb-6">
            {error}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-4">
            {penalties.map((penalty) => (
              <div key={penalty.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-100">
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800">{getLabel(penalty.delay_category)}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input 
                    type="number" 
                    min="0"
                    value={penalty.penalty_amount} 
                    onChange={(e) => handleAmountChange(penalty.id, e.target.value)}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-right font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-500 font-bold">€</span>
                </div>
              </div>
            ))}
            
            <div className="pt-4 flex justify-end">
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="px-6 py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>

      {!error && (
          <div className="bg-white rounded-[40px] shadow-sm p-8 md:p-12 border border-slate-100 max-w-4xl mx-auto">
             <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                <div className="flex-1">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Classement des pénalités</h2>
                    <p className="text-sm text-slate-500 mt-1">Total des pénalités par médecin selon la période de garde.</p>
                    <div className="mt-4 inline-flex items-center gap-4 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
                        <span className="text-xs font-bold text-slate-500">Depuis le {counterResetDate.getFullYear() === 1970 ? 'début' : counterResetDate.toLocaleDateString('fr-FR')}</span>
                        <div className="h-4 w-px bg-slate-200"></div>
                        <button 
                            onClick={handleResetCounter}
                            className="text-xs font-black uppercase text-red-600 hover:text-red-700 transition-colors"
                        >
                            Réinitialiser le compteur
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Du</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Au</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button onClick={() => { setStartDate(''); setEndDate(''); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Effacer les filtres">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    )}
                </div>
             </div>

             {ranking.length > 0 ? (
                 <div className="flex flex-col gap-2">
                     {ranking.map((row, index) => (
                         <div key={row.trigram} className="flex flex-col border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm">
                             <div 
                                 className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                 onClick={() => setExpandedUserTrigram(expandedUserTrigram === row.trigram ? null : row.trigram)}
                             >
                                 <div className="flex items-center gap-4">
                                     <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shrink-0">
                                         #{index + 1}
                                     </div>
                                     <span className="font-bold text-slate-900 text-lg">{row.trigram}</span>
                                     <svg className={\`w-5 h-5 text-slate-400 transition-transform \${expandedUserTrigram === row.trigram ? 'rotate-180' : ''}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                 </div>
                                 <div className="flex items-center gap-4">
                                     <span className="font-black text-red-600 text-lg">{row.total.toFixed(2)} €</span>
                                 </div>
                             </div>
                             
                             {expandedUserTrigram === row.trigram && (
                                 <div className="bg-slate-50 p-4 border-t border-slate-100">
                                     <div className="flex flex-col gap-3">
                                         {row.items.map((p, idx) => {
                                             const req = p.abandon_request;
                                             return (
                                             <div key={p.id || idx} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                                                 <div className="flex-1 space-y-1">
                                                     <div className="flex items-center gap-2">
                                                         <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-[10px] font-black uppercase tracking-widest">{getLabel(p.penalty_category)}</span>
                                                     </div>
                                                     <div className="font-bold text-slate-800 text-sm mt-2">
                                                         {req ? (
                                                            req.requester_choice 
                                                            ? formatRequestDate(req.requester_choice.row, req.requester_choice.month, req.requester_choice.year, req.requester_choice.col, req.requester_choice.colLabel, true, columnConfigs) 
                                                            : (req.shift_snapshot ? formatRequestDate(req.shift_snapshot.row, req.shift_snapshot.month, req.shift_snapshot.year, req.shift_snapshot.col, req.shift_snapshot.colLabel, true, columnConfigs) : 'Garde supprimée')
                                                         ) : 'Garde introuvable'}
                                                         {req?.shift_snapshot?.linked_take && (
                                                             <>
                                                               {' → '}
                                                               <span className="font-bold text-teal-600">Reprise [{formatRequestDate(req.shift_snapshot.linked_take.row, req.shift_snapshot.linked_take.month, req.shift_snapshot.linked_take.year, req.shift_snapshot.linked_take.col, req.shift_snapshot.linked_take.colLabel, false, columnConfigs)}]</span>
                                                             </>
                                                         )}
                                                     </div>
                                                     <div className="text-[10px] text-slate-400">Demandé le {new Date(p.abandon_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                                 </div>
                                                 <div className="text-right shrink-0">
                                                     <span className="font-black text-red-600">{parseFloat(p.penalty_amount).toFixed(2)} €</span>
                                                 </div>
                                             </div>
                                         )})}
                                     </div>
                                 </div>
                             )}
                         </div>
                     ))}
                     
                     <div className="mt-4 p-6 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                         <span className="font-black text-slate-900 uppercase tracking-widest text-sm">Total des pénalités</span>
                         <span className="font-black text-red-700 text-2xl">{ranking.reduce((sum, r) => sum + r.total, 0).toFixed(2)} €</span>
                     </div>
                 </div>
             ) : (
                 <div className="text-center py-12 bg-slate-50 rounded-3xl border border-slate-200 border-dashed">
                     <p className="text-slate-500 font-bold">Aucune pénalité trouvée pour cette période.</p>
                 </div>
             )}
          </div>
      )}
    </div>
  );
};

const LogsTabPanel`;

content = content.replace(regex, replacement);

// Oh wait, AdminDashboard also doesn't pass columnConfigs to PenaltiesPanel currently. Let's fix that.
const appRegex = /<PenaltiesPanel supabase=\{supabase\} logAction=\{logAction\} \/>/;
content = content.replace(appRegex, `<PenaltiesPanel supabase={supabase} logAction={logAction} columnConfigs={columnConfigs} />`);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Updated AdminDashboard.tsx");
