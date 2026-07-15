const fs = require('fs');
let content = fs.readFileSync('components/StandardisteDashboard.tsx', 'utf8');

const fetchAllStr = `
const fetchAll = async (supabaseClient: any, table: string, queryModifier: (q: any) => any = (q) => q) => {
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabaseClient.from(table).select('*');
    query = queryModifier(query);
    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error(error);
      break;
    }
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (data.length < pageSize) break;
      page++;
    } else {
      break;
    }
  }
  return allData;
};
`;

if (!content.includes('const fetchAll =')) {
    content = content.replace(
        "const logAction = async (action: string, details: any = {}) => {",
        `${fetchAllStr}\n\n  const logAction = async (action: string, details: any = {}) => {`
    );
    
    content = content.replace(
        "const { data: choicesData } = await supabase.from('choices').select('*');",
        "const choicesData = await fetchAll(supabase, 'choices');"
    );

    fs.writeFileSync('components/StandardisteDashboard.tsx', content);
    console.log("Added fetchAll to StandardisteDashboard");
}
