import SlideShell from './shared/SlideShell';
import { PALETTE, TYPOGRAPHY } from './shared/presentationConstants';

/* ── CRPS comparison data (benchmark on Elia) ──
 * Headline CRPS deltas for the mechanism against the published baselines
 * on the Elia wind and electricity series.
 */
const comparisons = [
  {
    label: 'Raja et al.',
    tag: 'History-free',
    tagColour: PALETTE.slate,
    wind: '−1.4 %',
    elec: '+0.0 %',
    note: 'Self-financed, but no memory across rounds',
  },
  {
    label: 'Vitali & Pinson',
    tag: 'OGD',
    tagColour: PALETTE.purple,
    wind: '−21.1 %',
    elec: '−4.0 %',
    note: 'Lowest CRPS — relative weights, not self-financed',
  },
  {
    label: 'This project',
    tag: 'Skill + Lambert',
    tagColour: PALETTE.teal,
    wind: '−7.1 %',
    elec: '0.0 %',
    note: 'Adaptive and self-financed, with an absolute skill signal',
  },
] as const;

const futureWork = [
  'Close the CRPS gap to Vitali & Pinson without giving up the self-financed identity',
  'Improve tail calibration (currently ~5 pp under-dispersion)',
  'Test against a wider range of strategic adversaries',
] as const;

/* ── Unified type tokens ──
 * Keeping to three tiers so the dark slide does not feel noisy. Using
 * solid PALETTE.white for primary text on dark (contrast ≥ 15:1) and
 * PALETTE.darkText (#E2E8F0) only for secondary meta text.
 */
const TYPE = {
  cardLabel: { fontSize: '1.5rem', fontWeight: 700 as const, color: PALETTE.white },
  cardTag:   { fontSize: '0.9rem', fontWeight: 700 as const, color: PALETTE.white },
  cardBody:  { fontSize: '1.25rem', color: PALETTE.white },
  cardMeta:  { fontSize: '1.05rem', color: PALETTE.darkText },
  takeaway:  { fontSize: '1.4rem', fontWeight: 700 as const, color: PALETTE.white },
  sectionH:  { fontSize: '1.15rem', fontWeight: 700 as const, color: PALETTE.teal, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  listItem:  { fontSize: '1.2rem', color: PALETTE.white },
};

function DarkCard({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'rgba(255,255,255,0.06)',
        border: `1.5px solid ${accent}`,
        borderRadius: 12,
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 10,
        fontFamily: TYPOGRAPHY.fontFamily,
      }}
    >
      {children}
    </div>
  );
}

export default function ConclusionSlide() {
  return (
    <SlideShell title="Conclusion + Future Work" dark slideNumber={13}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

        {/* ── CRPS Comparison Cards ── */}
        <div style={{ flex: 1, display: 'flex', gap: 20, alignItems: 'stretch' }}>
          {comparisons.map((c) => (
            <DarkCard key={c.label} accent={c.tagColour}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...TYPE.cardLabel, fontFamily: TYPOGRAPHY.fontFamily }}>
                  {c.label}
                </span>
                <span
                  style={{
                    ...TYPE.cardTag,
                    fontFamily: TYPOGRAPHY.fontFamily,
                    background: c.tagColour,
                    borderRadius: 20,
                    padding: '4px 14px',
                  }}
                >
                  {c.tag}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  ...TYPE.cardBody,
                  fontFamily: TYPOGRAPHY.fontFamily,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>Wind: <strong>{c.wind}</strong></span>
                <span>Elec: <strong>{c.elec}</strong></span>
              </div>
              <p style={{ margin: 0, ...TYPE.cardMeta, fontFamily: TYPOGRAPHY.fontFamily, lineHeight: 1.5 }}>
                {c.note}
              </p>
            </DarkCard>
          ))}
        </div>

        {/* ── Key Takeaway ── */}
        <div
          style={{
            background: 'rgba(46, 139, 139, 0.18)',
            borderLeft: `4px solid ${PALETTE.teal}`,
            borderRadius: '0 12px 12px 0',
            padding: '18px 26px',
            marginTop: 24,
          }}
        >
          <p style={{ margin: 0, ...TYPE.takeaway, lineHeight: 1.5, fontFamily: TYPOGRAPHY.fontFamily }}>
            Adaptation, a self-financed settlement, and an absolute skill signal can coexist in a single mechanism.
          </p>
        </div>

        {/* ── Future Work ── */}
        <div style={{ marginTop: 24 }}>
          <h3 style={{ margin: 0, marginBottom: 12, ...TYPE.sectionH, fontFamily: TYPOGRAPHY.fontFamily }}>
            Future Work
          </h3>
          <ul style={{ margin: 0, paddingLeft: 24, listStyleType: 'disc' }}>
            {futureWork.map((item) => (
              <li
                key={item}
                style={{ ...TYPE.listItem, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily, marginBottom: 8 }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </SlideShell>
  );
}
