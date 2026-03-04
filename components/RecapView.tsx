
import React, { useState, useMemo } from 'react';
import { Choice, ColumnDefinition, ChoiceCategory } from '../types';

interface Props {
  choices: Choice[];
  columns: ColumnDefinition[];
  onReorder: (newChoices: Choice[]) => void;
}

interface GroupedChoice {
  id: number;
  items: Choice[];
}

// Icons
const GripIcon = () => (
  <svg className="w-4 h-4 text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
);

const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
);

export const RecapView: React.FC<Props> = ({ choices, columns, onReorder }) => {
  // DnD State
  const [draggedItem, setDraggedItem] = useState<Choice | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<{id: number, category: ChoiceCategory} | null>(null);
  const [dragOverItemInfo, setDragOverItemInfo] = useState<{row: number, col: number, position: 'top' | 'bottom'} | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<number | null>(null);

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

  // --- LOGIC: Remove Item ---
  const handleRemoveChoice = (row: number, col: number) => {
    const itemToRemove = choices.find(c => c.row === row && c.col === col);
    if (!itemToRemove) return;

    const newChoices = choices
      .filter(c => !(c.row === row && c.col === col))
      .map(c => {
        // Shift subRanks up for remaining items in same group
        if (c.category === itemToRemove.category && c.groupIndex === itemToRemove.groupIndex && c.subRank > itemToRemove.subRank) {
          return { ...c, subRank: c.subRank - 1 };
        }
        return c;
      });
    
    onReorder(newChoices);
  };

  // --- LOGIC: Item Drag & Drop (Reordering alternatives) ---
  const handleItemDragStart = (e: React.DragEvent, item: Choice) => {
    e.stopPropagation();
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleItemDragOver = (e: React.DragEvent, targetItem: Choice) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.category !== targetItem.category) return;
    
    // Determine if we are hovering top or bottom half to show insertion line
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'top' : 'bottom';
    
    setDragOverItemInfo({ row: targetItem.row, col: targetItem.col, position });
  };

  const handleItemDrop = (e: React.DragEvent, targetItem: Choice) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemInfo(null);

    if (!draggedItem || draggedItem.id === targetItem.id) {
        setDraggedItem(null);
        return;
    }

    if (draggedItem.category !== targetItem.category) return;

    // Moving within same group or moving to another group (targeting an item)
    // If target group is different, change groupIndex
    const isSameGroup = draggedItem.groupIndex === targetItem.groupIndex;
    
    // Prepare items list for calculation
    // We want to construct the FINAL list for the target group
    const targetGroupItems = choices
        .filter(c => c.category === targetItem.category && c.groupIndex === targetItem.groupIndex && c.id !== draggedItem.id)
        .sort((a, b) => a.subRank - b.subRank);

    // Determine insertion index
    const targetIndex = targetGroupItems.findIndex(c => c.id === targetItem.id);
    const insertAtIndex = dragOverItemInfo?.position === 'top' ? targetIndex : targetIndex + 1;
    
    // Insert dragged item
    const newItem = { ...draggedItem, groupIndex: targetItem.groupIndex };
    targetGroupItems.splice(insertAtIndex, 0, newItem);

    // Re-rank target group
    const newTargetGroupItems = targetGroupItems.map((item, idx) => ({ ...item, subRank: idx + 1 }));

    // If different group, we also need to re-rank source group (remove gap)
    let newSourceGroupItems: Choice[] = [];
    if (!isSameGroup) {
        newSourceGroupItems = choices
            .filter(c => c.category === draggedItem.category && c.groupIndex === draggedItem.groupIndex && c.id !== draggedItem.id)
            .sort((a, b) => a.subRank - b.subRank)
            .map((item, idx) => ({ ...item, subRank: idx + 1 }));
    }

    // Combine all
    const others = choices.filter(c => 
        !(c.category === targetItem.category && c.groupIndex === targetItem.groupIndex) && 
        !(c.category === draggedItem.category && c.groupIndex === draggedItem.groupIndex)
    );

    // Careful not to duplicate if groups are same (already handled in targetGroupItems)
    const finalChoices = isSameGroup 
        ? [...others, ...newTargetGroupItems]
        : [...others, ...newSourceGroupItems, ...newTargetGroupItems];

    onReorder(finalChoices);
    setDraggedItem(null);
  };

  // --- LOGIC: Group Drag & Drop (Reordering priorities) ---
  const handleGroupDragStart = (e: React.DragEvent, id: number, category: ChoiceCategory) => {
    setDraggedGroup({ id, category });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleGroupDragOver = (e: React.DragEvent, targetGroupId: number, category: ChoiceCategory) => {
    e.preventDefault();
    
    // If dragging an ITEM over a group header/container (to move it to this group)
    if (draggedItem && draggedItem.category === category && draggedItem.groupIndex !== targetGroupId) {
        setDragOverGroupId(targetGroupId);
        e.dataTransfer.dropEffect = "move";
        return;
    }

    if (!draggedGroup || draggedGroup.category !== category) return;
    setDragOverGroupId(targetGroupId);
  };

  const handleGroupDrop = (e: React.DragEvent, targetGroupId: number, category: ChoiceCategory) => {
    e.preventDefault();
    setDragOverGroupId(null);

    // Case 1: Dropping an ITEM into a Group (append to end)
    if (draggedItem && draggedItem.category === category && draggedItem.groupIndex !== targetGroupId) {
        // Find existing items in target group to find max subRank
        const targetGroupItems = choices.filter(c => c.category === category && c.groupIndex === targetGroupId);
        const maxSubRank = targetGroupItems.length > 0 ? Math.max(...targetGroupItems.map(c => c.subRank)) : 0;
        
        const newItem = { ...draggedItem, groupIndex: targetGroupId, subRank: maxSubRank + 1 };
        
        // Re-rank source group
        const sourceGroupItems = choices
            .filter(c => c.category === category && c.groupIndex === draggedItem.groupIndex && c.id !== draggedItem.id)
            .sort((a, b) => a.subRank - b.subRank)
            .map((c, i) => ({ ...c, subRank: i + 1 }));
        
        const others = choices.filter(c => 
            c.id !== draggedItem.id && 
            !(c.category === category && c.groupIndex === draggedItem.groupIndex)
        );

        onReorder([...others, ...sourceGroupItems, newItem]);
        setDraggedItem(null);
        return;
    }
    
    // Case 2: Dropping a GROUP (swap)
    if (!draggedGroup || draggedGroup.category !== category) return;
    if (draggedGroup.id === targetGroupId) {
        setDraggedGroup(null);
        return;
    }

    // Find all items not in these two groups
    const otherChoices = choices.filter(c => 
        !(c.category === category && (c.groupIndex === draggedGroup.id || c.groupIndex === targetGroupId))
    );

    // Get items for source and target group
    const sourceItems = choices.filter(c => c.category === category && c.groupIndex === draggedGroup.id);
    const targetItems = choices.filter(c => c.category === category && c.groupIndex === targetGroupId);

    // Swap their groupIndexes
    const newSourceItems = sourceItems.map(c => ({ ...c, groupIndex: targetGroupId }));
    const newTargetItems = targetItems.map(c => ({ ...c, groupIndex: draggedGroup.id }));

    onReorder([...otherChoices, ...newSourceItems, ...newTargetItems]);
    setDraggedGroup(null);
  };

  // --- RENDER HELPERS ---
  const renderGroupList = (groups: GroupedChoice[], category: ChoiceCategory, title: string, colorTheme: 'blue' | 'orange' | 'indigo') => {
    const themeColors = {
        blue: { border: 'border-blue-600', text: 'text-blue-800', bg: 'bg-blue-600', light: 'bg-blue-50' },
        orange: { border: 'border-orange-500', text: 'text-orange-800', bg: 'bg-orange-500', light: 'bg-orange-50' },
        indigo: { border: 'border-indigo-700', text: 'text-indigo-800', bg: 'bg-indigo-700', light: 'bg-indigo-50' }
    }[colorTheme];

    return (
        <div className="flex-1 flex flex-col min-w-[320px] bg-slate-50 border-r border-slate-200 overflow-hidden text-slate-900 last:border-r-0">
          <div className={`p-4 border-b-2 shadow-sm sticky top-0 bg-white z-30 ${themeColors.border} flex justify-between items-center`}>
            <h2 className={`text-[10px] font-black uppercase tracking-tight ${themeColors.text}`}>
              {title}
            </h2>
            <span className="text-[9px] font-bold bg-slate-100 px-2 py-1 rounded-full text-slate-500">{groups.length} Groupes</span>
          </div>
    
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 custom-scrollbar">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-40">
                  <div className="w-12 h-12 bg-slate-200 rounded-full mb-3 flex items-center justify-center text-2xl">∅</div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aucun choix</span>
              </div>
            ) : (
              groups.map((group) => {
                const isGroupDragging = draggedGroup?.id === group.id && draggedGroup?.category === category;
                const isGroupOver = dragOverGroupId === group.id; // && draggedGroup?.category === category (implied by handler)
    
                return (
                  <div 
                    key={`${category}-group-${group.id}`}
                    className={`
                        relative flex flex-col bg-white rounded-2xl border transition-all duration-200
                        ${isGroupDragging ? 'opacity-30 scale-95 border-dashed border-slate-400' : 'opacity-100 border-slate-200 shadow-sm'}
                        ${isGroupOver ? `ring-2 ring-offset-2 ring-${colorTheme}-400 scale-[1.02] z-10 bg-${colorTheme}-50` : ''}
                    `}
                    onDragOver={(e) => handleGroupDragOver(e, group.id, category)}
                    onDrop={(e) => handleGroupDrop(e, group.id, category)}
                  >
                    {/* Header Group - Draggable Handle */}
                    <div 
                        className={`p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl cursor-grab active:cursor-grabbing group/header`}
                        draggable
                        onDragStart={(e) => handleGroupDragStart(e, group.id, category)}
                    >
                        <div className="flex items-center gap-2">
                            <GripIcon />
                            <span className={`text-[10px] font-black uppercase tracking-wider ${themeColors.text}`}>
                                Priorité {group.id}
                            </span>
                        </div>
                        <div className="text-[9px] font-bold text-slate-400">{group.items.length} créneaux</div>
                    </div>

                    {/* Items List */}
                    <div className="p-2 flex flex-col gap-1.5 min-h-[40px]">
                      {group.items.map((item: Choice) => {
                        const colDef = columns.find(c => c.id === item.col);
                        const isAlternative = item.subRank > 1;
                        const isItemDragging = draggedItem?.id === item.id;
                        
                        // Check if we are dragging over this item
                        const isOverThisItem = dragOverItemInfo?.row === item.row && dragOverItemInfo?.col === item.col;
                        const insertPos = isOverThisItem ? dragOverItemInfo.position : null;
                        
                        return (
                          <div 
                            key={`${item.row}-${item.col}`}
                            draggable
                            onDragStart={(e) => handleItemDragStart(e, item)}
                            onDragOver={(e) => handleItemDragOver(e, item)}
                            onDrop={(e) => handleItemDrop(e, item)}
                            className={`
                                relative flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-150 group/item
                                ${isItemDragging ? 'opacity-20 border-dashed border-slate-400 bg-slate-50' : 'bg-white hover:border-slate-300'}
                                ${isOverThisItem ? 'bg-blue-50 border-blue-300 shadow-md' : 'border-slate-100'}
                                ${isAlternative ? 'ml-6' : ''}
                            `}
                          >
                            {/* Drag Handle */}
                            <div className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-slate-100 rounded">
                                <GripIcon />
                            </div>

                            {/* Badge */}
                            <div className={`
                                w-6 h-6 rounded flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm
                                ${!isAlternative ? themeColors.bg : 'bg-slate-400'}
                            `}>
                              {item.subRank === 1 ? item.groupIndex : `${item.groupIndex}.${String.fromCharCode(95 + item.subRank)}`}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col leading-tight">
                              <div className="font-black text-slate-700 text-[10px] uppercase truncate">
                                {colDef?.label || `Col ${item.col}`}
                              </div>
                              <div className="text-[9px] text-slate-400 font-medium">
                                {new Date(item.year, item.month, item.row).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </div>
                            </div>

                            {/* Delete Action */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveChoice(item.row, item.col); }}
                                className="opacity-0 group-hover/item:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Supprimer ce vœu"
                            >
                                <TrashIcon />
                            </button>
                            
                            {/* Visual insertion line if dragging over */}
                            {isOverThisItem && (
                                <div className={`absolute left-0 right-0 h-1 bg-blue-500 z-50 rounded-full pointer-events-none ${insertPos === 'top' ? '-top-1.5' : '-bottom-1.5'}`}>
                                </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Empty state or spacer for drop zone */}
                      {group.items.length === 0 && (
                          <div className="text-center py-2 text-[9px] text-slate-300 italic border border-dashed border-slate-200 rounded-lg">Glissez un choix ici</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-100">
      {renderGroupList(normalGroups, 'normal', 'Gardes Cibles', 'orange')}
      {renderGroupList(goodBonusGroups, 'good_bonus', 'Bonnes Gardes', 'blue')}
      {renderGroupList(badBonusGroups, 'bad_bonus', 'Gardes Normales', 'indigo')}
    </div>
  );
};
