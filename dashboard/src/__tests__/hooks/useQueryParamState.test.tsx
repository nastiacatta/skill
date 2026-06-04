/**
 * Tests for useQueryParamState.
 *
 * Verifies:
 * - returns the fallback for an absent param
 * - returns the fallback for an invalid param (clamp-to-default)
 * - returns the param value when valid
 * - writing a non-default value updates the URL search string
 * - writing the fallback value clears the key (clean URLs)
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useQueryParamState } from '@/hooks/useQueryParamState';

afterEach(cleanup);

type Tab = 'A' | 'B' | 'C';
const isTab = (v: string): v is Tab => v === 'A' || v === 'B' || v === 'C';

function Harness() {
  const [tab, setTab] = useQueryParamState<Tab>('tab', 'A', isTab);
  const loc = useLocation();
  return (
    <div>
      <span data-testid="value">{tab}</span>
      <span data-testid="search">{loc.search}</span>
      <button onClick={() => setTab('B')}>set-B</button>
      <button onClick={() => setTab('A')}>set-A</button>
    </div>
  );
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Harness />
    </MemoryRouter>,
  );
}

describe('useQueryParamState', () => {
  it('returns the fallback when the param is absent', () => {
    renderAt('/');
    expect(screen.getByTestId('value').textContent).toBe('A');
  });

  it('returns the fallback when the param is invalid', () => {
    renderAt('/?tab=ZZZ');
    expect(screen.getByTestId('value').textContent).toBe('A');
  });

  it('returns the param value when valid', () => {
    renderAt('/?tab=C');
    expect(screen.getByTestId('value').textContent).toBe('C');
  });

  it('writes a non-default value into the search string', () => {
    renderAt('/');
    fireEvent.click(screen.getByText('set-B'));
    expect(screen.getByTestId('value').textContent).toBe('B');
    expect(screen.getByTestId('search').textContent).toContain('tab=B');
  });

  it('clears the key when the fallback value is written', () => {
    renderAt('/?tab=B');
    expect(screen.getByTestId('value').textContent).toBe('B');
    fireEvent.click(screen.getByText('set-A'));
    expect(screen.getByTestId('value').textContent).toBe('A');
    expect(screen.getByTestId('search').textContent).not.toContain('tab=');
  });
});
