const fs = require('fs');
let lines = fs.readFileSync('components/ExchangeRules.tsx', 'utf8').split('\n');

let newLines = [];
for(let i=0; i<lines.length; i++) {
  if (lines[i].trim() === '))}  // wait, this is not how it is') {
    // wait I can just regex it.
  }
}
// It's easier to just remove lines that are exactly `                                 ))}`
// Except the ones that actually close a valid map!
