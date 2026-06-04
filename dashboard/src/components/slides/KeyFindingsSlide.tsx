import SlideWrapper from './SlideWrapper';

interface Finding {
  icon: 'check' | 'arrow' | 'scale';
  color: string;
  title: string;
  description: string;
}

const findings: Finding[] = [
  {
    icon: 'check',
    color: 'bg-emerald-500',
    title: 'Skill-weighted aggregation improves accuracy',
    description:
      'Skill-weighted aggregation improves accuracy over equal weighting on real data.',
  },
  {
    icon: 'arrow',
    color: 'bg-teal-500',
    title: 'Mechanism improves over equal weighting',
    description:
      'The mechanism (skill + stake) improves mean CRPS versus equal weighting on the heterogeneous Elia wind panel, and ties equal weighting on the near-homogeneous electricity panel (the committed null).',
  },
  {
    icon: 'scale',
    color: 'bg-amber-500',
    title: 'Best single can still win',
    description:
      'Even when the mechanism improves the aggregate, the best single forecaster can still outperform it on some datasets, so the claim is conditional rather than dominance.',
  },
];

function FindingIcon({ kind }: { kind: Finding['icon'] }) {
  const stroke = 'currentColor';
  switch (kind) {
    case 'check':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'arrow':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4L12 12M12 12H6M12 12V6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'scale':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2V13M3 13H13M5 6H11M3 9L5 6L7 9M9 9L11 6L13 9" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export default function KeyFindingsSlide() {
  return (
    <SlideWrapper>
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Takeaways</h2>
      <h3 className="text-2xl font-bold text-slate-900">Key Findings</h3>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed">
        Summary of the main takeaways from the real-world evaluation.
      </p>

      <div className="mt-8 space-y-3">
        {findings.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-slate-200 bg-white p-5 flex gap-4 items-start"
          >
            <div className={`w-7 h-7 rounded-full ${f.color} flex items-center justify-center text-white shrink-0 mt-0.5`}>
              <FindingIcon kind={f.icon} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-slate-800">{f.title}</div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">{f.description}</div>
            </div>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}

