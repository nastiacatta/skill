import { THESIS_TITLE, THESIS_RESEARCH_QUESTION } from '@/lib/thesis';

interface ThesisHeaderProps {
  /** Optional badge: experiment or scenario name */
  experimentBadge?: string;
  scenarioBadge?: string;
  /** Optional extra controls (e.g. selectors) */
  controls?: React.ReactNode;
  compact?: boolean;
}

export default function ThesisHeader({
  experimentBadge,
  scenarioBadge,
  controls,
  compact = false,
}: ThesisHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={compact ? 'text-lg font-semibold text-slate-900' : 'text-xl font-semibold text-slate-900'}>
            {THESIS_TITLE}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-700 max-w-2xl">
            {THESIS_RESEARCH_QUESTION}
          </p>
          {(experimentBadge || scenarioBadge) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {experimentBadge && (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {experimentBadge}
                </span>
              )}
              {scenarioBadge && (
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {scenarioBadge}
                </span>
              )}
            </div>
          )}
        </div>
        {controls && <div className="flex items-center gap-2">{controls}</div>}
      </div>
    </header>
  );
}
