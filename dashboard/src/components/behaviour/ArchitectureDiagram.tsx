import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ArchitectureDiagramProps {
  highlightedBlock?: 'A' | 'B' | null;
  onBlockHover?: (block: 'A' | 'B' | null) => void;
}

export default function ArchitectureDiagram({
  highlightedBlock: controlledHighlight,
  onBlockHover,
}: ArchitectureDiagramProps) {
  const [internalHighlight, setInternalHighlight] = useState<'A' | 'B' | null>(null);
  const highlighted = controlledHighlight ?? internalHighlight;
  // framer-motion ignores prefers-reduced-motion unless told; settle instantly.
  const reduce = useReducedMotion();

  const handleHover = (block: 'A' | 'B' | null) => {
    setInternalHighlight(block);
    onBlockHover?.(block);
  };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.2 }}
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0">
        {/* Block B — Agent Policies */}
        <div
          onMouseEnter={() => handleHover('B')}
          onMouseLeave={() => handleHover(null)}
          className={`relative rounded-xl border-2 px-5 py-4 text-center transition-all w-full sm:w-56 ${
            highlighted === 'B'
              ? 'border-violet-400 bg-violet-50 shadow-md'
              : 'border-violet-200 bg-violet-50/50'
          }`}
        >
          <p className="text-[13px] font-semibold uppercase tracking-wider text-violet-400 mb-1">
            Block B
          </p>
          <p className="text-[14px] font-semibold text-violet-700">Agent Policies</p>
          <p className="text-[13px] text-violet-500 mt-1 font-mono">
            π(attributes, state, t) → action
          </p>
        </div>

        {/* Arrows */}
        <div className="flex flex-col items-center gap-1 px-3 py-2 sm:py-0 shrink-0">
          {/* B → A */}
          <div className="flex items-center gap-1">
            <span className="text-[13px] text-slate-500 font-mono leading-none">
              (participate, report, deposit)
            </span>
            <span className="text-slate-400">→</span>
          </div>
          <span className="text-[13px] font-semibold text-slate-600">Behaviour Contract</span>
          {/* A → B */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400">←</span>
            <span className="text-[13px] text-slate-500 font-mono leading-none">
              (wealth, σ, r̂, round)
            </span>
          </div>
          <span className="text-[13px] font-semibold text-slate-600">Platform State</span>
        </div>

        {/* Block A — Core Mechanism */}
        <div
          onMouseEnter={() => handleHover('A')}
          onMouseLeave={() => handleHover(null)}
          className={`relative rounded-xl border-2 px-5 py-4 text-center transition-all w-full sm:w-56 ${
            highlighted === 'A'
              ? 'border-teal-400 bg-teal-50 shadow-md'
              : 'border-teal-200 bg-teal-50/50'
          }`}
        >
          <p className="text-[13px] font-semibold uppercase tracking-wider text-teal-400 mb-1">
            Block A
          </p>
          <p className="text-[14px] font-semibold text-teal-700">Core Mechanism</p>
          <p className="text-[13px] text-teal-500 mt-1 font-mono">state machine</p>
        </div>
      </div>
    </motion.div>
  );
}
