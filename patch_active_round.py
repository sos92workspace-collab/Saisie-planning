import re

with open('App.tsx', 'r') as f:
    content = f.read()

# Replace the start
content = content.replace(
    '<div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative" ref={tableContainerRef}>',
    '{activeRound && (\n      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative" ref={tableContainerRef}>'
)

# Put the closing bracket back
# Wait, I need to know where it ends exactly.
# It ends at:
#           </div>
#       </div>
#       {hoveredCell && (
content = content.replace(
    '          </div>\n      </div>\n\n      {hoveredCell && (',
    '          </div>\n        )}\n      </div>\n      )}\n\n      {hoveredCell && ('
)
# Wait, the previous structure was:
#         </div>
#       </div>
# So if I add )} after the first </div>?
# Let's check exactly what the end looks like.
