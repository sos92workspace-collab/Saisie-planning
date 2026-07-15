const fs = require('fs');
const content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');
const lines = content.split('\n');
let lastFunc = "";
for(let i=0; i<3800; i++) {
   if (lines[i].includes('const ') && lines[i].includes(' = ({')) {
       lastFunc = lines[i];
   }
}
console.log(lastFunc);
