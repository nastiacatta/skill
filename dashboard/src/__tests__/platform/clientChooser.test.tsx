import { render, screen, cleanup, within } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import ClientChooser from '@/components/platform/ClientChooser';
import { CLIENT_DOMAINS } from '@/components/platform/panelFramings';

afterEach(cleanup);

function renderChooser() {
  return render(
    <MemoryRouter>
      <ClientChooser />
    </MemoryRouter>,
  );
}

describe('ClientChooser - start-of-platform client / domain chooser', () => {
  it('renders the chooser wrapper and the three scoped domains', () => {
    renderChooser();
    expect(screen.getByTestId('client-chooser')).toBeDefined();
    expect(screen.getByTestId('domain-wind')).toBeDefined();
    expect(screen.getByTestId('domain-electricity')).toBeDefined();
    expect(screen.getByTestId('domain-air_quality')).toBeDefined();
    // Exactly the scoped set, no extras.
    expect(CLIENT_DOMAINS.map((d) => d.id)).toEqual(['wind', 'electricity', 'air_quality']);
  });

  it('routes live domains to the Market with the framing preselected', () => {
    renderChooser();
    const windCta = within(screen.getByTestId('domain-wind')).getByTestId('domain-wind-cta');
    expect(windCta.getAttribute('href')).toBe('#/platform/market?panel=heterogeneous');
    const elecCta = within(screen.getByTestId('domain-electricity')).getByTestId('domain-electricity-cta');
    expect(elecCta.getAttribute('href')).toBe('#/platform/market?panel=homogeneous');
    const aqCta = within(screen.getByTestId('domain-air_quality')).getByTestId('domain-air_quality-cta');
    expect(aqCta.getAttribute('href')).toBe('#/platform/market?panel=chemistry_moe');
  });

  it('shows the illustrative / synthetic tag and "shaped like" note on a synthetic-framed domain', () => {
    renderChooser();
    const wind = within(screen.getByTestId('domain-wind'));
    expect(wind.getByText('Live synthetic sandbox')).toBeDefined();
    const note = screen.getByTestId('domain-wind-note').textContent ?? '';
    expect(note).toContain('synthetic sandbox shaped like the wind panel');
    expect(note).toContain('not the Elia wind series');
  });

  it('air_quality is live with a market deep-link and a secondary evidence link', () => {
    renderChooser();
    const aq = within(screen.getByTestId('domain-air_quality'));
    // Primary CTA deep-links the live Market with the chemistry framing.
    const cta = aq.getByTestId('domain-air_quality-cta');
    expect(cta.getAttribute('href')).toBe('#/platform/market?panel=chemistry_moe');
    // Live synthetic sandbox tag, not an evidence-only tag.
    expect(aq.getByText('Live synthetic sandbox')).toBeDefined();
    const note = screen.getByTestId('domain-air_quality-note').textContent ?? '';
    expect(note).toContain('shaped like a chemistry-transport panel');
    expect(note).toContain('not the real CAMS series');
    // Secondary link points at the verified CAMS evidence.
    const evidence = aq.getByTestId('domain-air_quality-evidence');
    expect(evidence.getAttribute('href')).toBe('#/evidence');
  });

  it('every live card carries a quiet evidence link in the same footer slot', () => {
    renderChooser();
    // All three footers now align because each card has an evidence link
    // beneath its primary CTA, pointing at that domain's verified evidence.
    for (const id of ['wind', 'electricity', 'air_quality']) {
      const card = within(screen.getByTestId(`domain-${id}`));
      const evidence = card.getByTestId(`domain-${id}-evidence`);
      // The evidence slot routes to the evidence surface, never into the Market.
      expect(evidence.getAttribute('href')).toBe('#/evidence');
      expect(evidence.getAttribute('href')).not.toContain('market');
      // Neutral wording, no percentage on the card face.
      const text = evidence.textContent ?? '';
      expect(text).toContain('verified');
      expect(text).toMatch(/wind|electricity|CAMS/);
      expect(text).not.toMatch(/%/);
    }
  });

  it('never relabels the synthetic sandbox with a real domain unit', () => {
    renderChooser();
    const text = screen.getByTestId('client-chooser').textContent ?? '';
    // No real units that would imply the live run is the real series.
    expect(text).not.toMatch(/MW\b/);
    expect(text).not.toMatch(/€\/MWh/);
    expect(text).not.toMatch(/µg\/m³/);
    // The unverified CAMS figure is never shown on a card face.
    expect(text).not.toContain('-13.5%');
    // The only verified number named (-7.1%) is framed as living in the
    // evidence, never as a live or loaded value on the card.
    const windNote = screen.getByTestId('domain-wind-note').textContent ?? '';
    if (windNote.includes('-7.1%')) {
      expect(windNote).toContain('in the evidence');
    }
  });
});
