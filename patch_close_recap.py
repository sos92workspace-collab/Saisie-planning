import re

with open('App.tsx', 'r') as f:
    content = f.read()

content = re.sub(r"(\s*\}\)\}\s*<\/div>\s*<\/div>\s*)(\{hoveredCell && \()", r"\1)}\n      \2", content)

with open('App.tsx', 'w') as f:
    f.write(content)
