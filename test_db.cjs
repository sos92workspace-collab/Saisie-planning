const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    if (line.includes('=')) {
        const [k, v] = line.split('=');
        acc[k.trim()] = v.trim();
    }
    return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: stData } = await supabase.from('choices').select('status');
  const counts = {};
  for (const row of (stData || [])) {
      counts[row.status] = (counts[row.status] || 0) + 1;
  }
  console.log("Statuses in choices:", counts);
}
check();
