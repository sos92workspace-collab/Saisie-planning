const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// Inside handleFinalAbandonConfirm:
const regex = /const reqAbandon = \{\s*requester_trigram: abandonedChoice\.userTrigram,\s*shift_snapshot: \{\s*row: abandonedChoice\.row,\s*month: abandonedChoice\.month \+ 1,\s*year: abandonedChoice\.year,\s*col: abandonedChoice\.col,\s*colLabel: abandonedChoice\.colLabel \|\| columnConfigs\.find\(\(c: any\) => c\.column_id === abandonedChoice\.col\)\?\.custom_label \|\| columnConfigs\.find\(\(c: any\) => c\.column_id === abandonedChoice\.col\)\?\.name,\s*target_row: replacementCell\.row,\s*target_month: replacementCell\.month \+ 1,\s*target_year: replacementCell\.year,\s*target_col: replacementCell\.col\s*\},\s*status: 'APPROVED',\s*processed_by: \(typeof currentUserTrigram !== 'undefined' \? currentUserTrigram : 'ADMIN'\),\s*created_at: new Date\(\)\.toISOString\(\),\s*updated_at: new Date\(\)\.toISOString\(\)\s*\};/;

const replacement = `
      const takeReq = {
          requester_trigram: abandonedChoice.userTrigram,
          target_row: replacementCell.row,
          target_col: replacementCell.col,
          target_month: replacementCell.month + 1,
          target_year: replacementCell.year,
          target_col_label: replacementCell.colLabel || columnConfigs.find((c: any) => c.column_id === replacementCell.col)?.custom_label || columnConfigs.find((c: any) => c.column_id === replacementCell.col)?.name,
          status: 'APPROVED',
          processed_by: currentUserTrigram || 'ADMIN',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
      };
      
      let takeId = null;
      const { data: takeData, error: takeError } = await supabase.from('take_requests').insert([takeReq]).select().single();
      if (!takeError && takeData) {
          takeId = takeData.id;
      }

      const reqAbandon = {
          requester_trigram: abandonedChoice.userTrigram,
          shift_snapshot: {
              row: abandonedChoice.row,
              month: abandonedChoice.month + 1,
              year: abandonedChoice.year,
              col: abandonedChoice.col,
              colLabel: abandonedChoice.colLabel || columnConfigs.find((c: any) => c.column_id === abandonedChoice.col)?.custom_label || columnConfigs.find((c: any) => c.column_id === abandonedChoice.col)?.name,
              linked_take: takeId ? {
                  id: takeId,
                  row: replacementCell.row,
                  col: replacementCell.col,
                  month: replacementCell.month + 1,
                  year: replacementCell.year,
                  colLabel: replacementCell.colLabel || columnConfigs.find((c: any) => c.column_id === replacementCell.col)?.custom_label || columnConfigs.find((c: any) => c.column_id === replacementCell.col)?.name,
              } : null
          },
          status: 'APPROVED',
          processed_by: (typeof currentUserTrigram !== 'undefined' ? currentUserTrigram : 'ADMIN'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
      };
`;

content = content.replace(regex, replacement);

fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log("Fixed AdminDashboard");
