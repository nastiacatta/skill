/**
 * Unit tests for static audit content completeness.
 *
 * Verifies that LITERATURE_REFS, THEORY_VS_PRACTICE, MODEL_ANNOTATIONS,
 * XGBOOST_SUGGESTIONS, and RECOMMENDATIONS meet the minimum counts and
 * structural requirements specified in the design document.
 */

import { describe, it, expect } from 'vitest';
import {
  LITERATURE_REFS,
  THEORY_VS_PRACTICE,
  MODEL_ANNOTATIONS,
  XGBOOST_SUGGESTIONS,
  RECOMMENDATIONS,
} from '@/lib/audit/auditContent';

// ── LITERATURE_REFS ────────────────────────────────────────────────────────

describe('LITERATURE_REFS', () => {
  it('has at least 6 references', () => {
    expect(LITERATURE_REFS.length).toBeGreaterThanOrEqual(6);
  });

  it('covers all 6 required categories', () => {
    const categories = new Set(LITERATURE_REFS.map((r) => r.category));
    expect(categories).toContain('mechanism_design');
    expect(categories).toContain('linear_pool');
    expect(categories).toContain('online_learning');
    expect(categories).toContain('alternative_aggregation');
    expect(categories).toContain('model_improvement');
    expect(categories).toContain('collusion');
  });

  it('each reference has non-empty required fields', () => {
    for (const ref of LITERATURE_REFS) {
      expect(ref.id).toBeTruthy();
      expect(ref.authors).toBeTruthy();
      expect(ref.title).toBeTruthy();
      expect(ref.keyFinding).toBeTruthy();
      expect(ref.empiricalConnection).toBeTruthy();
    }
  });

  it('has unique ids', () => {
    const ids = LITERATURE_REFS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the 8 specific references from the spec', () => {
    const authors = LITERATURE_REFS.map((r) => r.authors);
    expect(authors).toContain('Lambert et al. (2008)');
    expect(authors).toContain('Raja et al. (2024)');
    expect(authors).toContain('Ranjan & Gneiting (2010)');
    expect(authors).toContain('Cesa-Bianchi & Lugosi (2006)');
    expect(authors.some((a) => a.includes('Vitali'))).toBe(true);
    expect(authors.some((a) => a.includes('Berrisch'))).toBe(true);
    expect(authors.some((a) => a.includes('Chun'))).toBe(true);
    expect(authors.some((a) => a.includes('Bassetti'))).toBe(true);
  });
});

// ── THEORY_VS_PRACTICE ─────────────────────────────────────────────────────

describe('THEORY_VS_PRACTICE', () => {
  it('has at least 4 rows', () => {
    expect(THEORY_VS_PRACTICE.length).toBeGreaterThanOrEqual(4);
  });

  it('each row has non-empty required fields', () => {
    for (const row of THEORY_VS_PRACTICE) {
      expect(row.theoreticalPrediction).toBeTruthy();
      expect(row.empiricalObservation).toBeTruthy();
      expect(row.source).toBeTruthy();
      expect(typeof row.supported).toBe('boolean');
    }
  });
});

// ── MODEL_ANNOTATIONS ──────────────────────────────────────────────────────

describe('MODEL_ANNOTATIONS', () => {
  const EXPECTED_FORECASTERS = [
    'Naive',
    'EWMA(5)',
    'ARIMA(2,1,1)',
    'XGBoost',
    'Neural Net',
    'Theta',
    'Ensemble',
  ];

  it('has exactly 7 forecaster annotations', () => {
    expect(MODEL_ANNOTATIONS.length).toBe(7);
  });

  it('covers all 7 expected forecasters', () => {
    const names = MODEL_ANNOTATIONS.map((a) => a.forecaster);
    for (const expected of EXPECTED_FORECASTERS) {
      expect(names).toContain(expected);
    }
  });

  it('each annotation has non-empty strengths, weaknesses, and theory note', () => {
    for (const ann of MODEL_ANNOTATIONS) {
      expect(ann.strengths).toBeTruthy();
      expect(ann.weaknesses).toBeTruthy();
      expect(ann.theoryNote).toBeTruthy();
    }
  });
});

// ── XGBOOST_SUGGESTIONS ───────────────────────────────────────────────────

describe('XGBOOST_SUGGESTIONS', () => {
  it('has at least 3 suggestions', () => {
    expect(XGBOOST_SUGGESTIONS.length).toBeGreaterThanOrEqual(3);
  });

  it('each suggestion has non-empty id, title, and description', () => {
    for (const sug of XGBOOST_SUGGESTIONS) {
      expect(sug.id).toBeTruthy();
      expect(sug.title).toBeTruthy();
      expect(sug.description).toBeTruthy();
    }
  });

  it('has unique ids', () => {
    const ids = XGBOOST_SUGGESTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── RECOMMENDATIONS ────────────────────────────────────────────────────────

describe('RECOMMENDATIONS', () => {
  it('has at least 11 recommendations', () => {
    expect(RECOMMENDATIONS.length).toBeGreaterThanOrEqual(11);
  });

  it('covers all 4 required categories', () => {
    const categories = new Set(RECOMMENDATIONS.map((r) => r.category));
    expect(categories).toContain('model');
    expect(categories).toContain('skill');
    expect(categories).toContain('aggregation');
    expect(categories).toContain('economic');
  });

  it('has at least 3 model-level recommendations', () => {
    const model = RECOMMENDATIONS.filter((r) => r.category === 'model');
    expect(model.length).toBeGreaterThanOrEqual(3);
  });

  it('has at least 3 skill estimation recommendations', () => {
    const skill = RECOMMENDATIONS.filter((r) => r.category === 'skill');
    expect(skill.length).toBeGreaterThanOrEqual(3);
  });

  it('has at least 3 aggregation recommendations', () => {
    const agg = RECOMMENDATIONS.filter((r) => r.category === 'aggregation');
    expect(agg.length).toBeGreaterThanOrEqual(3);
  });

  it('has at least 2 economic mechanism recommendations', () => {
    const econ = RECOMMENDATIONS.filter((r) => r.category === 'economic');
    expect(econ.length).toBeGreaterThanOrEqual(2);
  });

  it('each recommendation has non-empty required fields', () => {
    for (const rec of RECOMMENDATIONS) {
      expect(rec.id).toBeTruthy();
      expect(rec.title).toBeTruthy();
      expect(rec.description).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(rec.priority);
      expect(['model', 'skill', 'aggregation', 'economic']).toContain(rec.category);
    }
  });

  it('has unique ids', () => {
    const ids = RECOMMENDATIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('recommendations with crpsEstimate cite data source in evidence', () => {
    const withEstimate = RECOMMENDATIONS.filter((r) => r.crpsEstimate);
    for (const rec of withEstimate) {
      // Recommendations with CRPS estimates should have evidence
      expect(rec.evidence).toBeTruthy();
    }
  });
});
