const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const replacement = `
              setChoices((prev: any[]) => [...prev, newChoice]);
              logAction('ASSIGNATION_MANUELLE', { user: cleanTri, date: \`\${editingCell.row}/\${editingCell.month+1}/\${editingCell.year}\`, col: editingCell.col });
              
              if (logInCounter) {
                  const takeReq = {
                      requester_trigram: cleanTri,
                      target_row: editingCell.row,
                      target_col: editingCell.col,
                      target_month: editingCell.month + 1,
                      target_year: editingCell.year,
                      target_col_label: columnConfigs.find((c: any) => c.column_id === editingCell.col)?.col_label || COLUMNS.find(c => c.id === editingCell.col)?.label,
                      status: 'APPROVED',
                      processed_by: currentUserTrigram || 'ADMIN',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                  };
                  supabase.from('take_requests').insert([takeReq]).then(({error}) => {
                      if (error) console.error("Error inserting into take_requests", error);
                  });
              }
              setEditingCell(null);
`;
content = content.replace(/setChoices\(\(prev: any\[\]\) => \[\.\.\.prev, newChoice\]\);\n              logAction\('ASSIGNATION_MANUELLE'[\s\S]*?\);\n          \} else \{/, replacement + "\n          } else {");

// Wait, the existing code didn't reset `editingCell(null)` in `handleAssignment`? Let's check how the modal is closed.
fs.writeFileSync('components/AdminDashboard.tsx', content);
