import clsx from 'clsx';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

/**
 * Warm skeleton loader — matches the paper palette.
 */
export default function Skeleton({
  width,
  height,
  className,
  variant = 'rect',
}: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'rounded h-3',
        variant === 'rect' && 'rounded-md',
        className,
      )}
      style={{
        width,
        height,
        background: 'var(--border)',
      }}
      aria-hidden="true"
    />
  );
}
