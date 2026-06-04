/**
 * React hook wrapping the pure validation functions from `lib/validation.ts`.
 *
 * Accepts raw chart data, validation rules, and a chart title. Returns
 * filtered clean data (rows with NaN/Infinity in required numeric fields
 * removed), any validation warnings, and a convenience boolean.
 *
 * Uses `useMemo` so validation only re-runs when `data` or `rules` change.
 *
 * Requirements: 27.1–27.7, 8.3, 8.7
 */

import { useMemo } from 'react';

import type { ValidationRules, ValidationWarning } from '../lib/validation';
import {
  validateNumericFields,
  validateRanges,
  validateMonotonicity,
  validateSignConsistency,
  validateBudgetBalance,
} from '../lib/validation';

import type { ValidationSchema } from '../lib/analysis/types';
import { validate as guardValidate } from '../lib/analysis/dataIntegrityGuard';

/** Result returned by `useValidatedData`. */
export interface ValidatedResult<T> {
  /** Data filtered to exclude rows with NaN/Infinity in required numeric fields. */
  data: T[];
  /** All warnings produced by the configured validation rules. */
  warnings: ValidationWarning[];
  /** `true` when at least one warning was produced. */
  hasWarnings: boolean;
}

/**
 * Validate chart data against the supplied rules and return clean data plus
 * any warnings.
 *
 * Rows containing `NaN` or `±Infinity` in any of the `requiredNumericFields`
 * are excluded from the returned `data` array. All other checks (range,
 * monotonicity, sign-consistency, budget-balance) produce warnings but do
 * **not** filter rows — the data is still rendered so the user can see the
 * issue in context.
 *
 * Each warning is logged to `console.warn` with the chart title for easy
 * debugging during development.
 */
export function useValidatedData<T extends Record<string, unknown>>(
  data: T[],
  rules: ValidationRules,
  chartTitle: string,
): ValidatedResult<T> {
  return useMemo(() => {
    const warnings: ValidationWarning[] = [];

    // ── Numeric field checks (NaN, Infinity, null) ──────────────────
    if (rules.requiredNumericFields && rules.requiredNumericFields.length > 0) {
      const numericWarnings = validateNumericFields(
        data as Record<string, unknown>[],
        rules.requiredNumericFields,
      );
      warnings.push(...numericWarnings);
    }

    // ── Range checks ────────────────────────────────────────────────
    if (rules.rangeChecks && rules.rangeChecks.length > 0) {
      const rangeWarnings = validateRanges(
        data as Record<string, unknown>[],
        rules.rangeChecks,
      );
      warnings.push(...rangeWarnings);
    }

    // ── Monotonicity checks ─────────────────────────────────────────
    if (rules.monotonicFields && rules.monotonicFields.length > 0) {
      const monoWarnings = validateMonotonicity(
        data as Record<string, unknown>[],
        rules.monotonicFields,
      );
      warnings.push(...monoWarnings);
    }

    // ── Sign-consistency checks ─────────────────────────────────────
    if (rules.signConsistency && rules.signConsistency.length > 0) {
      const signWarnings = validateSignConsistency(
        data as Record<string, unknown>[],
        rules.signConsistency,
      );
      warnings.push(...signWarnings);
    }

    // ── Budget-balance check ────────────────────────────────────────
    if (rules.budgetBalance) {
      const { payoffField, depositField, tolerance } = rules.budgetBalance;
      const payoffs: number[] = [];
      const deposits: number[] = [];

      for (const row of data) {
        const p = row[payoffField];
        const d = row[depositField];
        if (typeof p === 'number' && Number.isFinite(p)) payoffs.push(p);
        if (typeof d === 'number' && Number.isFinite(d)) deposits.push(d);
      }

      const budgetWarnings = validateBudgetBalance(payoffs, deposits, tolerance);
      warnings.push(...budgetWarnings);
    }

    // ── Log warnings ────────────────────────────────────────────────
    for (const w of warnings) {
      console.warn(`[${chartTitle}] ${w.field}: ${w.message}`);
    }

    // ── Filter rows with NaN/Infinity in required numeric fields ────
    const requiredFields = rules.requiredNumericFields ?? [];
    const filteredData: T[] =
      requiredFields.length > 0
        ? data.filter((row) =>
            requiredFields.every((field) => {
              const v = row[field];
              return typeof v === 'number' && Number.isFinite(v);
            }),
          )
        : data;

    return {
      data: filteredData,
      warnings,
      hasWarnings: warnings.length > 0,
    };
  }, [data, rules, chartTitle]);
}


// ── Schema-based validation via DataIntegrityGuard ──────────────────

/** Result returned by `useSchemaValidatedData`. */
export interface SchemaValidatedResult<T extends Record<string, unknown>> {
  /** Sanitised data with out-of-range values replaced by null. */
  sanitisedData: T[] | null;
  /** Warnings from the data integrity guard. */
  warnings: string[];
  /** Fields where > 10% of rows contain NaN. */
  degradedFields: string[];
  /** True while data or schema is not yet available. */
  loading: boolean;
}

/**
 * Validate data against a `ValidationSchema` from `dataIntegrityGuard.ts`.
 *
 * When both `data` and `schema` are provided, calls `validate()` and
 * returns sanitised data, warnings, and degraded fields.
 * When `schema` is null, passes data through unchanged.
 *
 * Requirements: 8.3, 8.7
 */
export function useSchemaValidatedData<T extends Record<string, unknown>>(
  data: T[] | null,
  schema: ValidationSchema | null,
): SchemaValidatedResult<T> {
  return useMemo(() => {
    if (data === null) {
      return { sanitisedData: null, warnings: [], degradedFields: [], loading: true };
    }

    if (schema === null) {
      return { sanitisedData: data, warnings: [], degradedFields: [], loading: false };
    }

    const result = guardValidate(data, schema);
    return {
      sanitisedData: result.sanitisedData,
      warnings: result.warnings,
      degradedFields: result.degradedFields,
      loading: false,
    };
  }, [data, schema]);
}
