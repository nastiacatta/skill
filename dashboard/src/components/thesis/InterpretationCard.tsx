/**
 * Short interpretation block in thesis language
 */
interface InterpretationCardProps {
  children: React.ReactNode;
}

export default function InterpretationCard({ children }: InterpretationCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 mt-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-2">Interpretation</h3>
      <div className="text-sm text-slate-700 prose prose-slate max-w-none">
        {children}
      </div>
    </div>
  );
}
