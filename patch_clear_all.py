import re

with open('App.tsx', 'r') as f:
    content = f.read()

target = """<button onClick={() => setChoices([])} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase hover:bg-red-200 transition-colors shadow-sm whitespace-nowrap hidden md:block">Effacer tout</button>"""
replacement = """<button onClick={() => setChoices(prev => prev.filter(c => c.userTrigram !== trigram.toUpperCase() || c.status !== 'PENDING'))} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase hover:bg-red-200 transition-colors shadow-sm whitespace-nowrap hidden md:block">Effacer tout</button>"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced clear all")
else:
    print("Not found clear all")

with open('App.tsx', 'w') as f:
    f.write(content)
