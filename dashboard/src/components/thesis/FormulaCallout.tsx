/**
 * Compact formula block with optional label
 */
import MathBlock from '@/components/dashboard/MathBlock';

interface FormulaCalloutProps {
  label?: string;
  latex: string;
}

export default function FormulaCallout({ label, latex }: FormulaCalloutProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      {label && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
          {label}
        </p>
      )}
      <MathBlock inline latex={latex} />
    </div>
  );
}
