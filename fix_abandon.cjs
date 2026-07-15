const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const newStates = `  const [pendingReplacementAction, setPendingReplacementAction] = useState<any>(null);
  const [finalAbandonConfirm, setFinalAbandonConfirm] = useState<any>(null);`;

content = content.replace(
    "const [abandonPenaltiesRules, setAbandonPenaltiesRules] = useState<any[]>([]);",
    "const [abandonPenaltiesRules, setAbandonPenaltiesRules] = useState<any[]>([]);\n" + newStates
);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Injected new states");
