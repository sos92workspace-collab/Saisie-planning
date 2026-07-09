const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const modalUI = `
        {/* Assignment Removal Modal */}
        {removingCell && (
            <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 p-6">
                        <h3 className="text-white text-lg font-black uppercase tracking-tight">Retirer la garde</h3>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">
                            Le {removingCell.row}/{removingCell.month + 1}/{removingCell.year} • Colonne {removingCell.col}
                        </p>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="text-sm font-medium text-slate-700">
                            Êtes-vous sûr de vouloir retirer la garde du Dr <span className="font-bold text-slate-900">{removingCell.assignedChoice.userTrigram}</span> ?
                        </div>
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                id="logInCounterRemove" 
                                checked={logInCounter} 
                                onChange={(e) => setLogInCounter(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="logInCounterRemove" className="text-xs font-bold text-slate-700">Comptabiliser cet abandon dans le compteur du médecin</label>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setRemovingCell(null)}
                                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={handleRemoveAssignment}
                                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-colors shadow-sm"
                            >
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
`;

content = content.replace(/\{editingCell && \(/, modalUI + "\n        {editingCell && (");

const fnUI = `
  const handleRemoveAssignment = async () => {
      if (!removingCell) return;
      const { row, col, month, year, assignedChoice } = removingCell;
      const { error } = await supabase.from(tableName).delete().eq('id', assignedChoice.id);
      if (!error) {
          setChoices((prev: any[]) => prev.filter((c: any) => c.id !== assignedChoice.id));
          logAction('SUPPRESSION_GARDE', { user: assignedChoice.userTrigram, date: \`\${row}/\${month+1}/\${year}\`, col: col });
          
          if (logInCounter) {
             const reqAbandon = {
                  requester_trigram: assignedChoice.userTrigram,
                  shift_snapshot: {
                      row: assignedChoice.row,
                      month: assignedChoice.month + 1,
                      year: assignedChoice.year,
                      col: assignedChoice.col,
                      colLabel: assignedChoice.colLabel || COLUMNS.find(c => c.id === assignedChoice.col)?.label
                  },
                  status: 'APPROVED',
                  processed_by: (typeof currentUserTrigram !== 'undefined' ? currentUserTrigram : 'ADMIN'),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
              };
              supabase.from('abandon_requests').insert([reqAbandon]).then(({error}) => {
                  if (error) console.error("Error inserting abandon_request", error);
              });
          }
      } else {
          alert("Erreur lors de la suppression");
      }
      setRemovingCell(null);
  };
`;

content = content.replace(/const handleAssignment = async \(\) => \{/, fnUI + "\n  const handleAssignment = async () => {");

fs.writeFileSync('components/AdminDashboard.tsx', content);
