const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const oldHandleCellClick = `
  const handleCellClick = async (row: number, colId: number, month: number, year: number) => {
      if (overrideAdminMode) {
          if (onCellClick) {
              const assigned = choices.find((c: any) => c.row === row && c.col === colId && c.month === month && c.year === year && (c.status === 'ASSIGNED' || c.status === 'VALIDATED'));
              onCellClick({ row, col: colId, month, year, assigned });
          }
          return;
      }

      if (isEditClosuresMode) {
          const existing = globalClosures.find((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
          if (existing) {
              await supabase.from(closuresTableName).delete().eq('id', existing.id);
              setGlobalClosures((prev: any[]) => prev.filter(gc => gc.id !== existing.id));
          } else {
              const { data, error } = await supabase.from(closuresTableName).insert({ col_id: colId, row, month: month + 1, year }).select();
              if (data && !error) setGlobalClosures((prev: any[]) => [...prev, { ...data[0], month: data[0].month - 1 }]);
          }
          return;
      }

      const isClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
      if (isClosed) {
          alert("Cette case est fermée.");
          return;
      }

      const assignedChoice = choices.find((c: any) => c.row === row && c.col === colId && c.month === month && c.year === year && (c.status === 'ASSIGNED' || c.status === 'VALIDATED'));
      
      if (assignedChoice) {
          if (window.confirm(\`Retirer la garde du Dr \${assignedChoice.userTrigram} ?\`)) {
              const { error } = await supabase.from(tableName).delete().eq('id', assignedChoice.id);
              if (!error) {
                  setChoices((prev: any[]) => prev.filter((c: any) => c.id !== assignedChoice.id));
                  logAction('SUPPRESSION_GARDE', { user: assignedChoice.userTrigram, date: \`\${row}/\${month+1}/\${year}\`, col: colId });
              } else {
                  alert("Erreur lors de la suppression");
              }
          }
      } else {
          // Open Modal for Assignment
          setEditingCell({ row, col: colId, month, year });
          setSelectedUserTrigram('');
      }
  };
`;

const newHandleCellClick = `
  const handleCellClick = async (row: number, colId: number, month: number, year: number) => {
      if (overrideAdminMode) {
          if (onCellClick) {
              const assigned = choices.find((c: any) => c.row === row && c.col === colId && c.month === month && c.year === year && (c.status === 'ASSIGNED' || c.status === 'VALIDATED'));
              onCellClick({ row, col: colId, month, year, assigned });
          }
          return;
      }

      if (isEditClosuresMode) {
          const existing = globalClosures.find((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
          if (existing) {
              await supabase.from(closuresTableName).delete().eq('id', existing.id);
              setGlobalClosures((prev: any[]) => prev.filter(gc => gc.id !== existing.id));
          } else {
              const { data, error } = await supabase.from(closuresTableName).insert({ col_id: colId, row, month: month + 1, year }).select();
              if (data && !error) setGlobalClosures((prev: any[]) => [...prev, { ...data[0], month: data[0].month - 1 }]);
          }
          return;
      }

      const isClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
      if (isClosed) {
          alert("Cette case est fermée.");
          return;
      }

      const assignedChoice = choices.find((c: any) => c.row === row && c.col === colId && c.month === month && c.year === year && (c.status === 'ASSIGNED' || c.status === 'VALIDATED'));
      
      if (assignedChoice) {
          setRemovingCell({ row, col: colId, month, year, assignedChoice });
          setLogInCounter(true);
      } else {
          // Open Modal for Assignment
          setEditingCell({ row, col: colId, month, year });
          setSelectedUserTrigram('');
          setLogInCounter(true);
      }
  };
`;

// we need to find exactly from `const handleCellClick` until `  const handleAssignment = async () => {`
const startIdx = content.indexOf('  const handleCellClick = async');
const endIdx = content.indexOf('  const handleAssignment = async () => {');
if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + newHandleCellClick + content.substring(endIdx);
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Success");
} else {
    console.log("Could not find boundaries");
}
