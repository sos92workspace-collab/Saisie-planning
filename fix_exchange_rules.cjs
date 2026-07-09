const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// 1. Replace "Ce jour-ci :" with "Garde :"
content = content.replace(/Ce jour-ci :/g, 'Garde :');

// 2. Remove Planning Grids
const regexGrid1 = /\s*\{\/\*\s*Exchange Planning Grid\s*\*\/\}[\s\S]*?(?=<\/div>\s*\}\s*\{\/\*\s*Historique\s*\*\/\}|<\/div>\s*\)\s*\}\s*\{activeTab === 'ABANDONS')/g;
// Actually, they look like this:
//          {/* Exchange Planning Grid */}
//          <div className="flex flex-col h-[70vh] mt-8 border-t border-slate-100 pt-8">
//             {PlanningPanel && <PlanningPanel ... />}
//          </div>
// We can just find the start and balance the divs.

fs.writeFileSync('components/ExchangeRules.tsx', content);
