import { forwardRef, type ElementType, type ReactNode, type HTMLAttributes } from 'react';
import { RADIUS, SHADOW, SPACE } from '@/components/platform/designTokens';

type Padding = 'compact' | 'default' | 'roomy';
type Elevation = 'flat' | 'raised' | 'lift';

const PADDING: Record<Padding, string> = {
  compact: `${SPACE[4]}px ${SPACE[5]}px`,
  default: `${SPACE[6]}px`,
  roomy: `${SPACE[8]}px`,
};

const ELEVATION: Record<Elevation, string> = {
  flat: SHADOW.sm,
  raised: SHADOW.md,
  lift: SHADOW.lg,
};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Element to render as (`div` by default). */
  as?: ElementType;
  /** Inner padding step. */
  padding?: Padding;
  /** Resting shadow level. */
  elevation?: Elevation;
  /**
   * When true, the card lifts on hover/focus to `SHADOW.lift`. The lift
   * is suppressed under `prefers-reduced-motion` (handled in CSS).
   */
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Base surface primitive: paper background, border, rounded corners,
 * shadow. Replaces the ad-hoc `rounded-xl border bg-white p-5` pattern.
 *
 * Spec: design_system.md §4 (radius), §5 (elevation), §3 (spacing).
 */
const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    as,
    padding = 'default',
    elevation = 'flat',
    interactive = false,
    className = '',
    style,
    children,
    ...rest
  },
  ref,
) {
  const Component = (as ?? 'div') as ElementType;
  return (
    <Component
      ref={ref}
      data-interactive={interactive ? 'true' : undefined}
      className={`platform-card${interactive ? ' platform-card--interactive' : ''} ${className}`.trim()}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.sm,
        boxShadow: ELEVATION[elevation],
        padding: PADDING[padding],
        ...style,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
});

export default Card;
