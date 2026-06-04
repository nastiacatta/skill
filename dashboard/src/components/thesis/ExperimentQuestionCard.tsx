/**
 * Card stating the experiment question and what is held fixed vs varied
 */
interface ExperimentQuestionCardProps {
  question: string;
  fixed: string[];
  varies: string[];
}

export default function ExperimentQuestionCard({ question, fixed, varies }: ExperimentQuestionCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-2">Experiment question</h3>
      <p className="text-sm text-slate-700">{question}</p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase">Held fixed</p>
          <ul className="mt-1 text-xs text-slate-600 list-disc pl-4">
            {fixed.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase">What varies</p>
          <ul className="mt-1 text-xs text-slate-600 list-disc pl-4">
            {varies.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
