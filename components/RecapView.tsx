import React, { useMemo, useState } from 'react';
import { Choice, ColumnDefinition, ChoiceCategory, Round } from '../types';
import { ArrowUp, ArrowDown, CornerDownRight, CornerUpLeft, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  choices: Choice[];
  columns: ColumnDefinition[];
  onReorder: (newChoices: Choice[]) => void;
  activeRound?: Round;
  currentUserTrigram: string;
}

export const RecapView: React.FC<Props> = ({ choices, columns, onReorder, activeRound, currentUserTrigram }) => {
  // --- LOGIC: Cleanup Group Indices ---
  // Ensures group indices are strictly sequential (1, 2, 3...) without gaps or decimals
  const cleanupGroupIndices = (currentChoices: Choice[]) => {
    const categories: ChoiceCategory[] = ['normal', 'good_bonus', 'bad_bonus'];
    let finalChoices = [...currentChoices];
    
    categories.forEach(category => {
        const catChoices = finalChoices.filter(c => c.status === 'PENDING' && c.category === category && c.userTrigram === currentUserTrigram);
        const uniqueGroups = Array.from(new Set(catChoices.map(c => c.groupIndex))).sort((a, b) => a - b);
        
        finalChoices = finalChoices.map(c => {
            if (c.status !== 'PENDING' || c.category !== category || c.userTrigram !== currentUserTrigram) return c;
            const newGroupIndex = uniqueGroups.indexOf(c.groupIndex) + 1;
            return { ...c, groupIndex: newGroupIndex };
        });
    });
    return finalChoices;
  };

  // --- LOGIC: Promote / Demote ---
  const handleMakeMain = (item: Choice) => {
    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== item.category || c.userTrigram !== currentUserTrigram) return c;
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

    const targetGroupItems = choices.filter(c => c.status === 'PENDING' && c.category === item.category && c.groupIndex === targetGroupIndex && c.userTrigram === currentUserTrigram);
    const maxSubRank = targetGroupItems.length > 0 ? Math.max(...targetGroupItems.map(c => c.subRank)) : 0;

    const newChoices = choices.map(c => {
        if (c.status !== 'PENDING' || c.category !== item.category || c.userTrigram !== currentUserTrigram) return c;
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
    const itemToRemove = choices.find(c => c.row === row && c.col === col && c.userTrigram === currentUserTrigram);
    if (!itemToRemove) return;

    const remaining = choices.filter(c => !(c.row === row && c.col === col));
    
    const newChoices = remaining.map(c => {
        if (c.status === 'PENDING' && c.category === itemToRemove.category && c.userTrigram === currentUserTrigram && c.groupIndex === itemToRemove.groupIndex && c.subRank > itemToRemove.subRank) {
            return { ...c, subRank: c.subRank - 1 };
        }
        return c;
    });
    
    onReorder(cleanupGroupIndices(newChoices));
  };

  // --- RENDER HELPERS ---
  const SortableChoiceItem = ({ item, isHidden, isDragOverlay, forceAlternative, themeColors, colDef, onRemove, onMakeMain, onMakeAlt, dragDeltaX = 0 }: any) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      ...(isHidden && !isDragOverlay ? { height: 0, padding: 0, margin: 0, overflow: 'hidden', border: 'none', opacity: 0 } : {}),
    };

    const isAlt = forceAlternative !== undefined ? forceAlternative : item.subRank > 1;
    const displaySubRank = isAlt ? (item.subRank > 1 ? item.subRank : 2) : 1;

    if (isDragging && !isDragOverlay) {
        let projectedIsAlt = isAlt;
        if (dragDeltaX > 30) projectedIsAlt = true;
        else if (dragDeltaX < -30) projectedIsAlt = false;

        return (
          <div ref={setNodeRef} style={style} className={`shrink-0 flex items-center justify-between p-3 border-2 border-dashed transition-all duration-200 ${projectedIsAlt ? 'ml-12 border-amber-400 bg-amber-50 rounded-l-xl' : 'ml-0 border-blue-400 bg-blue-50 rounded-xl'}`}>
             <div className="h-8 w-full flex items-center px-2 gap-3">
                {projectedIsAlt ? (
                    <>
                        <CornerDownRight className="text-amber-500" size={20} strokeWidth={3} />
                        <span className="text-[11px] font-black uppercase tracking-widest text-amber-600">
                            Déposer comme alternative
                        </span>
                    </>
                ) : (
                    <>
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-500 text-white font-black text-[10px] shadow-sm">P</div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">
                            Déposer comme priorité principale
                        </span>
                    </>
                )}
             </div>
          </div>
        );
    }

    const overlayClass = isDragOverlay ? (isAlt ? 'ring-2 ring-amber-400 shadow-amber-200/50 bg-amber-50/30' : 'ring-2 ring-blue-400 shadow-blue-200/50') : '';

    return (
      <div ref={setNodeRef} style={style} className={`shrink-0 flex items-center justify-between p-3 border-b border-slate-50 last:border-0 transition-all duration-200 bg-white hover:bg-slate-50/80 ${isAlt ? 'pl-12 bg-slate-50/50' : ''} ${overlayClass}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600">
            <GripVertical size={16} />
          </div>
          <div className={`w-8 h-8 rounded flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm ${!isAlt ? themeColors.bg : 'bg-slate-400'}`}>
            {!isAlt ? item.groupIndex : `${item.groupIndex}.${String.fromCharCode(95 + displaySubRank)}`}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-700 text-sm uppercase truncate">
              {colDef?.label ? `${colDef.label} - colonne ${item.col}` : `Colonne ${item.col}`}
            </span>
            <span className="text-sm text-slate-500 font-semibold capitalize max-w-full">
              {new Date(item.year, item.month, item.row).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
        {!isDragOverlay && (
          <div className="flex items-center gap-1 shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            {isAlt && (
                <button onClick={() => onMakeMain(item)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Détacher en tant que nouvelle priorité principale">
                    <CornerUpLeft size={16} strokeWidth={2.5} />
                </button>
            )}
            {!isAlt && item.groupIndex > 1 && (
                <button onClick={() => onMakeAlt(item)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Fusionner comme alternative de la priorité précédente">
                    <CornerDownRight size={16} strokeWidth={2.5} />
                </button>
            )}
            <button onClick={() => onRemove(item.row, item.col)} className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer ce vœu">
              <Trash2 size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const CategoryList = ({ category, title, colorTheme }: { category: ChoiceCategory, title: string, colorTheme: 'blue' | 'orange' | 'indigo' }) => {
    const themeColors = {
      blue: { border: 'border-blue-600', text: 'text-blue-800', bg: 'bg-blue-600', light: 'bg-blue-50' },
      orange: { border: 'border-orange-500', text: 'text-orange-800', bg: 'bg-orange-500', light: 'bg-orange-50' },
      indigo: { border: 'border-indigo-700', text: 'text-indigo-800', bg: 'bg-indigo-700', light: 'bg-indigo-50' }
    }[colorTheme];

    const flatChoices = useMemo(() => {
      return choices
        .filter(c => c.category === category && c.status === 'PENDING' && c.userTrigram === currentUserTrigram)
        .sort((a, b) => a.groupIndex !== b.groupIndex ? a.groupIndex - b.groupIndex : a.subRank - b.subRank);
    }, [choices, category]);

    const [activeId, setActiveId] = useState<number | null>(null);
    const [dragDeltaX, setDragDeltaX] = useState(0);

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as number);
      setDragDeltaX(0);
    };

    const handleDragMove = (event: DragMoveEvent) => {
      setDragDeltaX(event.delta.x);
    };

    const handleDragEnd = (event: DragEndEvent) => {
      setActiveId(null);
      setDragDeltaX(0);
      const { active, over, delta } = event;
      if (!over) return;

      const activeItem = flatChoices.find(c => c.id === active.id);
      const overItem = flatChoices.find(c => c.id === over.id);
      if (!activeItem || !overItem) return;

      const oldIndex = flatChoices.findIndex(c => c.id === active.id);
      const newIndex = flatChoices.findIndex(c => c.id === over.id);

      let newFlatChoices = [...flatChoices];

      const isDraggingMain = activeItem.subRank === 1;
      const draggedGroupItems = isDraggingMain 
          ? flatChoices.filter(c => c.groupIndex === activeItem.groupIndex)
          : [activeItem];

      newFlatChoices = newFlatChoices.filter(c => !draggedGroupItems.find(d => d.id === c.id));

      let insertIndex = newFlatChoices.findIndex(c => c.id === overItem.id);
      if (insertIndex === -1) {
          insertIndex = flatChoices.findIndex(c => c.id === activeItem.id);
      } else if (oldIndex < newIndex) {
          insertIndex += 1;
      }

      newFlatChoices.splice(insertIndex, 0, ...draggedGroupItems);

      let isAlternative = activeItem.subRank > 1;
      if (delta.x > 30) isAlternative = true;
      else if (delta.x < -30) isAlternative = false;

      let currentGroupIndex = 0;
      let currentSubRank = 1;

      const updatedCatChoices = newFlatChoices.map((item, index) => {
        let itemIsAlt = item.subRank > 1;
        
        if (item.id === activeItem.id) {
            itemIsAlt = isAlternative;
        } else if (isDraggingMain && draggedGroupItems.find(d => d.id === item.id)) {
            itemIsAlt = true; 
        }

        if (index === 0) itemIsAlt = false;

        if (!itemIsAlt) {
          currentGroupIndex += 1;
          currentSubRank = 1;
        } else {
          currentSubRank += 1;
        }

        return {
          ...item,
          groupIndex: currentGroupIndex,
          subRank: currentSubRank
        };
      });

      const finalChoices = choices.map(c => {
        if (c.category === category && c.status === 'PENDING' && c.userTrigram === currentUserTrigram) {
          return updatedCatChoices.find(uc => uc.id === c.id) || c;
        }
        return c;
      });

      onReorder(finalChoices);
    };

    const activeItem = flatChoices.find(c => c.id === activeId);
    const draggedGroupItems = activeItem?.subRank === 1 
        ? flatChoices.filter(c => c.groupIndex === activeItem.groupIndex)
        : (activeItem ? [activeItem] : []);

    return (
      <div className="flex-1 flex flex-col w-full md:min-w-[320px] min-h-[400px] md:min-h-0 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 overflow-hidden text-slate-900 last:border-r-0 last:border-b-0">
        <div className={`p-4 border-b-2 shadow-sm sticky top-0 bg-white z-30 ${themeColors.border} flex justify-between items-center`}>
          <h2 className={`text-[10px] font-black uppercase tracking-tight ${themeColors.text}`}>
            {title}
          </h2>
          <span className="text-[9px] font-bold bg-slate-100 px-2 py-1 rounded-full text-slate-500">{new Set(flatChoices.map(c => c.groupIndex)).size} Groupes</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
          {flatChoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-40">
                <div className="w-12 h-12 bg-slate-200 rounded-full mb-3 flex items-center justify-center text-2xl">∅</div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aucun choix</span>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
              <SortableContext items={flatChoices.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0">
                  {flatChoices.map(item => (
                    <SortableChoiceItem 
                      key={item.id} 
                      item={item} 
                      isHidden={draggedGroupItems.some(d => d.id === item.id && d.id !== activeId)}
                      themeColors={themeColors}
                      colDef={columns.find(c => c.id === item.col)}
                      onRemove={handleRemoveChoice}
                      onMakeMain={handleMakeMain}
                      onMakeAlt={handleMakeAlternative}
                      dragDeltaX={activeId === item.id ? dragDeltaX : 0}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } })}>
                {activeId ? (
                  <div className={`shadow-2xl rounded-xl overflow-hidden border-2 transition-colors duration-200 ${dragDeltaX > 30 ? 'border-amber-400' : (dragDeltaX < -30 ? 'border-blue-400' : 'border-slate-300')} bg-white`}>
                    {draggedGroupItems.map((item, index) => {
                       const isAlt = index === 0 ? (dragDeltaX > 30 ? true : (dragDeltaX < -30 ? false : item.subRank > 1)) : true;
                       return <SortableChoiceItem 
                          key={item.id} 
                          item={item} 
                          isDragOverlay 
                          forceAlternative={isAlt}
                          themeColors={themeColors}
                          colDef={columns.find(c => c.id === item.col)}
                       />
                    })}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden bg-slate-100">
      {(activeRound?.step_normal_active ?? true) && <CategoryList category="normal" title="Étape 1" colorTheme="orange" />}
      {(activeRound?.step_good_bonus_active ?? true) && <CategoryList category="good_bonus" title="Étape 2" colorTheme="blue" />}
      {(activeRound?.step_bad_bonus_active ?? true) && <CategoryList category="bad_bonus" title="Étape 3 - Garde au choix" colorTheme="indigo" />}
    </div>
  );
};
