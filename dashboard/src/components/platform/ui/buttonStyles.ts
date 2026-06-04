/**
 * Button colour-role and size tokens, split out so the Button component
 * file stays focused on markup. Colours come from the slide `PALETTE`
 * and CSS variables; no new hex literals.
 *
 * Spec: design_system.md §2 (colour roles), §8 (controls).
 */
import { PALETTE } from '@/lib/palette';
import { CONTROL, RADIUS } from '@/components/platform/designTokens';

export { CONTROL, RADIUS };

interface Role {
  bg: string;
  fg: string;
  border: string;
}

export const PALETTE_ROLES: Record<'primary' | 'secondary' | 'ghost' | 'danger', Role> = {
  primary: { bg: PALETTE.navy, fg: PALETTE.white, border: PALETTE.navy },
  secondary: { bg: PALETTE.white, fg: PALETTE.navy, border: 'var(--border-strong)' },
  ghost: { bg: 'transparent', fg: 'var(--ink-muted)', border: 'transparent' },
  danger: { bg: PALETTE.coral, fg: PALETTE.white, border: PALETTE.coral },
};
