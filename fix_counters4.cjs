const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// I will remove all lines that match precisely `                                 ))}`
// BUT I have to be careful. The valid maps also end with that.
// Let's just fix it manually using sed on the exact lines.
