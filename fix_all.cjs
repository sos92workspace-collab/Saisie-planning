const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace `insert([{ ... })` with `insert([{ ... }])`
    // Since there could be newlines, we can use a more specific replace.
    // Let's just find lines that have `insert([{` and we know the end is `});`.
    // Wait, let's just find `})` that should be `}])`.
    
    // In App.tsx: 796
    if (file === 'App.tsx') {
        let lines = content.split('\n');
        // line 796 is index 795
        if (lines[795].includes('})')) {
            lines[795] = lines[795].replace('})', '}])');
        }
        content = lines.join('\n');
    }
    
    if (file === 'components/ExchangeRules.tsx') {
        let lines = content.split('\n');
        // Let's print the lines with errors to see
        const errLines = [350, 362, 367, 424, 429, 458, 467, 933, 1166, 1449, 1916];
        errLines.forEach(l => {
            const idx = l - 1;
            if (lines[idx].includes('})')) {
                lines[idx] = lines[idx].replace('})', '}])');
            } else if (lines[idx].includes('}')) {
                // maybe it's `}]` replaced by `}`
                // e.g., `filter(Boolean)}` became `filter(Boolean)}`
                lines[idx] = lines[idx].replace('}', '}]');
            }
        });
        content = lines.join('\n');
    }
    
    fs.writeFileSync(file, content);
}

fix('App.tsx');
fix('components/ExchangeRules.tsx');
