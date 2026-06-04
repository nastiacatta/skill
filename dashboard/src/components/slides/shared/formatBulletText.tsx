import React from 'react';
import { EMPHASIS, PALETTE } from './presentationConstants';

/**
 * Detect and wrap key terms in bullet text with appropriate emphasis styling.
 */

const METHOD_NAMES = /\b(WSWM|EWMA|CRPS|sybilproofness|budget balance|sybilproof)\b/g;
const NUMERIC_PATTERNS = /([−-]?\d+\.?\d*%|[−-]?\d+\.\d{4,}|\d+\s*[×x]\s*10[⁻-]?\d+)/g;

export function formatBulletText(text: string): React.ReactNode {
  // Lines starting with [!] get full warning styling — don't do inline numeric detection
  // which would override the coral colour from bulletStyle
  if (text.trimStart().startsWith('[!]')) {
    return <span style={EMPHASIS.warning}>{text.replace(/\[!\]\s*/g, '')}</span>;
  }

  // Strip [!] markers — visual styling handled by bulletStyle in PresentationPage
  text = text.replace(/\[!\]\s*/g, '');

  // Full-line emphasis for warning lines (▲ or ⚠ or • Warning:) — wrap numerics in coral
  const stripped = text.trimStart().replace(/^[•⚠▲]\s*/, '');
  if (stripped.startsWith('Warning:') || text.trimStart().startsWith('⚠') || text.trimStart().startsWith('▲')) {
    // Wrap any numeric patterns in explicit coral bold spans
    const numericRe = /([−\-~]?\d+\.?\d*%)/g;
    const warningParts: React.ReactNode[] = [];
    let wLastIndex = 0;
    let wMatch: RegExpExecArray | null;
    while ((wMatch = numericRe.exec(text)) !== null) {
      if (wMatch.index > wLastIndex) {
        warningParts.push(text.slice(wLastIndex, wMatch.index));
      }
      warningParts.push(
        <span key={`wn-${wMatch.index}`} style={{ color: PALETTE.coral, fontWeight: 800 }}>
          {wMatch[0]}
        </span>,
      );
      wLastIndex = numericRe.lastIndex;
    }
    if (warningParts.length === 0) return text;
    if (wLastIndex < text.length) {
      warningParts.push(text.slice(wLastIndex));
    }
    return <>{warningParts}</>;
  }

  // Build a combined regex for inline matches
  const combined = new RegExp(
    `(${METHOD_NAMES.source})|(${NUMERIC_PATTERNS.source})`,
    'g',
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];
    if (match[1]) {
      parts.push(
        <span key={`m-${match.index}`} style={EMPHASIS.method}>
          {matched}
        </span>,
      );
    } else {
      parts.push(
        <span key={`n-${match.index}`} style={EMPHASIS.numeric}>
          {matched}
        </span>,
      );
    }
    lastIndex = combined.lastIndex;
  }

  if (parts.length === 0) return text;

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
