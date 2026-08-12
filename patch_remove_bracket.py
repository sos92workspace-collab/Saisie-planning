import re

with open('App.tsx', 'r') as f:
    content = f.read()

content = content.replace("          </div>\n        )}\n      </div>", "          </div>\n      </div>")

with open('App.tsx', 'w') as f:
    f.write(content)
