import re

with open('App.tsx', 'r') as f:
    content = f.read()

target = """        <RecapView 
            choices={choices} 
            onReorder={setChoices}
            columns={dynamicColumns}
            activeRound={activeRound}
        />"""

replacement = """        <RecapView 
            choices={choices} 
            onReorder={setChoices}
            columns={dynamicColumns}
            activeRound={activeRound}
            currentUserTrigram={trigram.toUpperCase()}
        />"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced in App.tsx")
else:
    print("Not found in App.tsx")

with open('App.tsx', 'w') as f:
    f.write(content)
