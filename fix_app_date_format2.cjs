const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf8');

const regex = /const formatRequestDate = [\s\S]*?return `Col\. \$\{col\} : \$\{displayLabel\} - \$\{dayName\} \$\{dateStr\}\$\{typeInfos\}`;/m;

content = content.replace(regex, `const formatRequestDate = (day: number | undefined, month: number | undefined, year: number | undefined, col: number | undefined, colLabel: string | undefined, is1IndexedMonth: boolean = false, columnConfigs: ColumnConfig[] = []) => {
  if (day == null || month == null || year == null || col == null) return '';
  const adjustedMonth = is1IndexedMonth ? month - 1 : month;
  const d = new Date(year, adjustedMonth, day);
  const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' }).toUpperCase();
  const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const jf = isPublicHoliday(d) ? ' - JF' : '';
  const columnDef = COLUMNS.find(c => c.id === col);
  const cfg = columnConfigs.find(c => c.column_id === col);
  const displayLabel = colLabel || cfg?.custom_label || columnDef?.label || '';
  
  const typeStr = cfg?.custom_type || columnDef?.type || '';
  const timeStr = cfg?.custom_time_range || columnDef?.timeRange || '';
  
  return \`\${dayName} \${dateStr}\${jf} | \${typeStr} | Col. \${col} : \${displayLabel} | \${timeStr}\`;`);

fs.writeFileSync('App.tsx', content);
