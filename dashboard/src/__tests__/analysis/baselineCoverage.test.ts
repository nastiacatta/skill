/**
 * Unit tests for baseline coverage audit — alias mappings and audit logic.
 *
 * Requirements: 1.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.2, 4.1, 5.3, 7.1, 7.2, 7.3, 8.1
 */
import { describe, it, expect } from 'vitest';
import {
  MANDATORY_BASELINES,
  METHOD_ALIAS_MAP,
  KNOWN_NON_BASELINES,
  resolveMethodName,
  auditBaselineCoverage,
} from '@/lib/analysis/baselineCoverage';
import type { ExperimentMeta } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ExperimentMeta for testing. */
function makeMeta(name: string, block: 'core' | 'experiments' = 'core'): ExperimentMeta {
  return {
    name,
    displayName: name,
    description: '',
    block,
  };
}

/** Build a dataByExperiment map from a list of method names for a single experiment. */
function makeDataMap(
  experimentName: string,
  methods: string[],
): Map<string, { method: string }[]> {
  return new Map([[experimentName, methods.map((m) => ({ method: m }))]]);
}

// ---------------------------------------------------------------------------
// 1. Specific alias mappings (Req 1.1)
// ---------------------------------------------------------------------------

describe('METHOD_ALIAS_MAP — specific alias mappings', () => {
  it('maps uniform → equal', () => {
    expect(METHOD_ALIAS_MAP['uniform']).toBe('equal');
  });

  it('maps deposit → stake-only', () => {
    expect(METHOD_ALIAS_MAP['deposit']).toBe('stake-only');
  });

  it('maps skill → skill-only', () => {
    expect(METHOD_ALIAS_MAP['skill']).toBe('skill-only');
  });

  it('maps mechanism → blended', () => {
    expect(METHOD_ALIAS_MAP['mechanism']).toBe('blended');
  });

  it('maps bankroll → bankroll (identity)', () => {
    expect(METHOD_ALIAS_MAP['bankroll']).toBe('bankroll');
  });
});

// ---------------------------------------------------------------------------
// 2. best_single exclusion (Req 3.2, 8.1)
// ---------------------------------------------------------------------------

describe('best_single exclusion', () => {
  it('KNOWN_NON_BASELINES contains best_single', () => {
    expect(KNOWN_NON_BASELINES).toContain('best_single');
  });

  it('best_single does not appear in presentBaselines or missingBaselines', () => {
    const experiments = [makeMeta('exp1')];
    const data = makeDataMap('exp1', ['uniform', 'deposit', 'skill', 'mechanism', 'bankroll', 'best_single']);
    const [entry] = auditBaselineCoverage(experiments, data);

    expect(entry.presentBaselines).not.toContain('best_single');
    expect(entry.missingBaselines).not.toContain('best_single');
  });
});

// ---------------------------------------------------------------------------
// 3. Full coverage scenario (Req 2.6, 2.7)
// ---------------------------------------------------------------------------

describe('full coverage scenario', () => {
  it('data with all 5 aliased methods → isComplete = true', () => {
    const experiments = [makeMeta('full_exp')];
    const data = makeDataMap('full_exp', ['uniform', 'deposit', 'skill', 'mechanism', 'bankroll']);
    const [entry] = auditBaselineCoverage(experiments, data);

    expect(entry.isComplete).toBe(true);
    expect(entry.missingBaselines).toEqual([]);
    expect(entry.presentBaselines).toHaveLength(MANDATORY_BASELINES.length);
    for (const b of MANDATORY_BASELINES) {
      expect(entry.presentBaselines).toContain(b);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Canonical-name-only scenario (Req 7.1)
// ---------------------------------------------------------------------------

describe('canonical-name-only scenario', () => {
  it('data using canonical names directly → correct results', () => {
    const experiments = [makeMeta('canonical_exp')];
    const data = makeDataMap('canonical_exp', [
      'equal',
      'stake-only',
      'skill-only',
      'blended',
      'bankroll',
    ]);
    const [entry] = auditBaselineCoverage(experiments, data);

    expect(entry.isComplete).toBe(true);
    expect(entry.missingBaselines).toEqual([]);
    expect(entry.presentBaselines).toHaveLength(MANDATORY_BASELINES.length);
  });
});

// ---------------------------------------------------------------------------
// 5. Mixed naming scenario (Req 7.3)
// ---------------------------------------------------------------------------

describe('mixed naming scenario', () => {
  it('some aliased, some canonical → correct results', () => {
    const experiments = [makeMeta('mixed_exp')];
    // Mix: uniform (alias), stake-only (canonical), skill (alias), blended (canonical), bankroll
    const data = makeDataMap('mixed_exp', [
      'uniform',
      'stake-only',
      'skill',
      'blended',
      'bankroll',
    ]);
    const [entry] = auditBaselineCoverage(experiments, data);

    expect(entry.isComplete).toBe(true);
    expect(entry.missingBaselines).toEqual([]);
    expect(entry.presentBaselines).toHaveLength(MANDATORY_BASELINES.length);
  });
});

// ---------------------------------------------------------------------------
// 6. Empty experiment data (Req 2.7)
// ---------------------------------------------------------------------------

describe('empty experiment data', () => {
  it('no data rows → all baselines missing, isComplete = false', () => {
    const experiments = [makeMeta('empty_exp')];
    const data = new Map<string, { method: string }[]>();
    const [entry] = auditBaselineCoverage(experiments, data);

    expect(entry.isComplete).toBe(false);
    expect(entry.presentBaselines).toEqual([]);
    expect(entry.missingBaselines).toHaveLength(MANDATORY_BASELINES.length);
    for (const b of MANDATORY_BASELINES) {
      expect(entry.missingBaselines).toContain(b);
    }
  });

  it('empty rows array → all baselines missing', () => {
    const experiments = [makeMeta('empty_rows')];
    const data = new Map([['empty_rows', [] as { method: string }[]]]);
    const [entry] = auditBaselineCoverage(experiments, data);

    expect(entry.isComplete).toBe(false);
    expect(entry.presentBaselines).toEqual([]);
    expect(entry.missingBaselines).toHaveLength(MANDATORY_BASELINES.length);
  });
});

// ---------------------------------------------------------------------------
// 7. KNOWN_NON_BASELINES registry (Req 8.1)
// ---------------------------------------------------------------------------

describe('KNOWN_NON_BASELINES registry', () => {
  it('contains best_single', () => {
    expect(KNOWN_NON_BASELINES).toContain('best_single');
  });

  it('is a non-empty readonly array', () => {
    expect(KNOWN_NON_BASELINES.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8. No duplicate non-identity mappings (Req 5.3)
// ---------------------------------------------------------------------------

describe('METHOD_ALIAS_MAP — no duplicate non-identity mappings', () => {
  it('no two different non-identity keys map to the same canonical name', () => {
    // Collect non-identity mappings: entries where key !== value
    const nonIdentity = Object.entries(METHOD_ALIAS_MAP).filter(
      ([key, value]) => key !== value,
    );

    // Group by canonical name
    const byCanonical = new Map<string, string[]>();
    for (const [key, canonical] of nonIdentity) {
      const existing = byCanonical.get(canonical) ?? [];
      existing.push(key);
      byCanonical.set(canonical, existing);
    }

    // Each canonical name should have at most one non-identity alias
    for (const [canonical, aliases] of byCanonical) {
      expect(
        aliases.length,
        `Canonical name "${canonical}" has multiple non-identity aliases: ${aliases.join(', ')}`,
      ).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// resolveMethodName — additional edge cases
// ---------------------------------------------------------------------------

describe('resolveMethodName', () => {
  it('resolves known aliases to canonical names', () => {
    expect(resolveMethodName('uniform')).toBe('equal');
    expect(resolveMethodName('deposit')).toBe('stake-only');
    expect(resolveMethodName('skill')).toBe('skill-only');
    expect(resolveMethodName('mechanism')).toBe('blended');
  });

  it('returns canonical names unchanged', () => {
    expect(resolveMethodName('equal')).toBe('equal');
    expect(resolveMethodName('stake-only')).toBe('stake-only');
    expect(resolveMethodName('skill-only')).toBe('skill-only');
    expect(resolveMethodName('blended')).toBe('blended');
    expect(resolveMethodName('bankroll')).toBe('bankroll');
  });

  it('returns unknown method names unchanged', () => {
    expect(resolveMethodName('best_single')).toBe('best_single');
    expect(resolveMethodName('unknown_method')).toBe('unknown_method');
    expect(resolveMethodName('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// auditBaselineCoverage — block filtering
// ---------------------------------------------------------------------------

describe('auditBaselineCoverage — block filtering', () => {
  it('only audits experiments in core or experiments blocks', () => {
    const experiments: ExperimentMeta[] = [
      makeMeta('core_exp', 'core'),
      { name: 'behaviour_exp', displayName: 'b', description: '', block: 'behaviour' },
      makeMeta('exp_block', 'experiments'),
    ];
    const data = new Map<string, { method: string }[]>([
      ['core_exp', [{ method: 'uniform' }]],
      ['behaviour_exp', [{ method: 'uniform' }]],
      ['exp_block', [{ method: 'deposit' }]],
    ]);

    const results = auditBaselineCoverage(experiments, data);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.experimentName)).toEqual(['core_exp', 'exp_block']);
  });
});

// ---------------------------------------------------------------------------
// auditBaselineCoverage — partial coverage
// ---------------------------------------------------------------------------

describe('auditBaselineCoverage — partial coverage', () => {
  it('reports correct present and missing when only some baselines exist', () => {
    const experiments = [makeMeta('partial_exp')];
    // Only uniform (→equal) and bankroll present
    const data = makeDataMap('partial_exp', ['uniform', 'bankroll']);
    const [entry] = auditBaselineCoverage(experiments, data);

    expect(entry.isComplete).toBe(false);
    expect(entry.presentBaselines).toContain('equal');
    expect(entry.presentBaselines).toContain('bankroll');
    expect(entry.missingBaselines).toContain('stake-only');
    expect(entry.missingBaselines).toContain('skill-only');
    expect(entry.missingBaselines).toContain('blended');
  });
});
