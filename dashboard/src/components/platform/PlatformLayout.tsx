import type { ReactNode } from 'react';
import PageShell from '@/components/dashboard/PageShell';
import Tag from '@/components/platform/ui/Tag';
import { SPACE } from '@/components/platform/designTokens';

/**
 * Shell wrapper for the platform showcase pages. The product wordmark, the
 * two-zone toggle and the lens rail now live in the unified app shell
 * (`TopBar` + `Sidebar`), so this layout only carries the
 * synthetic-sandbox provenance tag and the shared `PageShell` measure. The
 * lens list itself is the binding nav, kept here for any consumer that
 * needs the canonical ordering.
 */
export interface PlatformLens {
  to: string;
  label: string;
}

export const PLATFORM_LENSES: PlatformLens[] = [
  { to: '/platform', label: 'Explainer' },
  { to: '/platform/forecast', label: 'Submit a forecast' },
  { to: '/platform/market', label: 'Market' },
  { to: '/platform/account', label: 'My account' },
  { to: '/platform/leaderboard', label: 'Leaderboard' },
  { to: '/platform/operator', label: 'Operator' },
];

export interface PlatformLayoutProps {
  children: ReactNode;
  /** Show the synthetic-sandbox provenance tag (default true). */
  showSandboxTag?: boolean;
}

export default function PlatformLayout({ children, showSandboxTag = true }: PlatformLayoutProps) {
  return (
    <PageShell width="wide">
      {showSandboxTag && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -SPACE[8] }}>
          <Tag tone="caution" size="sm">Synthetic sandbox</Tag>
        </div>
      )}
      {children}
    </PageShell>
  );
}
