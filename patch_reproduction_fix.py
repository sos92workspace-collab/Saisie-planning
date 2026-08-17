import re

with open('App.tsx', 'r') as f:
    content = f.read()

bad_code = """    const groupedSourceChoices = sourceChoices.reduce((acc, choice) => {
        if (!acc[choice.groupIndex]) acc[choice.groupIndex] = [];
        acc[choice.groupIndex].push(choice);
        return acc;
    }, {} as Record<number, Choice[]>);

    // Ensure we only reproduce choices that fall within the current round's months
    sourceChoices = sourceChoices.filter(c => monthsToDisplay.some(m => m.month === c.month && m.year === c.year));

    const groupedSourceChoices = sourceChoices.reduce((acc, choice) => {
        if (!acc[choice.groupIndex]) acc[choice.groupIndex] = [];
        acc[choice.groupIndex].push(choice);
        return acc;
    }, {} as Record<number, Choice[]>);"""

good_code = """    // Ensure we only reproduce choices that fall within the current round's months
    sourceChoices = sourceChoices.filter(c => monthsToDisplay.some(m => m.month === c.month && m.year === c.year));

    const groupedSourceChoices = sourceChoices.reduce((acc, choice) => {
        if (!acc[choice.groupIndex]) acc[choice.groupIndex] = [];
        acc[choice.groupIndex].push(choice);
        return acc;
    }, {} as Record<number, Choice[]>);"""

content = content.replace(bad_code, good_code)

with open('App.tsx', 'w') as f:
    f.write(content)
