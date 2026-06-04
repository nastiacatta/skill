import type { ReactNode } from 'react';
import { RADIUS } from '@/components/platform/designTokens';
import { VERDICT_COLOURS, PALETTE } from '@/lib/palette';

type Tone = 'neutral' | 'good' | 'bad' | 'caution' | 'info';
type Size = 'sm' | 'md';

interface ToneStyle {
  fg: string;
  bg: string;
  border: string;
}

const TONE: Record<Tone, ToneStyle> = {
  good: VERDICT_COLOURS.good,
  bad: VERDICT_COLOURS.bad,
  caution: VERDICT_COLOURS.neutral,
  info: { fg: PALETTE.imperial, bg: 'var(--navy-tint)', border: PALETTE.imperial },
  neutral: { fg: 'var(--ink-muted)', bg: 'var(--cream)', border: 'var(--border-strong)' },
};

const SIZE: Record<Size, { fontSize: number; padY: number; padX: number }> = {
  // 13px is the smallest allowed DOM text (px floor).
  sm: { fontSize: 13, padY: 2, padX: 8 },
  md: { fontSize: 14, padY: 4, padX: 10 },
};

export interface TagProps {
  /** Semantic tone; drives colour. */
  tone?: Tone;
  size?: Size;
  /** Optional leading icon (decorative). */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Compact pill for status / category / provenance / synthetic-vs-real
 * labels. Tones map onto the WCAG-checked `VERDICT_COLOURS` plus an
 * info/neutral pair.
 *
 * Spec: design_system.md §2 (verdict colours), §0 (13px floor).
 */
export default function Tag({
  tone = 'neutral',
  size = 'md',
  icon,
  className = '',
  children,
}: TagProps) {
  const t = TONE[tone];
  const s = SIZE[size];
  return (
    <span
      className={`platform-tag ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-sans)',
        fontSize: s.fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        padding: `${s.padY}px ${s.padX}px`,
        borderRadius: RADIUS.pill,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {icon && (
        <span aria-hidden="true" style={{ display: 'inline-flex' }}>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
