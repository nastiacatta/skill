import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ZONES, zoneForPath } from '@/components/dashboard/navModel';

/**
 * The single keyboard-shortcuts model for the shell. Within the active
 * zone, number keys 1-9 jump to that zone's rail items; `t` toggles between
 * the two zones (Try the platform / Read the research). The glossary (`g`),
 * shortcuts overlay (`?`) and tab keys are owned by their own components.
 *
 * Mirrors the route's zone so the numbers always address the rail the user
 * is looking at. Ignores keystrokes while an input is focused or a modifier
 * is held.
 */
export function useNavShortcuts() {
  const location = useLocation();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const zone = zoneForPath(location.pathname);

      // `t` toggles to the other zone's home.
      if (e.key === 't') {
        const other = zone === 'platform' ? 'research' : 'platform';
        window.location.hash = `#${ZONES[other].home}`;
        return;
      }

      // Number keys address the active zone's rail.
      const item = ZONES[zone].items.find((n) => n.shortcut === e.key);
      if (item) {
        window.location.hash = `#${item.to}`;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname]);
}
