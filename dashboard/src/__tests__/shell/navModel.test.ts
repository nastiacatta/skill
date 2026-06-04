import { describe, it, expect } from 'vitest';
import {
  PLATFORM_NAV,
  RESEARCH_NAV,
  ZONES,
  ZONE_ORDER,
  zoneForPath,
  crossLinkForPath,
  CROSS_LINKS,
} from '@/components/dashboard/navModel';
import { ROUTE_TITLES } from '@/App';

/**
 * The unified shell's navigation model. These pin the binding
 * page-map facts: the two zones, their rails, the cross-link pairs, and the
 * canonical route set. Routes and pairings are bound by page_map.md.
 */

const CANONICAL_ROUTES = [
  '/platform',
  '/platform/forecast',
  '/platform/market',
  '/platform/stress',
  '/platform/account',
  '/platform/leaderboard',
  '/platform/operator',
  '/research',
  '/evidence',
  '/robustness',
  '/explainer',
  '/audit',
  '/notes',
  '/appendix',
  '/appendix/experiments',
  '/appendix/figures',
  '/appendix/diagnostics',
  '/slides',
];

describe('navModel - zones and rails', () => {
  it('has exactly two zones in a stable order', () => {
    expect(ZONE_ORDER).toEqual(['platform', 'research']);
    expect(Object.keys(ZONES).sort()).toEqual(['platform', 'research']);
  });

  it('the platform rail is the seven showcase lenses, in order', () => {
    expect(PLATFORM_NAV.map((n) => n.to)).toEqual([
      '/platform',
      '/platform/forecast',
      '/platform/market',
      '/platform/stress',
      '/platform/account',
      '/platform/leaderboard',
      '/platform/operator',
    ]);
  });

  it('the research rail follows the chapter flow', () => {
    expect(RESEARCH_NAV.map((n) => n.to)).toEqual([
      '/research',
      '/evidence',
      '/robustness',
      '/explainer',
      '/audit',
      '/notes',
      '/appendix',
    ]);
  });

  it('neither rail routes to the standalone slides deck', () => {
    const all = [...PLATFORM_NAV, ...RESEARCH_NAV].map((n) => n.to);
    expect(all).not.toContain('/slides');
  });

  it('every rail item has a unique within-zone shortcut and a hint', () => {
    for (const rail of [PLATFORM_NAV, RESEARCH_NAV]) {
      const shortcuts = rail.map((n) => n.shortcut);
      expect(new Set(shortcuts).size).toBe(rail.length);
      for (const item of rail) {
        expect(item.hint.length).toBeGreaterThan(0);
        expect(item.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('each zone home is the first item of its rail', () => {
    expect(ZONES.platform.home).toBe(PLATFORM_NAV[0].to);
    expect(ZONES.research.home).toBe(RESEARCH_NAV[0].to);
  });
});

describe('navModel - zoneForPath', () => {
  it('classifies every platform route as platform', () => {
    for (const to of PLATFORM_NAV.map((n) => n.to)) {
      expect(zoneForPath(to)).toBe('platform');
    }
  });

  it('classifies every research route as research', () => {
    for (const to of RESEARCH_NAV.map((n) => n.to)) {
      expect(zoneForPath(to)).toBe('research');
    }
    expect(zoneForPath('/appendix/figures')).toBe('research');
  });

  it('does not mistake /platformish prefixes for the platform zone', () => {
    // Only exact /platform or /platform/* count.
    expect(zoneForPath('/platform')).toBe('platform');
    expect(zoneForPath('/platform/market')).toBe('platform');
    // A hypothetical sibling must not be swallowed.
    expect(zoneForPath('/research')).toBe('research');
  });
});

describe('navModel - cross-links', () => {
  it('every rail item has a contextual cross-link into the other zone', () => {
    for (const item of [...PLATFORM_NAV, ...RESEARCH_NAV]) {
      const cross = crossLinkForPath(item.to);
      expect(cross.to.length).toBeGreaterThan(0);
      expect(cross.label.length).toBeGreaterThan(0);
      // The cross-link points at the OPPOSITE zone.
      expect(zoneForPath(cross.to)).not.toBe(zoneForPath(item.to));
    }
  });

  it('every explicit cross-link target is a real canonical route', () => {
    for (const { to } of Object.values(CROSS_LINKS)) {
      expect(CANONICAL_ROUTES).toContain(to);
    }
  });

  it('falls back to a sensible default for an unmapped path', () => {
    expect(crossLinkForPath('/platform/unknown').to).toBe('/evidence');
    expect(crossLinkForPath('/something-else').to).toBe('/platform');
  });
});

describe('routing - titles', () => {
  it('every canonical route has a page title', () => {
    for (const route of CANONICAL_ROUTES) {
      expect(ROUTE_TITLES[route]).toBeDefined();
      expect(ROUTE_TITLES[route].length).toBeGreaterThan(0);
    }
  });
});
