
import React from 'react';
import { ColumnDefinition } from '../types';

interface Props {
  columns: ColumnDefinition[];
  isEditClosuresMode?: boolean;
  onColumnClick?: (colId: number) => void;
  globalClosures?: any[];
}

export const MatrixHeader: React.FC<Props> = ({ columns, isEditClosuresMode, onColumnClick, globalClosures = [] }) => {
  return (
    <thead className="sticky top-0 z-40 shadow-md bg-white">
      {/* Single Row: Date & Columns */}
      <tr className="bg-white text-slate-900 text-[11px] md:text-[9px] font-bold border-b border-slate-300 h-12">
        <th className="sticky left-0 z-50 w-20 md:w-16 bg-white border-r border-slate-300 uppercase tracking-tighter shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs md:text-[10px] align-middle">
            Date
        </th>
        {columns.map((col) => {
          const isColClosed = globalClosures.some(gc => gc.col_id === col.id && gc.row === null);
          return (
          <th key={col.id} onClick={() => isEditClosuresMode && onColumnClick && onColumnClick(col.id)} className={`group border-r border-slate-300 min-w-[60px] w-[60px] md:min-w-[28px] md:w-[28px] text-center p-0 align-middle transition-all relative ${isEditClosuresMode ? 'cursor-pointer hover:bg-red-100' : 'hover:bg-slate-50'} ${isColClosed ? 'bg-red-100/50' : ''}`}>
            <div className={`flex flex-col leading-none py-1 h-full justify-center ${isEditClosuresMode ? '' : 'cursor-help'}`}>
              <span className="text-[9px] md:text-[7px] text-slate-400 font-normal mb-0.5">{col.id}</span>
              <span className={`font-black text-[11px] md:text-[9px] ${isColClosed ? 'text-red-600 line-through' : 'text-slate-800'}`}>{col.label}</span>
            </div>
            
            {/* Tooltip on Hover - Positioned BELOW (top-full) to avoid being cut off */}
            {!isEditClosuresMode && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block z-[100] pointer-events-none">
                <div className="relative bg-slate-900 text-white text-[10px] font-medium p-3 rounded-xl shadow-2xl whitespace-nowrap border border-slate-700 flex flex-col gap-1 items-start min-w-[140px] animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Little arrow pointing up */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 border-l border-t border-slate-700"></div>
                    
                    <div className="font-black uppercase tracking-widest text-blue-300 mb-2 border-b border-slate-700 w-full pb-1 text-left">
                        Colonne {col.id} : {col.label}
                    </div>
                    <div className="flex justify-between w-full gap-4">
                        <span className="text-slate-400">Type :</span>
                        <span className="font-bold">{col.type}</span>
                    </div>
                    <div className="flex justify-between w-full gap-4">
                        <span className="text-slate-400">Site :</span>
                        <span className="font-bold">{col.site}</span>
                    </div>
                    <div className="flex justify-between w-full gap-4">
                        <span className="text-slate-400">Horaire :</span>
                        <span className="font-bold text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded">{col.timeRange}</span>
                    </div>
                </div>
            </div>
            )}
          </th>
        )})}
      </tr>
    </thead>
  );
};
