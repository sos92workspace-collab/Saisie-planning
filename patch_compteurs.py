import re

with open('components/ExchangeRules.tsx', 'r') as f:
    content = f.read()

compteurs_tab = """      {activeTab === 'COMPTEURS' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 border-b border-slate-100 pb-6">
            <div>
              <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">Compteurs & Pénalités</h3>
              <p className="text-sm text-slate-500 mt-1">Gérez et consultez les statistiques des médecins filtrées par date.</p>
            </div>
            <div className="flex flex-wrap items-end gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1">Date de début</label>
                <input 
                  type="date" 
                  value={counterStartDate} 
                  onChange={(e) => setCounterStartDate(e.target.value)} 
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1">Date de fin</label>
                <input 
                  type="date" 
                  value={counterEndDate} 
                  onChange={(e) => setCounterEndDate(e.target.value)} 
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              {(counterStartDate || counterEndDate) && (
                <button 
                  onClick={() => { setCounterStartDate(''); setCounterEndDate(''); }}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 underline pb-2"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* ECHANGES */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-white">
                <h4 className="font-black uppercase text-slate-800">Échanges</h4>
              </div>
              <div className="p-4 space-y-6">
                {/* Titulaires */}
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 pb-1 mb-3">Titulaires</h5>
                  {(() => {
                     const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                       const matchedRequests = requests.filter(r => {
                         if (r.requester_trigram !== user.trigram || r.status !== 'APPROVED') return false;
                         const actionDate = new Date(r.updated_at || r.created_at);
                         if (counterStartDate && actionDate < new Date(counterStartDate)) return false;
                         if (counterEndDate) { const endD = new Date(counterEndDate); endD.setHours(23, 59, 59, 999); if (actionDate > endD) return false; }
                         return true;
                       });
                       return { user, count: matchedRequests.length, matchedRequests };
                     }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
                     if (userCounts.length === 0) return <div className="text-xs text-slate-500 italic">Aucun échange.</div>;
                     return <div className="space-y-2">
                       {userCounts.map(({ user, count }) => (
                         <div key={user.trigram} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                           <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                           <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{count}</span>
                         </div>
                       ))}
                     </div>
                  })()}
                </div>
                {/* Remplaçants */}
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 pb-1 mb-3">Remplaçants</h5>
                  {(() => {
                     const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                       const matchedRequests = requests.filter(r => {
                         if (r.requester_trigram !== user.trigram || r.status !== 'APPROVED') return false;
                         const actionDate = new Date(r.updated_at || r.created_at);
                         if (counterStartDate && actionDate < new Date(counterStartDate)) return false;
                         if (counterEndDate) { const endD = new Date(counterEndDate); endD.setHours(23, 59, 59, 999); if (actionDate > endD) return false; }
                         return true;
                       });
                       return { user, count: matchedRequests.length, matchedRequests };
                     }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
                     if (userCounts.length === 0) return <div className="text-xs text-slate-500 italic">Aucun échange.</div>;
                     return <div className="space-y-2">
                       {userCounts.map(({ user, count }) => (
                         <div key={user.trigram} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                           <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                           <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{count}</span>
                         </div>
                       ))}
                     </div>
                  })()}
                </div>
              </div>
            </div>

            {/* ABANDONS */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-white">
                <h4 className="font-black uppercase text-slate-800">Abandons</h4>
              </div>
              <div className="p-4 space-y-6">
                {/* Titulaires */}
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 pb-1 mb-3">Titulaires</h5>
                  {(() => {
                     const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                       const filterAction = (actionDate: Date) => {
                         if (counterStartDate && actionDate < new Date(counterStartDate)) return false;
                         if (counterEndDate) { const endD = new Date(counterEndDate); endD.setHours(23, 59, 59, 999); if (actionDate > endD) return false; }
                         return true;
                       };
                       const matchedAbandons = abandons.filter(a => {
                         if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                         return filterAction(new Date(a.updated_at || a.created_at));
                       });
                       const matchedExchanges = requests.filter(r => {
                         if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                         return filterAction(new Date(r.updated_at || r.created_at));
                       });
                       return { user, count: matchedAbandons.length + matchedExchanges.length };
                     }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
                     if (userCounts.length === 0) return <div className="text-xs text-slate-500 italic">Aucun abandon.</div>;
                     return <div className="space-y-2">
                       {userCounts.map(({ user, count }) => (
                         <div key={user.trigram} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                           <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                           <span className="text-xs font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{count}</span>
                         </div>
                       ))}
                     </div>
                  })()}
                </div>
                {/* Remplaçants */}
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 pb-1 mb-3">Remplaçants</h5>
                  {(() => {
                     const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                       const filterAction = (actionDate: Date) => {
                         if (counterStartDate && actionDate < new Date(counterStartDate)) return false;
                         if (counterEndDate) { const endD = new Date(counterEndDate); endD.setHours(23, 59, 59, 999); if (actionDate > endD) return false; }
                         return true;
                       };
                       const matchedAbandons = abandons.filter(a => {
                         if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                         return filterAction(new Date(a.updated_at || a.created_at));
                       });
                       const matchedExchanges = requests.filter(r => {
                         if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                         return filterAction(new Date(r.updated_at || r.created_at));
                       });
                       return { user, count: matchedAbandons.length + matchedExchanges.length };
                     }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
                     if (userCounts.length === 0) return <div className="text-xs text-slate-500 italic">Aucun abandon.</div>;
                     return <div className="space-y-2">
                       {userCounts.map(({ user, count }) => (
                         <div key={user.trigram} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                           <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                           <span className="text-xs font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{count}</span>
                         </div>
                       ))}
                     </div>
                  })()}
                </div>
              </div>
            </div>

            {/* TAKES (AJOUTS) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-white">
                <h4 className="font-black uppercase text-slate-800">Reprises de garde (Ajouts)</h4>
              </div>
              <div className="p-4 space-y-6">
                {/* Titulaires */}
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 pb-1 mb-3">Titulaires</h5>
                  {(() => {
                     const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                       const filterAction = (actionDate: Date) => {
                         if (counterStartDate && actionDate < new Date(counterStartDate)) return false;
                         if (counterEndDate) { const endD = new Date(counterEndDate); endD.setHours(23, 59, 59, 999); if (actionDate > endD) return false; }
                         return true;
                       };
                       const matchedTakes = takes.filter(t => {
                         if (t.requester_trigram !== user.trigram || t.status !== 'APPROVED') return false;
                         return filterAction(new Date(t.updated_at || t.created_at));
                       });
                       const matchedExchanges = requests.filter(r => {
                         if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                         return filterAction(new Date(r.updated_at || r.created_at));
                       });
                       return { user, count: matchedTakes.length + matchedExchanges.length };
                     }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
                     if (userCounts.length === 0) return <div className="text-xs text-slate-500 italic">Aucune reprise.</div>;
                     return <div className="space-y-2">
                       {userCounts.map(({ user, count }) => (
                         <div key={user.trigram} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                           <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                           <span className="text-xs font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{count}</span>
                         </div>
                       ))}
                     </div>
                  })()}
                </div>
                {/* Remplaçants */}
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 pb-1 mb-3">Remplaçants</h5>
                  {(() => {
                     const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                       const filterAction = (actionDate: Date) => {
                         if (counterStartDate && actionDate < new Date(counterStartDate)) return false;
                         if (counterEndDate) { const endD = new Date(counterEndDate); endD.setHours(23, 59, 59, 999); if (actionDate > endD) return false; }
                         return true;
                       };
                       const matchedTakes = takes.filter(t => {
                         if (t.requester_trigram !== user.trigram || t.status !== 'APPROVED') return false;
                         return filterAction(new Date(t.updated_at || t.created_at));
                       });
                       const matchedExchanges = requests.filter(r => {
                         if ((r.requester_trigram !== user.trigram && r.target_trigram !== user.trigram) || r.status !== 'APPROVED') return false;
                         return filterAction(new Date(r.updated_at || r.created_at));
                       });
                       return { user, count: matchedTakes.length + matchedExchanges.length };
                     }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
                     if (userCounts.length === 0) return <div className="text-xs text-slate-500 italic">Aucune reprise.</div>;
                     return <div className="space-y-2">
                       {userCounts.map(({ user, count }) => (
                         <div key={user.trigram} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                           <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                           <span className="text-xs font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{count}</span>
                         </div>
                       ))}
                     </div>
                  })()}
                </div>
              </div>
            </div>

            {/* PENALITES */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-white">
                <h4 className="font-black uppercase text-slate-800">Pénalités</h4>
              </div>
              <div className="p-4 space-y-6">
                {/* Titulaires */}
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 pb-1 mb-3">Titulaires</h5>
                  {(() => {
                     const userCounts = users.filter(u => u.role === 'DOCTOR').map(user => {
                       const filterAction = (actionDate: Date) => {
                         if (counterStartDate && actionDate < new Date(counterStartDate)) return false;
                         if (counterEndDate) { const endD = new Date(counterEndDate); endD.setHours(23, 59, 59, 999); if (actionDate > endD) return false; }
                         return true;
                       };
                       const matchedAbandons = abandons.filter(a => {
                         if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                         if (!a.penalty_amount || a.penalty_amount <= 0) return false;
                         return filterAction(new Date(a.updated_at || a.created_at));
                       });
                       const totalPenalty = matchedAbandons.reduce((sum, a) => sum + (a.penalty_amount || 0), 0);
                       return { user, count: matchedAbandons.length, penalty: totalPenalty };
                     }).filter(item => item.penalty > 0).sort((a, b) => b.penalty - a.penalty);
                     if (userCounts.length === 0) return <div className="text-xs text-slate-500 italic">Aucune pénalité.</div>;
                     return <div className="space-y-2">
                       {userCounts.map(({ user, penalty }) => (
                         <div key={user.trigram} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                           <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                           <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">{penalty}€</span>
                         </div>
                       ))}
                     </div>
                  })()}
                </div>
                {/* Remplaçants */}
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 pb-1 mb-3">Remplaçants</h5>
                  {(() => {
                     const userCounts = users.filter(u => u.role === 'SUBSTITUTE').map(user => {
                       const filterAction = (actionDate: Date) => {
                         if (counterStartDate && actionDate < new Date(counterStartDate)) return false;
                         if (counterEndDate) { const endD = new Date(counterEndDate); endD.setHours(23, 59, 59, 999); if (actionDate > endD) return false; }
                         return true;
                       };
                       const matchedAbandons = abandons.filter(a => {
                         if (a.requester_trigram !== user.trigram || a.status !== 'APPROVED') return false;
                         if (!a.penalty_amount || a.penalty_amount <= 0) return false;
                         return filterAction(new Date(a.updated_at || a.created_at));
                       });
                       const totalPenalty = matchedAbandons.reduce((sum, a) => sum + (a.penalty_amount || 0), 0);
                       return { user, count: matchedAbandons.length, penalty: totalPenalty };
                     }).filter(item => item.penalty > 0).sort((a, b) => b.penalty - a.penalty);
                     if (userCounts.length === 0) return <div className="text-xs text-slate-500 italic">Aucune pénalité.</div>;
                     return <div className="space-y-2">
                       {userCounts.map(({ user, penalty }) => (
                         <div key={user.trigram} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                           <span className="text-sm font-bold text-slate-700">{user.trigram}</span>
                           <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">{penalty}€</span>
                         </div>
                       ))}
                     </div>
                  })()}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}"""

content = content.replace('{/* Modals for validation would go here. We reuse existing modals or standard alerts. */}', compteurs_tab + '\n      {/* Modals for validation would go here. We reuse existing modals or standard alerts. */}')

with open('components/ExchangeRules.tsx', 'w') as f:
    f.write(content)
