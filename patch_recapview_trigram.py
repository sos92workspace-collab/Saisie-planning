import re

with open('components/RecapView.tsx', 'r') as f:
    content = f.read()

# 1. Props interface
props_search = """interface Props {
  choices: Choice[];
  columns: ColumnDefinition[];
  onReorder: (newChoices: Choice[]) => void;
  activeRound?: Round;
}"""
props_replace = """interface Props {
  choices: Choice[];
  columns: ColumnDefinition[];
  onReorder: (newChoices: Choice[]) => void;
  activeRound?: Round;
  currentUserTrigram: string;
}"""
content = content.replace(props_search, props_replace)

# 2. Component signature
sig_search = """export const RecapView: React.FC<Props> = ({ choices, columns, onReorder, activeRound }) => {"""
sig_replace = """export const RecapView: React.FC<Props> = ({ choices, columns, onReorder, activeRound, currentUserTrigram }) => {"""
content = content.replace(sig_search, sig_replace)

# 3. cleanupGroupIndices
cleanup_search = """    categories.forEach(category => {
        const catChoices = finalChoices.filter(c => c.status === 'PENDING' && c.category === category);
        const uniqueGroups = Array.from(new Set(catChoices.map(c => c.groupIndex))).sort((a, b) => a - b);
        
        finalChoices = finalChoices.map(c => {
            if (c.status !== 'PENDING' || c.category !== category) return c;"""
cleanup_replace = """    categories.forEach(category => {
        const catChoices = finalChoices.filter(c => c.status === 'PENDING' && c.category === category && c.userTrigram === currentUserTrigram);
        const uniqueGroups = Array.from(new Set(catChoices.map(c => c.groupIndex))).sort((a, b) => a - b);
        
        finalChoices = finalChoices.map(c => {
            if (c.status !== 'PENDING' || c.category !== category || c.userTrigram !== currentUserTrigram) return c;"""
content = content.replace(cleanup_search, cleanup_replace)

# 4. handleMakeMain
makemain_search = """    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== item.category) return c;"""
makemain_replace = """    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== item.category || c.userTrigram !== currentUserTrigram) return c;"""
content = content.replace(makemain_search, makemain_replace)

# 5. handleMakeAlternative
makealt_search = """    const targetGroupItems = choices.filter(c => c.status === 'PENDING' && c.category === item.category && c.groupIndex === targetGroupIndex);"""
makealt_replace = """    const targetGroupItems = choices.filter(c => c.status === 'PENDING' && c.category === item.category && c.groupIndex === targetGroupIndex && c.userTrigram === currentUserTrigram);"""
content = content.replace(makealt_search, makealt_replace)

makealt_map_search = """    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== item.category) return c;"""
makealt_map_replace = """    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== item.category || c.userTrigram !== currentUserTrigram) return c;"""
content = content.replace(makealt_map_search, makealt_map_replace)

# 6. handleRemoveChoice
remove_search = """    const itemToRemove = choices.find(c => c.row === row && c.col === col);"""
remove_replace = """    const itemToRemove = choices.find(c => c.row === row && c.col === col && c.userTrigram === currentUserTrigram);"""
content = content.replace(remove_search, remove_replace)

remove_map_search = """    const newChoices = remaining.map(c => {
        if (c.status === 'PENDING' && c.category === itemToRemove.category && c.groupIndex === itemToRemove.groupIndex && c.subRank > itemToRemove.subRank) {"""
remove_map_replace = """    const newChoices = remaining.map(c => {
        if (c.status === 'PENDING' && c.category === itemToRemove.category && c.userTrigram === currentUserTrigram && c.groupIndex === itemToRemove.groupIndex && c.subRank > itemToRemove.subRank) {"""
content = content.replace(remove_map_search, remove_map_replace)

# 7. flatChoices
flat_search = """    const flatChoices = useMemo(() => {
      return choices
        .filter(c => c.category === category && c.status === 'PENDING')"""
flat_replace = """    const flatChoices = useMemo(() => {
      return choices
        .filter(c => c.category === category && c.status === 'PENDING' && c.userTrigram === currentUserTrigram)"""
content = content.replace(flat_search, flat_replace)

# 8. onReorder filter in CategoryList
reorder_search = """      const finalChoices = choices.map(c => {
        if (c.category === category && c.status === 'PENDING') {"""
reorder_replace = """      const finalChoices = choices.map(c => {
        if (c.category === category && c.status === 'PENDING' && c.userTrigram === currentUserTrigram) {"""
content = content.replace(reorder_search, reorder_replace)

with open('components/RecapView.tsx', 'w') as f:
    f.write(content)
