# Behaviour block

User and adversary behaviour: everything that produces actions for the core.

- **`protocol.py`** — `RoundPublicState`, `AgentAction`, `BehaviourModel` (interface).
- **`traits.py`** — `UserTraits`, population generation.
- **`population.py`** — `UserConfig`, `build_population`.
- **`composite.py`** — `CompositeBehaviourModel` (orchestrates policies).
- **`factory.py`** — `make_behaviour(preset_name, ...)` — single entrypoint.
- **`baselines.py`** — Legacy adapters (exponential, fixed, bankroll deposit).
- **`config/`** — Presets: `get_preset_kwargs`, `PRESET_NAMES`.
- **`policies/`** — Participation, belief, reporting, staking, identity.
- **`adversaries/`** — Theory-grounded attack archetypes; see below.
- **`plotting/`** — `make_behaviour_dashboard` (7 plots + arbitrage heatmap).

**Boundary:** Behaviour gets only `RoundPublicState` (past history, no `y_t`) when choosing actions; it receives `y_t` and logs only in `observe_round_result` after the round.

## Adversary archetypes

Each adversary is grounded in a cited threat model. See the docstrings for
references and the exact theory used.

- **`arbitrage_seeking.py`** — Chen, Devanur, Pennock & Vaughan (EC'14) /
  Chun & Shachter (2011) arbitrage interval. Computes the wager-weighted
  median of other agents' reports (MAE-WSWM analogue of
  `||p_{-i}||_{f,μ}`) and participates iff expected profit under
  `y ~ Uniform[0,1]` is strictly positive. Takes an optional
  `target_others` callback that supplies an F_{t-1} snapshot of other
  agents' reports and effective wagers; falls back to the previous
  aggregate plus a disagreement proxy.
- **`coordinated_group.py`** — Chun-Shachter coalition: members broadcast
  the wager-weighted mean of their private beliefs (or weighted median in
  MAE mode). Strictly raises total coalition payoff when members
  disagree. Members retain individual stakes to keep the detector
  audit honest.
- **`privileged_information.py`** — Insider with an F_{t-1}-measurable
  high-precision signal on `y_{t-k}` (default `k=1`, `σ_priv=0.015`).
  An `allow_leakage=True` guarded mode lets callers deliberately break
  the information boundary to audit leakage detection; a warning is
  raised if `y_sequence` is passed without the flag.
- **`strategic_influence.py`** — Aggregate manipulator. Reports the target
  `μ` directly (optional boundary snap) with stake fraction scaled by
  `manipulation_strength`. Encodes the corner solution of the
  `max m_i (r_i - r_i*) / M_t` utility.
- **`strategic_reporter.py`** — Soft version of `strategic_influence`:
  reports `(1 - pull) * anchor + pull * target`. Trades aggregate shift
  vs scoring-rule loss.
- **`detector_aware.py`** — Adaptive evader. Consumes
  `detector_scores` from `observe_round_result(logs_t)` and enters a
  "quiet" hedging mode when suspicion EWMA exceeds a threshold.
- **`wash_trader.py`** — Linked-account activity gaming. Two styles:
  `"anchor"` (report near the public aggregate so score losses are
  bounded) and `"split_bet"` (maximal internal transfer, large score
  loss but also large activity inflation).
- **`sybil_arbitrage.py`** — Combined sybil + arbitrage attack. Fans
  the :class:`ArbitrageSeekingBehaviour` decision into k linked
  accounts sharing the same report and total stake; used as an
  empirical sybil-proofness audit. Results in `outputs/behaviour/
  experiments/sybil_arbitrage/` show the profit is invariant to k,
  matching the Lambert sybilproofness property.
- **`reputation_reset.py`** — Whitewashing attack (Feldman & Chuang
  2004). An aggressive manipulator that tracks its own cumulative
  profit and, when reputation stock collapses, abandons the current
  ``account_id`` and rejoins under ``account_id__reset_k``. Captures
  the sequential "rent fresh identity" threat on reputation systems;
  empirically cuts the attacker's loss from -20 (fixed identity) to
  -3.5 (whitewashing) over 1000 rounds.

### Experiment summaries and plots

Every multi-seed adversary experiment writes two CSVs under
`outputs/behaviour/experiments/<name>/data/`:

- `<name>.csv` — per-seed rows for paired comparisons.
- `<name>_summary.csv` — mean, SE, 95% CI, n_seeds per scenario.

Adversary-specific plots live under `.../plots/`:
`arbitrage_profit_by_lam.png`, `arbitrage_wealth_trajectories.png`,
`arbitrage_crowd_size.png`, `coalition_profit.png`,
`informed_collusion.png`, `insider_profit.png`, `wash_activity.png`,
`strategic_reporting_frontier.png`, `sybil_arbitrage_profit.png`.

Additional adversary-focused experiments:

- `arbitrage_crowd_size` — 2D sweep (λ, n_benign) showing the attack
  scales roughly linearly with crowd size.
- `informed_collusion` — combines a Chun-Shachter coalition with
  per-member privileged-information signals under an AR(1) DGP.

### Backwards-compatible aliases

The legacy names `ArbitrageurBehaviour`, `ManipulatorBehaviour`,
`AdaptiveEvaderBehaviour`, `InsiderBehaviour`, `CollusionGroupBehaviour`
resolve to the canonical classes above.
