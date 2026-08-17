const sourceChoices = [
    { row: 1, col: 1, month: 0, year: 2026, groupIndex: 1, subRank: 1 },
    { row: 2, col: 1, month: 0, year: 2026, groupIndex: 2, subRank: 1 },
];
const currentCategoryChoices = [];
let maxGroupIndex = 0;
const newChoices = [];

const groupedSourceChoices = sourceChoices.reduce((acc, choice) => {
    if (!acc[choice.groupIndex]) acc[choice.groupIndex] = [];
    acc[choice.groupIndex].push(choice);
    return acc;
}, {});

const sortedGroupIndices = Object.keys(groupedSourceChoices).map(Number).sort((a, b) => a - b);

for (const groupIndex of sortedGroupIndices) {
    const group = groupedSourceChoices[groupIndex].sort((a, b) => a.subRank - b.subRank);
    let hasAddedToGroup = false;
    let currentSubRank = 1;
    
    for (const choice of group) {
        // mock isColOpen
        const isColOpen = true; 
        if (isColOpen) {
            const alreadyExists = currentCategoryChoices.some(c => c.row === choice.row && c.col === choice.col && c.month === choice.month && c.year === choice.year);
            if (!alreadyExists) {
                if (!hasAddedToGroup) {
                    maxGroupIndex++;
                    hasAddedToGroup = true;
                }
                newChoices.push({
                    ...choice,
                    groupIndex: maxGroupIndex,
                    subRank: currentSubRank
                });
                currentSubRank++;
            }
        }
    }
}
console.log(newChoices);
