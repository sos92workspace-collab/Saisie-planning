import sys

with open('components/ExchangeRules.tsx', 'r') as f:
    code = f.read()

# We need to add `)}` before `          {/* Pending Requests */}` for the 3rd one.
# Let's replace the last `          {/* Pending Requests */}` with `            )}\n          </div>\n          {/* Pending Requests */}`

idx = code.rfind("          {/* Pending Requests */}")
if idx != -1:
    code = code[:idx] + "            )}\n          </div>\n" + code[idx:]
    with open('components/ExchangeRules.tsx', 'w') as f:
        f.write(code)
    print("Fix 2 applied!")
else:
    print("Not found")
