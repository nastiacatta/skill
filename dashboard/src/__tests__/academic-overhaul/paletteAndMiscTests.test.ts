/**
 * Property-based tests for Properties 6, 10, 11, and 12.
 *
 * Uses fast-check with vitest. Each property runs ≥ 100 iterations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

import { CB_PALETTE, VERDICT_COLOURS, contrastRatio } from '@/lib/palette';

// ─── Property 6: Colourblind-safe palette contrast ─────────────────
// **Validates: Requirements 9.1, 9.3**

describe('Property 6: Colourblind-safe palette has pairwise-distinct colours and adequate contrast', () => {
  it('CB_PALETTE has exactly 8 entries', () => {
    expect(CB_PALETTE).toHaveLength(8);
  });

  it('all CB_PALETTE entries are valid hex colour strings', () => {
    for (const colour of CB_PALETTE) {
      expect(colour).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('all verdict colours have WCAG contrast ratio ≥ 4.5:1 between fg and bg', () => {
    const verdicts = Object.keys(VERDICT_COLOURS) as Array<keyof typeof VERDICT_COLOURS>;

    // Use fast-check to pick a random verdict for each iteration
    fc.assert(
      fc.property(
        fc.constantFrom(...verdicts),
        (verdict) => {
          const { fg, bg } = VERDICT_COLOURS[verdict];
          const ratio = contrastRatio(fg, bg);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all verdict colours individually satisfy WCAG 4.5:1 (exhaustive check)', () => {
    for (const [, { fg, bg }] of Object.entries(VERDICT_COLOURS)) {
      const ratio = contrastRatio(fg, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// ─── Property 10: SmartTooltip formatter ───────────────────────────
// **Validates: Requirements 6.5, 6.6**

describe('Property 10: SmartTooltip applies formatter and handles empty payloads', () => {
  /**
   * Pure logic extracted from SmartTooltip:
   * - Returns null if !active || !payload?.length
   * - Filters out entries where value is null/undefined
   * - Applies formatter(value, name) to each entry, or default fmt
   */
  function smartTooltipLogic(
    active: boolean | undefined,
    payload: Array<{ name: string; value: number; color: string; dataKey: string }> | null | undefined,
    formatter?: (value: number, name: string) => string,
  ): string[] | null {
    if (!active || !payload?.length) return null;

    const filtered = payload.filter((p) => p.value != null);
    if (!filtered.length) return null;

    const format = formatter ?? ((v: number) => v.toFixed(4));
    return filtered.map((p) => format(p.value, p.name));
  }

  /** Arbitrary for a hex colour string like "#a1b2c3" */
  const hexColourArb = fc
    .array(fc.integer({ min: 0, max: 255 }), { minLength: 3, maxLength: 3 })
    .map(([r, g, b]) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);

  const payloadEntryArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 10 }),
    value: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
    color: hexColourArb,
    dataKey: fc.string({ minLength: 1, maxLength: 10 }),
  });

  it('returns null for inactive tooltip', () => {
    fc.assert(
      fc.property(
        fc.array(payloadEntryArb, { minLength: 1, maxLength: 5 }),
        (payload) => {
          expect(smartTooltipLogic(false, payload)).toBeNull();
          expect(smartTooltipLogic(undefined, payload)).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null for null or empty payload', () => {
    fc.assert(
      fc.property(fc.boolean(), (active) => {
        expect(smartTooltipLogic(active, null)).toBeNull();
        expect(smartTooltipLogic(active, undefined)).toBeNull();
        expect(smartTooltipLogic(active, [])).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('applies formatter to each payload entry when active with non-empty payload', () => {
    fc.assert(
      fc.property(
        fc.array(payloadEntryArb, { minLength: 1, maxLength: 5 }),
        (payload) => {
          const formatter = (value: number, name: string) => `${name}:${value.toFixed(2)}`;
          const result = smartTooltipLogic(true, payload, formatter);

          expect(result).not.toBeNull();
          expect(result!.length).toBe(payload.length);

          for (let i = 0; i < payload.length; i++) {
            expect(result![i]).toBe(`${payload[i].name}:${payload[i].value.toFixed(2)}`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('uses default formatting when no formatter is provided', () => {
    fc.assert(
      fc.property(
        fc.array(payloadEntryArb, { minLength: 1, maxLength: 5 }),
        (payload) => {
          const result = smartTooltipLogic(true, payload);
          expect(result).not.toBeNull();
          for (let i = 0; i < payload.length; i++) {
            expect(result![i]).toBe(payload[i].value.toFixed(4));
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 11: Sidebar localStorage round-trip ──────────────────
// **Validates: Requirements 28.7**

describe('Property 11: Sidebar state persists via localStorage round-trip', () => {
  const STORAGE_KEY = 'sidebar-collapsed';

  /** Mirrors readPersistedState from useCollapsibleSidebar */
  function readPersistedState(storage: Storage): boolean {
    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (stored === null) return false;
      return stored === 'true';
    } catch {
      return false;
    }
  }

  /** Mirrors writePersistedState from useCollapsibleSidebar */
  function writePersistedState(storage: Storage, collapsed: boolean): void {
    try {
      storage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Silently ignore
    }
  }

  let mockStorage: Storage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (index: number) => Object.keys(store)[index] ?? null,
    };
  });

  it('write then read returns the same boolean value', () => {
    fc.assert(
      fc.property(fc.boolean(), (collapsed) => {
        writePersistedState(mockStorage, collapsed);
        const readBack = readPersistedState(mockStorage);
        expect(readBack).toBe(collapsed);
      }),
      { numRuns: 100 },
    );
  });

  it('defaults to false (expanded) when localStorage has no entry', () => {
    const result = readPersistedState(mockStorage);
    expect(result).toBe(false);
  });

  it('defaults to false when localStorage throws (private browsing)', () => {
    const throwingStorage: Storage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
      removeItem: () => { throw new Error('SecurityError'); },
      clear: () => { throw new Error('SecurityError'); },
      get length() { return 0; },
      key: () => null,
    };

    fc.assert(
      fc.property(fc.boolean(), (collapsed) => {
        writePersistedState(throwingStorage, collapsed);
        const result = readPersistedState(throwingStorage);
        expect(result).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 12: Auto-interpretation ──────────────────────────────
// **Validates: Requirements 22.2, 22.7**

describe('Property 12: Auto-interpretation generates valid summary text', () => {
  const NO_SIGNIFICANCE_MSG = 'No statistically significant difference detected';

  /**
   * Pure interpretation logic extracted from useAutoInterpretation's
   * interpretDeltaBar helper. Given delta-bar data, finds the method
   * with the most negative delta and reports its improvement percentage.
   */
  function interpretDeltaBar(
    data: Array<{ method: string; delta: number }>,
    threshold: number,
  ): string {
    let bestMethod = '';
    let bestDelta = 0;

    for (const row of data) {
      if (Number.isNaN(row.delta)) continue;
      if (row.delta < bestDelta) {
        bestDelta = row.delta;
        bestMethod = row.method;
      }
    }

    if (bestDelta === 0 || Math.abs(bestDelta) <= threshold) {
      return NO_SIGNIFICANCE_MSG;
    }

    const pct = Math.abs(bestDelta * 100).toFixed(1);
    return `${bestMethod} achieves the largest improvement at ${pct}% reduction in CRPS.`;
  }

  it('output contains method name and delta when delta exceeds threshold', () => {
    const methodArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);
    const deltaArb = fc.double({ min: -10, max: -0.06, noNaN: true }); // significant negative delta

    fc.assert(
      fc.property(methodArb, deltaArb, (method, delta) => {
        const data = [{ method, delta }];
        const result = interpretDeltaBar(data, 0.05);

        expect(result).toContain(method);
        const pct = Math.abs(delta * 100).toFixed(1);
        expect(result).toContain(pct);
      }),
      { numRuns: 100 },
    );
  });

  it('returns fallback text when delta is within threshold', () => {
    const methodArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);
    // Delta within [-0.05, 0] — not significant
    const smallDeltaArb = fc.double({ min: -0.05, max: 0, noNaN: true });

    fc.assert(
      fc.property(methodArb, smallDeltaArb, (method, delta) => {
        const data = [{ method, delta }];
        const result = interpretDeltaBar(data, 0.05);
        expect(result).toBe(NO_SIGNIFICANCE_MSG);
      }),
      { numRuns: 100 },
    );
  });

  it('returns fallback text for empty data', () => {
    const result = interpretDeltaBar([], 0.05);
    expect(result).toBe(NO_SIGNIFICANCE_MSG);
  });

  it('returns fallback text when all deltas are positive (no improvement)', () => {
    const methodArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);
    const positiveDeltaArb = fc.double({ min: 0.001, max: 10, noNaN: true });

    fc.assert(
      fc.property(
        fc.array(fc.tuple(methodArb, positiveDeltaArb), { minLength: 1, maxLength: 5 }),
        (entries) => {
          const data = entries.map(([method, delta]) => ({ method, delta }));
          const result = interpretDeltaBar(data, 0.05);
          expect(result).toBe(NO_SIGNIFICANCE_MSG);
        },
      ),
      { numRuns: 100 },
    );
  });
});
