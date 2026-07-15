const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const penaltyInputRegex = /<input[^>]*type="number"[^>]*value=\{removePenaltyAmount\}[^>]*onChange=\{e => setRemovePenaltyAmount\(parseFloat\(e\.target\.value\) \|\| 0\)\}[^>]*\/>/s;

const penaltyDropdown = `
                    <select 
                        value={removePenaltyAmount}
                        onChange={e => setRemovePenaltyAmount(parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
                    >
                        {abandonPenaltiesRules.map(r => (
                            <option key={r.id} value={r.penalty_amount}>
                                {r.penalty_amount}€ - {r.delay_category === 'MORE_THAN_48H' ? '> 48h' : r.delay_category === 'BETWEEN_6H_AND_48H' ? '48h à 6h' : '< 6h'}
                            </option>
                        ))}
                        <option value="0">0€ - Aucune pénalité (Exonération)</option>
                    </select>
`;

if (content.match(penaltyInputRegex)) {
    content = content.replace(penaltyInputRegex, penaltyDropdown);
    
    // Also remove the explicit "span €" next to the input because the select includes it
    content = content.replace(
        /<span className="text-sm text-slate-500 font-bold">€<\/span>/,
        ''
    );
    
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Updated penalty input to dropdown");
} else {
    console.log("Could not find penalty input to replace");
}
