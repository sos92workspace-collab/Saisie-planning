const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const updatedHandleRemoveAssignment = `
  const handleRemoveAssignment = async () => {
      if (!removingCell) return;
      const { row, col, month, year, assignedChoice } = removingCell;
      
      if (removeMode === 'ABANDON') {
          // Transition to pending replacement
          setPendingReplacementAction({
              abandonedChoice: assignedChoice,
              penaltyAmount: removePenaltyAmount,
              penaltyCategory: removeDelayCategory
          });
          setRemovingCell(null);
          return;
      }
      
      // ERROR mode: just remove it
      const { error } = await supabase.from(tableName).delete().eq('id', assignedChoice.id);
      if (!error) {
          setChoices((prev: any[]) => prev.filter((c: any) => c.id !== assignedChoice.id));
          logAction('SUPPRESSION_GARDE', { mode: 'CORRECTION_ERREUR', user: assignedChoice.userTrigram, date: \`\${row}/\${month+1}/\${year}\`, col: col });
      } else {
          alert("Erreur lors de la suppression");
      }
      setRemovingCell(null);
  };
`;

content = content.replace(
    /const handleRemoveAssignment = async \(\) => \{[\s\S]*?setRemovingCell\(null\);\s*\};\s*const handleAssignment/m,
    updatedHandleRemoveAssignment.trim() + '\n\n  const handleAssignment'
);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Updated handleRemoveAssignment");
