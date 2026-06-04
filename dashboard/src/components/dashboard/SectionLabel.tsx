import clsx from 'clsx';

export type LabelType = 'hidden_state' | 'user_choice' | 'mechanism_computation' | 'observed_output';

const LABELS: Record<LabelType, { short: string; full: string; color: string }> = {
  hidden_state: { short: 'Hidden state', full: 'Hidden state', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  user_choice: { short: 'User choice', full: 'User choice', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  mechanism_computation: { short: 'Skill × stake', full: 'Skill × stake computation', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  observed_output: { short: 'Observed output', full: 'Observed output', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
};

interface SectionLabelProps {
  type: LabelType;
  short?: boolean;
  className?: string;
}

export default function SectionLabel({ type, short = true, className }: SectionLabelProps) {
  const { short: s, full, color } = LABELS[type];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider',
        color,
        className
      )}
    >
      {short ? s : full}
    </span>
  );
}

export { LABELS };
