/**
 * Data-loading hook for the Model Performance Audit page.
 *
 * Loads comparison.json, baselines.json, and deposit_sensitivity.json
 * in parallel on mount. Returns a single AuditData object with loading
 * and per-file error tracking so panels can degrade gracefully.
 */

import { useState, useEffect } from 'react';

import type { AuditData } from '../lib/audit/auditTypes';
import {
  loadRealDataComparison,
  loadBaselines,
  loadDepositSensitivity,
} from '../lib/adapters';

export function useAuditData(): AuditData {
  const [state, setState] = useState<AuditData>({
    comparison: null,
    baselines: null,
    depositSensitivity: null,
    loading: true,
    errors: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const errors: string[] = [];

      const [comparison, baselines, depositSensitivity] = await Promise.all([
        loadRealDataComparison('elia_wind').catch(() => {
          errors.push('Comparison data could not be loaded.');
          return null;
        }),
        loadBaselines('elia_wind').catch(() => {
          errors.push('Baseline data could not be loaded.');
          return null;
        }),
        loadDepositSensitivity('elia_wind').catch(() => {
          errors.push('Deposit-sensitivity data could not be loaded.');
          return null;
        }),
      ]);

      if (!cancelled) {
        setState({
          comparison,
          baselines,
          depositSensitivity,
          loading: false,
          errors,
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
