import { motion, useReducedMotion } from 'framer-motion';
import { Button, Card, SectionHeading, Tag } from '@/components/platform/ui';
import { CLIENT_DOMAINS, type ClientDomain } from '@/components/platform/panelFramings';
import { TYPE, SPACE, DURATION } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';

/**
 * Start-of-platform client / domain chooser (Q1 decision, built per spec).
 *
 * A non-blocking row of cards near the top of the landing. Each card frames the
 * synthetic sandbox in a visitor-recognisable domain and deep-links into the
 * Market with the matching P2 framing preselected. Every domain (wind,
 * electricity, air-quality chemistry) is now live, carrying a "Live synthetic
 * sandbox" tag and the "shaped like" wording so the synthetic run is never read
 * as the real one. Every card also carries a quiet secondary link to that
 * domain's verified evidence in the same footer slot, so the three footers
 * align and the verified real-data result stays one click away from each card.
 *
 * Presentational only: no `coreMechanism` logic, no simulator state. Colours
 * come from `SEM` tokens, never a hex literal.
 */
export default function ClientChooser() {
  const reduce = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0 } : { delay, duration: DURATION.deliberate / 1000 },
  });

  return (
    <motion.div {...fadeUp(0.16)} data-testid="client-chooser">
      <SectionHeading
        eyebrow="Choose a forecasting client"
        title="Which forecasting problem do you want to explore?"
        subtitle="Each client drives a live synthetic panel shaped like its real one. The verified real-data results live in the evidence."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: SPACE[5],
          marginTop: SPACE[6],
        }}
      >
        {CLIENT_DOMAINS.map((d) => (
          <DomainCard key={d.id} domain={d} />
        ))}
      </div>
    </motion.div>
  );
}

function DomainCard({ domain: d }: { domain: ClientDomain }) {
  const accent = SEM[d.accent];
  const isLive = d.mode === 'live';

  return (
    <Card
      padding="default"
      elevation="raised"
      data-testid={`domain-${d.id}`}
      style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}
    >
      {/* Accent eyebrow bar, tinted with the concept token (no hex). */}
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: 44,
          height: 4,
          borderRadius: 999,
          background: accent.main,
        }}
      />
      <Tag tone={isLive ? 'info' : 'caution'} size="sm">
        {d.tag}
      </Tag>
      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: TYPE.h3.size,
          lineHeight: TYPE.h3.lineHeight,
          fontWeight: TYPE.h3.weight,
          color: 'var(--ink)',
          margin: 0,
        }}
      >
        {d.title}
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: TYPE.body.size,
          lineHeight: TYPE.body.lineHeight,
          color: 'var(--ink-soft)',
          margin: 0,
        }}
      >
        {d.task}
      </p>
      <p
        data-testid={`domain-${d.id}-note`}
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: TYPE.caption.size,
          lineHeight: TYPE.caption.lineHeight,
          color: 'var(--ink-faint)',
          margin: 0,
        }}
      >
        {d.honestNote}
      </p>
      <div style={{ marginTop: 'auto', paddingTop: SPACE[2], display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
        <Button
          as="a"
          href={d.href}
          size="md"
          variant={isLive ? 'primary' : 'secondary'}
          data-testid={`domain-${d.id}-cta`}
        >
          {d.cta}
        </Button>
        {d.secondaryHref && (
          <a
            href={d.secondaryHref}
            data-testid={`domain-${d.id}-evidence`}
            style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--imperial)' }}
          >
            {d.secondaryText}
          </a>
        )}
      </div>
    </Card>
  );
}
