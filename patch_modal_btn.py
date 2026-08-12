import re

with open('components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

old_btn = """<button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase">Confirmer</button>"""

new_btn = """<button onClick={executeDelete} disabled={deleteMode === 'ALL' && !resetOptions.choicesDoctors && !resetOptions.choicesStandardists && !resetOptions.unavailabilities && !resetOptions.globalClosures} className={`flex-1 py-3 text-white rounded-xl text-xs font-black uppercase transition-all ${deleteMode === 'ALL' && !resetOptions.choicesDoctors && !resetOptions.choicesStandardists && !resetOptions.unavailabilities && !resetOptions.globalClosures ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>Confirmer</button>"""

content = content.replace(old_btn, new_btn)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
