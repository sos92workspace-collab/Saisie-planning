const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// Add states
content = content.replace(/const \[editingCell, setEditingCell\] = useState<\{row: number, col: number, month: number, year: number\} \| null>\(null\);/, 
  "const [editingCell, setEditingCell] = useState<{row: number, col: number, month: number, year: number} | null>(null);\n" +
  "  const [removingCell, setRemovingCell] = useState<{row: number, col: number, month: number, year: number, assignedChoice: any} | null>(null);\n" +
  "  const [logInCounter, setLogInCounter] = useState<boolean>(true);");

// Replace handleCellClick's confirm
const handleCellClickReplacement = `
      if (assignedChoice) {
          setRemovingCell({ row, col: colId, month, year, assignedChoice });
          setLogInCounter(true);
      } else {
          // Open Modal for Assignment
          setEditingCell({ row, col: colId, month, year });
          setSelectedUserTrigram('');
          setLogInCounter(true);
      }
`;
content = content.replace(/if \(assignedChoice\) \{\n          if \(window\.confirm\([\s\S]*?\} else \{/g, handleCellClickReplacement + "      } else if (false) {"); // hacky way to match the rest of if-else

fs.writeFileSync('components/AdminDashboard.tsx', content);
