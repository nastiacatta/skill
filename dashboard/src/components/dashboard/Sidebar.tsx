import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { LAYOUT, RADIUS, SPACE, TYPE } from '@/components/platform/designTokens';
import { useNavRailCollapse } from '@/hooks/useNavRailCollapse';
import { ZONES, zoneForPath, type NavItem } from './navModel';

/**
 * Zone-aware navigation rail. Renders the rail for whichever zone the
 * current route belongs to (Platform or Research); the top bar's two-face
 * control switches zones. Big, legible items (44px+ targets, 16px labels).
 *
 * Responsive (responsive_grid.md): a full labelled rail at or above
 * `bp.md` (1024px); below it collapses to a 64px icon-only rail with the
 * labels surfaced as accessible tooltips. The collapse is a layout state
 * driven by viewport width, and the width transition is skipped under
 * reduce-motion via the global index.css rule.
 */
export default function Sidebar() {
  const location = useLocation();
  const zone = zoneForPath(location.pathname);
  const def = ZONES[zone];
  const collapsed = useNavRailCollapse();

  const width = collapsed ? LAYOUT.navRailCollapsed : LAYOUT.navRailWidth;

  return (
    <aside
      className="shell-rail flex flex-col h-full shrink-0 overflow-hidden no-print"
      aria-label={`${def.faceLabel} navigation`}
      style={{
        width,
        transition: 'width 180ms cubic-bezier(0.2, 0, 0, 1)',
        background: 'var(--cream)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Zone eyebrow */}
      <div
        className="flex items-center"
        style={{
          minHeight: 56,
          padding: collapsed ? `0 ${SPACE[2]}px` : `0 ${SPACE[5]}px`,
          borderBottom: '1px solid var(--border)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        {collapsed ? (
          <span
            aria-hidden="true"
            title={def.faceLabel}
            style={{
              width: 10,
              height: 10,
              borderRadius: RADIUS.pill,
              background: zone === 'platform' ? 'var(--teal)' : 'var(--navy)',
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: TYPE.label.size,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: zone === 'platform' ? 'var(--teal-deep)' : 'var(--navy)',
            }}
          >
            {zone === 'platform' ? 'Platform' : 'Research'}
          </span>
        )}
      </div>

      {/* Items */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: `${SPACE[4]}px ${SPACE[2]}px` }}>
        <ul className="space-y-1">
          {def.items.map((item) => (
            <li key={item.to}>
              <RailLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer hint (expanded only) */}
      {!collapsed && (
        <div
          className="flex items-center justify-between"
          style={{
            padding: `${SPACE[3]}px ${SPACE[5]}px`,
            borderTop: '1px solid var(--border)',
            fontSize: TYPE.label.size,
            color: 'var(--ink-faint)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <Kbd>g</Kbd> glossary
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>?</Kbd> keys
          </span>
        </div>
      )}
    </aside>
  );
}

function RailLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/platform' || item.to === '/research'}
      title={collapsed ? `${item.label} (${item.shortcut})` : item.hint}
      className={({ isActive }) =>
        clsx(
          'group relative flex items-center rounded-md font-semibold transition-colors',
          collapsed ? 'justify-center' : 'gap-3',
          isActive && 'shadow-sm',
        )
      }
      style={({ isActive }: { isActive: boolean }) => ({
        minHeight: 44,
        padding: collapsed ? `0 ${SPACE[2]}px` : `0 ${SPACE[3]}px`,
        background: isActive ? 'var(--navy)' : 'transparent',
        color: isActive ? '#fbf9f4' : 'var(--ink-soft)',
        fontFamily: 'var(--font-sans)',
        fontSize: 16,
        textDecoration: 'none',
      })}
      onMouseOver={(e) => {
        const el = e.currentTarget;
        if (el.getAttribute('aria-current') !== 'page') {
          el.style.background = 'rgba(15, 23, 42, 0.05)';
          el.style.color = 'var(--ink)';
        }
      }}
      onMouseOut={(e) => {
        const el = e.currentTarget;
        if (el.getAttribute('aria-current') !== 'page') {
          el.style.background = 'transparent';
          el.style.color = 'var(--ink-soft)';
        }
      }}
    >
      {({ isActive }) => (
        <>
          <span
            className="inline-flex shrink-0"
            style={{ color: isActive ? '#fbf9f4' : 'var(--ink-faint)' }}
          >
            <Icon size={22} />
          </span>
          {!collapsed && <span className="whitespace-nowrap overflow-hidden flex-1">{item.label}</span>}
          {!collapsed && item.shortcut && (
            <span
              aria-hidden="true"
              className="font-mono shrink-0"
              style={{
                fontSize: TYPE.label.size,
                color: isActive ? 'rgba(251, 249, 244, 0.6)' : 'var(--ink-faint)',
              }}
            >
              {item.shortcut}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      className="font-mono rounded px-1.5 py-px"
      style={{
        fontSize: TYPE.label.size,
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        color: 'var(--ink-soft)',
      }}
    >
      {children}
    </kbd>
  );
}
