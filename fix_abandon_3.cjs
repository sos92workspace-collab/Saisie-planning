const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const updatedHandleCellClick = `
  const handleCellClick = async (row: number, colId: number, month: number, year: number) => {
      if (overrideAdminMode) {
          if (onCellClick) {
              const assigned = choices.find((c: any) => c.row === row && c.col === colId && c.month === month && c.year === year && (c.status === 'ASSIGNED' || c.status === 'VALIDATED'));
              onCellClick({ row, col: colId, month, year, assigned });
          }
          return;
      }

      if (pendingReplacementAction) {
          const isClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
          if (isClosed) {
              alert("Cette case est fermée.");
              return;
          }
          const assignedChoice = choices.find((c: any) => c.row === row && c.col === colId && c.month === month && c.year === year && (c.status === 'ASSIGNED' || c.status === 'VALIDATED'));
          if (assignedChoice) {
              alert("Veuillez sélectionner une case vide ou disponible pour le remplacement.");
              return;
          }
          setFinalAbandonConfirm({
              ...pendingReplacementAction,
              replacementCell: { row, col: colId, month, year }
          });
          setPendingReplacementAction(null);
          return;
      }
`;

content = content.replace(
    /const handleCellClick = async \(row: number, colId: number, month: number, year: number\) => \{[\s\S]*?if \(isEditClosuresMode\)/m,
    updatedHandleCellClick.trim() + '\n\n      if (isEditClosuresMode)'
);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Updated handleCellClick");
