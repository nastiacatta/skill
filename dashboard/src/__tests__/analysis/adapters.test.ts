/**
 * Unit tests for analysis adapter functions.
 *
 * Tests that each adapter returns null/[] on 404 (mock fetch).
 *
 * Requirements: 2.3, 4.3, 8.3, 10.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadAblationInterpretation,
  loadRegimeBreakdown,
  loadDepositInteraction,
  loadPanelSizeSensitivity,
} from '@/lib/adapters';

describe('Analysis adapter functions — error handling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Mock fetch to return 404 for all requests
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loadAblationInterpretation returns null on 404', async () => {
    const result = await loadAblationInterpretation();
    expect(result).toBeNull();
  });

  it('loadRegimeBreakdown returns empty array on 404', async () => {
    const result = await loadRegimeBreakdown();
    expect(result).toEqual([]);
  });

  it('loadDepositInteraction returns null on 404', async () => {
    const result = await loadDepositInteraction();
    expect(result).toBeNull();
  });

  it('loadPanelSizeSensitivity returns null on 404', async () => {
    const result = await loadPanelSizeSensitivity();
    expect(result).toBeNull();
  });
});

describe('Analysis adapter functions — network error', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loadAblationInterpretation returns null on network error', async () => {
    const result = await loadAblationInterpretation();
    expect(result).toBeNull();
  });

  it('loadRegimeBreakdown returns empty array on network error', async () => {
    const result = await loadRegimeBreakdown();
    expect(result).toEqual([]);
  });

  it('loadDepositInteraction returns null on network error', async () => {
    const result = await loadDepositInteraction();
    expect(result).toBeNull();
  });

  it('loadPanelSizeSensitivity returns null on network error', async () => {
    const result = await loadPanelSizeSensitivity();
    expect(result).toBeNull();
  });
});
