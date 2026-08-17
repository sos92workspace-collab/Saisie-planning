import re
with open('components/StandardisteDashboard.tsx', 'r') as f:
    content = f.read()

# I need to add onOpenTerms and onOpenLegal to the Props and destructuring in StandardisteDashboard
props_interface = "export const StandardisteDashboard = ({ users, supabase, onLogout, currentUserTrigram, activeRound, columnConfigs, globalClosures, onOpenTerms, onOpenLegal }: any) => {"

content = re.sub(r"export const StandardisteDashboard = \(\{.*\}\: any\) => \{", props_interface, content)

with open('components/StandardisteDashboard.tsx', 'w') as f:
    f.write(content)
