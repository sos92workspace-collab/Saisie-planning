const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

content = content.replace(/updated_at: new Date\(\)\.toISOString\(\)/g, "updated_at: new Date().toISOString(), processed_by: currentUserTrigram");

fs.writeFileSync('components/ExchangeRules.tsx', content);
