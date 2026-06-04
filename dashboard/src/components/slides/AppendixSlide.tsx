import { useState } from 'react';
import SlideShell from './shared/SlideShell';
import { PALETTE, TYPOGRAPHY, CARD_STYLE, FIGURE_FRAME } from './shared/presentationConstants';

/* ─── Q&A data ────────────────────────────────────────────────── */

interface QAItem {
  question: string;
  answer: string;
}

const QA_ITEMS: QAItem[] = [
  {
    question:
      "Why not just use Vitali & Pinson's approach? It has lower CRPS.",
    answer:
      "Vitali & Pinson's OGD achieves lower CRPS (−21.1 % wind) but uses Shapley settlement (not self-financed) and relative weights on a simplex. This project's mechanism preserves Lambert's seven formal properties, including budget balance and narrow sybil invariance, and uses absolute skill signals. The trade-off is quantified: roughly 14 percentage points of CRPS on wind relative to OGD, in exchange for a self-financed settlement and absolute skill.",
  },
  {
    question:
      'Why does the best single forecaster still beat the aggregate on wind?',
    answer:
      'On Elia wind, XGBoost has the lowest per-agent mean CRPS, with ARIMA and Naive persistence close behind (wind is highly autocorrelated at the one-hour horizon). The mechanism improves the aggregate modestly (−7.1% relative to equal weights) but the ceiling is set by a rolling best-single selector, which is roughly 16 percentage points lower. This is a known limitation of linear opinion pools — future work could explore nonlinear combination methods.',
  },
  {
    question:
      'How sensitive are the results to hyperparameter choices (γ, ρ, λ)?',
    answer:
      'The parameter sweep experiments show the mechanism is stable across many parameter values. γ (skill learning rate) has the strongest effect — too low means slow adaptation, too high means overfitting to noise. The tuned values (γ = 16, ρ = 0.5, λ = 0.05) were selected via grid search on a validation split.',
  },
  {
    question: 'What happens with fewer forecasters?',
    answer:
      'The mechanism needs heterogeneity to work. With N < 4, there is not enough diversity for the skill signal to exploit. The sweet spot is N ≥ 6 with genuinely different model families.',
  },
  {
    question: 'Is truthfulness guaranteed?',
    answer:
      "Per-round truthfulness under risk-neutrality holds, following Lambert et al.'s original assumption. Under risk aversion, forecasters may shade their reports. This is a known limitation shared with all Lambert-family mechanisms.",
  },
  {
    question: 'How does the mechanism handle regime changes?',
    answer:
      'The EWMA skill signal naturally adapts — recent performance is weighted more heavily. The staleness decay also helps: if a forecaster becomes stale during a regime shift, their skill decays toward baseline. Seasonal analysis on Elia wind shows the mechanism improves in all four seasons.',
  },
  {
    question: 'What is the computational cost?',
    answer:
      'Each round is O(N) where N is the number of forecasters. The EWMA update, skill gate, and Lambert settlement are all linear. The full 17,544-round Elia experiment runs in under 30 seconds on a laptop.',
  },
  {
    question: 'How does this compare to simple inverse-variance weighting?',
    answer:
      'Inverse-variance weighting uses forecast spread as a proxy for quality. Our mechanism learns skill from realised accuracy over time, which is more informative. On Elia wind, the mechanism outperforms inverse-variance by a wide margin.',
  },
  {
    question: 'Could this work with non-probabilistic (point) forecasts?',
    answer:
      'The mechanism requires probabilistic forecasts (quantiles) because the CRPS scoring rule needs a full distribution. Point forecasts could be converted to distributions via residual resampling, which is what we do for the 7 models.',
  },
  {
    question: 'What about the warm-up period?',
    answer:
      'The first 200 rounds are a warm-up where all forecasters have equal skill. This is needed for the EWMA to accumulate enough history. Results are reported on the post-warm-up period only.',
  },
];


/* ─── Extra figures references ────────────────────────────────── */

const BASE = import.meta.env.BASE_URL;

const EXTRA_FIGURES = [
  { label: 'Budget-balance + profit distribution (settlement sanity)', file: 'settlement_sanity.png' },
  { label: 'Sybil invariance: profit ratio vs number of clones', file: 'sybil.png' },
  { label: 'Cumulative mean CRPS by method over time', file: 'forecast_aggregation.png' },
  { label: 'Parameter sweep results', file: 'parameter_sweep.png' },
  { label: 'Calibration reliability diagram', file: 'calibration_reliability.png' },
  { label: 'Behaviour matrix (18 presets × 9 families)', file: 'behaviour_concentration.png' },
  { label: 'Seasonal decomposition of Elia wind results', file: 'real_data_validation.png' },
];

/* ─── Tab type ────────────────────────────────────────────────── */

type AppendixTab = 'qa' | 'figures' | 'guarantees' | 'deposit' | 'mechanism' | 'skillmath' | 'params' | 'crps' | 'ordering' | 'rewards';

/* ─── Mechanism Comparison data (moved from main deck) ─────── */

interface ComparisonRow {
  feature: string;
  lambert: string;
  raja: string;
  vitali: string;
  thesis: string;
}

const COMPARISON_DATA: ComparisonRow[] = [
  {
    feature: 'Financing',
    lambert: 'Self-financed',
    raja: 'Self-financed + client reward',
    vitali: 'Shapley payoffs (not self-financed)',
    thesis: 'Self-financed',
  },
  {
    feature: 'Weight Adaptation',
    lambert: 'Static (per-round)',
    raja: 'Static (per-round)',
    vitali: 'Online gradient descent',
    thesis: 'Online EWMA',
  },
  {
    feature: 'Skill/Weight Type',
    lambert: 'Equal or deposit-based',
    raja: 'Equal or deposit-based',
    vitali: 'Relative (simplex)',
    thesis: 'Absolute (per-forecaster)',
  },
  {
    feature: 'Intermittency',
    lambert: 'Not handled',
    raja: 'Not handled',
    vitali: 'Handled (online)',
    thesis: 'Staleness decay',
  },
  {
    feature: 'Key Properties',
    lambert: '7 formal properties, uniqueness',
    raja: 'Client reward, payoff allocation',
    vitali: 'Regret bounds, missing data',
    thesis: '7 properties + skill learning',
  },
];

const COMPARISON_HEADERS = ['Lambert et al.', 'Raja et al.', 'Vitali & Pinson', 'This Project'] as const;

const COMPARISON_HEADER_TINTS = [
  'rgba(0, 62, 116, 0.08)',
  'rgba(100, 116, 139, 0.08)',
  'rgba(124, 58, 237, 0.08)',
  'rgba(46, 139, 139, 0.10)',
] as const;

/* ─── Mechanism Guarantees data ───────────────────────────────── */

interface GuaranteeRow {
  property: string;
  meaning: string;
  pass: boolean;
}

const GUARANTEES: GuaranteeRow[] = [
  {
    property: 'Budget gap',
    meaning: 'Self-financed — no external subsidy needed',
    pass: true,
  },
  {
    property: 'Mean profit',
    meaning: 'Zero-sum — no money created or destroyed',
    pass: true,
  },
  {
    property: 'Sybil ratio',
    meaning: 'No advantage from splitting',
    pass: true,
  },
  {
    property: 'Noise-skill corr.',
    meaning: 'Skilled forecasters reliably rewarded',
    pass: true,
  },
];

/** SVG checkmark icon for guarantees table */
function CheckIcon({ pass }: { pass: boolean }) {
  if (pass) {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12" fill="rgba(46, 139, 139, 0.1)" stroke={PALETTE.teal} strokeWidth="2" />
        <path d="M9 14 L12.5 17.5 L19 11" stroke={PALETTE.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" fill="rgba(232, 93, 74, 0.1)" stroke={PALETTE.coral} strokeWidth="2" />
      <path d="M10 10 L18 18 M18 10 L10 18" stroke={PALETTE.coral} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Q&A card ────────────────────────────────────────────────── */

function QACard({ item, index }: { item: QAItem; index: number }) {
  return (
    <div
      style={{
        ...CARD_STYLE,
        padding: '18px 22px',
        marginBottom: 14,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '1.15rem',
          fontWeight: 700,
          color: PALETTE.navy,
          lineHeight: 1.45,
          fontFamily: TYPOGRAPHY.fontFamily,
        }}
      >
        Q{index + 1}. "{item.question}"
      </p>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: '1.05rem',
          fontWeight: 400,
          color: PALETTE.charcoal,
          lineHeight: 1.55,
          fontFamily: TYPOGRAPHY.fontFamily,
        }}
      >
        → {item.answer}
      </p>
    </div>
  );
}

/* ─── Figure reference card ───────────────────────────────────── */

function FigureCard({ label, file }: { label: string; file: string }) {
  return (
    <div
      style={{
        ...CARD_STYLE,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <img
        src={`${BASE}presentation-plots/${file}`}
        alt={label}
        style={{
          flex: 1,
          maxWidth: '100%',
          maxHeight: 400,
          objectFit: 'contain',
          borderRadius: 8,
        }}
      />
      <span
        style={{
          fontSize: '0.92rem',
          fontWeight: 600,
          color: PALETTE.navy,
          fontFamily: TYPOGRAPHY.fontFamily,
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─── Tab button ──────────────────────────────────────────────── */

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        padding: '8px 24px',
        fontSize: '0.92rem',
        fontWeight: active ? 700 : 500,
        fontFamily: TYPOGRAPHY.fontFamily,
        color: active ? PALETTE.white : PALETTE.navy,
        background: active ? PALETTE.teal : PALETTE.lightBg,
        border: `1.5px solid ${active ? PALETTE.teal : PALETTE.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        letterSpacing: '0.03em',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

/* ─── Main component ──────────────────────────────────────────── */

/**
 * Appendix slide — backup material for Q&A.
 * No slide number, no section bar. Uses SlideShell without slideNumber.
 * Props are passed by PresentationPage for consistency with other slides; content is static.
 */
export default function AppendixSlide(_props: {
  slide?: unknown;
  palette?: unknown;
  fontFamily?: string;
}) {
  const [tab, setTab] = useState<AppendixTab>('qa');

  return (
    <SlideShell title="Appendix" subtitle="Backup slides for Q&A">
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexShrink: 0,
        }}
      >
        <TabButton
          label="A. Anticipated Questions"
          active={tab === 'qa'}
          onClick={() => setTab('qa')}
        />
        <TabButton
          label="B. Extra Figures"
          active={tab === 'figures'}
          onClick={() => setTab('figures')}
        />
        <TabButton
          label="C. Mechanism Guarantees"
          active={tab === 'guarantees'}
          onClick={() => setTab('guarantees')}
        />
        <TabButton
          label="D. Deposit Design"
          active={tab === 'deposit'}
          onClick={() => setTab('deposit')}
        />
        <TabButton
          label="E. Mechanism Comparison"
          active={tab === 'mechanism'}
          onClick={() => setTab('mechanism')}
        />
        <TabButton
          label="F. Skill Signal Math"
          active={tab === 'skillmath'}
          onClick={() => setTab('skillmath')}
        />
        <TabButton
          label="G. Tuned Parameters"
          active={tab === 'params'}
          onClick={() => setTab('params')}
        />
        <TabButton
          label="H. CRPS Explained"
          active={tab === 'crps'}
          onClick={() => setTab('crps')}
        />
        <TabButton
          label="I. Why Ordering Validates"
          active={tab === 'ordering'}
          onClick={() => setTab('ordering')}
        />
        <TabButton
          label="J. Reward Sharing"
          active={tab === 'rewards'}
          onClick={() => setTab('rewards')}
        />
      </div>

      {/* Tab content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        {tab === 'qa' && (
          <div>
            {QA_ITEMS.map((item, i) => (
              <QACard key={i} item={item} index={i} />
            ))}
          </div>
        )}

        {tab === 'figures' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 20,
            }}
          >
            {EXTRA_FIGURES.map((fig) => (
              <FigureCard key={fig.file} label={fig.label} file={fig.file} />
            ))}
          </div>
        )}

        {tab === 'guarantees' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
            }}
          >
            <p
              style={{
                fontSize: '1.15rem',
                color: PALETTE.slate,
                fontFamily: TYPOGRAPHY.fontFamily,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Verified to machine precision across all properties
            </p>

            <div
              style={{
                ...CARD_STYLE,
                width: '100%',
                padding: '38px 48px',
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 170px 1fr',
                  gap: 16,
                  paddingBottom: 14,
                  borderBottom: `2px solid ${PALETTE.border}`,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: '1.06rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily, textAlign: 'center' }}>
                  Status
                </span>
                <span style={{ fontSize: '1.06rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>
                  Property
                </span>
                <span style={{ fontSize: '1.06rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>
                  What it means
                </span>
              </div>

              {GUARANTEES.map((row, i) => (
                <div
                  key={row.property}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 170px 1fr',
                    gap: 16,
                    alignItems: 'center',
                    padding: '18px 0 18px 0',
                    borderBottom: i < GUARANTEES.length - 1 ? `1px solid ${PALETTE.border}` : 'none',
                    borderLeft: row.pass ? `4px solid ${PALETTE.teal}` : '4px solid transparent',
                    paddingLeft: 12,
                    borderRadius: '4px 0 0 4px',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <CheckIcon pass={row.pass} />
                  </div>
                  <span
                    style={{
                      fontSize: '1.35rem',
                      fontWeight: 600,
                      color: PALETTE.navy,
                      fontFamily: TYPOGRAPHY.fontFamily,
                    }}
                  >
                    {row.property}
                  </span>
                  <span
                    style={{
                      fontSize: '1.2rem',
                      color: PALETTE.teal,
                      fontWeight: 600,
                      fontFamily: TYPOGRAPHY.fontFamily,
                    }}
                  >
                    {row.meaning}
                  </span>
                </div>
              ))}
            </div>

            {/* Visual evidence: budget-gap + profit distribution */}
            <div
              style={{
                ...CARD_STYLE,
                width: '100%',
                padding: '18px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: PALETTE.navy,
                  fontFamily: TYPOGRAPHY.fontFamily,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase' as const,
                }}
              >
                Numerical evidence
              </span>
              <span
                style={{
                  fontSize: '0.95rem',
                  color: PALETTE.slate,
                  fontFamily: TYPOGRAPHY.fontFamily,
                  lineHeight: 1.5,
                }}
              >
                Budget-gap histogram concentrates at zero (max |Σ payouts − Σ wagers| on the order of 10⁻¹⁴); the profit distribution is zero-mean.
              </span>
              <img
                src={`${BASE}presentation-plots/settlement_sanity.png`}
                alt="Histograms of per-round budget gap and per-forecaster profit distribution, both concentrated at zero"
                style={{
                  width: '100%',
                  maxHeight: 340,
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
        )}

        {tab === 'deposit' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <div style={{ background: PALETTE.purple, color: PALETTE.white, fontSize: '1rem', fontWeight: 700, padding: '8px 18px', borderRadius: 16, fontFamily: TYPOGRAPHY.fontFamily }}>
                Bankroll+Conf: strong relative gain over Fixed
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', ...FIGURE_FRAME }}>
              <img
                src={`${BASE}presentation-plots/deposit_policy_comparison.png`}
                alt="Deposit policy comparison showing Oracle, Bankroll+Confidence, Fixed, and Random"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
              />
            </div>
            <p style={{ fontSize: '1rem', color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
              Practical deposit rules capture most of the available gain, but we cannot control what forecasters stake
            </p>
          </div>
        )}

        {tab === 'mechanism' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
            }}
          >
            <div
              style={{
                ...CARD_STYLE,
                width: '100%',
                padding: '36px 44px',
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 1fr 1fr 1fr 1fr',
                  gap: 16,
                  paddingBottom: 14,
                  borderBottom: `2px solid ${PALETTE.border}`,
                  marginBottom: 10,
                }}
              >
                <span />
                {COMPARISON_HEADERS.map((header, idx) => (
                  <span
                    key={header}
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      color: PALETTE.navy,
                      fontFamily: TYPOGRAPHY.fontFamily,
                      textAlign: 'center',
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: COMPARISON_HEADER_TINTS[idx],
                    }}
                  >
                    {header}
                  </span>
                ))}
              </div>

              {/* Data rows */}
              {COMPARISON_DATA.map((row, i) => (
                <div
                  key={row.feature}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '180px 1fr 1fr 1fr 1fr',
                    gap: 16,
                    alignItems: 'center',
                    padding: '16px 0',
                    borderBottom:
                      i < COMPARISON_DATA.length - 1
                        ? `1px solid ${PALETTE.border}`
                        : 'none',
                    background: i % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    borderRadius: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.35rem',
                      fontWeight: 600,
                      color: PALETTE.navy,
                      fontFamily: TYPOGRAPHY.fontFamily,
                      borderLeft: `4px solid ${PALETTE.navy}`,
                      paddingLeft: 12,
                    }}
                  >
                    {row.feature}
                  </span>
                  {[row.lambert, row.raja, row.vitali, row.thesis].map((cell, ci) => (
                    <div key={ci} style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '1.12rem',
                          color: PALETTE.charcoal,
                          fontFamily: TYPOGRAPHY.fontFamily,
                          lineHeight: 1.45,
                        }}
                      >
                        {cell}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'skillmath' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Step 1: Per-round loss */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Step 1: Per-Round Forecasting Loss
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                Each round, forecaster <em>i</em> submits a probabilistic forecast (a set of quantiles). After the outcome is observed, the forecast is scored using the <strong>Continuous Ranked Probability Score (CRPS)</strong>. CRPS is always ≥ 0, with lower values indicating better forecasts. This gives a per-round loss:
              </p>
              <div style={{ margin: '12px 0', padding: '12px 20px', background: 'rgba(46, 139, 139, 0.06)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.15rem', color: PALETTE.navy, fontWeight: 600 }}>
                ℓᵢ(t) = CRPS(qᵢ(t), y(t)) ≥ 0
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: PALETTE.slate, lineHeight: 1.5, fontFamily: TYPOGRAPHY.fontFamily }}>
                where qᵢ(t) is the submitted quantile forecast and y(t) is the realised outcome.
              </p>
            </div>

            {/* Step 2: EWMA accumulator */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Step 2: Loss Accumulator (EWMA)
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                The mechanism maintains an <strong>exponentially weighted moving average</strong> of past losses. Recent performance is weighted more heavily than distant history:
              </p>
              <div style={{ margin: '12px 0', padding: '12px 20px', background: 'rgba(46, 139, 139, 0.06)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.15rem', color: PALETTE.navy, fontWeight: 600 }}>
                Lᵢ(t) = ρ · Lᵢ(t−1) + (1 − ρ) · ℓᵢ(t)
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: PALETTE.slate, lineHeight: 1.5, fontFamily: TYPOGRAPHY.fontFamily }}>
                ρ ∈ (0, 1) is the decay parameter. Since ℓᵢ(t) ≥ 0 always, Lᵢ(t) ≥ 0 always. A consistently bad forecaster accumulates Lᵢ → large; a good one keeps Lᵢ ≈ 0. There is <strong>no upper bound</strong> on Lᵢ — it can grow without limit if the forecaster is persistently poor.
              </p>
            </div>

            {/* Step 3: Exponential mapping */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Step 3: Exponential Mapping to Bounded Skill
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                The unbounded accumulator is compressed into the interval [σ_min, 1] via an exponential decay:
              </p>
              <div style={{ margin: '12px 0', padding: '12px 20px', background: 'rgba(46, 139, 139, 0.06)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.15rem', color: PALETTE.navy, fontWeight: 600 }}>
                σᵢ = σ_min + (1 − σ_min) · exp(−γ · Lᵢ)
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: PALETTE.slate, lineHeight: 1.5, fontFamily: TYPOGRAPHY.fontFamily }}>
                γ {'>'} 0 controls sensitivity. When Lᵢ ≈ 0 (good): σᵢ ≈ 1. When Lᵢ is large (bad): σᵢ → σ_min. The floor σ_min {'>'} 0 ensures every forecaster retains some market access, so no one is permanently excluded.
              </p>
            </div>

            {/* Step 4: Staleness decay */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Step 4: Staleness Decay (Absent Forecasters)
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                When a forecaster is absent in round t, their loss state decays toward a neutral baseline:
              </p>
              <div style={{ margin: '12px 0', padding: '12px 20px', background: 'rgba(46, 139, 139, 0.06)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.15rem', color: PALETTE.navy, fontWeight: 600 }}>
                Lᵢ(t) = λ · L_baseline + (1 − λ) · Lᵢ(t−1)
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: PALETTE.slate, lineHeight: 1.5, fontFamily: TYPOGRAPHY.fontFamily }}>
                λ is the staleness rate. This prevents a forecaster from building a high skill estimate and then disappearing to preserve it. With no new evidence, skill gradually reverts to a prior.
              </p>
            </div>
          </div>
        )}

        {tab === 'params' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <p style={{ margin: 0, fontSize: '1.1rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
              All hyperparameters were selected via <strong>grid search on a held-out validation split</strong> of the Elia wind dataset. The table below lists each parameter, its tuned value, and its role in the mechanism.
            </p>

            <div style={{ ...CARD_STYLE, width: '100%', padding: '36px 44px' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 1fr', gap: 16, paddingBottom: 14, borderBottom: `2px solid ${PALETTE.border}`, marginBottom: 10 }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>Parameter</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily, textAlign: 'center' }}>Value</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>Role</span>
              </div>

              {[
                { symbol: 'γ (gamma)', value: '16', role: 'Skill learning rate — controls how sharply the exponential mapping separates good from bad forecasters. Higher γ means faster differentiation.' },
                { symbol: 'ρ (rho)', value: '0.5', role: 'EWMA decay — balances recent vs. historical performance. At 0.5, the half-life is about 1 round, so the mechanism adapts quickly.' },
                { symbol: 'λ (lambda)', value: '0.05', role: 'Staleness decay rate — how fast an absent forecaster\'s skill reverts to baseline. Low λ means slow decay, giving forecasters time to return.' },
                { symbol: 'σ_min', value: '0.05', role: 'Skill floor, the minimum skill any forecaster retains. Ensures no one is permanently excluded from the aggregate.' },
                { symbol: 'Warm-up', value: '200 rounds', role: 'Initial period where all forecasters have equal skill. Allows the EWMA to accumulate enough history before differentiation begins.' },
              ].map((row, i, arr) => (
                <div
                  key={row.symbol}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 120px 1fr',
                    gap: 16,
                    alignItems: 'center',
                    padding: '18px 0',
                    borderBottom: i < arr.length - 1 ? `1px solid ${PALETTE.border}` : 'none',
                    borderLeft: `4px solid ${PALETTE.teal}`,
                    paddingLeft: 12,
                    borderRadius: '4px 0 0 4px',
                  }}
                >
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: 'monospace' }}>{row.symbol}</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: PALETTE.teal, fontFamily: 'monospace', textAlign: 'center' }}>{row.value}</span>
                  <span style={{ fontSize: '1.05rem', color: PALETTE.charcoal, fontFamily: TYPOGRAPHY.fontFamily, lineHeight: 1.5 }}>{row.role}</span>
                </div>
              ))}
            </div>

            <div style={{ ...CARD_STYLE, padding: '20px 28px', background: 'rgba(46, 139, 139, 0.04)' }}>
              <p style={{ margin: 0, fontSize: '1rem', color: PALETTE.slate, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                <strong>Sensitivity:</strong> The parameter sweep experiments show the mechanism is stable across many parameter values. γ has the strongest effect — too low means slow adaptation, too high means overfitting to noise. The other parameters are less sensitive.
              </p>
            </div>
          </div>
        )}

        {tab === 'crps' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* What is CRPS */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                What is CRPS?
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                The <strong>Continuous Ranked Probability Score</strong> measures how close a probabilistic forecast is to the realised outcome. It generalises mean absolute error to full distributions. CRPS is always ≥ 0, and <strong>lower is better</strong>.
              </p>
              <div style={{ margin: '12px 0', padding: '12px 20px', background: 'rgba(46, 139, 139, 0.06)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.1rem', color: PALETTE.navy, fontWeight: 600 }}>
                CRPS(F, y) = ∫ [F(x) − 𝟙(x ≥ y)]² dx
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: PALETTE.slate, lineHeight: 1.5, fontFamily: TYPOGRAPHY.fontFamily }}>
                where F is the forecast CDF and y is the observed value. A perfect forecast concentrating all mass at y gives CRPS = 0.
              </p>
            </div>

            {/* What does the CRPS reduction mean */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                What Does "CRPS Reduction" Mean on Elia Wind?
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                On 17,544 hourly points of Elia offshore wind, under strictly-causal expanding
                normalisation (training pipeline audit, May 2026), the mechanism's mean CRPS is <strong>about 7.1% lower</strong> than equal-weight averaging. The calculation:
              </p>
              <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 180, fontSize: '1.05rem', fontWeight: 600, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>Equal weights CRPS</div>
                  <div style={{ padding: '8px 20px', background: 'rgba(232, 93, 74, 0.08)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 700, color: PALETTE.coral }}>0.04078</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 180, fontSize: '1.05rem', fontWeight: 600, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>Mechanism CRPS</div>
                  <div style={{ padding: '8px 20px', background: 'rgba(46, 139, 139, 0.08)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 700, color: PALETTE.teal }}>0.03788</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 180, fontSize: '1.05rem', fontWeight: 600, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>Relative change</div>
                  <div style={{ padding: '8px 20px', background: 'rgba(0, 62, 116, 0.06)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 700, color: PALETTE.navy }}>(0.03788 − 0.04078) / 0.04078 ≈ −7.12%</div>
                </div>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: '0.95rem', color: PALETTE.slate, lineHeight: 1.5, fontFamily: TYPOGRAPHY.fontFamily }}>
                Earlier revisions of the deck reported −44%. That figure came from a whole-series normalisation that leaked future evaluation-window extremes into every training round. The corrected analysis uses only warmup-window statistics, which gives the honest −7.1%.
              </p>
            </div>

            {/* Context: other benchmarks */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px', background: 'rgba(46, 139, 139, 0.04)' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                How Does This Compare?
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {[
                  { label: 'This Project', wind: '−7.1%', elec: '+0.0%', tint: `rgba(46, 139, 139, 0.08)`, color: PALETTE.teal },
                  { label: 'Vitali OGD (per-τ)', wind: '−21.1%', elec: '−4.0%', tint: `rgba(124, 58, 237, 0.08)`, color: PALETTE.purple },
                  { label: 'Raja history-free', wind: '−1.4%', elec: '+0.0%', tint: `rgba(100, 116, 139, 0.08)`, color: PALETTE.slate },
                ].map((item) => (
                  <div key={item.label} style={{ padding: '16px 20px', background: item.tint, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: item.color, fontFamily: TYPOGRAPHY.fontFamily, marginBottom: 8 }}>{item.label}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: PALETTE.navy, fontFamily: 'monospace' }}>{item.wind} wind</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: PALETTE.charcoal, fontFamily: 'monospace', marginTop: 4 }}>{item.elec} electricity</div>
                  </div>
                ))}
              </div>
              <p style={{ margin: '14px 0 0', fontSize: '0.95rem', color: PALETTE.slate, lineHeight: 1.5, fontFamily: TYPOGRAPHY.fontFamily }}>
                Per-τ OGD (Vitali & Pinson) achieves lower CRPS by learning separate weight vectors for
                each quantile level. This project uses a single weight vector across all τ so the
                mechanism stays self-financed and preserves the seven Lambert properties.
              </p>
            </div>
          </div>
        )}

        {tab === 'ordering' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Why we look at ordering at all */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.25rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Why use ordering to validate the mechanism?
              </h4>
              <p style={{ margin: 0, fontSize: '1.08rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                Different forecasters contribute <strong>different information</strong>. Naive reads autocorrelation from the last observation. XGBoost reads nonlinear lag structure from a wider window. Theta reads trend. Because they see different parts of the signal, they bring different value into the final forecast, and that is exactly why combining them helps in the first place. For the same reason, there is no single ground-truth "best forecaster" label on real data.
              </p>
              <p style={{ margin: '10px 0 0', fontSize: '1.08rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                So I need an indirect probe. The skill signal σ is claimed to track realised forecasting loss. The cheapest, most falsifiable check on that claim is whether the <strong>ranking σ induces</strong> matches the <strong>ranking that realised CRPS induces</strong> on the same data.
              </p>
            </div>

            {/* Synthetic: Spearman ρ = 1 */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.25rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Synthetic: ordering is the right probe because I know the answer
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                On six forecasters with known noise levels, the only way to check that σ means "skill" is to compare the induced ranking to the true noise ranking. Spearman ρ = 1.0 on all five canonical seeds is a direct, parameter-free pass/fail. It does not certify accuracy of σ values (only of the order they induce), which is precisely what the mechanism needs to allocate weight and payoff correctly.
              </p>
            </div>

            {/* Real data: ordering vs per-agent CRPS */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.25rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Real data: σ-ranking vs per-agent CRPS ranking (Elia wind)
              </h4>
              <p style={{ margin: '0 0 12px', fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                Steady-state σ and post-warmup per-agent mean CRPS on the 17,544-round Elia wind run give two independent orderings of the same panel. Comparing them is the real-data analogue of the synthetic ρ = 1 check.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.6fr 0.6fr 0.4fr', gap: 10, padding: '10px 14px', borderBottom: `2px solid ${PALETTE.border}`, fontWeight: 700, color: PALETTE.slate, fontSize: '0.98rem', fontFamily: TYPOGRAPHY.fontFamily }}>
                <span>Forecaster</span>
                <span style={{ textAlign: 'right' }}>σ (steady-state)</span>
                <span style={{ textAlign: 'right' }}>Mean CRPS</span>
                <span style={{ textAlign: 'center' }}>Rank agreement</span>
              </div>
              {[
                { name: 'XGBoost', sigma: '0.808', crps: '0.031', ok: true },
                { name: 'ARIMA(2,1,1)', sigma: '0.791', crps: '0.035', ok: true },
                { name: 'Naive (last value)', sigma: '0.790', crps: '0.035', ok: true },
                { name: 'Neural Net (MLP)', sigma: '0.768', crps: '0.040', ok: true },
                { name: 'Ensemble (Naive+EWMA)', sigma: '0.753', crps: '0.047', ok: true },
                { name: 'EWMA (5)', sigma: '0.703', crps: '0.063', ok: true },
                { name: 'Theta', sigma: '0.685', crps: '0.068', ok: true },
              ].map((r, i, arr) => (
                <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.6fr 0.6fr 0.4fr', gap: 10, padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${PALETTE.border}` : 'none', alignItems: 'center', fontFamily: TYPOGRAPHY.fontFamily }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 600, color: PALETTE.navy }}>{r.name}</span>
                  <span style={{ fontSize: '1.05rem', fontFamily: 'monospace', textAlign: 'right', color: PALETTE.teal, fontWeight: 700 }}>{r.sigma}</span>
                  <span style={{ fontSize: '1.05rem', fontFamily: 'monospace', textAlign: 'right', color: PALETTE.charcoal }}>{r.crps}</span>
                  <span style={{ fontSize: '1.15rem', textAlign: 'center', color: PALETTE.teal, fontWeight: 700 }}>{r.ok ? '✓' : '✗'}</span>
                </div>
              ))}
              <p style={{ margin: '12px 0 0', fontSize: '0.98rem', color: PALETTE.slate, lineHeight: 1.55, fontFamily: TYPOGRAPHY.fontFamily }}>
                The two orderings agree monotonically: higher σ ⇔ lower per-agent CRPS. That is what the skill signal is supposed to do, and it is the check that justifies using σ to weight deposits in settlement.
              </p>
            </div>

            {/* Why not CRPS directly */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px', background: 'rgba(46, 139, 139, 0.04)' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Why not just report CRPS and stop?
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                Mean CRPS is reported, and the −7.1% headline on slide 10 is exactly that. But CRPS of the aggregate only says whether the combination is good; it does not say whether the mechanism identified <em>who</em> is good, which is what a skill signal is for. Ordering separates those two questions. "Does the aggregate score well?" is CRPS. "Does σ reflect reality?" is ordering.
              </p>
            </div>
          </div>
        )}

        {tab === 'rewards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Intro: what a reward is */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.25rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                The core of the mechanism: how each forecaster is paid
              </h4>
              <p style={{ margin: 0, fontSize: '1.08rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                Each round, every forecaster submits a probabilistic forecast and puts up a deposit bᵢ. The settlement rule returns cash Πᵢ such that the sum of all Πᵢ equals the sum of all deposits actually put at stake. No external subsidy. No budget surplus. That is what "self-financed" means, and it is the property that separates this from Vitali & Pinson's Shapley payoffs.
              </p>
            </div>

            {/* Step 1: effective wager */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Step 1 — Effective wager
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                The deposit is scaled by the learned skill. Only mᵢ actually enters the settlement pool; the rest is returned to the forecaster:
              </p>
              <div style={{ margin: '12px 0', padding: '12px 20px', background: 'rgba(46, 139, 139, 0.06)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.2rem', color: PALETTE.navy, fontWeight: 700 }}>
                mᵢ = bᵢ · g(σᵢ),  g(σ) ∈ [g_min, 1]
              </div>
              <p style={{ margin: 0, fontSize: '0.98rem', color: PALETTE.slate, lineHeight: 1.55, fontFamily: TYPOGRAPHY.fontFamily }}>
                Low skill means most of the deposit is refunded, so a noisy forecaster can't buy weight or outsized loss. High skill means the full deposit counts.
              </p>
            </div>

            {/* Step 2: score */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Step 2 — Round score
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                After the outcome y is observed, each forecaster gets a bounded score sᵢ computed from a proper scoring rule (CRPS-based). Higher sᵢ means a better forecast this round. The wager-weighted mean s̄ is the reference level the pool settles against:
              </p>
              <div style={{ margin: '12px 0', padding: '12px 20px', background: 'rgba(46, 139, 139, 0.06)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.2rem', color: PALETTE.navy, fontWeight: 700 }}>
                sᵢ = S(qᵢ, y),   s̄ = Σⱼ wⱼ · sⱼ,   wⱼ = mⱼ / Σₖ mₖ
              </div>
            </div>

            {/* Step 3: payoff */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px', border: `2.5px solid ${PALETTE.teal}`, background: 'rgba(46, 139, 139, 0.04)' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Step 3 — Payoff (the reward formula)
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                Each forecaster gets back their effective wager, multiplied by how much their own score beat the wager-weighted market mean:
              </p>
              <div style={{ margin: '14px 0', padding: '16px 22px', background: PALETTE.white, borderRadius: 10, fontFamily: 'monospace', fontSize: '1.35rem', color: PALETTE.teal, fontWeight: 700, textAlign: 'center', border: `2px solid ${PALETTE.teal}` }}>
                Πᵢ = mᵢ · (1 + sᵢ − s̄)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 10 }}>
                <div style={{ padding: '12px 16px', background: 'rgba(46, 139, 139, 0.08)', borderRadius: 8, borderLeft: `4px solid ${PALETTE.teal}` }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: PALETTE.teal, fontFamily: TYPOGRAPHY.fontFamily }}>If sᵢ &gt; s̄ (above-market forecast)</div>
                  <div style={{ fontSize: '0.98rem', color: PALETTE.charcoal, fontFamily: TYPOGRAPHY.fontFamily, marginTop: 4, lineHeight: 1.5 }}>
                    Πᵢ &gt; mᵢ — you get back more than you wagered. Paid out of the losers' pool.
                  </div>
                </div>
                <div style={{ padding: '12px 16px', background: 'rgba(232, 93, 74, 0.08)', borderRadius: 8, borderLeft: `4px solid ${PALETTE.coral}` }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: PALETTE.coral, fontFamily: TYPOGRAPHY.fontFamily }}>If sᵢ &lt; s̄ (below-market forecast)</div>
                  <div style={{ fontSize: '0.98rem', color: PALETTE.charcoal, fontFamily: TYPOGRAPHY.fontFamily, marginTop: 4, lineHeight: 1.5 }}>
                    Πᵢ &lt; mᵢ — you lose a fraction of your effective wager. Funds the winners.
                  </div>
                </div>
              </div>
            </div>

            {/* Budget balance — the sum */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Budget balance: why the pool closes exactly
              </h4>
              <p style={{ margin: 0, fontSize: '1.05rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
                Sum Πᵢ over the whole panel and the (sᵢ − s̄) term vanishes by construction, because s̄ is the wager-weighted mean of sᵢ. That gives budget balance:
              </p>
              <div style={{ margin: '12px 0', padding: '12px 20px', background: 'rgba(46, 139, 139, 0.06)', borderRadius: 8, fontFamily: 'monospace', fontSize: '1.1rem', color: PALETTE.navy, fontWeight: 700 }}>
                Σᵢ Πᵢ = Σᵢ mᵢ · (1 + sᵢ − s̄) = Σᵢ mᵢ + Σᵢ mᵢ(sᵢ − s̄) = Σᵢ mᵢ
              </div>
              <p style={{ margin: 0, fontSize: '0.98rem', color: PALETTE.slate, lineHeight: 1.55, fontFamily: TYPOGRAPHY.fontFamily }}>
                Measured numerically, the budget gap is zero to 10⁻¹⁴ — floating-point noise. See Appendix C.
              </p>
            </div>

            {/* Properties rewards deliver */}
            <div style={{ ...CARD_STYLE, padding: '24px 32px', background: 'rgba(100, 116, 139, 0.04)' }}>
              <h4 style={{ margin: '0 0 14px', fontSize: '1.2rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily }}>
                Why this reward rule is the right one
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { h: 'Self-financed', b: 'Winners are paid from losers, not from the client. No subsidy needed.' },
                  { h: 'Truthful', b: 'Under risk neutrality, a forecaster maximises expected Πᵢ by reporting their true belief. Follows Lambert et al.' },
                  { h: 'Narrow Lambert sybil invariance (identical clones)', b: 'Splitting one identity into k clones with the same forecast and combined deposit b changes nothing: the aggregate is identical and the combined Π is unchanged.' },
                  { h: 'Anonymous', b: 'Only (qᵢ, bᵢ, σᵢ, sᵢ) matters, identity plays no direct role.' },
                  { h: 'Skill-scaled exposure', b: 'A low-skill forecaster risks less and earns less per round. Noisy participation is bounded.' },
                  { h: 'Client reward (Raja extension)', b: 'A client reward R can be added to the pool and redistributed by the same rule, scaling payoffs proportionally without breaking balance.' },
                ].map((c) => (
                  <div key={c.h} style={{ padding: '12px 16px', background: PALETTE.white, borderRadius: 8, border: `1px solid ${PALETTE.border}` }}>
                    <div style={{ fontSize: '1.02rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily, marginBottom: 4 }}>{c.h}</div>
                    <div style={{ fontSize: '0.96rem', color: PALETTE.charcoal, fontFamily: TYPOGRAPHY.fontFamily, lineHeight: 1.5 }}>{c.b}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </SlideShell>
  );
}
