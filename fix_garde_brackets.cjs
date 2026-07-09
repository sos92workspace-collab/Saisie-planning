const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// The replacement ` \}\]` might not have matched if there was no space before `}]`.
content = content.replace(/ \}\]/g, "}");
content = content.replace(/\}\]/g, "}");
fs.writeFileSync('components/ExchangeRules.tsx', content);
