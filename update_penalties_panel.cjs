const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const newPanel = `
const PenaltiesPanel = ({ supabase, logAction }: any) => {
  const [penalties, setPenalties] = useState<any[]>([]);
  const [appliedPenalties, setAppliedPenalties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const fetchPenalties = async () => {
      const { data, error: fetchError } = await supabase.from('abandon_penalties').select('*').order('id', { ascending: true });
      
      if (fetchError) {
        if (fetchError.code === '42P01') {
           setError("La table 'abandon_penalties' n'existe pas. Veuillez exécuter le script SQL fourni.");
        } else {
           setError(fetchError.message);
        }
      } else if (data) {
        setPenalties(data);
        await syncAppliedPenalties(data);
      }
      setLoading(false);
    };

    const syncAppliedPenalties = async (currentPenalties: any[]) => {
      try {
        const { data: requests } = await supabase.from('abandon_requests').select('*').eq('status', 'APPROVED');
        const { data: applied, error: errApplied } = await supabase.from('applied_penalties').select('*');
        
        if (errApplied && errApplied.code === '42P01') {
            setError("La table 'applied_penalties' n'existe pas. Veuillez exécuter le script SQL fourni.");
            return;
        }

        const appliedSet = new Set((applied || []).map((a: any) => a.abandon_request_id));
        const toInsert = [];

        for (const req of (requests || [])) {
          if (!appliedSet.has(req.id)) {
            const snap = req.shift_snapshot;
            let hour = 0;
            const match = snap.colLabel?.match(/\\((\\d{1,2})h/i);
            if (match) {
                hour = parseInt(match[1], 10);
            }
            const shiftDate = new Date(snap.year, snap.month - 1, snap.row, hour, 0, 0);
            const abandonDate = new Date(req.created_at);
            
            const delayHours = (shiftDate.getTime() - abandonDate.getTime()) / (1000 * 3600);
            
            let category = 'MORE_THAN_48H';
            if (delayHours < 6) {
                category = 'LESS_THAN_6H';
            } else if (delayHours < 48) {
                category = 'BETWEEN_6H_AND_48H';
            }
            
            const p = currentPenalties.find((p: any) => p.delay_category === category);
            const amount = p ? parseFloat(p.penalty_amount) : 0;
            
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
            const { data: finalApplied } = await supabase.from('applied_penalties').select('*');
            setAppliedPenalties(finalApplied || []);
        } else {
            setAppliedPenalties(applied || []);
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
    logAction('PENALTIES_UPDATE', 'Mise à jour des pénalités d\\'abandon');
    setSaving(false);
    alert('Pénalités enregistrées avec succès.');
  };

  const getLabel = (category: string) => {
    switch(category) {
      case 'MORE_THAN_48H': return 'Abandon supérieur à 48 heures';
      case 'BETWEEN_6H_AND_48H': return 'Abandon entre 48h et 6h avant la garde';
      case 'LESS_THAN_6H': return 'Abandon inférieur à 6 heures';
      default: return category;
    }
  };

  const ranking = useMemo(() => {
      let filtered = appliedPenalties.filter(p => p.penalty_amount > 0);
      if (startDate) {
          filtered = filtered.filter(p => new Date(p.shift_date) >= new Date(startDate));
      }
      if (endDate) {
          // Add 1 day to end date to include the whole day
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          filtered = filtered.filter(p => new Date(p.shift_date) < end);
      }
      
      const userTotals: Record<string, number> = {};
      filtered.forEach(p => {
          userTotals[p.user_trigram] = (userTotals[p.user_trigram] || 0) + parseFloat(p.penalty_amount);
      });
      
      return Object.entries(userTotals)
          .map(([trigram, total]) => ({ trigram, total }))
          .sort((a, b) => b.total - a.total);
  }, [appliedPenalties, startDate, endDate]);

  if (loading) return <div className="p-6">Chargement...</div>;

  return (
    <div className="space-y-8">
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

      {!error && appliedPenalties.length > 0 && (
          <div className="bg-white rounded-[40px] shadow-sm p-8 md:p-12 border border-slate-100 max-w-4xl mx-auto">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Classement des pénalités</h2>
                    <p className="text-sm text-slate-500 mt-1">Total des pénalités par médecin selon la période de garde.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Du</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Au</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button onClick={() => { setStartDate(''); setEndDate(''); }} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors" title="Effacer les filtres">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
             </div>

             {ranking.length > 0 ? (
                 <div className="overflow-hidden rounded-2xl border border-slate-200">
                     <table className="w-full text-left border-collapse">
                         <thead>
                             <tr className="bg-slate-50 border-b border-slate-200">
                                 <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-widest">Médecin</th>
                                 <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Total Pénalités</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {ranking.map((row, index) => (
                                 <tr key={row.trigram} className="hover:bg-slate-50/50 transition-colors">
                                     <td className="py-4 px-6">
                                         <div className="flex items-center gap-3">
                                             <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">
                                                 #{index + 1}
                                             </div>
                                             <span className="font-bold text-slate-900">{row.trigram}</span>
                                         </div>
                                     </td>
                                     <td className="py-4 px-6 text-right">
                                         <span className="font-black text-red-600">{row.total.toFixed(2)} €</span>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                         <tfoot className="bg-slate-50 border-t border-slate-200">
                             <tr>
                                 <td className="py-4 px-6 font-black text-slate-900 uppercase tracking-widest text-sm">Total</td>
                                 <td className="py-4 px-6 text-right font-black text-red-700 text-lg">
                                     {ranking.reduce((sum, r) => sum + r.total, 0).toFixed(2)} €
                                 </td>
                             </tr>
                         </tfoot>
                     </table>
                 </div>
             ) : (
                 <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                     <p className="text-slate-500 font-bold">Aucune pénalité trouvée pour cette période.</p>
                 </div>
             )}
          </div>
      )}
    </div>
  );
};
`;

const regex = /const PenaltiesPanel = \(\{ supabase, logAction \}: any\) => \{[\s\S]*?(?=\nexport const AdminDashboard)/;

if (regex.test(content)) {
    content = content.replace(regex, newPanel);
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Replaced");
} else {
    console.log("Could not find PenaltiesPanel");
}
