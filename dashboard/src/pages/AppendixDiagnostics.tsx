import { useEffect, useMemo, useState } from 'react';
import PageShell from '@/components/dashboard/PageShell';
import PageHeader from '@/components/dashboard/PageHeader';
import Breadcrumb from '@/components/dashboard/Breadcrumb';
import ThesisRef from '@/components/dashboard/ThesisRef';
import { THESIS_PALETTE } from '@/lib/palette';

const PALETTE = THESIS_PALETTE;

interface AuditRow {
  experiment: string;
  method: string;
  seed: number;
  DGP: string;
  preset: string;
  mean_crps: number;
  delta_crps_vs_equal: number;
  delta_ci_lower: number;
  delta_ci_upper: number;
  delta_bootstrap_se: number;
}

interface AuditConfig {
  T: number;
  warmup: number;
  n_forecasters: number;
  forecasters: string[];
  gamma: number;
  rho: number;
  lam: number;
  series_name: string;
  normalize_mode: string;
}

interface PerAgentRecord extends Record<string, number> {
  t: number;
}

interface AuditComparison {
  config: AuditConfig;
  rows: AuditRow[];
  per_agent_crps: PerAgentRecord[];
  forecaster_names: string[];
}

interface CoverageData {
  taus: number[];
  nominal: number[];
  mech_coverage: number[];
  vitali_coverage: number[];
  mech_tail_dev: number;
  mech_centre_dev: number;
  vitali_tail_dev: number;
  vitali_centre_dev: number;
  mech_crps: number;
  vitali_crps: number;
}

const METHOD_LABEL: Record<string, string> = {
  uniform: 'Uniform (equal weights)',
  skill: 'Skill only',
  mechanism: 'Mechanism (skill × stake)',
  best_single: 'Best single forecaster',
  inverse_variance: 'Inverse-variance',
  trimmed_mean: 'Trimmed mean',
  median: 'Median',
  oracle: 'Oracle',
  per_round_inv_crps_hindsight: 'Hindsight inv-CRPS (per round)',
  michael_ogd_centered_median_fan: 'Vitali OGD (centred median fan)',
};

function fmt(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function pct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`;
}

export default function AppendixDiagnostics() {
  const [audit, setAudit] = useState<AuditComparison | null>(null);
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/';
    const safeFetch = async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`request failed (HTTP ${r.status})`);
      return r.json();
    };
    Promise.all([
      safeFetch(`${base}data/real_data/elia_wind_audit_fresh/data/comparison.json`),
      safeFetch(`${base}data/audit_per_quantile/coverage.json`),
    ])
      .then(([a, c]) => {
        setAudit(a as AuditComparison);
        setCoverage(c as CoverageData);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const perAgentMean = useMemo(() => {
    if (!audit) return [] as { name: string; mean: number }[];
    const names = audit.forecaster_names;
    return names.map((name) => {
      const vals = audit.per_agent_crps
        .map((row) => row[name])
        .filter((v): v is number => typeof v === 'number');
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
      return { name, mean };
    });
  }, [audit]);

  const tEval = audit ? audit.config.T - audit.config.warmup : 0;

  return (
    <PageShell>
      <Breadcrumb />
      <PageHeader
        hero
        eyebrow="Appendix"
        title="Audit-slice diagnostics"
        subtitle="Audit-slice triplet on Elia wind: aggregate CRPS, per-forecaster CRPS, and per-quantile coverage."
        companion={<ThesisRef viewKey="appendix/diagnostics" />}
      />

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          Could not load audit data: {error}
        </div>
      )}

      {!audit || !coverage ? (
        <div role="status" aria-label="Loading audit-slice data">
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>
            Loading audit-slice data&hellip;
          </p>
          <div
            className="rounded-lg border border-dashed border-slate-200 bg-slate-50 animate-pulse"
            style={{ height: 160, marginBottom: 16 }}
          />
          <div
            className="rounded-lg border border-dashed border-slate-200 bg-slate-50 animate-pulse"
            style={{ height: 220 }}
          />
        </div>
      ) : (
        <>
          <section>
            <h2
              className="font-serif"
              style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}
            >
              Run configuration
            </h2>
            <div className="panel-card" style={{ padding: 16 }}>
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0, maxWidth: '70ch' }}>
                Elia offshore wind, audit slice. T = {audit.config.T.toLocaleString()} rounds,
                warmup {audit.config.warmup}, evaluation rounds {tEval.toLocaleString()}. {audit.config.n_forecasters}
                {' '}forecasters under expanding causal normalisation. Tuned
                hyperparameters γ = {audit.config.gamma}, ρ = {audit.config.rho}, λ = {audit.config.lam}.
              </p>
            </div>
          </section>

          <section>
            <p style={tableCue}>Table 1 of 3 &middot; Aggregate CRPS</p>
            <h2
              className="font-serif"
              style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}
            >
              Aggregate CRPS by aggregation rule, audit slice (§4.2.1.3)
              <span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: 14 }}> · T6a</span>
            </h2>
            <p
              style={{
                fontSize: 13.5,
                color: 'var(--ink-soft)',
                marginBottom: 12,
                maxWidth: '70ch',
              }}
            >
              Mean CRPS, Δ vs uniform, and the bootstrap 95% interval on the audit slice.
            </p>
            <div className="panel-card" style={{ overflowX: 'auto', padding: 0 }}>
              <table
                className="w-full"
                style={{ fontSize: 13, borderCollapse: 'collapse' }}
              >
                <thead>
                  <tr style={{ background: 'rgba(31, 42, 56, 0.04)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Method</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Mean CRPS</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Δ vs uniform</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Δ %</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>95% CI (Δ)</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.rows.map((row) => {
                    const ref = audit.rows.find((r) => r.method === 'uniform');
                    const refMean = ref ? ref.mean_crps : NaN;
                    const pctVal = Number.isFinite(refMean) && refMean > 0
                      ? row.delta_crps_vs_equal / refMean
                      : NaN;
                    const isMech = row.method === 'mechanism';
                    return (
                      <tr
                        key={row.method}
                        style={{
                          borderTop: '1px solid var(--border)',
                          background: isMech ? 'rgba(31, 119, 180, 0.06)' : 'transparent',
                        }}
                      >
                        {/* Mechanism row text uses the AA-compliant imperial
                            token on the tinted highlight row; the chart-anchored
                            proposed blue stays the row tint + bold weight. */}
                        <td style={{ padding: '8px 12px', color: isMech ? 'var(--imperial)' : 'var(--ink)', fontWeight: isMech ? 600 : 400 }}>
                          {METHOD_LABEL[row.method] ?? row.method}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {fmt(row.mean_crps, 5)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {fmt(row.delta_crps_vs_equal, 5)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {row.method === 'uniform' ? '—' : pct(pctVal, 2)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {row.method === 'uniform'
                            ? '—'
                            : `[${fmt(row.delta_ci_lower, 5)}, ${fmt(row.delta_ci_upper, 5)}]`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <p style={tableCue}>Table 2 of 3 &middot; Per-forecaster CRPS</p>
            <h2
              className="font-serif"
              style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}
            >
              Per-forecaster mean CRPS, audit slice (§4.2.1.3)
              <span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: 14 }}> · T7</span>
            </h2>
            <p
              style={{
                fontSize: 13.5,
                color: 'var(--ink-soft)',
                marginBottom: 12,
                maxWidth: '70ch',
              }}
            >
              Mean CRPS for each input forecaster across the {audit.per_agent_crps.length.toLocaleString()}
              {' '}per-round records logged on the audit slice.
            </p>
            <div className="panel-card" style={{ overflowX: 'auto', padding: 0 }}>
              <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(31, 42, 56, 0.04)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Forecaster</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Mean CRPS</th>
                  </tr>
                </thead>
                <tbody>
                  {perAgentMean.map((d) => (
                    <tr key={d.name} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>{d.name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {fmt(d.mean, 5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <p style={tableCue}>Table 3 of 3 &middot; Per-quantile coverage</p>
            <h2
              className="font-serif"
              style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}
            >
              Per-quantile coverage, audit slice (§4.2.1.3)
              <span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: 14 }}> · T8</span>
            </h2>
            <p
              style={{
                fontSize: 13.5,
                color: 'var(--ink-soft)',
                marginBottom: 12,
                maxWidth: '70ch',
              }}
            >
              Empirical coverage at each nominal quantile τ. Tail deviation sums |empirical − nominal| over τ ∈ {'{'}0.1, 0.9{'}'} and centre deviation over τ ∈ {'{'}0.4, 0.5, 0.6{'}'}.
            </p>
            <div className="panel-card" style={{ overflowX: 'auto', padding: 0 }}>
              <table className="w-full" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(31, 42, 56, 0.04)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>τ</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Nominal</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right', color: PALETTE.proposed }}>Mechanism</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right', color: PALETTE.external }}>Vitali OGD</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.taus.map((tau, i) => (
                    <tr key={tau} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{tau.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {coverage.nominal[i].toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {coverage.mech_coverage[i].toFixed(4)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {coverage.vitali_coverage[i].toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(31, 42, 56, 0.03)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }} colSpan={2}>Tail deviation</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {fmt(coverage.mech_tail_dev, 4)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {fmt(coverage.vitali_tail_dev, 4)}
                    </td>
                  </tr>
                  <tr style={{ background: 'rgba(31, 42, 56, 0.03)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }} colSpan={2}>Centre deviation</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {fmt(coverage.mech_centre_dev, 4)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {fmt(coverage.vitali_centre_dev, 4)}
                    </td>
                  </tr>
                  <tr style={{ background: 'rgba(31, 42, 56, 0.03)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }} colSpan={2}>Mean CRPS (slice)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {fmt(coverage.mech_crps, 5)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {fmt(coverage.vitali_crps, 5)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}

const tableCue: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-faint)',
  margin: '0 0 4px',
};
