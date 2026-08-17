import re

with open('App.tsx', 'r') as f:
    content = f.read()

target = """      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative" ref={tableContainerRef}>
        <div className="min-w-max pb-32 md:pb-12 bg-white">
          {monthsToDisplay.map((m: any) => {"""

replacement = """      {currentStep === AppStep.RECAP_ORDERING && !isConsultationMode ? (
        <RecapView 
            choices={choices} 
            setChoices={setChoices}
            columns={dynamicColumns}
            columnConfigs={columnConfigs}
            activeRound={activeRound}
        />
      ) : (
      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative" ref={tableContainerRef}>
        <div className="min-w-max pb-32 md:pb-12 bg-white">
          {monthsToDisplay.map((m: any) => {"""

if target in content:
    content = content.replace(target, replacement)
    
    # Now need to close the added block at the end of the month rendering
    # Wait, the closing brace of the original div is around line 2530 maybe?
    # Let's find out where the `monthsToDisplay.map` block ends.
else:
    print("Target not found")

with open('App.tsx', 'w') as f:
    f.write(content)
