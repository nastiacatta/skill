/**
 * Developer / QA diagnostics: the number-provenance table.
 *
 * NOT part of the visitor flow. This surface exists so a maintainer can see, at
 * a glance, whether every headline on-screen number still matches its source.
 * It is reachable only at `#/dev/provenance` (no nav link, no sidebar entry)
 * and is gated to dev/preview builds. It renders the provenance registry as a
 * table: claim, displayed value, source value, status (OK / DRIFT), and the
 * source path or citation. It adds no number to the visitor experience.
 *
 * The committed gate is the Node test in `__tests__/provenance`; this panel is
 * the human-readable mirror of the same registry. Artefact claims are checked
 * live by fetching the committed files. Draft-pinned claims are shown as
 * draft-pinned (the browser cannot read `src/`); the test verifies those.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  PROVENANCE_CLAIMS,
  checkArtefactClaim,
  type ClaimCheck,
  type ProvenanceClaim,
} from '@/lib/provenance';
import { browserArtefactLoader } from '@/lib/provenance/browserLoader';
import { VERDICT_COLOURS } from '@/lib/palette';

type RowStatus = 'OK' | 'DRIFT' | 'DRAFT-PINNED' | 'CHECKING';

interface PanelRow {
  claim: ProvenanceClaim;
  displayed: string;
  sourceValue: string;
  status: RowStatus;
  sourceRef: string;
  detail: string;
}

function sourceRef(claim: ProvenanceClaim): string {
  if (claim.source.kind === 'artefact') {
    const ptrs = claim.source.computeFromDoc
      ? '(computed from per-round array)'
      : claim.source.pointers.join(', ');
    return `${claim.source.file} ${ptrs}`.trim();
  }
  if (claim.source.rendersIn) {
    return `draft ${claim.source.citation} -> ${claim.source.rendersIn.file}`;
  }
  if (claim.source.mustNotAppearIn) {
    return `draft ${claim.source.citation} (must NOT appear; no artefact)`;
  }
  return `draft ${claim.source.citation}`;
}

const fmt = (n: number, unit?: string) =>
  `${Number.isInteger(n) ? n : n.toFixed(unit === '%' ? 2 : 4)}${unit ? ` ${unit}` : ''}`;

// Available only in dev/preview builds, never the production visitor bundle.
const DIAGNOSTICS_ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'preview';

export default function ProvenancePanel() {
  const [checks, setChecks] = useState<Record<string, ClaimCheck>>({});

  useEffect(() => {
    if (!DIAGNOSTICS_ENABLED) return;
    let cancelled = false;
    (async () => {
      const artefactClaims = PROVENANCE_CLAIMS.filter((c) => c.source.kind === 'artefact');
      const results = await Promise.all(
        artefactClaims.map((c) => checkArtefactClaim(c, browserArtefactLoader)),
      );
      if (cancelled) return;
      const map: Record<string, ClaimCheck> = {};
      results.forEach((r) => (map[r.claim.id] = r));
      setChecks(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: PanelRow[] = useMemo(
    () =>
      PROVENANCE_CLAIMS.map((claim) => {
        if (claim.source.kind === 'draft') {
          return {
            claim,
            displayed: fmt(claim.expected, claim.unit),
            sourceValue: '— (draft-pinned)',
            status: 'DRAFT-PINNED' as RowStatus,
            sourceRef: sourceRef(claim),
            detail: claim.note ?? '',
          };
        }
        const check = checks[claim.id];
        if (!check) {
          return {
            claim,
            displayed: fmt(claim.expected, claim.unit),
            sourceValue: '…',
            status: 'CHECKING' as RowStatus,
            sourceRef: sourceRef(claim),
            detail: 'Loading artefact…',
          };
        }
        return {
          claim,
          displayed: fmt(claim.expected, claim.unit),
          sourceValue: check.sourceValue === null ? 'ERROR' : fmt(check.sourceValue, claim.unit),
          status: check.ok ? 'OK' : 'DRIFT',
          sourceRef: sourceRef(claim),
          detail: check.detail,
        };
      }),
    [checks],
  );

  if (!DIAGNOSTICS_ENABLED) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: 'var(--ink-soft)' }}>
        Provenance diagnostics are available in development builds only.
      </div>
    );
  }

  const driftCount = rows.filter((r) => r.status === 'DRIFT').length;
  const okCount = rows.filter((r) => r.status === 'OK').length;
  const draftCount = rows.filter((r) => r.status === 'DRAFT-PINNED').length;

  const statusColour = (s: RowStatus): { fg: string; bg: string } => {
    if (s === 'OK') return { fg: VERDICT_COLOURS.good.fg, bg: VERDICT_COLOURS.good.bg };
    if (s === 'DRIFT') return { fg: VERDICT_COLOURS.bad.fg, bg: VERDICT_COLOURS.bad.bg };
    return { fg: 'var(--ink-soft)', bg: 'var(--border)' };
  };

  return (
    <div
      style={{
        padding: 32,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, monospace',
        background: 'var(--paper)',
        minHeight: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Unmistakably a diagnostics surface, not visitor content. */}
      <div
        style={{
          border: '2px dashed var(--ink-faint)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          background: 'var(--border)',
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: '0.08em', color: 'var(--ink-soft)', fontWeight: 700 }}>
          DEVELOPER / QA DIAGNOSTICS — NOT PART OF THE VISITOR FLOW
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 6 }}>
          Number-provenance self-test. Every headline on-screen number is mapped to its source
          (a committed artefact value or a draft-pinned constant). This table is the human mirror
          of the committed gate in <code>__tests__/provenance</code>. Artefact rows are checked
          live by fetching the committed files. Draft-pinned rows are verified by the test, which
          can read the source.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <Summary label="OK (artefact match)" value={okCount} tone="good" />
        <Summary label="DRIFT" value={driftCount} tone={driftCount ? 'bad' : 'good'} />
        <Summary label="Draft-pinned (gated by test)" value={draftCount} tone="neutral" />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--ink-soft)' }}>
            <Th>ID</Th>
            <Th>Claim</Th>
            <Th>Displayed</Th>
            <Th>Source value</Th>
            <Th>Status</Th>
            <Th>Source path / citation</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = statusColour(r.status);
            return (
              <tr key={r.claim.id} style={{ borderTop: '1px solid var(--border)' }} title={r.detail}>
                <Td mono>{r.claim.id}</Td>
                <Td>{r.claim.label}</Td>
                <Td mono>{r.displayed}</Td>
                <Td mono>{r.sourceValue}</Td>
                <Td>
                  <span
                    style={{
                      background: c.bg,
                      color: c.fg,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    {r.status}
                  </span>
                </Td>
                <Td mono style={{ color: 'var(--ink-soft)', fontSize: 11 }}>
                  {r.sourceRef}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: 'good' | 'bad' | 'neutral' }) {
  const colour =
    tone === 'good'
      ? VERDICT_COLOURS.good.fg
      : tone === 'bad'
      ? VERDICT_COLOURS.bad.fg
      : 'var(--ink-soft)';
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 120 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: colour, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{label}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '6px 10px', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>{children}</th>;
}

function Td({
  children,
  mono,
  style,
}: {
  children: React.ReactNode;
  mono?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: '6px 10px',
        color: 'var(--ink)',
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
        verticalAlign: 'top',
        ...style,
      }}
    >
      {children}
    </td>
  );
}
