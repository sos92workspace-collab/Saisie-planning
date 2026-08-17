import re

with open('App.tsx', 'r') as f:
    content = f.read()

repro_logic = """    if (reproductionStep === 'PREVIOUS_ROUND') {
        // Find previous round's assigned/validated choices for this user and this category
        sourceChoices = choices.filter(c => 
            c.userTrigram === trigram.toUpperCase() && 
            c.category === targetCategory && 
            (c.status === 'ASSIGNED' || c.status === 'VALIDATED')
        );
    }"""

new_repro_logic = """    if (reproductionStep === 'PREVIOUS_ROUND') {
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
            month: c.month,
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
    }"""

content = content.replace(repro_logic, new_repro_logic)

with open('App.tsx', 'w') as f:
    f.write(content)
