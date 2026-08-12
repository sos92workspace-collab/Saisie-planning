import re

with open('components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

old_block = """          // Clear choices, unavailabilities
          await supabase.from('choices').delete().not('id', 'is', null);
          await supabase.from('unavailabilities').delete().not('id', 'is', null);
          logAction('VIDER_BASE', { mode: 'ALL' });"""

new_block = """          // Apply selected resets
          if (resetOptions.choicesDoctors) {
             await supabase.from('choices').delete().in('user_role', ['DOCTOR', 'SUBSTITUTE']);
          }
          if (resetOptions.choicesStandardists) {
             await supabase.from('choices').delete().eq('user_role', 'STANDARDISTE');
          }
          if (resetOptions.unavailabilities) {
             await supabase.from('unavailabilities').delete().not('id', 'is', null);
          }
          if (resetOptions.globalClosures) {
             await supabase.from('global_closures').delete().not('id', 'is', null);
          }
          logAction('VIDER_BASE', { mode: 'CUSTOM_RESET', options: resetOptions });"""

content = content.replace(old_block, new_block)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
