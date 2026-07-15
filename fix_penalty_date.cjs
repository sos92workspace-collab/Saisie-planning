const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const regex = /let shiftDate = new Date\(year, month - \(month > 11 \? 1 : 0\), row \|\| 1, hour, 0, 0\);/g;

const replacement = `let shiftDate = new Date(year, month - 1, row || 1, hour, 0, 0);`;

if (content.match(regex)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Fixed penalty date calculation");
} else {
    console.log("Not found penalty date");
}
