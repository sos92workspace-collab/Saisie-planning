const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

const match = content.match(/const \[activeTab, setActiveTab\] = useState[^;]+;/);
console.log(match[0]);
