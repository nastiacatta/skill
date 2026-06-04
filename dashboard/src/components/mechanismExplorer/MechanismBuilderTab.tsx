import { useState, useRef, useEffect } from 'react';
import type { MechanismConfig, SimParams } from '@/lib/mechanismExplorer/types';
import {
  BLOCK_DEFS,
  PARAM_DEFS,
  type BlockDef,
} from '@/lib/mechanismExplorer/blockDefs';

const BLOCK_COLORS: Record<string, { bg: string; text: string }> = {
  skill: { bg: '#E1F5EE', text: '#085041' },
  deposit: { bg: '#E6F1FB', text: '#0C447C' },
  influence: { bg: '#FAEEDA', text: '#412402' },
  aggregation: { bg: '#EEEDFE', text: '#26215C' },
  settlement: { bg: '#FAECE7', text: '#4A1B0C' },
  behaviour: { bg: '#F1EFE8', text: '#2C2C2A' },
};

interface MechanismBuilderTabProps {
  config: MechanismConfig;
  setConfig: (c: MechanismConfig) => void;
  params: SimParams;
  setParams: (p: SimParams) => void;
  onRun: () => void;
  runMessage: string | null;
  /** When true, changes are staged; clicking onRun applies them and recomputes the pipeline. */
  hasPendingChanges?: boolean;
}

function PipelineBlock({
  def,
  value,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isPopoverOpen,
  onSwapClick,
  onVariantSelect,
  popoverRef,
}: {
  def: BlockDef;
  value: string;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isPopoverOpen: boolean;
  onSwapClick: (e: React.MouseEvent) => void;
  onVariantSelect: (k: string) => void;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const variant = def.variants[value];
  const colors = BLOCK_COLORS[def.id] ?? { bg: '#f1f5f9', text: '#475569' };

  return (
    <div
      className={`
        relative min-w-[114px] max-w-[134px] flex-1 bg-white border rounded-lg py-2.5 px-2.5 cursor-grab active:cursor-grabbing
        transition-all select-none
        border-slate-200
        ${isDragging ? 'opacity-45 scale-[0.97]' : ''}
        ${isDragOver ? 'border-teal-500 bg-teal-50/50' : ''}
      `}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
        {def.num}
      </div>
      <div className="text-[11.5px] font-medium text-slate-800 mt-0.5">
        {def.label}
      </div>
      <span
        className="inline-block text-[10px] py-0.5 px-1.5 rounded-full font-medium mt-1 whitespace-nowrap"
        style={{ background: colors.bg, color: colors.text }}
      >
        {value}
      </span>
      <div className="font-mono text-[9.5px] text-slate-500 mt-1.5 leading-snug min-h-[28px]">
        {variant?.formula ?? value}
      </div>
      <div className="text-[9px] text-slate-400 mt-1 italic">drag to reorder</div>
      <button
        type="button"
        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded border-0 bg-transparent text-slate-400 hover:bg-slate-100 text-sm leading-none"
        title="Swap variant"
        onClick={onSwapClick}
      >
        ⇄
      </button>
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 z-[99] mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 px-1.5 min-w-[180px]"
          role="listbox"
        >
          {Object.keys(def.variants).map((k) => (
            <button
              key={k}
              type="button"
              className={`w-full text-left py-1.5 px-2.5 rounded-md text-xs transition-colors ${
                k === value
                  ? 'font-medium text-teal-700 bg-teal-50'
                  : 'hover:bg-slate-100'
              }`}
              onClick={() => onVariantSelect(k)}
            >
              {k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MechanismBuilderTab({
  config,
  setConfig,
  params,
  setParams,
  onRun,
  runMessage,
  hasPendingChanges = false,
}: MechanismBuilderTabProps) {
  const [blockOrder, setBlockOrder] = useState<number[]>(() =>
    BLOCK_DEFS.map((_, i) => i),
  );
  const [openVariantIdx, setOpenVariantIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        openVariantIdx !== null &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpenVariantIdx(null);
      }
    }
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [openVariantIdx]);

  const setBlock = (id: keyof MechanismConfig, value: string) => {
    setConfig({ ...config, [id]: value as MechanismConfig[keyof MechanismConfig] });
    setOpenVariantIdx(null);
  };

  const setParam = (id: keyof SimParams, value: number) => {
    setParams({ ...params, [id]: value });
  };

  const orderedDefs = blockOrder.map((i) => BLOCK_DEFS[i]);

  const handleDrop = (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    setBlockOrder((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, removed);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 overflow-hidden">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2.5">
          Drag to reorder · click ⇄ to swap variant
        </div>
        <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
          {orderedDefs.map((def, displayIdx) => (
              <div key={def.id} className="contents">
                {displayIdx > 0 && (
                  <div className="flex items-center px-1 text-slate-400 text-sm shrink-0">
                    ›
                  </div>
                )}
                <PipelineBlock
                  def={def}
                  value={config[def.id]}
                  isDragging={dragIdx === displayIdx}
                  isDragOver={dragOverIdx === displayIdx}
                  onDragStart={() => setDragIdx(displayIdx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIdx(displayIdx);
                  }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(displayIdx);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setDragOverIdx(null);
                  }}
                  isPopoverOpen={openVariantIdx === displayIdx}
                  onSwapClick={(e) => {
                    e.stopPropagation();
                    setOpenVariantIdx((prev) =>
                      prev === displayIdx ? null : displayIdx,
                    );
                  }}
                  onVariantSelect={(k) => setBlock(def.id, k)}
                  popoverRef={openVariantIdx === displayIdx ? popoverRef : undefined}
                />
              </div>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
        {PARAM_DEFS.map((p) => (
          <div
            key={p.id}
            className="bg-slate-100 border border-slate-200 rounded-lg p-2.5"
          >
            <label className="flex justify-between items-center mb-1.5 text-[10.5px] text-slate-500">
              <span>{p.label}</span>
              <span className="text-xs font-medium text-slate-800">
                {params[p.id]}
              </span>
            </label>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={params[p.id]}
              onChange={(e) => setParam(p.id, +e.target.value)}
              className="w-full accent-teal-600"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onRun}
          className={`flex-1 max-w-[240px] py-2 text-white text-sm font-medium rounded-lg transition-opacity ${
            hasPendingChanges
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-teal-600 hover:bg-teal-700'
          }`}
        >
          {hasPendingChanges ? 'Apply' : 'Apply'}
        </button>
        <span
          className={`flex-1 text-xs ${
            runMessage?.startsWith('✓') ? 'text-teal-700' : 'text-slate-500'
          }`}
        >
          {runMessage ?? 'Configure blocks above and click Apply to run the pipeline.'}
        </span>
      </div>
    </div>
  );
}
