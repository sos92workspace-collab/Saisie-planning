const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// 1. Change the "Confirmer" button to "Choisir la garde à reprendre"
content = content.replace(
    /onClick=\{handleRemoveAssignment\}\s*className="flex-1 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-colors shadow-sm"\s*>\s*Confirmer\s*<\/button>/g,
    `onClick={handleRemoveAssignment}
                                className={\`flex-1 py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm \${removeMode === 'ABANDON' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-500 hover:bg-red-600'}\`}
                            >
                                {removeMode === 'ABANDON' ? 'Choisir la garde à reprendre' : 'Confirmer'}
                            </button>`
);

// 2. Add isPendingTarget logic to cell rendering
const cellRenderingRegex = /const isQuotaReachedAdmin = isQuotaDoctorReached \|\| isQuotaSubReached;/;
content = content.replace(cellRenderingRegex, 
    `const isQuotaReachedAdmin = isQuotaDoctorReached || isQuotaSubReached;
                                                const isPendingTarget = pendingReplacementAction && !assigned && !isClosed;`
);

const bgLogicRegex = /if \(isClosed\) bgColor = '#fee2e2'; \/\/ red-100\s*else if \(assigned\) \{[\s\S]*?\} else if \(isQuotaReachedAdmin\) \{\s*bgColor = '#fee2e2'; \/\/ red-100\s*\} else \{\s*\/\/ Cellule libre - 70% d'opacité\s*bgColor = col\.customColor \? \`\$\{col\.customColor\}B3\` : '#FFFFFFB3';\s*\}/;

const newBgLogic = `if (isClosed) bgColor = '#fee2e2'; // red-100
                                                else if (isPendingTarget) {
                                                    bgColor = '#22c55e'; // green-500
                                                } else if (assigned) {
                                                    if (highlightedTrigram && assigned.userTrigram === highlightedTrigram) {
                                                        bgColor = '#fef08a'; // yellow-300
                                                    } else {
                                                        bgColor = col.customColor || '#FFFFFF';
                                                    }
                                                } else if (isQuotaReachedAdmin) {
                                                    bgColor = '#fee2e2'; // red-100
                                                } else {
                                                    // Cellule libre - 70% d'opacité
                                                    bgColor = col.customColor ? \`\${col.customColor}B3\` : '#FFFFFFB3';
                                                }`;

content = content.replace(bgLogicRegex, newBgLogic);

// Add className logic
const classNameRegex = /className=\{\`border-r border-b border-slate-200 text-center relative min-w-\[75px\] w-\[75px\] md:min-w-\[36px\] md:w-\[36px\] cursor-pointer transition-opacity align-middle overflow-hidden \$\{isEditClosuresMode \? 'hover:bg-red-200' : 'hover:opacity-80'\} \$\{isCrosshair \? 'after:absolute after:inset-0 after:bg-blue-500\/10 after:pointer-events-none' : ''\} \$\{isHighlightedCell \? 'ring-4 ring-yellow-400 ring-inset z-20 bg-yellow-300 shadow-\[0_0_15px_6px_rgba\(250,204,21,0\.6\)\] animate-\[pulse_1s_ease-in-out_infinite\]' : ''\} \$\{isQuotaReachedAdmin && !assigned \? "bg-\[url\('data:image\/svg\+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZjhmYWZjIj48L3JlY3Q\+CjxwYXRoIGQ9Ik0wLDggTDgsMCBaIiBzdHJva2U9IiNjYmQ1ZTEiIHN0cm9rZS13aWR0aD0iMSI\+PC9wYXRoPgo8L3N2Zz4='\)\]" : ""\}\`\}/;

const newClassNameLogic = `className={\`border-r border-b border-slate-200 text-center relative min-w-[75px] w-[75px] md:min-w-[36px] md:w-[36px] cursor-pointer transition-all align-middle overflow-hidden \${isEditClosuresMode ? 'hover:bg-red-200' : 'hover:opacity-80'} \${isCrosshair ? 'after:absolute after:inset-0 after:bg-blue-500/10 after:pointer-events-none' : ''} \${isPendingTarget ? 'ring-2 ring-emerald-500 ring-inset z-20 shadow-[inset_0_0_0_2px_#22c55e] animate-[pulse_1.5s_ease-in-out_infinite] scale-[1.05]' : ''} \${isHighlightedCell ? 'ring-4 ring-yellow-400 ring-inset z-20 bg-yellow-300 shadow-[0_0_15px_6px_rgba(250,204,21,0.6)] animate-[pulse_1s_ease-in-out_infinite]' : ''} \${isQuotaReachedAdmin && !assigned ? "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZjhmYWZjIj48L3JlY3Q+CjxwYXRoIGQ9Ik0wLDggTDgsMCBaIiBzdHJva2U9IiNjYmQ1ZTEiIHN0cm9rZS13aWR0aD0iMSI+PC9wYXRoPgo8L3N2Zz4=')]" : ""}\`}`;

content = content.replace(classNameRegex, newClassNameLogic);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Updated AdminDashboard.tsx");
