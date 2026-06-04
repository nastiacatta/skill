import { Link } from 'react-router-dom';
import PageShell from '@/components/dashboard/PageShell';
import PageHeader from '@/components/dashboard/PageHeader';
import Breadcrumb from '@/components/dashboard/Breadcrumb';
import ThesisRef from '@/components/dashboard/ThesisRef';
import { Card, SectionHeading } from '@/components/platform/ui';

const SECTIONS = [
  { to: '/appendix', title: 'Simulation lab', description: 'Interactive sandbox: round replay, time-series, comparison, validation.' },
  { to: '/appendix/experiments', title: 'Experiments index', description: 'Browse every experiment by block (core, behaviour, real data) and search.' },
  { to: '/appendix/diagnostics', title: 'Audit-slice diagnostics', description: 'Warmup-window audit triplet on Elia wind: aggregate CRPS, per-forecaster CRPS, per-quantile coverage.' },
];

type GalleryFigure = { src: string; title: string; caption: string };

const DIAGNOSTIC_GALLERY_GROUPS: { label: string; figures: GalleryFigure[] }[] = [
  {
    label: 'Real-data wind and electricity diagnostics',
    figures: [
      {
        src: 'presentation-plots/skill_vs_noskill_weights.png',
        title: 'Skill-gated versus no-skill aggregation weights (Elia wind)',
        caption: 'Steady-state aggregation weights spread from 0.122 on Theta to 0.158 on XGBoost under the skill gate, against the uniform 0.143 baseline.',
      },
      {
        src: 'presentation-plots/weight_distribution_uniform.png',
        title: 'Tail-of-run weight distribution: wind versus electricity',
        caption: 'Electricity sits near uniform while wind spreads under XGBoost.',
      },
      {
        src: 'presentation-plots/pit_histogram_two_panel.png',
        title: 'PIT histograms (wind versus electricity)',
        caption: 'Wind shows systematic over-coverage while electricity sits near the uniform reference.',
      },
      {
        src: 'presentation-plots/wind_cumulative_profit.png',
        title: 'Cumulative profit by forecaster (Elia wind)',
        caption: 'XGBoost accumulates the largest surplus across the full run. Theta and EWMA(5) the least.',
      },
      {
        src: 'presentation-plots/dm_rolling_window.png',
        title: 'Rolling Diebold–Mariano stability',
        caption: 'The DM t-statistic stays above the 1.96 cutoff in every 1,000-round window across the full wind run.',
      },
      {
        src: 'presentation-plots/cumulative_crps.png',
        title: 'Cumulative mean CRPS (Elia wind)',
        caption: 'The mechanism trace separates from uniform near round 2,000 and sustains the gap.',
      },
      {
        src: 'presentation-plots/regime_shift_bars.png',
        title: 'Restart-per-season regime-shift evaluation',
        caption: 'The mechanism delivers −3.0% to −4.2% CRPS reduction in every season under per-season restart.',
      },
      {
        src: 'presentation-plots/wind_weight_concentration.png',
        title: 'Weight concentration on Elia wind',
        caption: 'HHI stays below 0.5 throughout, concentrating on the leader without collapsing onto one forecaster.',
      },
    ],
  },
  {
    label: 'Synthetic-panel diagnostics',
    figures: [
      {
        src: 'presentation-plots/synth_reward_distribution.png',
        title: 'Cumulative profit per cohort (synthetic panel)',
        caption: 'The two lowest-noise cohorts absorb 0.88 of the redistributed surplus on the known-noise panel.',
      },
      {
        src: 'presentation-plots/reward_distribution.png',
        title: 'Pooled reward distribution: mechanism vs uniform-stake',
        caption: 'The mechanism distribution is 61% narrower (mean absolute profit 48.4 vs 77.9 deposit units).',
      },
      {
        src: 'presentation-plots/panel_scaling.png',
        title: 'Panel-size scaling',
        caption: 'Mean CRPS and effective participant count across panel sizes. The mechanism overtakes uniform between n=12 and n=25.',
      },
      {
        src: 'presentation-plots/bankroll_ablation_four_panel.png',
        title: 'Bankroll ablation (four-panel)',
        caption: 'Final bankroll, mean CRPS, Gini, and effective participants across deposit fractions f.',
      },
      {
        src: 'presentation-plots/weight_rule_comparison.png',
        title: 'Weight-rule comparison',
        caption: 'Mean CRPS by aggregation rule (skill, mechanism, inverse-variance, trimmed mean, median) on the synthetic panel.',
      },
      {
        src: 'presentation-plots/crps_calibration.png',
        title: 'CRPS versus calibration trade-off',
        caption: 'Mean CRPS against MACE for the five aggregation rules.',
      },
      {
        src: 'presentation-plots/behaviour_wealth.png',
        title: 'Wealth trajectory by behaviour',
        caption: 'Cumulative wealth by attacker class on the synthetic stress panel, anchored to the truthful baseline.',
      },
      {
        src: 'presentation-plots/selective_participation.png',
        title: 'Selective participation',
        caption: 'CRPS impact of opt-in versus full participation across the behaviour catalogue.',
      },
      {
        src: 'presentation-plots/deposit_policy_comparison.png',
        title: 'Deposit-policy comparison',
        caption: 'Mean CRPS for fixed, exponential, and bankroll-fraction deposits on the synthetic panel.',
      },
    ],
  },
  {
    label: 'Validation and composites',
    figures: [
      {
        src: 'presentation-plots/scoring_validation.png',
        title: 'Scoring validation',
        caption: 'Internal CRPS against the scoringRules R package on a paired sample, with differences at floating-point noise.',
      },
      {
        src: 'presentation-plots/master_comparison_four_panel.png',
        title: 'Master comparison (four-panel)',
        caption: 'Four-panel reference covering CRPS gain, weight concentration, calibration, and Gini across the synthetic and real panels.',
      },
    ],
  },
];

export default function Appendix() {
  return (
    <PageShell width="narrow">
      <Breadcrumb />
      <PageHeader
        hero
        title="Figures and diagnostics"
        companion={<ThesisRef viewKey="appendix/figures" />}
        subtitle="Supplementary figures and diagnostic checks supporting the main results."
      />
      <ul className="space-y-4">
        {SECTIONS.map(({ to, title, description }) => (
          <li key={to}>
            <Card
              interactive
              elevation="raised"
              className="block transition-colors"
              {...({ as: Link, to } as { as: typeof Link; to: string })}
            >
              <h2
                className="font-serif"
                style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              >
                {title}
                <span aria-hidden="true" style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>&rarr;</span>
              </h2>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: 'var(--ink-soft)',
                  marginTop: 6,
                }}
              >
                {description}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <section style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
        <SectionHeading
          title="Diagnostic gallery"
          subtitle="Stability and distributional checks behind the headline results."
          level={2}
        />
        <div style={{ height: 16 }} />
        {DIAGNOSTIC_GALLERY_GROUPS.map(({ label, figures }, groupIndex) => (
          <div key={label} style={{ marginTop: groupIndex === 0 ? 0 : 32 }}>
            <h3
              className="font-serif"
              style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-soft)', margin: '0 0 12px' }}
            >
              {label}
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 16,
              }}
            >
              {figures.map(({ src, title, caption }) => (
                <figure
                  key={src}
                  className="panel-card"
                  style={{ margin: 0, padding: 12 }}
                >
                  <img
                    src={src}
                    alt={`${title}. ${caption}`}
                    loading="lazy"
                    style={{ width: '100%', height: 'auto', borderRadius: 4 }}
                  />
                  <figcaption style={{ marginTop: 8 }}>
                    <div
                      style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
                    >
                      {title}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: 'var(--ink-soft)',
                        marginTop: 4,
                      }}
                    >
                      {caption}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </section>
    </PageShell>
  );
}
