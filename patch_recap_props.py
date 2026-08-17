import re

with open('App.tsx', 'r') as f:
    content = f.read()

target = """        <RecapView 
            choices={choices} 
            setChoices={setChoices}
            columns={dynamicColumns}
            columnConfigs={columnConfigs}
            activeRound={activeRound}
        />"""

replacement = """        <RecapView 
            choices={choices} 
            onReorder={setChoices}
            columns={dynamicColumns}
            activeRound={activeRound}
        />"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced props")
else:
    print("Target not found")

with open('App.tsx', 'w') as f:
    f.write(content)
