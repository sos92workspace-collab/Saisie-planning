const fs = require('fs');

let content = fs.readFileSync('components/ExchangeRules.tsx', 'utf8');

// 1. Rewrite formatRequestDate
content = content.replace(
/const formatRequestDate = \([^)]+\) => {[\s\S]*?return `Col\. \$\{col\} : \$\{displayLabel\} - \$\{dayName\} \$\{dateStr\}\$\{jf\}\$\{typeInfos\}`;/m,
`const formatRequestDate = (day: number | undefined, month: number | undefined, year: number | undefined, col: number | undefined, colLabel: string | undefined, is1IndexedMonth: boolean = false, columnConfigs: any[] = []) => {
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
  
  return \`\${dayName} \${dateStr}\${jf} | \${typeStr} | Col. \${col} : \${displayLabel} | \${timeStr}\`;`
);

// 2. Replace "traité le" with "Demandé le ..., traité le ..."
content = content.replace(/Abandon traité le \{new Date\(ab\.updated_at \|\| ab\.created_at\)\.toLocaleDateString\('fr-FR'\)\}/g, "Demandé le {new Date(ab.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(ab.updated_at || ab.created_at).toLocaleDateString('fr-FR')}");
content = content.replace(/Échange traité le \{new Date\(ex\.updated_at \|\| ex\.created_at\)\.toLocaleDateString\('fr-FR'\)\}/g, "Demandé le {new Date(ex.created_at).toLocaleDateString('fr-FR')}, traité le {new Date(ex.updated_at || ex.created_at).toLocaleDateString('fr-FR')}");

fs.writeFileSync('components/ExchangeRules.tsx', content);
