import sys

with open('components/ExchangeRules.tsx', 'r') as f:
    code = f.read()

code = code.replace('[...exchanges, ...abandons, ...takes]', '[...requests, ...abandons, ...takes]')

with open('components/ExchangeRules.tsx', 'w') as f:
    f.write(code)
print("Done")
