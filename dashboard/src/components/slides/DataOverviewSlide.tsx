import SlideWrapper from './SlideWrapper';

const datasets = [
  {
    name: 'Elia Electricity',
    rounds: '10,000',
    forecasters: 5,
    description: 'Belgian electricity load from Elia TSO',
    color: 'bg-amber-500',
    border: 'border-l-amber-500',
  },
  {
    name: 'Elia Wind',
    rounds: '17,544',
    forecasters: 5,
    description: 'Belgian wind power generation from Elia TSO',
    color: 'bg-sky-500',
    border: 'border-l-sky-500',
  },
];

export default function DataOverviewSlide() {
  return (
    <SlideWrapper>
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Data</h2>
      <h3 className="text-2xl font-bold text-slate-900">Real-World Datasets</h3>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-xl">
        Both datasets use the same 5 forecaster models, enabling a direct comparison of
        aggregation methods across different energy domains.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {datasets.map((ds) => (
          <div
            key={ds.name}
            className={`rounded-xl border border-slate-200 border-l-4 ${ds.border} bg-white p-5`}
          >
            <h4 className="text-sm font-semibold text-slate-800">{ds.name}</h4>
            <p className="mt-1 text-xs text-slate-500">{ds.description}</p>
            <div className="mt-4 flex gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Rounds</p>
                <p className="mt-1 text-xl font-bold text-slate-800">{ds.rounds}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Forecasters</p>
                <p className="mt-1 text-xl font-bold text-slate-800">{ds.forecasters}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SlideWrapper>
  );
}
