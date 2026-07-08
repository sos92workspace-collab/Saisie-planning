const fs = require('fs');

const fixFile = (file) => {
    let code = fs.readFileSync(file, 'utf8');
    
    code = code.replace(/<button onClick=\{\(\) => setShowExchangeConfirmModal\(false\)\} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors">Annuler<\/button>/g,
    '<button onClick={() => { setShowExchangeConfirmModal(false); setSelectedTargetChoice(null); }} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors">Annuler</button>');

    code = code.replace(/<button onClick=\{\(\) => setShowTakeConfirmModal\(false\)\} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors">Annuler<\/button>/g,
    '<button onClick={() => { setShowTakeConfirmModal(false); setSelectedTargetChoice(null); }} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors">Annuler</button>');
    
    // Check multiline button in ArchivePlanningDoctorView.tsx
    code = code.replace(/<button\s+onClick=\{\(\) => setShowTakeConfirmModal\(false\)\}\s+className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors"\s*>\s*Annuler\s*<\/button>/g,
    `<button 
        onClick={() => { setShowTakeConfirmModal(false); setSelectedTargetChoice(null); }}
        className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors"
    >
        Annuler
    </button>`);

    code = code.replace(/<button\s+onClick=\{\(\) => setShowExchangeConfirmModal\(false\)\}\s+className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors"\s*>\s*Annuler\s*<\/button>/g,
    `<button 
        onClick={() => { setShowExchangeConfirmModal(false); setSelectedTargetChoice(null); }}
        className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors"
    >
        Annuler
    </button>`);

    fs.writeFileSync(file, code);
};

fixFile('App.tsx');
fixFile('components/ArchivePlanningDoctorView.tsx');
