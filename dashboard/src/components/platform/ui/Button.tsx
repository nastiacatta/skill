import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { CONTROL, RADIUS, PALETTE_ROLES } from './buttonStyles';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const SIZE_STYLE: Record<Size, { height: number; padX: number; fontSize: number }> = {
  sm: { height: CONTROL.height.sm, padX: 14, fontSize: 14 },
  md: { height: CONTROL.height.md, padX: 18, fontSize: 16 },
  lg: { height: CONTROL.height.lg, padX: 24, fontSize: 18 },
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { as?: 'button' };
type ButtonAsAnchor = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { as: 'a' };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

/**
 * Button primitive: four variants, three sizes (>= 44px target by
 * default), icon slots, loading + disabled states, visible focus ring,
 * reduce-motion-safe hover.
 *
 * Spec: design_system.md §8 (controls, focus). Colours from PALETTE.
 */
const Button = forwardRef<HTMLButtonElement & HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'primary',
      size = 'md',
      iconLeft,
      iconRight,
      loading = false,
      children,
      className = '',
      ...rest
    } = props as CommonProps & Record<string, unknown>;

    const sz = SIZE_STYLE[size];
    const role = PALETTE_ROLES[variant];
    const isAnchor = (props as ButtonAsAnchor).as === 'a';
    const isDisabled = Boolean((rest as { disabled?: boolean }).disabled) || loading;

    const content = (
      <>
        {loading && (
          <span
            className="platform-btn__spinner"
            aria-hidden="true"
            style={{
              width: sz.fontSize,
              height: sz.fontSize,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              display: 'inline-block',
            }}
          />
        )}
        {!loading && iconLeft}
        {children != null && <span>{children}</span>}
        {!loading && iconRight}
      </>
    );

    const style: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: sz.height,
      minWidth: CONTROL.minTarget,
      padding: `0 ${sz.padX}px`,
      fontFamily: 'var(--font-sans)',
      fontSize: sz.fontSize,
      fontWeight: 600,
      lineHeight: 1,
      borderRadius: RADIUS.sm,
      border: `1px solid ${role.border}`,
      background: role.bg,
      color: role.fg,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.55 : 1,
      textDecoration: 'none',
      whiteSpace: 'nowrap',
    };

    if (isAnchor) {
      const { as: _as, disabled: _disabled, ...anchorRest } =
        rest as { as?: string; disabled?: boolean } & AnchorHTMLAttributes<HTMLAnchorElement>;
      void _as;
      void _disabled;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={`platform-btn platform-btn--${variant} ${className}`.trim()}
          aria-disabled={isDisabled || undefined}
          aria-busy={loading || undefined}
          style={style}
          {...anchorRest}
        >
          {content}
        </a>
      );
    }

    const { as: _as, ...buttonRest } = rest as { as?: string } & ButtonHTMLAttributes<HTMLButtonElement>;
    void _as;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={(buttonRest.type as 'button' | 'submit' | 'reset') ?? 'button'}
        className={`platform-btn platform-btn--${variant} ${className}`.trim()}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        style={style}
        {...buttonRest}
      >
        {content}
      </button>
    );
  },
);

export default Button;
