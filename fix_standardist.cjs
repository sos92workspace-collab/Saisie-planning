const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

content = content.replace(/currentUserTrigram\?: string;/g, "currentUserTrigram?: string;\n  isStandardist?: boolean;");
content = content.replace(/currentUserTrigram \}\) => \{/g, "currentUserTrigram, isStandardist }) => {");

content = content.replace(/<button \n            onClick=\{\(\) => setActiveTab\('RULES'\)\}/g, "{!isStandardist && (\n          <button \n            onClick={() => setActiveTab('RULES')}");
content = content.replace(/Règles d'équivalence\n          <\/button>\n        <\/div>/g, "Règles d'équivalence\n          </button>\n          )}\n        </div>");

fs.writeFileSync('components/ExchangeRules.tsx', content);

let stdDash = fs.readFileSync('components/StandardisteDashboard.tsx', 'utf8');
stdDash = stdDash.replace(/currentUserTrigram=\{currentUserTrigram\}/g, "currentUserTrigram={currentUserTrigram} isStandardist={true}");
fs.writeFileSync('components/StandardisteDashboard.tsx', stdDash);
