const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// Ensure we don't have remaining date issues.
const regex = /let category = 'MORE_THAN_48H';/g;

const replacement = `if (isNaN(delayHours)) {
                console.warn("Invalid delayHours", {shiftDate, abandonDate});
                continue;
            }
            let category = 'MORE_THAN_48H';`;

if (content.match(regex)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Fixed delayHours NaN check");
}
