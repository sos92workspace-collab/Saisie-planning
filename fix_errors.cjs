const fs = require('fs');
let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

content = content.replace(/await supabase.from\('exchange_requests'\).update\(\{ status: action, updated_at: new Date\(\)\.toISOString\(\), processed_by: currentUserTrigram \}\)\.eq\('id', requestId\);/g, 
  "const { error } = await supabase.from('exchange_requests').update({ status: action, updated_at: new Date().toISOString(), processed_by: currentUserTrigram }).eq('id', requestId);\n      if (error) throw error;");

fs.writeFileSync('components/ExchangeRules.tsx', content);
