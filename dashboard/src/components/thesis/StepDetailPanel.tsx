import type { ReactNode } from 'react';
import MathBlock from '@/components/dashboard/MathBlock';

interface StepDetailPanelProps {
  title: string;
  /** Formula (LaTeX) to show prominently */
  formula?: string;
  /** Short interpretation text */
  interpretation?: string;
  children?: ReactNode;
}

export default function StepDetailPanel({
  title,
  formula,
  interpretation,
  children,
}: StepDetailPanelProps) {
  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-slate-50/50 p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-slate-800 mb-2">{title}</h3>
      {formula && (
        <div className="rounded-lg bg-white border border-slate-200 p-2 mb-2">
          <MathBlock inline latex={formula} />
        </div>
      )}
      {interpretation && (
        <p className="text-xs text-slate-600 mb-3">{interpretation}</p>
      )}
      {children}
    </aside>
  );
}
