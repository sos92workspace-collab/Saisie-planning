const fs = require('fs');
const content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('editingCell && (')) {
        console.log(`${i+1}: ${lines[i]}`);
    }
}
