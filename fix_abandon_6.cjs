const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// I need to remove target_row, target_col, etc from abandon_requests insert!
const updatedFunctions = `
  const handleFinalAbandonConfirm = async () => {
      if (!finalAbandonConfirm) return;
      const { abandonedChoice, replacementCell, penaltyAmount, penaltyCategory } = finalAbandonConfirm;
      
      const { error: removeError } = await supabase.from(tableName).delete().eq('id', abandonedChoice.id);
      if (removeError) {
          alert("Erreur lors de la suppression de l'ancienne garde");
          return;
      }
      
      const reqAbandon = {
          requester_trigram: abandonedChoice.userTrigram,
          shift_snapshot: {
              row: abandonedChoice.row,
              month: abandonedChoice.month + 1,
              year: abandonedChoice.year,
              col: abandonedChoice.col,
              colLabel: abandonedChoice.colLabel || columnConfigs.find((c: any) => c.column_id === abandonedChoice.col)?.custom_label || columnConfigs.find((c: any) => c.column_id === abandonedChoice.col)?.name,
              target_row: replacementCell.row,
              target_month: replacementCell.month + 1,
              target_year: replacementCell.year,
              target_col: replacementCell.col
          },
          status: 'APPROVED',
          processed_by: (typeof currentUserTrigram !== 'undefined' ? currentUserTrigram : 'ADMIN'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
      };
      
      const { data: reqData, error: reqError } = await supabase.from('abandon_requests').insert([reqAbandon]).select();
      if (!reqError && reqData && reqData.length > 0) {
          const abandonId = reqData[0].id;
          
          let colLabel = reqAbandon.shift_snapshot.colLabel || "0h";
          const match = colLabel.match(/\\((\\d{1,2})h/i);
          const hour = match ? parseInt(match[1], 10) : 0;
          const shiftDate = new Date(abandonedChoice.year, abandonedChoice.month, abandonedChoice.row || 1, hour, 0, 0);
          
          const penaltyInsert = {
              abandon_request_id: abandonId,
              user_trigram: abandonedChoice.userTrigram,
              shift_date: shiftDate.toISOString(),
              abandon_date: reqAbandon.updated_at,
              delay_hours: 0,
              penalty_amount: penaltyAmount,
              penalty_category: penaltyCategory
          };
          
          await supabase.from('applied_penalties').insert([penaltyInsert]);
      }
      
      // Now assign the new choice
      const newPayload = {
          id: generateId(),
          row: replacementCell.row, col: replacementCell.col, month: replacementCell.month + 1, year: replacementCell.year,
          user_trigram: abandonedChoice.userTrigram,
          user_role: abandonedChoice.userRole || 'DOCTOR',
          status: 'ASSIGNED',
          round_id: activeRound?.id || 0,
          group_index: 1, sub_rank: 1, category: 'normal',
          submitted_at: new Date().toISOString()
      };
      
      const { data: newData, error: newError } = await supabase.from(tableName).insert(newPayload).select();
      if (!newError && newData) {
          const newChoice = {
              id: newData[0].id,
              row: newData[0].row, col: newData[0].col, month: newData[0].month - 1, year: newData[0].year,
              groupIndex: newData[0].group_index, subRank: newData[0].sub_rank, category: newData[0].category,
              userTrigram: newData[0].user_trigram, userRole: newData[0].user_role,
              status: newData[0].status, submittedAt: newData[0].submitted_at, roundId: newData[0].round_id,
              colLabel: newData[0].col_label, colType: newData[0].col_type, colTimeRange: newData[0].col_time_range
          };
          
          setChoices((prev: any[]) => {
              const withoutOld = prev.filter(c => c.id !== abandonedChoice.id);
              return [...withoutOld, newChoice];
          });
      } else {
          setChoices((prev: any[]) => prev.filter(c => c.id !== abandonedChoice.id));
      }
      
      logAction('SUPPRESSION_GARDE', { mode: 'ABANDON_AVEC_REMPLACEMENT', user: abandonedChoice.userTrigram, date: \`\${abandonedChoice.row}/\${abandonedChoice.month+1}/\${abandonedChoice.year}\`, col: abandonedChoice.col });
      
      setFinalAbandonConfirm(null);
  };
`;

content = content.replace(
    /const handleFinalAbandonConfirm = async \(\) => \{[\s\S]*?setFinalAbandonConfirm\(null\);\s*\};/m,
    updatedFunctions.trim()
);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Updated handleFinalAbandonConfirm to remove invalid columns from insert");
