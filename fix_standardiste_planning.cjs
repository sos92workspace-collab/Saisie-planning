const fs = require('fs');
let content = fs.readFileSync('components/StandardisteDashboard.tsx', 'utf8');

if (!content.includes("{ id: 'PLANNING'")) {
    content = content.replace(
        "const navItems = [",
        "const navItems = [\n    { id: 'PLANNING', label: 'Planning Actuel', icon: Calendar },"
    );
    
    content = content.replace(
        "{activeTab === 'ECHANGES' && (",
        `{activeTab === 'PLANNING' && (
            <PlanningPanel
                currentUserTrigram={currentUserTrigram}
                choices={choices}
                setChoices={setChoices}
                users={users}
                activeRound={activeRound}
                columnConfigs={columnConfigs}
                quotas={{}}
                headerConfigs={headerConfigs}
                supabase={supabase}
                globalClosures={globalClosures}
                setGlobalClosures={() => {}}
                logAction={async () => {}}
            />
          )}
          {activeTab === 'ECHANGES' && (`
    );
    
    // Also change the default tab to PLANNING
    content = content.replace(
        "const [activeTab, setActiveTab] = useState<'ECHANGES' | 'ARCHIVES'>('ECHANGES');",
        "const [activeTab, setActiveTab] = useState<'PLANNING' | 'ECHANGES' | 'ARCHIVES'>('PLANNING');"
    );

    fs.writeFileSync('components/StandardisteDashboard.tsx', content);
    console.log("Fixed StandardisteDashboard tabs");
}
