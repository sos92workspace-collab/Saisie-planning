const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const regex = /let shiftDate = new Date\(snap\.year, snap\.month - \(snap\.month > 11 \? 1 : 0\), snap\.row \|\| 1, hour, 0, 0\);/g;

const replacement = `
let year = snap?.year;
let month = snap?.month;
let row = snap?.row;
if (year === undefined) {
    if (snap?.date) {
        const d = new Date(snap.date);
        year = d.getFullYear();
        month = d.getMonth() + 1;
        row = d.getDate();
    } else {
        year = new Date().getFullYear();
    }
}
if (month === undefined) month = new Date().getMonth() + 1;
if (row === undefined) row = new Date().getDate();

let shiftDate = new Date(year, month - (month > 11 ? 1 : 0), row || 1, hour, 0, 0);`;

if (content.match(regex)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Fixed date fallback");
} else {
    console.log("Not found fallback");
}
