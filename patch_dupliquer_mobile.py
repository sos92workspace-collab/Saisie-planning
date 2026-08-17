import re

with open('App.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    """<button onClick={() => setShowReproductionModal(true)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase hover:bg-blue-200 transition-colors shadow-sm whitespace-nowrap hidden md:block">Dupliquer choix</button>""",
    """<button onClick={() => setShowReproductionModal(true)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase hover:bg-blue-200 transition-colors shadow-sm whitespace-nowrap">Dupliquer choix</button>"""
)

with open('App.tsx', 'w') as f:
    f.write(content)
