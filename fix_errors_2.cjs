const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// abandon_requests - there are multiple updates for abandon_requests. Let's find them.
content = content.replace(/await supabase.from\('abandon_requests'\).update\(\{ shift_snapshot: choiceData, status: action, updated_at: new Date\(\)\.toISOString\(\), processed_by: currentUserTrigram \}\)\.eq\('id', abandonId\);/g, 
  "const { error: err1 } = await supabase.from('abandon_requests').update({ shift_snapshot: choiceData, status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', abandonId);\n                   if (err1) throw err1;");

content = content.replace(/await supabase.from\('abandon_requests'\).update\(\{ status: action, updated_at: new Date\(\)\.toISOString\(\), processed_by: currentUserTrigram \}\)\.eq\('id', abandonId\);/g, 
  "const { error: err2 } = await supabase.from('abandon_requests').update({ status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', abandonId);\n                if (err2) throw err2;");

// take_requests
content = content.replace(/await supabase.from\('take_requests'\).update\(\{ status: action, updated_at: new Date\(\)\.toISOString\(\), processed_by: currentUserTrigram \}\)\.eq\('id', takeId\);/g, 
  "const { error: err3 } = await supabase.from('take_requests').update({ status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', takeId);\n      if (err3) throw err3;");

fs.writeFileSync('components/ExchangeRules.tsx', content);
