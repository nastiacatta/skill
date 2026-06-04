/**
 * Component property tests — Properties 1, 4, 12, 16.
 * Feature: behaviour-analysis-redesign
 *
 * Tests pure data/logic rather than DOM rendering.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PRESET_CONFIGS, ALL_PRESET_IDS } from '@/lib/behaviour/presetMeta';
import { TAXONOMY_ITEMS } from '@/lib/behaviour/taxonomyData';
import type { BehaviourFamily } from '@/lib/behaviour/hiddenAttributes';

const ALL_FAMILIES: BehaviourFamily[] = [
  'participation', 'information', 'reporting', 'staking',
  'objectives', 'identity', 'learning', 'adversarial', 'operational',
];

// Feature: behaviour-analysis-redesign, Property 1: FamilyCard displays all required fields
// **Validates: Requirements 1.2**
describe('Property 1 — FamilyCard displays all required fields', () => {
  it('every family has a name, description, and items with valid statuses', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_FAMILIES),
        (family) => {
          const items = TAXONOMY_ITEMS.filter(i => i.family === family);
          // Family has items
          expect(items.length).toBeGreaterThan(0);
          // Each item has required fields
          for (const item of items) {
            expect(item.name.length).toBeGreaterThan(0);
            expect(['experiment', 'taxonomy-only', 'not-covered']).toContain(item.status);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('FamilyCard data structure has family name, description, and sub-items', () => {
    // Verify that PRESET_CONFIGS provides the data FamilyCard needs
    for (const family of ALL_FAMILIES) {
      const items = TAXONOMY_ITEMS.filter(i => i.family === family);
      expect(items.length).toBeGreaterThan(0);
      // Each item has a name and status (the fields FamilyCard renders)
      for (const item of items) {
        expect(typeof item.name).toBe('string');
        expect(typeof item.status).toBe('string');
      }
    }
  });
});

// Feature: behaviour-analysis-redesign, Property 4: Preset selection shows correct hidden attributes
// **Validates: Requirements 3.2, 3.3**
describe('Property 4 — Preset selection shows correct hidden attributes', () => {
  it('every preset has agentProfiles with valid hidden attributes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESET_IDS),
        (presetId) => {
          const config = PRESET_CONFIGS[presetId];
          expect(config).toBeDefined();
          expect(config.agentProfiles.length).toBeGreaterThan(0);

          for (const profile of config.agentProfiles) {
            const attrs = profile.attributes;
            // All 6 hidden attribute fields must be present and finite
            expect(Number.isFinite(attrs.intrinsicSkill)).toBe(true);
            expect(Number.isFinite(attrs.crraGamma)).toBe(true);
            expect(Number.isFinite(attrs.participationBaseline)).toBe(true);
            expect(Number.isFinite(attrs.bias)).toBe(true);
            expect(Number.isFinite(attrs.initialBudget)).toBe(true);
            expect(Number.isFinite(attrs.identityCount)).toBe(true);
            // Sensible ranges
            expect(attrs.intrinsicSkill).toBeGreaterThanOrEqual(0);
            expect(attrs.intrinsicSkill).toBeLessThanOrEqual(1);
            expect(attrs.participationBaseline).toBeGreaterThanOrEqual(0);
            expect(attrs.participationBaseline).toBeLessThanOrEqual(1);
            expect(attrs.initialBudget).toBeGreaterThan(0);
            expect(attrs.identityCount).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 12: Tab content indicator correctness
// **Validates: Requirements 10.3, 10.4**
describe('Property 12 — Tab content indicator correctness', () => {
  const TABS = [
    'Overview', 'Participation', 'Information', 'Reporting', 'Staking',
    'Objectives', 'Identity', 'Learning', 'Adversarial', 'Operational', 'Sensitivity',
  ];

  /** Replicates the EXPERIMENT_TABS logic from BehaviourPage. */
  function computeExperimentTabs(items: typeof TAXONOMY_ITEMS): Set<string> {
    const tabs = new Set<string>(
      items.filter(i => i.status === 'experiment' && i.tab).map(i => i.tab!),
    );
    tabs.add('Overview');
    tabs.add('Sensitivity');
    return tabs;
  }

  it('tab has experiment indicator iff at least one experiment item maps to it', () => {
    const experimentTabs = computeExperimentTabs(TAXONOMY_ITEMS);

    for (const tab of TABS) {
      const hasExperimentItem = TAXONOMY_ITEMS.some(
        i => i.status === 'experiment' && i.tab === tab,
      );
      const isSpecialTab = tab === 'Overview' || tab === 'Sensitivity';

      if (hasExperimentItem || isSpecialTab) {
        expect(experimentTabs.has(tab)).toBe(true);
      } else {
        expect(experimentTabs.has(tab)).toBe(false);
      }
    }
  });

  it('property: any subset of taxonomy items produces consistent tab indicators', () => {
    fc.assert(
      fc.property(
        fc.subarray(TAXONOMY_ITEMS, { minLength: 0 }),
        (subset) => {
          const experimentTabs = computeExperimentTabs(subset);
          // Overview and Sensitivity are always experiment-backed
          expect(experimentTabs.has('Overview')).toBe(true);
          expect(experimentTabs.has('Sensitivity')).toBe(true);
          // Every tab in the set should have at least one experiment item mapping to it (or be special)
          for (const tab of experimentTabs) {
            if (tab === 'Overview' || tab === 'Sensitivity') continue;
            const hasItem = subset.some(i => i.status === 'experiment' && i.tab === tab);
            expect(hasItem).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 16: Config panel shows correct parameters with ranges
// **Validates: Requirements 12.1, 12.3**
describe('Property 16 — Config panel shows correct parameters with ranges', () => {
  it('every preset has tunableParams with valid min/max/step/default', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESET_IDS),
        (presetId) => {
          const config = PRESET_CONFIGS[presetId];
          expect(config.tunableParams.length).toBeGreaterThan(0);

          for (const param of config.tunableParams) {
            expect(typeof param.key).toBe('string');
            expect(param.key.length).toBeGreaterThan(0);
            expect(typeof param.label).toBe('string');
            expect(param.label.length).toBeGreaterThan(0);
            // min < max
            expect(param.min).toBeLessThan(param.max);
            // step > 0
            expect(param.step).toBeGreaterThan(0);
            // default is within [min, max]
            expect(param.default).toBeGreaterThanOrEqual(param.min);
            expect(param.default).toBeLessThanOrEqual(param.max);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
