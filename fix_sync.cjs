const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const regex = /const shiftDate = new Date\(snap\.year, snap\.month - 1, snap\.row, hour, 0, 0\);\s*const abandonDate = new Date\(req\.created_at\);\s*const delayHours = \(shiftDate\.getTime\(\) - abandonDate\.getTime\(\)\) \/ \(1000 \* 3600\);/g;

const replacement = `let shiftDate = new Date(snap.year, snap.month - (snap.month > 11 ? 1 : 0), snap.row || 1, hour, 0, 0);
            if (isNaN(shiftDate.getTime())) {
                console.warn("Invalid shift date for abandon request", req.id, snap);
                shiftDate = new Date(); // fallback to avoid crash
            }
            const abandonDate = new Date(req.created_at || new Date());
            
            const delayHours = (shiftDate.getTime() - abandonDate.getTime()) / (1000 * 3600);`;

if (content.match(regex)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Fixed");
} else {
    console.log("Not found");
}
