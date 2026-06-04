# Thesis Dashboard: Time-Step Pipeline Plan

## Thesis Context

**Research question:** Can adaptive skill updates improve aggregate forecasts without letting wealthy or strategic agents dominate?

**Foundation:** Extends Lambert's (2008) self-financed weighted-score wagering with Raja–Pinson's one-shot design to the **online setting** (skill learning, deterministic staking). See [Raja et al. 2022](https://pierrepinson.com/wp-content/uploads/2022/02/Rajaetal2022.pdf).

**What the thesis demonstrates:**
1. Online skill learning improves forecast quality vs static weighting
2. Robustness under intermittent and strategic behaviour
3. Trade-off between accuracy and concentration (Gini, N_eff)

---

## Time-Step Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: INPUTS                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │ Rounds (T)  │  │ Agents (n)  │  │ Seed        │  │ Scoring     │                      │
│  └─────────────┘  └─────────────┘  └─────────────┘  │ (MAE/CRPS)  │                      │
│                                                     └─────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: DGP (Data Generating Process)                                                   │
│  ┌─────────────────┐ ┌─────────────────────────────────┐ ┌────────────────────────────┐│
│  │ baseline        │ │ latent_fixed                     │ │ aggregation_method1        ││
│  │ (exogenous)     │ │ (exogenous, Bayes)               │ │ (endogenous, shared AR)    ││
│  └─────────────────┘ └─────────────────────────────────┘ └────────────────────────────┘│
│  ┌─────────────────────────────────┐                                                      │
│  │ aggregation_method3            │  ← Choose one: truth source & signal structure      │
│  │ (endogenous, per-agent shocks) │                                                      │
│  └─────────────────────────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: CORE (Lambert / RAJA mechanism components)                                      │
│                                                                                          │
│  3a. SCORING         s_i = 1 − |y − r_i|  (proper for median, bounded [0,1])             │
│  3b. EFFECTIVE WAGER  m_i = b_i × (λ + (1−λ)σ_i^η)  (skill gate on deposit)               │
│  3c. AGGREGATION     r̂ = Σ m̂_i r_i  (weighted by effective wager, cap ω_max)             │
│  3d. SETTLEMENT      π_i = m_i(1 + s_i − s̄)  (skill pool, zero-sum)                      │
│  3e. SKILL UPDATE    L_i ← EWMA; σ_i = σ_min + (1−σ_min)exp(−γ L_i)                       │
│                                                                                          │
│  Weighting rule: [uniform | deposit | skill | full]  ← choose which weights to use       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: BEHAVIOUR (how agents produce reports & deposits)                               │
│                                                                                          │
│  Participation & timing:  bursty, intermittent, edge-threshold, avoid-skill-decay       │
│  Reporting:              truthful, hedged, strategic, noisy                               │
│  Staking & deposit:      fixed, Kelly-like, house-money, lumpy, break-even              │
│  Adversarial:            sybil, collusion, arbitrageur, manipulator, evader, insider   │
│  Missingness:            intermittent participation, selective absence                  │
│                                                                                          │
│  Choose preset: [baseline | bursty | risk_averse | manipulator | ...]                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: RESULTS                                                                        │
│  Mean error |y−r̂|  ·  Mean participation  ·  N_eff  ·  Final Gini  ·  Round-by-round   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: EXPERIMENTS (other tabs)                                                        │
│  Pre-run experiments: validation, calibration, behaviour_matrix, etc.                   │
│  Each experiment = fixed config + CSV data from Python runs                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Dashboard Structure

### Main view: Time-step pipeline

**Single page:** A horizontal or vertical stepper where the user selects one option per step.

| Step | Component | Options | UI |
|------|-----------|---------|-----|
| 1 | Inputs | Rounds, n, seed, scoring mode | Sliders / inputs |
| 2 | DGP | baseline, latent_fixed, aggregation_method1, aggregation_method3 | Dropdown or cards |
| 3 | Core | Weighting rule + sub-components (expandable) | Dropdown + accordion for Scoring, Effective Wager, Aggregation, Settlement, Skill Update |
| 4 | Behaviour | Behaviour presets | Dropdown or cards |
| 5 | Results | Run → show metrics + charts | Button + results panel |
| 6 | Experiments | Tab bar or sidebar | Tabs: Validation, Experiments, etc. |

### Core sub-components (RAJA / Lambert)

From `onlinev2/core/`:

- **Scoring** – `s_i = 1 − |y − r_i|`, CRPS/MAE
- **Effective wager** – `m_i = b_i × gate(σ_i)` with skill gate
- **Aggregation** – quantile averaging by effective wager weights
- **Settlement** – Lambert skill pool + utility payoff
- **Skill update** – EWMA loss → σ mapping

Each should be selectable/expandable in the Core step for thesis clarity.

### Behaviour categories

From `BEHAVIOUR_COVERAGE.md`:

- **Deposit / staking:** fixed, Kelly-like, house-money, lumpy, break-even
- **Missingness:** intermittent, bursty, selective absence
- **Reporting:** truthful, hedged, strategic, noisy
- **Adversarial:** sybil, collusion, arbitrageur, manipulator, evader, insider

### Experiments tab

- **Validation** – scoring, settlement sanity
- **Experiments** – forecast_aggregation, parameter_sweep, calibration, etc.
- **Behaviour experiments** – behaviour_matrix, intermittency_stress, arbitrage_scan, etc.

Each experiment loads from `data/experiments/<name>/` (CSV, JSON).

---

## Implementation priorities

1. **New pipeline page** – Time-step stepper replacing the current PipelineOverview
2. **Core sub-components** – Expandable sections for Scoring, Effective Wager, Aggregation, Settlement, Skill Update
3. **Experiments tab bar** – Experiments as separate tabs within the same layout
4. **Thesis framing** – Research question and success metrics visible at top

---

## Files to create/modify

| File | Action |
|------|--------|
| `src/pages/PipelineStepper.tsx` | **New** – Main time-step pipeline UI |
| `src/components/dashboard/StepCard.tsx` | **New** – Reusable step card with selection |
| `src/components/dashboard/CoreSubComponents.tsx` | **New** – Expandable Core breakdown |
| `src/components/dashboard/ExperimentsTabBar.tsx` | **New** – Tab bar for experiments |
| `src/App.tsx` | Add route `/pipeline` → PipelineStepper |
| `src/components/dashboard/Sidebar.tsx` | Add "Pipeline" or "Time-step" nav item |
| `src/lib/coreMechanism/runPipeline.ts` | Keep; extend if needed for new options |
