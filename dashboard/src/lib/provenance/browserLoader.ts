/**
 * Browser-side artefact loader for the dev provenance panel.
 *
 * Fetches committed artefacts the same way the dashboard pages do
 * (`${BASE_URL}<file>`), so the panel checks the exact files the visitor flow
 * loads. Draft-pinned claims cannot be checked in the browser (the panel has
 * no access to `src/`), so the panel marks them as draft-pinned and defers to
 * the Node test, which does read the source files.
 */

import type { ArtefactLoader } from './resolve';

export const browserArtefactLoader: ArtefactLoader = async (file) => {
  const url = `${import.meta.env.BASE_URL}${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${file}`);
  return res.text();
};
