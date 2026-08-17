import re

with open('App.tsx', 'r') as f:
    content = f.read()

content = content.replace("month: c.month,", "month: c.month - 1,")

with open('App.tsx', 'w') as f:
    f.write(content)
