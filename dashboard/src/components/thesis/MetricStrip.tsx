/**
 * KPI cards: forecast quality, calibration/error, utility/payout, robustness/concentration
 */
import { Link } from 'react-router-dom';

interface MetricStripProps {
  /** Optional values from last pipeline run */
  meanError?: number;
  participation?: number;
  gini?: number;
  nEff?: number;
}

export default function MetricStrip({ meanError, participation, gini, nEff }: MetricStripProps) {
  const items = [
    {
      label: 'Forecast quality',
      value: meanError != null ? meanError.toFixed(4) : '—',
      subtitle: 'Mean |y − r̂|',
    },
    {
      label: 'Calibration / error',
      value: participation != null ? participation.toFixed(2) : '—',
      subtitle: 'Participation rate',
    },
    {
      label: 'Utility / payout',
      value: gini != null ? gini.toFixed(3) : '—',
      subtitle: 'Gini (wealth concentration)',
    },
    {
      label: 'Robustness / concentration',
      value: nEff != null ? nEff.toFixed(2) : '—',
      subtitle: 'Effective contributors N_eff',
    },
  ];

  return (
    <section>
      <h2 className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-3">
        Key metrics
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {item.label}
            </p>
            <p className="text-lg font-semibold text-slate-800 tabular-nums mt-0.5">
              {item.value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Run the pipeline in the Mechanism explorer to populate these values.
      </p>
      <Link
        to="/mechanism-explorer"
        className="mt-2 inline-block text-xs text-slate-600 hover:text-slate-800 font-medium"
      >
        Run pipeline →
      </Link>
    </section>
  );
}
