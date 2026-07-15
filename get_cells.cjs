const fs = require('fs');
const content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('isQuotaDoctorReached')) {
        console.log(`${i-2}-${i+2}: ${line}`);
    }
});
