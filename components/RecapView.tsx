import React, { useMemo } from 'react';
import { Choice, ColumnDefinition, ChoiceCategory, Round } from '../types';
import { ArrowUp, ArrowDown, CornerDownRight, CornerUpLeft, Trash2 } from 'lucide-react';

interface Props {
  choices: Choice[];
  columns: ColumnDefinition[];
  onReorder: (newChoices: Choice[]) => void;
  activeRound?: Round;
}

interface GroupedChoice {
  id: number;
  items: Choice[];
}

export const RecapView: React.FC<Props> = ({ choices, columns, onReorder, activeRound }) => {

  // Grouping logic
  const getGrouped = (category: ChoiceCategory): GroupedChoice[] => {
    const filtered = choices.filter(c => c.category === category && c.status === 'PENDING');
    const groups: { [key: number]: Choice[] } = {};
    
    filtered.forEach(c => {
      if (!groups[c.groupIndex]) groups[c.groupIndex] = [];
      groups[c.groupIndex].push(c);
    });

    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b)
      .map(groupId => ({
        id: groupId,
        items: groups[groupId].sort((a, b) => a.subRank - b.subRank)
      }));
  };

  const normalGroups = useMemo(() => getGrouped('normal'), [choices]);
  const badBonusGroups = useMemo(() => getGrouped('bad_bonus'), [choices]);
  const goodBonusGroups = useMemo(() => getGrouped('good_bonus'), [choices]);

  // --- LOGIC: Cleanup Group Indices ---
  // Ensures group indices are strictly sequential (1, 2, 3...) without gaps or decimals
  const cleanupGroupIndices = (currentChoices: Choice[]) => {
    const categories: ChoiceCategory[] = ['normal', 'good_bonus', 'bad_bonus'];
    let finalChoices = [...currentChoices];
    
    categories.forEach(category => {
        const catChoices = finalChoices.filter(c => c.status === 'PENDING' && c.category === category);
        const uniqueGroups = Array.from(new Set(catChoices.map(c => c.groupIndex))).sort((a, b) => a - b);
        
        finalChoices = finalChoices.map(c => {
            if (c.status !== 'PENDING' || c.category !== category) return c;
            const newGroupIndex = uniqueGroups.indexOf(c.groupIndex) + 1;
            return { ...c, groupIndex: newGroupIndex };
        });
    });
    return finalChoices;
  };

  // --- LOGIC: Move Group Up/Down ---
  const handleMoveGroupUp = (category: ChoiceCategory, groupIndex: number) => {
    if (groupIndex <= 1) return;
    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== category) return c;
        if (c.groupIndex === groupIndex) return { ...c, groupIndex: groupIndex - 1 };
        if (c.groupIndex === groupIndex - 1) return { ...c, groupIndex: groupIndex };
        return c;
    });
    onReorder(cleanupGroupIndices(newChoices));
  };

  const handleMoveGroupDown = (category: ChoiceCategory, groupIndex: number) => {
    const maxGroup = Math.max(...choices.filter(c => c.status === 'PENDING' && c.category === category).map(c => c.groupIndex));
    if (groupIndex >= maxGroup) return;
    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== category) return c;
        if (c.groupIndex === groupIndex) return { ...c, groupIndex: groupIndex + 1 };
        if (c.groupIndex === groupIndex + 1) return { ...c, groupIndex: groupIndex };
        return c;
    });
    onReorder(cleanupGroupIndices(newChoices));
  };

  // --- LOGIC: Promote / Demote ---
  const handleMakeMain = (item: Choice) => {
    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== item.category) return c;
        // Move to a new group immediately following its current group
        if (c.id === item.id) return { ...c, groupIndex: item.groupIndex + 0.5, subRank: 1 };
        // Shift remaining alternatives up
        if (c.groupIndex === item.groupIndex && c.subRank > item.subRank) return { ...c, subRank: c.subRank - 1 };
        return c;
    });
    onReorder(cleanupGroupIndices(newChoices));
  };

  const handleMakeAlternative = (item: Choice) => {
    const targetGroupIndex = item.groupIndex - 1;
    if (targetGroupIndex < 1) return;

    const targetGroupItems = choices.filter(c => c.status === 'PENDING' && c.category === item.category && c.groupIndex === targetGroupIndex);
    const maxSubRank = targetGroupItems.length > 0 ? Math.max(...targetGroupItems.map(c => c.subRank)) : 0;

    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== item.category) return c;
        // Move this item to the end of the previous group
        if (c.id === item.id) return { ...c, groupIndex: targetGroupIndex, subRank: maxSubRank + 1 };
        // Promote its former alternatives to main choices
        if (item.subRank === 1 && c.groupIndex === item.groupIndex && c.subRank > 1) return { ...c, subRank: c.subRank - 1 };
        return c;
    });
    onReorder(cleanupGroupIndices(newChoices));
  };

  // --- LOGIC: Remove Item ---
  const handleRemoveChoice = (row: number, col: number) => {
    const itemToRemove = choices.find(c => c.row === row && c.col === col);
    if (!itemToRemove) return;

    const remaining = choices.filter(c => !(c.row === row && c.col === col));
    
    const newChoices = remaining.map(c => {
        if (c.status === 'PENDING' && c.category === itemToRemove.category && c.groupIndex === itemToRemove.groupIndex && c.subRank > itemToRemove.subRank) {
            return { ...c, subRank: c.subRank - 1 };
        }
        return c;
    });
    
    onReorder(cleanupGroupIndices(newChoices));
  };

  // --- RENDER HELPERS ---
  const renderGroupList = (groups: GroupedChoice[], category: ChoiceCategory, title: string, colorTheme: 'blue' | 'orange' | 'indigo') => {
    const themeColors = {
        blue: { border: 'border-blue-600', text: 'text-blue-800', bg: 'bg-blue-600', light: 'bg-blue-50' },
        orange: { border: 'border-orange-500', text: 'text-orange-800', bg: 'bg-orange-500', light: 'bg-orange-50' },
        indigo: { border: 'border-indigo-700', text: 'text-indigo-800', bg: 'bg-indigo-700', light: 'bg-indigo-50' }
    }[colorTheme];

    const maxGroup = groups.length > 0 ? Math.max(...groups.map(g => g.id)) : 0;

    return (
        <div className="flex-1 flex flex-col min-w-[320px] bg-slate-50 border-r border-slate-200 overflow-hidden text-slate-900 last:border-r-0">
          <div className={`p-4 border-b-2 shadow-sm sticky top-0 bg-white z-30 ${themeColors.border} flex justify-between items-center`}>
            <h2 className={`text-[10px] font-black uppercase tracking-tight ${themeColors.text}`}>
              {title}
            </h2>
            <span className="text-[9px] font-bold bg-slate-100 px-2 py-1 rounded-full text-slate-500">{groups.length} Groupes</span>
          </div>
    
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-40">
                  <div className="w-12 h-12 bg-slate-200 rounded-full mb-3 flex items-center justify-center text-2xl">∅</div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aucun choix</span>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                  {/* Group Header */}
                  <div className={`px-3 py-2 border-b border-slate-100 flex justify-between items-center ${themeColors.light}`}>
                      <span className={`text-xs font-black uppercase tracking-wider ${themeColors.text}`}>
                          Priorité {group.id}
                      </span>
                      <div className="flex items-center gap-1">
                          <button 
                              onClick={() => handleMoveGroupUp(category, group.id)}
                              disabled={group.id === 1}
                              className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors bg-white rounded shadow-sm border border-slate-200 hover:border-slate-300"
                              title="Monter cette priorité"
                          >
                              <ArrowUp size={14} strokeWidth={2.5} />
                          </button>
                          <button 
                              onClick={() => handleMoveGroupDown(category, group.id)}
                              disabled={group.id === maxGroup}
                              className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors bg-white rounded shadow-sm border border-slate-200 hover:border-slate-300"
                              title="Descendre cette priorité"
                          >
                              <ArrowDown size={14} strokeWidth={2.5} />
                          </button>
                      </div>
                  </div>

                  {/* Items */}
                  <div className="flex flex-col">
                      {group.items.map(item => {
                          const colDef = columns.find(c => c.id === item.col);
                          const isAlternative = item.subRank > 1;

                          return (
                              <div key={item.id} className={`flex items-center justify-between p-3 border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/80 ${isAlternative ? 'bg-slate-50/50 pl-8' : ''}`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                      <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-sm ${!isAlternative ? themeColors.bg : 'bg-slate-400'}`}>
                                          {item.subRank === 1 ? item.groupIndex : `${item.groupIndex}.${String.fromCharCode(95 + item.subRank)}`}
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                          <span className="font-bold text-slate-700 text-xs uppercase truncate">{colDef?.label || `Col ${item.col}`}</span>
                                          <span className="text-[10px] text-slate-400 font-medium">
                                              {new Date(item.year, item.month, item.row).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                          </span>
                                      </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                                      {isAlternative && (
                                          <button onClick={() => handleMakeMain(item)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Détacher en tant que nouvelle priorité principale">
                                              <CornerUpLeft size={16} strokeWidth={2.5} />
                                          </button>
                                      )}
                                      {!isAlternative && item.groupIndex > 1 && (
                                          <button onClick={() => handleMakeAlternative(item)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Fusionner comme alternative de la priorité précédente">
                                              <CornerDownRight size={16} strokeWidth={2.5} />
                                          </button>
                                      )}
                                      <button onClick={() => handleRemoveChoice(item.row, item.col)} className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer ce vœu">
                                          <Trash2 size={16} strokeWidth={2.5} />
                                      </button>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-100">
      {(activeRound?.step_normal_active ?? true) && renderGroupList(normalGroups, 'normal', 'Étape 1', 'orange')}
      {(activeRound?.step_good_bonus_active ?? true) && renderGroupList(goodBonusGroups, 'good_bonus', 'Étape 2', 'blue')}
      {(activeRound?.step_bad_bonus_active ?? true) && renderGroupList(badBonusGroups, 'bad_bonus', 'Étape 3 - Garde au choix', 'indigo')}
    </div>
  );
};
