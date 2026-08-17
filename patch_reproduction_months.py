import re

with open('App.tsx', 'r') as f:
    content = f.read()

filter_logic = """    const sortedGroupIndices = Object.keys(groupedSourceChoices).map(Number).sort((a, b) => a - b);"""

new_filter_logic = """    // Ensure we only reproduce choices that fall within the current round's months
    sourceChoices = sourceChoices.filter(c => monthsToDisplay.some(m => m.month === c.month && m.year === c.year));

    const groupedSourceChoices = sourceChoices.reduce((acc, choice) => {
        if (!acc[choice.groupIndex]) acc[choice.groupIndex] = [];
        acc[choice.groupIndex].push(choice);
        return acc;
    }, {} as Record<number, Choice[]>);

    const sortedGroupIndices = Object.keys(groupedSourceChoices).map(Number).sort((a, b) => a - b);"""

content = content.replace(filter_logic, new_filter_logic)

with open('App.tsx', 'w') as f:
    f.write(content)
