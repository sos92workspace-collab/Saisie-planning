import re

with open('App.tsx', 'r') as f:
    content = f.read()

target = """            <div className="flex items-center gap-2">
                 <button onClick={() => setChoices(prev => prev.filter(c => c.userTrigram !== trigram.toUpperCase() || c.status !== 'PENDING'))} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase hover:bg-red-200 transition-colors shadow-sm whitespace-nowrap hidden md:block">Effacer tout</button>
                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap hidden lg:block">Sélectionnez la case pour y affecter l'indice</div>
            </div>"""

replacement = """            <div className="flex items-center gap-2">
                 {activeRound?.allow_choice_reproduction && currentStep > AppStep.NORMAL_SELECTION && (
                     <button onClick={() => setShowReproductionModal(true)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase hover:bg-blue-200 transition-colors shadow-sm whitespace-nowrap hidden md:block">Dupliquer choix</button>
                 )}
                 <button onClick={() => setChoices(prev => prev.filter(c => c.userTrigram !== trigram.toUpperCase() || c.status !== 'PENDING'))} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase hover:bg-red-200 transition-colors shadow-sm whitespace-nowrap hidden md:block">Effacer tout</button>
                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap hidden lg:block">Sélectionnez la case pour y affecter l'indice</div>
            </div>"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced dupliquer button")
else:
    print("Target not found")

with open('App.tsx', 'w') as f:
    f.write(content)
