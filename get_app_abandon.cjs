const fs = require('fs');
const content = fs.readFileSync('App.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('handleCellClick')) {
        console.log(`${i+1}: ${line}`);
    }
});
