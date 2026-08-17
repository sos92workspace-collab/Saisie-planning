import re
with open('App.tsx', 'r') as f:
    content = f.read()

state_vars = """
  const [showMyChoicesOnly, setShowMyChoicesOnly] = useState(false);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [selectedPriorityIndex, setSelectedPriorityIndex] = useState(1);
  const tableContainerRef = useRef<HTMLDivElement>(null);
"""
# find a place to put them
# search for `const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);`
content = content.replace("const [isDataSyncing, setIsDataSyncing] = useState(false);", "const [isDataSyncing, setIsDataSyncing] = useState(false);\n" + state_vars)

with open('App.tsx', 'w') as f:
    f.write(content)
