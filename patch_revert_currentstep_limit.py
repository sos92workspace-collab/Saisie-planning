import re
with open('App.tsx', 'r') as f:
    content = f.read()

content = content.replace("activeRound?.allow_choice_reproduction && (", "activeRound?.allow_choice_reproduction && currentStep > AppStep.NORMAL_SELECTION && (")

with open('App.tsx', 'w') as f:
    f.write(content)
