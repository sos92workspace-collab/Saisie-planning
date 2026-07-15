const fs = require('fs');
let content = fs.readFileSync('components/StandardisteDashboard.tsx', 'utf8');

const logActionString = `  const logAction = async (action: string, details: any = {}) => {
    try {
      await supabase.from('logs').insert([{ action, details: { ...details, user: currentUserTrigram } }]);
    } catch (e) {
      console.error(e);
    }
  };`;

if (!content.includes('const logAction =')) {
    content = content.replace(
        "const refreshData = async () => {",
        `${logActionString}\n\n  const refreshData = async () => {`
    );
    
    content = content.replace(
        "logAction={async () => {}}",
        "logAction={logAction}"
    );

    fs.writeFileSync('components/StandardisteDashboard.tsx', content);
    console.log("Added logAction to StandardisteDashboard");
}
