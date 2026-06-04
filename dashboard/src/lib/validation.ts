/**
 * Pure data validation functions for chart data integrity checks.
 *
 * Each function accepts raw data and returns an array of `ValidationWarning`
 * objects describing any issues found. Functions are side-effect-free so they
 * can be composed and tested independently of React.
 *
 * Requirements: 27.1–27.7
 */

// ── Interfaces ──────────────────────────────────────────────────────

/** Warning produced by a data validation check. */
export interface ValidationWarning {
  field: string;
  type: 'nan' | 'infinity' | 'null' | 'range' | 'monotonicity' | 'sign' | 'budget';
  count: number;
  message: string;
}

/** Rule configuration consumed by `useValidatedData`. */
export interface ValidationRules {
  requiredNumericFields?: string[];
  rangeChecks?: Array<{ field: string; min: number; max: number; label?: string }>;
  monotonicFields?: string[];
  signConsistency?: Array<{ deltaField: string; labelField: string }>;
  budgetBalance?: { payoffField: string; depositField: string; tolerance: number };
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Type-narrow a value to `number` (excludes NaN and ±Infinity). */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// ── Validation functions ────────────────────────────────────────────

/**
 * Detect NaN, Infinity, and null values in the specified numeric fields.
 *
 * For each field the function scans every row and counts occurrences of
 * `NaN`, `±Infinity`, and `null`/`undefined`, returning one warning per
 * issue type per field.
 */
export function validateNumericFields(
  data: Record<string, unknown>[],
  fields: string[],
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const field of fields) {
    let nanCount = 0;
    let infCount = 0;
    let nullCount = 0;

    for (const row of data) {
      const v = row[field];
      if (v === null || v === undefined) {
        nullCount++;
      } else if (typeof v === 'number') {
        if (Number.isNaN(v)) nanCount++;
        else if (!Number.isFinite(v)) infCount++;
      }
    }

    if (nanCount > 0) {
      warnings.push({
        field,
        type: 'nan',
        count: nanCount,
        message: `${nanCount} NaN value${nanCount > 1 ? 's' : ''} in "${field}"`,
      });
    }
    if (infCount > 0) {
      warnings.push({
        field,
        type: 'infinity',
        count: infCount,
        message: `${infCount} Infinity value${infCount > 1 ? 's' : ''} in "${field}"`,
      });
    }
    if (nullCount > 0) {
      warnings.push({
        field,
        type: 'null',
        count: nullCount,
        message: `${nullCount} null/undefined value${nullCount > 1 ? 's' : ''} in "${field}"`,
      });
    }
  }

  return warnings;
}

/**
 * Detect values outside specified `[min, max]` ranges.
 *
 * Non-numeric, NaN, and null values are silently skipped (they are the
 * responsibility of `validateNumericFields`).
 */
export function validateRanges(
  data: Record<string, unknown>[],
  rangeChecks: Array<{ field: string; min: number; max: number; label?: string }>,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const { field, min, max, label } of rangeChecks) {
    let outOfRange = 0;

    for (const row of data) {
      const v = row[field];
      if (isFiniteNumber(v) && (v < min || v > max)) {
        outOfRange++;
      }
    }

    if (outOfRange > 0) {
      const displayName = label ?? field;
      warnings.push({
        field,
        type: 'range',
        count: outOfRange,
        message: `${outOfRange} value${outOfRange > 1 ? 's' : ''} in "${displayName}" outside [${min}, ${max}]`,
      });
    }
  }

  return warnings;
}

/**
 * Detect monotonicity violations in cumulative fields.
 *
 * A violation occurs when `data[i+1][field] < data[i][field]` for any
 * consecutive pair of finite numeric values. Non-numeric rows are skipped.
 */
export function validateMonotonicity(
  data: Record<string, unknown>[],
  fields: string[],
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const field of fields) {
    let violations = 0;
    let prev: number | null = null;

    for (const row of data) {
      const v = row[field];
      if (isFiniteNumber(v)) {
        if (prev !== null && v < prev) {
          violations++;
        }
        prev = v;
      }
    }

    if (violations > 0) {
      warnings.push({
        field,
        type: 'monotonicity',
        count: violations,
        message: `${violations} non-decreasing violation${violations > 1 ? 's' : ''} in "${field}"`,
      });
    }
  }

  return warnings;
}

/**
 * Detect sign-consistency mismatches between delta values and labels.
 *
 * Convention: a negative delta means "better than baseline" and a positive
 * delta means "worse than baseline". A mismatch occurs when:
 *   - delta < 0 and the label contains "worse" (case-insensitive), or
 *   - delta > 0 and the label contains "better" (case-insensitive).
 *
 * Rows where the delta is zero, non-numeric, or the label is missing are
 * skipped.
 */
export function validateSignConsistency(
  data: Record<string, unknown>[],
  rules: Array<{ deltaField: string; labelField: string }>,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const { deltaField, labelField } of rules) {
    let mismatches = 0;

    for (const row of data) {
      const delta = row[deltaField];
      const label = row[labelField];

      if (!isFiniteNumber(delta) || delta === 0) continue;
      if (typeof label !== 'string') continue;

      const lower = label.toLowerCase();
      if (delta < 0 && lower.includes('worse')) {
        mismatches++;
      } else if (delta > 0 && lower.includes('better')) {
        mismatches++;
      }
    }

    if (mismatches > 0) {
      warnings.push({
        field: deltaField,
        type: 'sign',
        count: mismatches,
        message: `${mismatches} sign/label mismatch${mismatches > 1 ? 'es' : ''} between "${deltaField}" and "${labelField}"`,
      });
    }
  }

  return warnings;
}

/**
 * Detect budget-balance violations.
 *
 * The budget is balanced when `|Σ payoffs − Σ deposits| ≤ tolerance`.
 * Returns a single warning if the imbalance exceeds the tolerance.
 */
export function validateBudgetBalance(
  payoffs: number[],
  deposits: number[],
  tolerance: number,
): ValidationWarning[] {
  const sumPayoffs = payoffs.reduce((s, v) => s + v, 0);
  const sumDeposits = deposits.reduce((s, v) => s + v, 0);
  const gap = Math.abs(sumPayoffs - sumDeposits);

  if (gap > tolerance) {
    return [
      {
        field: 'budget',
        type: 'budget',
        count: 1,
        message: `Budget balance violation: |Σ payoffs − Σ deposits| = ${gap.toExponential(4)}, exceeds tolerance ${tolerance}`,
      },
    ];
  }

  return [];
}
