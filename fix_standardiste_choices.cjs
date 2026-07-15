const fs = require('fs');
let content = fs.readFileSync('components/StandardisteDashboard.tsx', 'utf8');

const regex = /const \{ data: choicesData \} = await supabase\.from\('choices'\)\.select\('\*'\);\s*if \(choicesData\) setChoices\(choicesData\);/;

const replacement = `const { data: choicesData } = await supabase.from('choices').select('*');
    if (choicesData) {
        setChoices(choicesData.map((db: any) => ({
            id: db.id, row: db.row, col: db.col, month: db.month - 1, year: db.year,
            groupIndex: db.group_index, subRank: db.sub_rank, category: db.category,
            userTrigram: db.user_trigram, 
            userRole: db.user_role || 'DOCTOR',
            status: db.status, submittedAt: db.submitted_at, roundId: db.round_id,
            colLabel: db.col_label, colType: db.col_type, colTimeRange: db.col_time_range
        })));
    }`;

if (content.match(regex)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('components/StandardisteDashboard.tsx', content);
    console.log("Fixed choices format in StandardisteDashboard");
} else {
    console.log("Not found choices update");
}
