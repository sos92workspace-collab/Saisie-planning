import re

with open('App.tsx', 'r') as f:
    content = f.read()

# Match the button that toggles view mode
#                     {!isConsultationMode && !(viewMode === ViewMode.APP) && (
#                         <button 
#                             onClick={() => setViewMode(viewMode === ViewMode.APP ? ViewMode.LIST_INPUT : ViewMode.APP)}
#                             className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all shadow-sm whitespace-nowrap"
#                         >
#                             <span className="hidden md:inline">{viewMode === ViewMode.APP ? 'Saisie via Liste' : 'Saisie via Planning'}</span>
#                             <span className="md:hidden">{viewMode === ViewMode.APP ? 'Liste' : 'Planning'}</span>
#                         </button>
#                     )}
pattern = re.compile(r'\{\!isConsultationMode.*?Saisie via Liste.*?\}\)', re.DOTALL)
content = re.sub(pattern, '', content)

with open('App.tsx', 'w') as f:
    f.write(content)
