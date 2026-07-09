const fs = require('fs');

function fixInserts(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\}\)/g, '})'); // just in case
  
  // Actually, the syntax error is `insert([{ ... })`
  content = content.replace(/insert\(\[\{([^)]+?)\}\)/g, 'insert([{ $1 }])');
  
  // Wait, the regex `/\}\]/g` replaced `}]` with `}`.
  // So `insert([{ ... }])` became `insert([{ ... })` -> wait, if `}]` became `}`, then `}])` became `})`.
  // What about `highlightCells={[{...}]}`? It became `highlightCells={[{...}}`.
  // Let's just find `[{` and balance it.
  
  // Or I can just match `insert([{ ... }` and see how it ends.
}

fixInserts('App.tsx');
