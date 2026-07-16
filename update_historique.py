import sys

with open('components/ExchangeRules.tsx', 'r') as f:
    code = f.read()

target = """      {activeTab === 'HISTORIQUE' && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6">"""

replacement = """      {activeTab === 'HISTORIQUE' && (
        <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-8">
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6">"""

code = code.replace(target, replacement)

with open('components/ExchangeRules.tsx', 'w') as f:
    f.write(code)

print("Updated historique")
