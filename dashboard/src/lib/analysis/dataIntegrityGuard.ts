/**
 * Data integrity guard — runtime validation of loaded experiment data.
 *
 * Validates numeric fields for NaN/Infinity, checks range constraints,
 * verifies row counts, and flags degraded fields. Returns sanitised data
 * with out-of-range values replaced by null.
 *
 * Pure function — no side effects beyond console.warn logging.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import type { ValidationSchema, ValidationResult } from './types';

/**
 * Validate and sanitise a dataset against a schema.
 *
 * Behaviour:
 * - Checks every numeric field for NaN and Infinity values
 * - Logs warnings with field name and count of invalid values
 * - Flags fields as "degraded" when > 10 % of rows contain NaN
 * - Replaces out-of-range values with null in sanitised output
 * - Checks expectedRowCount if provided (within tolerance)
 * - Returns valid = true only when warnings is empty
 * - sanitisedData always has the same length as input
 */
export function validate<T extends Record<string, unknown>>(
  data: T[],
  schema: ValidationSchema,
): ValidationResult<T> {
  const warnings: string[] = [];
  const degradedFields: string[] = [];
  const n = data.length;

  // ── Row count check ──────────────────────────────────────────────
  if (schema.expectedRowCount != null) {
    const { value, tolerance } = schema.expectedRowCount;
    const diff = Math.abs(n - value);
    const allowedDiff = value * tolerance;
    if (diff > allowedDiff) {
      const msg = `Row count mismatch: expected ${value} (±${(tolerance * 100).toFixed(0)}%), got ${n}`;
      warnings.push(msg);
      console.warn(msg);
    }
  }

  // ── Build range-check lookup for fast access ─────────────────────
  const rangeByField = new Map<string, { min: number; max: number }>();
  for (const rc of schema.rangeChecks) {
    rangeByField.set(rc.field, { min: rc.min, max: rc.max });
  }

  // ── Per-field NaN / Infinity counts ──────────────────────────────
  const nanCounts = new Map<string, number>();
  const infCounts = new Map<string, number>();
  for (const field of schema.numericFields) {
    nanCounts.set(field, 0);
    infCounts.set(field, 0);
  }

  // ── Sanitise rows ────────────────────────────────────────────────
  const sanitisedData: T[] = data.map((row) => {
    // Shallow-clone so we don't mutate the original
    const sanitised = { ...row };

    for (const field of schema.numericFields) {
      const val = row[field];
      if (typeof val !== 'number') continue;

      // Detect NaN
      if (Number.isNaN(val)) {
        nanCounts.set(field, (nanCounts.get(field) ?? 0) + 1);
        (sanitised as Record<string, unknown>)[field] = null;
        continue;
      }

      // Detect Infinity
      if (!Number.isFinite(val)) {
        infCounts.set(field, (infCounts.get(field) ?? 0) + 1);
        (sanitised as Record<string, unknown>)[field] = null;
        continue;
      }

      // Range check
      const range = rangeByField.get(field);
      if (range && (val < range.min || val > range.max)) {
        (sanitised as Record<string, unknown>)[field] = null;
      }
    }

    return sanitised;
  });

  // ── Emit warnings for NaN / Infinity ─────────────────────────────
  for (const field of schema.numericFields) {
    const nanCount = nanCounts.get(field) ?? 0;
    const infCount = infCounts.get(field) ?? 0;

    if (nanCount > 0) {
      const msg = `Field "${field}": ${nanCount} NaN value(s) detected`;
      warnings.push(msg);
      console.warn(msg);
    }

    if (infCount > 0) {
      const msg = `Field "${field}": ${infCount} Infinity value(s) detected`;
      warnings.push(msg);
      console.warn(msg);
    }

    // Degraded = > 10 % NaN
    if (n > 0 && nanCount / n > 0.1) {
      degradedFields.push(field);
    }
  }

  // ── Emit warnings for range violations ───────────────────────────
  for (const rc of schema.rangeChecks) {
    let outOfRange = 0;
    for (const row of data) {
      const val = row[rc.field];
      if (typeof val !== 'number') continue;
      if (Number.isNaN(val) || !Number.isFinite(val)) continue;
      if (val < rc.min || val > rc.max) {
        outOfRange++;
      }
    }
    if (outOfRange > 0) {
      const msg = `Field "${rc.field}": ${outOfRange} value(s) out of range [${rc.min}, ${rc.max}]`;
      warnings.push(msg);
      console.warn(msg);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
    sanitisedData,
    degradedFields,
  };
}
