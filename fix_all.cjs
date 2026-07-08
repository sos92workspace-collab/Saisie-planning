const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    content = content.replace(/onClick=\{\(\) => setShowTakeConfirmModal\(false\)\}/g, "onClick={() => { setShowTakeConfirmModal(false); setSelectedTargetChoice(null); }}");
    content = content.replace(/onClick=\{\(\) => setShowExchangeConfirmModal\(false\)\}/g, "onClick={() => { setShowExchangeConfirmModal(false); setSelectedTargetChoice(null); }}");
    
    fs.writeFileSync(file, content);
}

fix('App.tsx');
fix('components/ArchivePlanningDoctorView.tsx');
