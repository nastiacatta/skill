import type { ReactNode } from 'react';

interface FourPanelLayoutProps {
  /** Panel 1: Primary outcome chart (Δ CRPS bar) */
  primary: ReactNode;
  /** Panel 2: Calibration chart (PIT/reliability) */
  calibration: ReactNode;
  /** Panel 3: Market structure chart (HHI, N_eff, Gini bars) */
  structure: ReactNode;
  /** Panel 4: Failure mode chart (context-dependent) */
  failure: ReactNode;
  /** Experiment title */
  title: string;
  /** One-sentence thesis point this experiment makes */
  thesisPoint: string;
}

const PANEL_LABELS = [
  'Primary outcome',
  'Calibration',
  'Weight concentration',
  'Failure mode',
] as const;

export default function FourPanelLayout({
  primary,
  calibration,
  structure,
  failure,
  title,
  thesisPoint,
}: FourPanelLayoutProps) {
  const panels = [primary, calibration, structure, failure];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
          {thesisPoint}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {panels.map((panel, i) => (
          <div key={PANEL_LABELS[i]} className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              {PANEL_LABELS[i]}
            </div>
            {panel}
          </div>
        ))}
      </div>
    </section>
  );
}
