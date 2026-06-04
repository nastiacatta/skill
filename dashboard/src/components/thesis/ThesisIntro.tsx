import { Link } from 'react-router-dom';
import { THESIS_TITLE, THESIS_RESEARCH_QUESTION } from '@/lib/thesis';

export default function ThesisIntro() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
        {THESIS_TITLE}
      </h1>
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          <strong>Research question.</strong> {THESIS_RESEARCH_QUESTION}
        </p>
        <p>
          This dashboard demonstrates how the system transforms inputs into an aggregate forecast, payoffs, and updated skill over repeated rounds. It foregrounds the research question: whether combining online skill updates with stake improves forecast accuracy and market outcomes under realistic and strategic user behaviour.
        </p>
        <p className="text-slate-600">
          <strong>How to read this dashboard.</strong> Start with the Overview (below) for the pipeline and round evolution. Use the Mechanism explorer to step through each stage in detail. Experiments test robustness and mechanism design choices.
        </p>
      </div>
      <Link
        to="/mechanism-explorer"
        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Open Mechanism explorer →
      </Link>
    </section>
  );
}
