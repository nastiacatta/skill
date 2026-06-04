# Behaviour coverage: taxonomy vs dashboard experiments

This checklist groups behaviours by family and marks what is **clearly illustrated** in the dashboard (dedicated, data-backed experiment or panel) vs **taxonomy only** (listed in Behaviour families, no dedicated view) vs **not visibly represented**.

The dashboard has **partial coverage**: the core mechanism and a substantial subset of behaviour experiments are well covered; many finer-grained behaviours are taxonomy-only or missing.

---

## 1. Participation and timing

| Item | Status | Notes |
|------|--------|--------|
| Availability (who can participate) | Taxonomy only | |
| Burstiness (clustered activity) | **Experiment** | Intermittency stress test |
| Deadline effects | Not in dashboard | |
| Selection on edge (participate when confident) | Taxonomy only | |
| Selection on confidence | Not in dashboard | |
| Avoiding skill decay (strategic absence) | Taxonomy only | |
| Task choice | Not in dashboard | |

---

## 2. Information and belief formation

| Item | Status | Notes |
|------|--------|--------|
| Precision of private signal | Taxonomy only | |
| Bias (systematic error) | **Experiment** | `biased` preset — agent adds +0.15 directional bias |
| Miscalibration | **Experiment** | `miscalibrated` preset — overconfident reports pushed away from 0.5 |
| Correlated errors across agents | Not in dashboard | |
| Drift adaptation | **Experiment** | Drift adaptation |
| Costly information | Not in dashboard | |

---

## 3. Reporting strategy

| Item | Status | Notes |
|------|--------|--------|
| Truthful reporting | **Experiment** | Baseline in behaviour matrix, preference stress |
| Noisy reporting | **Experiment** | `noisy_reporter` preset — agent adds σ=0.15 Gaussian noise |
| Hedged reports | **Experiment** | Preference stress (risk-averse) |
| Strategic misreporting | **Experiment** | Strategic reporting |
| Reputation gaming | **Experiment** | `reputation_gamer` preset — anchors to previous aggregate |
| Sandbagging | **Experiment** | `sandbagger` preset — deliberately adds large noise |

---

## 4. Staking and bankroll behaviour

| Item | Status | Notes |
|------|--------|--------|
| Budget constraints | **Experiment** | `budget_constrained` preset — agents stop when wealth < 0.1 |
| Deposits (how much to lock in) | **Experiment** | Stake policy matrix, core effective wager |
| Fixed-fraction, Kelly-like, etc. | **Experiment** | Stake policy matrix |
| Caps, house-money, break-even, lumpy | Taxonomy only / partial | Stake policy matrix touches some |

---

## 5. Objectives and preferences

| Item | Status | Notes |
|------|--------|--------|
| Expected value vs utility over wealth | Taxonomy only | |
| Risk aversion | **Experiment** | Preference stress |
| Externalities | Taxonomy only | |
| Signalling | Taxonomy only | |
| Leaderboard motives | Taxonomy only | |
| Compliance cost | Not in dashboard | |

---

## 6. Identity and account management

| Item | Status | Notes |
|------|--------|--------|
| Single identity | **Experiment** | Baseline in identity attack matrix |
| Multi-account control | **Experiment** | Identity attack matrix |
| Cap circumvention | Taxonomy only | |
| Reputation reset | **Experiment** | Identity attack matrix |
| Dormancy, reactivation | Taxonomy only | |
| Hidden mapping (real user → accounts) | Taxonomy only | |

---

## 7. Learning and meta-strategy

| Item | Status | Notes |
|------|--------|--------|
| Reinforcement from profits | Taxonomy only | |
| Rule learning | Taxonomy only | |
| Opponent awareness | Not in dashboard | |
| Exploration vs exploitation | Not in dashboard | |

---

## 8. Adversarial and manipulative behaviours

| Item | Status | Notes |
|------|--------|--------|
| Sybils | **Experiment** | Sybil experiment, identity attack matrix |
| Collusion | **Experiment** | Collusion stress |
| Arbitrage | **Experiment** | Arbitrage scan |
| Volume gaming | **Experiment** | Wash activity gaming |
| Evasion | **Experiment** | Detection adaptation (evader) |
| Insider-type selective entry | **Experiment** | Insider advantage |

---

## 9. Operational frictions and data artefacts

| Item | Status | Notes |
|------|--------|--------|
| Latency | Taxonomy only | |
| Missed rounds | **Experiment** | Intermittency stress (bursty, etc.) |
| Interface errors | Taxonomy only | |
| Automation patterns | Taxonomy only | |

---

## Summary

- **Clearly illustrated (data-backed or interactive):** Core mechanism (round contract, effective wager, aggregation, settlement, skill update, invariants); core vs behaviour split; behaviour matrix, preference stress, intermittency stress, arbitrage scan, detection adaptation, collusion stress, insider advantage, wash activity gaming, strategic reporting, identity attack matrix, drift adaptation, stake policy matrix; sybil; calibration; parameter sweep; settlement sanity; and related core/experiment runs.
- **Taxonomy only:** Many items above in “Taxonomy only” (e.g. deadline effects, selection on confidence, bias, miscalibration, reputation gaming, sandbagging, signalling, leaderboard motives, dormancy/reactivation, opponent awareness, exploration vs exploitation, latency, interface errors, automation patterns).
- **Not visibly represented:** Deadline effects, selection on confidence, task choice, bias, miscalibration, correlated errors, costly information, shared vs personal mistakes, compliance cost, opponent awareness, exploration vs exploitation, latency, interface errors, automation patterns (as first-class dashboard experiments).

To reach **full coverage** of “all the behaviours described”, each taxonomy item would need either a dedicated dashboard experiment (with data from the Python package) or a dedicated panel that illustrates it.
