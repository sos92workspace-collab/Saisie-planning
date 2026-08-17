import re

with open('App.tsx', 'r') as f:
    content = f.read()

# 1. State change
content = content.replace(
    "const [reproductionStep, setReproductionStep] = useState<AppStep | 'PREVIOUS_ROUND' | null>(null);",
    "const [reproductionStep, setReproductionStep] = useState<AppStep | null>(null);"
)

# 2. Logic change
old_logic = """    let sourceChoices: Choice[] = [];
    if (reproductionStep === 'PREVIOUS_ROUND') {
        // Find previous round's assigned/validated choices for this user and this category
        const previousFromChoices = choices.filter(c => 
            c.userTrigram === trigram.toUpperCase() && 
            c.category === targetCategory && 
            (c.status === 'ASSIGNED' || c.status === 'VALIDATED')
        );
        const previousFromArchived = archivedChoices.filter(c => 
            c.user_trigram === trigram.toUpperCase() && 
            c.category === targetCategory && 
            (c.status === 'ASSIGNED' || c.status === 'VALIDATED' || c.status === 'ARCHIVED')
        ).map(c => ({
            id: c.id,
            row: c.row,
            col: c.col,
            month: c.month - 1,
            year: c.year,
            groupIndex: c.group_index,
            subRank: c.sub_rank,
            category: c.category as ChoiceCategory,
            userTrigram: c.user_trigram,
            userRole: c.user_role as UserRole,
            status: c.status,
            submittedAt: c.submitted_at,
            roundId: c.round_id
        }));
        sourceChoices = [...previousFromChoices, ...previousFromArchived];
    } else {
        const sourceCategory = reproductionStep === AppStep.NORMAL_SELECTION ? 'normal' : 
                               reproductionStep === AppStep.GOOD_BONUS_SELECTION ? 'good_bonus' : 'bad_bonus';
        sourceChoices = choices.filter(c => 
            c.userTrigram === trigram.toUpperCase() && 
            c.category === sourceCategory && 
            c.status === 'PENDING'
        );
    }"""

new_logic = """    const sourceCategory = reproductionStep === AppStep.NORMAL_SELECTION ? 'normal' : 
                           reproductionStep === AppStep.GOOD_BONUS_SELECTION ? 'good_bonus' : 'bad_bonus';
    
    let sourceChoices = choices.filter(c => 
        c.userTrigram === trigram.toUpperCase() && 
        c.category === sourceCategory && 
        c.status === 'PENDING'
    );"""

content = content.replace(old_logic, new_logic)

# 3. Modal UI change
old_ui = """                    )}
                    <button 
                        onClick={() => setReproductionStep('PREVIOUS_ROUND')}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${reproductionStep === 'PREVIOUS_ROUND' ? 'border-purple-600 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}
                    >
                        <div className="font-black text-slate-900 uppercase">Tour précédent</div>
                        <div className="text-xs text-slate-500 font-medium">Reprendre vos choix validés/assignés du tour précédent pour cette étape</div>
                    </button>
                </div>"""

new_ui = """                    )}
                </div>"""

content = content.replace(old_ui, new_ui)

with open('App.tsx', 'w') as f:
    f.write(content)
