/**
 * Container for stage detail content in the Mechanism explorer
 */
import type { ReactNode } from 'react';

interface StageDetailPanelProps {
  title: string;
  children: ReactNode;
}

export default function StageDetailPanel({ title, children }: StageDetailPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 min-h-[200px]">
      <h2 className="text-base font-semibold text-slate-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}
