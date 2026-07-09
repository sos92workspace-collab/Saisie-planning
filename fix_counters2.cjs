const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// The incorrect blocks look like:
//                                  {matchedExchanges && matchedExchanges.map((ex, idx) => ( ... ))}
// There are multiple of them. Let's just remove ALL of them first.
const regex = /[ \t]*\{matchedExchanges && matchedExchanges\.map[^{]*\{[^{]*\{[^{]*\{[^{]*\{[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[ \t]*\)\)}/g;

// Actually, writing a regex for this is risky. Let's use string split and join.
let lines = content.split('\n');
let newLines = [];
let skip = 0;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('{matchedExchanges && matchedExchanges.map((ex, idx) => (')) {
    skip = 10;
  }
  if (skip > 0) {
    skip--;
    continue;
  }
  newLines.push(lines[i]);
}

content = newLines.join('\n');
fs.writeFileSync('components/ExchangeRules.tsx', content);
