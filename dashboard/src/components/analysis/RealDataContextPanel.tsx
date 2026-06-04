/**
 * Real-data contextualisation panel (academic redesign).
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type { RealDataResult } from '../../lib/adapters';
import PanelShell from './PanelShell';
import { hasDiscrepancyWarning } from '@/lib/analysis/discrepancyWarning';

interface RealDataContextPanelProps {
  realData: RealDataResult | null;
  realDataElectricity?: RealDataResult | null;
  syntheticDeltaCrps: number | null;
}

function computeRealDeltaCrps(data: RealDataResult | null): number | null {
  if (!data?.rows) return null;
  const blendedRows = data.rows.filter((r) => r.method === 'blended');
  if (blendedRows.length === 0) return null;
  return blendedRows.reduce((s, r) => s + r.delta_crps_vs_equal, 0) / blendedRows.length;
}

const FUTURE_TARGETS = [
  'Temperature forecasts (ECMWF ensemble)',
  'Financial volatility (VIX options)',
  'Solar irradiance (PVGIS)',
];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        fontSize: 11,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        color: 'var(--ink-muted)',
        padding: '3px 8px',
        borderRadius: 3,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="uppercase mb-2"
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'var(--ink-soft)',
      }}
    >
      {children}
    </p>
  );
}

function Callout({
  kind,
  title,
  children,
}: {
  kind: 'info' | 'warn';
  title: string;
  children: React.ReactNode;
}) {
  const cfg =
    kind === 'info'
      ? {
          accent: 'var(--navy)',
          tint: 'var(--navy-tint)',
          border: 'rgba(29,52,97,0.22)',
          titleColor: 'var(--navy-ink)',
          bodyColor: '#26324e',
          iconBg: 'var(--navy)',
        }
      : {
          accent: 'var(--amber)',
          tint: 'var(--amber-tint)',
          border: 'rgba(180,83,9,0.22)',
          titleColor: '#78350f',
          bodyColor: '#5c2a07',
          iconBg: 'var(--amber)',
        };
  return (
    <div
      className="p-3 mb-3 flex gap-2.5"
      style={{
        background: cfg.tint,
        border: `1px solid ${cfg.border}`,
        borderLeft: `3px solid ${cfg.accent}`,
        borderRadius: 4,
      }}
    >
      <span
        className="shrink-0 inline-flex items-center justify-center mt-0.5"
        style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', border: `1.5px solid ${cfg.accent}`, color: cfg.accent }}
      >
        {kind === 'info' ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 4.5v4M8 11.25h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L1.5 13.5H14.5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M8 7V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="8" cy="12" r="0.75" fill="currentColor" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="font-serif"
          style={{ fontSize: 13, fontWeight: 600, color: cfg.titleColor }}
        >
          {title}
        </p>
        <p
          style={{ fontSize: 12.5, color: cfg.bodyColor, lineHeight: 1.55, marginTop: 3 }}
        >
          {children}
        </p>
      </div>
    </div>
  );
}

export default function RealDataContextPanel({
  realData,
  realDataElectricity,
  syntheticDeltaCrps,
}: RealDataContextPanelProps) {
  const realDeltaCrpsWind = computeRealDeltaCrps(realData);
  const realDeltaCrpsElec = computeRealDeltaCrps(realDataElectricity ?? null);

  const hasWindDiscrepancy = hasDiscrepancyWarning(realDeltaCrpsWind, syntheticDeltaCrps);
  const hasElecDiscrepancy = hasDiscrepancyWarning(realDeltaCrpsElec, syntheticDeltaCrps);
  const hasAnyDiscrepancy = hasWindDiscrepancy || hasElecDiscrepancy;

  const datasets: { label: string; data: RealDataResult | null; deltaCrps: number | null }[] = [
    { label: 'Elia wind', data: realData, deltaCrps: realDeltaCrpsWind },
    { label: 'Elia electricity', data: realDataElectricity ?? null, deltaCrps: realDeltaCrpsElec },
  ];

  const hasMultipleDatasets = datasets.filter((d) => d.data != null).length > 1;

  return (
    <PanelShell title="Real-data context" accent="var(--teal)">
      <Callout kind="info" title="Generalisability caveat">
        {hasMultipleDatasets
          ? 'Results come from two real-world series (Elia Belgian offshore wind and Elia electricity prices). Both use the same seven forecasting models. Further replication across additional domains would strengthen generalisability claims.'
          : 'Results come from a single real-world series (Elia Belgian offshore wind, 17,544 hourly points, seven forecasting models). They may not transfer unchanged to other domains, so additional replication is needed before drawing general conclusions.'}
      </Callout>

      {datasets.map(({ label, data: ds }) =>
        ds?.config ? (
          <div key={label} className="mb-4">
            <SectionLabel>{label} — dataset characteristics</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              <Badge>Series: {String(ds.config.series_name ?? '').replace(/_/g, ' ')}</Badge>
              <Badge>
                <span className="font-mono tabular-nums">N = {ds.config.n_forecasters}</span>
              </Badge>
              <Badge>
                <span className="font-mono tabular-nums">T = {ds.config.T}</span>
              </Badge>
              <Badge>
                Warmup <span className="font-mono tabular-nums ml-1">{ds.config.warmup}</span>
              </Badge>
              {ds.config.forecasters?.length > 0 && (
                <Badge>Forecasters: {ds.config.forecasters.join(', ')}</Badge>
              )}
            </div>
          </div>
        ) : null,
      )}

      {(syntheticDeltaCrps != null || datasets.some((d) => d.deltaCrps != null)) && (
        <div className="mb-4">
          <SectionLabel>Synthetic vs real-data ΔCRPS</SectionLabel>
          <div
            className="overflow-x-auto"
            style={{ border: '1px solid var(--border)', borderRadius: 4 }}
          >
            <table className="w-full" style={{ fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
                  <th
                    className="text-left uppercase"
                    style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}
                  >
                    Source
                  </th>
                  <th
                    className="text-right uppercase"
                    style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}
                  >
                    ΔCRPS (blended vs equal)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 14px', color: 'var(--ink)', fontWeight: 500 }}>
                    Synthetic (latent_fixed)
                  </td>
                  <td
                    className="text-right font-mono tabular-nums"
                    style={{
                      padding: '8px 14px',
                      color:
                        syntheticDeltaCrps == null
                          ? 'var(--ink-faint)'
                          : syntheticDeltaCrps < 0
                          ? 'var(--teal-deep)'
                          : 'var(--crimson)',
                      fontWeight: syntheticDeltaCrps != null ? 600 : 400,
                    }}
                  >
                    {syntheticDeltaCrps != null ? syntheticDeltaCrps.toFixed(4) : '—'}
                  </td>
                </tr>
                {datasets.map(({ label, data: ds, deltaCrps }, i) =>
                  ds ? (
                    <tr
                      key={label}
                      style={{ borderBottom: i < datasets.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <td style={{ padding: '8px 14px', color: 'var(--ink)', fontWeight: 500 }}>
                        Real data ({label})
                      </td>
                      <td
                        className="text-right font-mono tabular-nums"
                        style={{
                          padding: '8px 14px',
                          color:
                            deltaCrps == null
                              ? 'var(--ink-faint)'
                              : deltaCrps < 0
                              ? 'var(--teal-deep)'
                              : 'var(--crimson)',
                          fontWeight: deltaCrps != null ? 600 : 400,
                        }}
                      >
                        {deltaCrps != null ? deltaCrps.toFixed(4) : '—'}
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasAnyDiscrepancy && (
        <Callout kind="warn" title="Discrepancy detected">
          {hasWindDiscrepancy && hasElecDiscrepancy
            ? 'Both real-data ΔCRPS values differ from synthetic by more than 2×.'
            : hasWindDiscrepancy
            ? 'Elia wind real-data ΔCRPS differs from synthetic by more than 2×.'
            : 'Elia electricity real-data ΔCRPS differs from synthetic by more than 2×.'}
          {' '}Possible causes: different panel size (N), different forecaster quality distribution, or domain-specific effects.
        </Callout>
      )}

      <div>
        <SectionLabel>Future replication targets</SectionLabel>
        <ul className="space-y-1.5">
          {FUTURE_TARGETS.map((target) => (
            <li
              key={target}
              className="flex items-center gap-2"
              style={{ fontSize: 13, color: 'var(--ink-muted)' }}
            >
              <span
                aria-hidden="true"
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: 'var(--ink-faint)' }}
              />
              {target}
            </li>
          ))}
        </ul>
      </div>
    </PanelShell>
  );
}
