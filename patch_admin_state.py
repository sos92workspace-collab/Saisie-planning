import re

with open('components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Add new state variables for reset options
state_vars = """
  const [resetOptions, setResetOptions] = useState({
    choicesDoctors: true,
    choicesStandardists: true,
    unavailabilities: true,
    globalClosures: false
  });
"""

# Insert right after `const [showDeleteModal, setShowDeleteModal] = useState(false);`
content = content.replace("const [showDeleteModal, setShowDeleteModal] = useState(false);", "const [showDeleteModal, setShowDeleteModal] = useState(false);\n" + state_vars)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
