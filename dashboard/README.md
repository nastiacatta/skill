# Thesis Dashboard

Interactive dashboard for the thesis on **adaptive skill and stake in forecast markets**. The dashboard is the visual companion to the thesis: it explains the research question, walks through how one round of the mechanism works, presents the headline evidence, stress-tests it under adversaries and ablations, and ships an interactive lab + audit-slice diagnostics for reviewers who want to look under the hood.

## Research question

**Can combining stake with an online, time-varying skill layer improve aggregate forecasts under non-stationarity, strategic behaviour, and intermittent participation?**

The thesis extension over Lambert (2008) / Raja–Pinson is the **online skill layer** — σ is updated each round from scoring-rule loss (EWMA with tuned half-life) — gated into the effective wager and aggregation while preserving budget balance and individual rationality on the deterministic core.

## Route structure

The sidebar groups routes into the thesis flow, reference views, and the appendix.

### Thesis flow
| Route | Purpose |
|-------|--------|
| `/` | **Overview.** Research question, why static stake is not enough, Raja vs online extension, how to read the dashboard. |
| `/evidence` | **Evidence.** Headline results: accuracy vs uniform / median / inverse-variance / best-single, the skill lever, deposit policy, calibration, and the Elia external benchmark. Each tab has a one-sentence claim and a chart. |
| `/robustness` | **Robustness.** Behaviour / adversary tabs (arbitrage, sybil, collusion, whitewashing, insiders, wash trading), ablations, sensitivity sweeps, and the failure-mode catalogue. |

### Reference
| Route | Purpose |
|-------|--------|
| `/notes` | **Notes.** Methodology notes, derivations, hyperparameter choices, and the citation-checked bibliography. |
| `/explorer` | **Mechanism explorer.** Step-by-step round walkthrough: Inputs → DGP / private signal → Behaviour → Core mechanism → Results → Next state. |
| `/audit` | **Audit.** Theory-grounding panel and the wager-allocation panel that pin claims to specific JSON / CSV outputs. |

### Appendix
| Route | Purpose |
|-------|--------|
| `/appendix` | **Simulation lab.** Live in-browser pipeline. Tabs: Round replay, Time series, Compare, Validation. Scenario builder lets reviewers sweep DGP / behaviour / γ / λ / η / f / U / seed / N / T. The top bar links directly to `/appendix/figures`, `/appendix/diagnostics`, and `/appendix/experiments`. |
| `/appendix/experiments` | **Cross-scenario comparison.** Core, Behaviour, DGP, Robustness, Ablations. |
| `/appendix/figures` | **Figure gallery.** Diagnostic gallery of presentation-only PNGs (bankroll ablation, weight-rule comparison, scoring validation, master comparison, CRPS calibration, behaviour wealth, selective participation, deposit-policy comparison) plus the supplementary-figure orphans demoted from the thesis body. The dashboard is the canonical home for these figures — the thesis body references them via `\href` rather than `\includegraphics`. |
| `/appendix/diagnostics` | **Audit-slice diagnostics.** T6a / T7 / T8 tables (aggregate CRPS, per-forecaster CRPS, per-quantile coverage) under tuned γ / ρ / λ on the Elia wind audit slice. |

The `/audit` page also gained two live-loaded sections in the latest pass: an **audit-slice configuration** table on the Theory tab (T, warmup, T_eval, n_forecasters, γ, ρ, λ, normalize_mode) and a **hyperparameter provenance** table on the Skill tab (γ / ρ / λ / η / σ_min / κ / f_stake / K_buf / refit period × synthetic / wind / electricity, plus the coarse + local-refinement grid footer).

The `/robustness` Adversarial tab now surfaces the canonical **arbitrage scan** line chart (profit vs gate floor λ with CI ribbon), the **per-1k-rounds attacker-profit table** across eight attack rows, and the **sybil-ε leakage** panel.

The `/evidence` page mounts a new **tail-CRPS panel** (P95 / P99 of per-round CRPS by aggregation rule) ahead of the deposit-sensitivity section, conditioning the headline on the worst 5% of rounds.

### Slides
| Route | Purpose |
|-------|--------|
| `/slides` | **Full-screen presentation mode.** Eight viva slides + appendix backup slides. No sidebar. |

Legacy redirects (so old links still work): `/overview` → `/`, `/results` → `/evidence`, `/behaviour` → `/robustness`, `/mechanism` → `/explorer`, `/walkthrough` → `/explorer`, `/lab` → `/appendix`, `/experiments` → `/appendix/experiments`, `/validation` → `/robustness`, `/presentation` → `/slides`.

## Data loading

- **Source:** the dashboard loads experiment metadata and pre-computed outputs from `public/data/`. There is no Python in the browser; the in-browser `runPipeline` on `/appendix` is a teaching device, not the production simulator.
- **Index:** `public/data/index.json` lists experiments (name, displayName, description, block, dgp, scoringMode, nAgents, rounds, dataFiles). Optional thesis-flow fields: `family`, `thesisTags`, `storyOrder`, `scenarioGroup`.
- **Per-experiment outputs:** under `public/data/<block>/experiments/<name>/` (or `public/data/experiments/<name>/`). Adapters in `src/lib/adapters.ts` fetch CSVs / JSONs at paths derived from the index.
- **Real data:** Elia 2024–2025 Belgian offshore wind (full series + audit slice) lives under `public/data/real_data/elia_wind/`. The operational baseline JSON is the source for `EliaOperationalBaseline.tsx`.
- **Store:** `src/lib/store.tsx` holds the experiment list, selected experiment, block filter, current round, and data mode.

## How to run locally

```bash
cd dashboard
npm install
npm run dev
```

Open the URL shown (typically http://localhost:5173). The app serves from `public/`; data is loaded from `/data/` (i.e. `public/data/`).

### Linking experiment data

If experiment outputs live outside the repo (e.g. Python package outputs), symlink or copy them into `public/data/`:

- `public/data/index.json` — must exist (in repo).
- `public/data/core/`, `public/data/behaviour/`, `public/data/experiments/`, `public/data/real_data/` — per-experiment outputs.

A helper is provided:

```bash
./scripts/link-dashboard-data.sh
```

If no data is present, the app falls back to mock data where configured so navigation still works.

## Build

```bash
cd dashboard
npm run build
```

Output is emitted to `dashboard/dist/`. The build is static — no server-side rendering, no runtime API, no analytics, no third-party CDN beyond the standard Vite asset graph.

## Conventions

- **Palette.** Charts use the canonical tab10-derived ML-research register defined in `src/lib/palette.ts` (`THESIS_PALETTE` token: `proposed #1F77B4` / `postProcessed #FF7F0E` / `external #2CA02C` / `adversary #D62728` / `altRef #9467BD` / `baseline #7F7F7F` / `ink #1F2A38`) and the slide palette in `src/components/slides/shared/presentationConstants.ts` (`PALETTE.navy/teal/coral/purple/slate/imperial/charcoal`). Renderers must import from these modules rather than hard-coding hex values.
- **Loading + error states.** Every async fetch renders a skeleton (`role="status"`, `animate-pulse`) while loading and a visible error block (`role="alert"`) on failure.
- **Page titles.** `App.tsx` sets `document.title = "${label} · Skill × Stake"` per route via `PageTransition`.
- **Accessibility.** All `<img>` tags carry alt text; interactive controls have ARIA labels.
- **Tests.** Vitest runs the audit-content and slide-content checks under `src/__tests__/`.
