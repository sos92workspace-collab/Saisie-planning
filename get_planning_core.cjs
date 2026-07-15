const fs = require('fs');
const content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('PlanningDashboardCore')) {
        console.log(`${i+1}: ${line}`);
    }
});
