import re

with open('App.tsx', 'r') as f:
    content = f.read()

# AdminDashboard
content = content.replace("<AdminDashboard users={users} setUsers={setUsers} rounds={rounds} setRounds={setRounds} supabase={supabase} onLogout={handleLogout} currentUserTrigram={trigram} />", "<AdminDashboard users={users} setUsers={setUsers} rounds={rounds} setRounds={setRounds} supabase={supabase} onLogout={handleLogout} currentUserTrigram={trigram} onOpenTerms={() => setIsTermsModalOpen(true)} />")

# StandardisteDashboard
content = content.replace("<StandardisteDashboard users={users} supabase={supabase} onLogout={handleLogout} currentUserTrigram={trigram} activeRound={activeRound} columnConfigs={columnConfigs} globalClosures={globalClosures} />", "<StandardisteDashboard users={users} supabase={supabase} onLogout={handleLogout} currentUserTrigram={trigram} activeRound={activeRound} columnConfigs={columnConfigs} globalClosures={globalClosures} onOpenTerms={() => setIsTermsModalOpen(true)} />")

with open('App.tsx', 'w') as f:
    f.write(content)
