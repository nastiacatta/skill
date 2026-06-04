import type { ExperimentMeta } from '@/lib/types';

interface ExperimentContextProps {
  experiment: ExperimentMeta | null;
  /** Optional: primary data source for this view (e.g. timeseries, summary). */
  dataSource?: string;
  className?: string;
}

export default function ExperimentContext({
  experiment,
  dataSource,
  className = '',
}: ExperimentContextProps) {
  if (!experiment) return null;

  return (
    <div
      className={`bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 ${className}`}
    >
      <span className="font-medium text-slate-700">Experiment:</span>{' '}
      {experiment.displayName}
      <span className="text-slate-400 mx-1">·</span>
      <span className="text-slate-500">{experiment.block}</span>
      {dataSource && (
        <>
          <span className="text-slate-400 mx-1">·</span>
          <span className="text-slate-500">Data: {dataSource}</span>
        </>
      )}
    </div>
  );
}

/** Badge for panels that use a shared/global reference dataset (not experiment-specific). */
export function ReferenceDatasetLabel({
  label,
  className = '',
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-[10px] font-medium uppercase tracking-wider text-slate-500 ${className}`}
    >
      Reference: {label}
    </span>
  );
}
