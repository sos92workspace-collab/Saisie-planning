import re

with open('App.tsx', 'r') as f:
    content = f.read()

# 1. Update the reproduction Step to allow PREVIOUS_ROUND
# But AppStep is an enum, we can just use a union type for reproductionStep: AppStep | 'PREVIOUS_ROUND' | null
content = content.replace("const [reproductionStep, setReproductionStep] = useState<AppStep | null>(null);", "const [reproductionStep, setReproductionStep] = useState<AppStep | 'PREVIOUS_ROUND' | null>(null);")

# 2. Add the button in the modal
modal_button = """                    {currentStep > AppStep.GOOD_BONUS_SELECTION && (
                        <button 
                            onClick={() => setReproductionStep(AppStep.GOOD_BONUS_SELECTION)}
                            className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${reproductionStep === AppStep.GOOD_BONUS_SELECTION ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
                        >
                            <div className="font-black text-slate-900 uppercase">Étape 2</div>
                            <div className="text-xs text-slate-500 font-medium">Bonne garde</div>
                        </button>
                    )}"""

new_modal_button = modal_button + """
                    <button 
                        onClick={() => setReproductionStep('PREVIOUS_ROUND')}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${reproductionStep === 'PREVIOUS_ROUND' ? 'border-purple-600 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}
                    >
                        <div className="font-black text-slate-900 uppercase">Tour précédent</div>
                        <div className="text-xs text-slate-500 font-medium">Reprendre vos choix validés/assignés du tour précédent pour cette étape</div>
                    </button>"""

content = content.replace(modal_button, new_modal_button)

# 3. Handle PREVIOUS_ROUND in handleReproduceChoices
repro_logic = """    const sourceCategory = reproductionStep === AppStep.NORMAL_SELECTION ? 'normal' : 
                           reproductionStep === AppStep.GOOD_BONUS_SELECTION ? 'good_bonus' : 'bad_bonus';
    
    const targetCategory = currentStep === AppStep.NORMAL_SELECTION ? 'normal' : 
                           currentStep === AppStep.GOOD_BONUS_SELECTION ? 'good_bonus' : 'bad_bonus';

    const sourceChoices = choices.filter(c => c.userTrigram === trigram.toUpperCase() && c.category === sourceCategory && c.status === 'PENDING');"""

new_repro_logic = """    const targetCategory = currentStep === AppStep.NORMAL_SELECTION ? 'normal' : 
                           currentStep === AppStep.GOOD_BONUS_SELECTION ? 'good_bonus' : 'bad_bonus';

    let sourceChoices: Choice[] = [];
    if (reproductionStep === 'PREVIOUS_ROUND') {
        // Find previous round's assigned/validated choices for this user and this category
        sourceChoices = choices.filter(c => 
            c.userTrigram === trigram.toUpperCase() && 
            c.category === targetCategory && 
            (c.status === 'ASSIGNED' || c.status === 'VALIDATED')
        );
    } else {
        const sourceCategory = reproductionStep === AppStep.NORMAL_SELECTION ? 'normal' : 
                               reproductionStep === AppStep.GOOD_BONUS_SELECTION ? 'good_bonus' : 'bad_bonus';
        sourceChoices = choices.filter(c => 
            c.userTrigram === trigram.toUpperCase() && 
            c.category === sourceCategory && 
            c.status === 'PENDING'
        );
    }"""

content = content.replace(repro_logic, new_repro_logic)

with open('App.tsx', 'w') as f:
    f.write(content)
