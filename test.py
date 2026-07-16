import sys

with open('components/ExchangeRules.tsx', 'r') as f:
    code = f.read()

target = "          {/* Pending Requests */}"
print(target in code)
