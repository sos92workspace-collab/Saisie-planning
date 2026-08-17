import re

with open('App.tsx', 'r') as f:
    content = f.read()

target = """            })}
          </div>
      </div>
      {hoveredCell && ("""

replacement = """            })}
          </div>
      </div>
      )}
      {hoveredCell && ("""

if target in content:
    content = content.replace(target, replacement)
else:
    print("Target not found")

with open('App.tsx', 'w') as f:
    f.write(content)
