# Skill x Stake: Complete Mechanism Analysis

## 1. What This Thesis Does

This thesis extends the Lambert (2008) self-financed wagering mechanism with an **online skill estimation layer**. The core idea: a group of forecasters submit probabilistic forecasts and put money at risk. The mechanism learns who is good at forecasting and gives them more influence over the combined prediction. Good forecasters earn money; bad ones lose it.

The key research question: **does this adaptive weighting actually produce better forecasts than simply averaging everyone equally?**

**Answer:** Conditionally yes. Under strictly-causal normalisation (training-pipeline audit, May 2026), the mechanism achieves a 7.1% CRPS reduction over equal weighting on the Elia offshore wind slice and is essentially tied with equal weights on Elia electricity prices. Equal weighting is a surprisingly strong baseline, and per-round best_single still outperforms the mechanism on wind. The mechanism's real value lies in its economic properties (budget balance, sybil-proofness, incentive compatibility) plus a conditional forecasting improvement when forecasters are heterogeneous — not raw CRPS dominance.

---

## 2. How the Mechanism Works (Step by Step)

### Round Structure

Each round t follows five steps:

### Step 1: Submit

Each forecaster i submits:
- A **probabilistic forecast**: a set of quantiles q_i(tau) at levels tau = {0.1, 0.2, ..., 0.9}
- A **deposit** b_i (money at risk)

The quantile grid uses 9 equidistant levels (tau = 0.1, 0.2, ..., 0.9), matching `TAUS_FINE` in both the Python core (`onlinev2.core.scoring.TAUS_FINE`) and the dashboard TypeScript (`dgpSimulator.TAUS`). A legacy 5-level grid (0.1, 0.25, 0.5, 0.75, 0.9) exists as `TAUS_COARSE` but is not recommended for new experiments because the non-equidistant spacing reduces CRPS approximation quality.

The deposit can follow different policies:
- **Fixed**: b_i = 1 for all agents (isolates the skill signal)
- **Wealth fraction**: b_i = f * W_i where f ~ 0.18 (creates feedback loop)
- **Sigma-scaled**: b_i = f * W_i * (0.25 + 0.85 * sigma_i) (strongest amplification)

### Step 2: Compute Effective Wager

The mechanism scales each deposit by a **skill gate**:

```
m_i = b_i * g(sigma_i)
```

where the skill gate function is:

```
g(sigma) = lambda + (1 - lambda) * sigma^eta
```

- lambda (lam): floor parameter in [0, 1]. Controls minimum weight for unskilled agents.
  - lambda = 0: unskilled agents get zero effective wager
  - lambda = 1: skill is ignored, all agents weighted by deposit only
- eta: exponent controlling nonlinearity (default 1, linear)
- sigma_i: skill estimate in [sigma_min, 1], learned from past performance

The **refund** is the portion not placed at risk: refund_i = b_i - m_i.

### Step 3: Aggregate

Individual forecasts are combined into a single aggregate using normalised effective wagers as weights:

```
w_i = m_i / sum_j(m_j)
q_hat(tau) = sum_i w_i * q_i(tau)
```

This is a **linear pool**: a weighted average of quantile forecasts. It preserves calibration for central quantiles but can under-disperse in the tails.

### Step 4: Score and Settle

After the outcome y is observed, each forecaster is scored using **CRPS-hat** (finite-grid CRPS approximation):

```
C_hat_i = (2/K) * sum_k pinball(y, q_i(tau_k), tau_k)
```

where pinball loss is:

```
L^tau(y, q) = tau * (y - q)     if y >= q
            = (1 - tau) * (q - y) if y < q
```

The bounded score is: s_i = 1 - C_hat_i / 2, mapping to [0, 1].

**Settlement** follows Lambert's self-financed wagering:

```
pi_i = m_i * (1 + s_i - s_bar)
```

where s_bar = sum_j(m_j * s_j) / sum_j(m_j) is the wager-weighted average score.

This is **budget-balanced by construction**: sum_i(pi_i) = sum_i(m_i). The total payout equals the total effective wager. No external funding is needed.

**Profit** for agent i: profit_i = pi_i - m_i = m_i * (s_i - s_bar).
- If s_i > s_bar: agent beats the weighted average, earns profit
- If s_i < s_bar: agent underperforms, loses money
- If s_i = s_bar: breaks even

### Step 5: Update Skill Estimates

The mechanism updates its belief about each forecaster's quality using **EWMA (Exponentially Weighted Moving Average)**:

**Loss computation:**
```
loss_i = C_hat_i / 2    (normalised to [0, 1])
```

**EWMA update (present agents):**
```
L_i,t = (1 - rho) * L_i,t-1 + rho * loss_i,t
```

**EWMA update (absent agents, if kappa > 0):**
```
L_i,t = (1 - kappa) * L_i,t-1 + kappa * L_0
```

**Loss-to-skill mapping:**
```
sigma_i,t = sigma_min + (1 - sigma_min) * exp(-gamma * L_i,t)
```

Key parameters:
- **rho**: learning rate. Higher = faster adaptation, more noise. Default 0.1 (half-life ~ 7 rounds), tuned to 0.5 for real data.
- **gamma**: sensitivity. Higher = faster skill decay for bad forecasters. Default 4, tuned to 16 for real data.
- **sigma_min**: floor on skill estimate (default 0.1). Prevents complete exclusion.
- **kappa**: missingness decay. If > 0, absent agents' skill decays toward a prior.

---

## 3. Key Parameters and Their Effects

| Parameter | Symbol | Default | Tuned (wind) | Effect |
|-----------|--------|---------|--------------|--------|
| Learning rate | rho | 0.1 | 0.5 | Higher = faster adaptation, more noise |
| Skill sensitivity | gamma | 4 | 16 | Higher = sharper skill differentiation |
| Skill gate floor | lambda | 0.05 | 0.05 | Higher = less skill influence |
| Skill exponent | eta | 1 | 2 | Higher = more nonlinear skill gating (real-data runner hardcodes 2.0) |
| Skill minimum | sigma_min | 0.1 | 0.1 | Floor on skill estimate |
| Dominance cap | omega_max | 1.0 | 1.0 | Maximum weight share per agent |

The tuned parameters (gamma=16, rho=0.5) are much more aggressive than defaults. This makes sense for the wind data: with 17,544 hourly observations and 7 forecasters with stable relative quality, the mechanism benefits from fast, decisive skill differentiation.

---

## 4. The Forecasters (Real Data)

Seven forecasting models are used on Elia offshore wind power data (2024-2025, 17,544 hourly points):

| Model | Description | Quantile Method |
|-------|-------------|-----------------|
| Naive (last value) | y_hat = y_{t-1} | Residual bootstrap |
| EWMA(5) | Exponentially weighted moving average, span=5 | Residual bootstrap |
| ARIMA(2,1,1) | Auto-regressive integrated moving average | Residual bootstrap |
| XGBoost | Gradient boosted trees with lag features | Residual bootstrap |
| Neural Net (MLP) | Multi-layer perceptron with lag features | Residual bootstrap |
| Theta | Theta method (Assimakopoulos & Nikolopoulos 2000) | Residual bootstrap |
| Ensemble (Naive+EWMA) | Average of Naive and EWMA(5) | Residual bootstrap |

All models are **strictly causal**: they only use data up to t-1 to predict t. They are retrained periodically on rolling windows (every 50 steps). Quantiles are generated via residual bootstrap with isotonic monotonicity enforcement.

---

## 5. Empirical Results

### 5.1 Real Data: Elia Wind (Headline Result)

With tuned parameters (gamma=16, rho=0.5, lambda=0.05):

| Method | Mean CRPS | Delta vs Equal | % Improvement |
|--------|-----------|----------------|---------------|
| Equal weighting | 0.0680 | 0.0000 | baseline |
| Skill-only | 0.0479 | -0.0201 | -29.6% |
| **Mechanism (skill x stake)** | **0.0450** | **-0.0229** | **-33.7%** |
| Inverse-variance | 0.0466 | -0.0214 | -31.4% |
| Trimmed mean | 0.0539 | -0.0140 | -20.6% |
| Median | 0.0453 | -0.0227 | -33.4% |
| Best single (Naive) | 0.0363 | -0.0317 | -46.6% |
| Oracle | 0.0340 | -0.0340 | -50.0% |

**Key observations:**
1. The mechanism (-33.7%) narrowly beats median (-33.4%) and inverse-variance (-31.4%)
2. Best single forecaster (Naive) beats all aggregation methods because wind power is highly autocorrelated
3. Oracle (optimal hindsight weights) achieves -50%, showing room for improvement
4. DM test confirms statistical significance: p < 0.001

### 5.2 Real Data: Elia Electricity

With the same tuned parameters on electricity imbalance prices:
- Mechanism improvement: -3.8% (much smaller than wind)
- Electricity prices are more volatile with spikes, making forecasting harder
- The mechanism still helps but the advantage is smaller

### 5.3 Skill Recognition

The mechanism correctly identifies forecaster quality:
- **Naive** gets highest sigma (best forecaster for wind)
- **ARIMA** gets lowest sigma (worst quantile calibration)
- Rank correlation with true quality: rho = 1.000 (perfect)
- Skill estimates converge within ~500 hours

### 5.4 Deposit Policy Sensitivity

Current canonical numbers live in `writing/50_results_synthetic.md §5.1.4`
and are regenerated from
`onlinev2/outputs/core/experiments/deposit_policy_comparison/data/deposit_policy_comparison.csv`
(20 seeds, T = 1000, 6 forecasters, quantile-CRPS scoring, mechanism
weight rule):

| Deposit Policy | Mean CRPS | Δ vs fixed_unit |
|---------------|------------------|-----------|
| iid_exp (random) | 0.04549 | +7.37% |
| fixed_unit (b=1) | 0.04237 | baseline |
| bankroll_conf | 0.03796 | **−10.40%** |
| oracle_precision | 0.02271 | **−46.39%** |

**Insight:** The deposit policy is the key lever. Random deposits carry
no information and lose ground to the fixed baseline. Bankroll +
confidence — using only observable wealth and forecast-width signals —
captures about 22% of the way to the oracle ceiling. Oracle precision
(true τ) is the theoretical ceiling and cannot be accessed in practice.

The earlier "-21% / -15% / -5%" table on this page reflected a
superseded synthetic benchmark (N=10, default γ=4, ρ=0.1, different
deposit regime). Those numbers are retained in git history only.

---

## 6. Mathematical Properties

### 6.1 Budget Balance

The settlement rule is budget-balanced by construction:

```
sum_i pi_i = sum_i m_i * (1 + s_i - s_bar)
           = sum_i m_i + sum_i m_i * s_i - s_bar * sum_i m_i
           = M + M * s_bar - s_bar * M
           = M
```

Total payout = total effective wager. Verified to machine precision (gap < 1e-14).

### 6.2 Sybil-Proofness

Splitting identity provides zero advantage **when clones submit identical reports and conserve total wager**. If agent i splits into two clones (i', i'') with deposits b' + b'' = b_i and the same forecast:
- Both clones get the same score s_i
- Their combined payoff: pi' + pi'' = m' * (1 + s_i - s_bar) + m'' * (1 + s_i - s_bar) = (m' + m'') * (1 + s_i - s_bar) = m_i * (1 + s_i - s_bar) = pi_i

The payoff is identical. No incentive to split.

**Important scope limitation:** This holds only for the narrow case of identical reports and conserved total wager. In practice, sybil clones may submit slightly different reports (due to noise or strategy), which can break the invariance. The dashboard's sybil preset tests this more realistic scenario where clones have small report divergence, not the theoretical invariance property.

### 6.3 Arbitrage behaviour

The single-round arbitrage interval of Chen-Devanur-Pennock-Vaughan (2014) applies to this mechanism. A theory-grounded arbitrage seeker that reports the wager-weighted median of other participants' reports (the MAE analogue of the f-norm arbitrage point) extracts +11 to +24 cumulative profit across the λ grid over 1000 rounds. Profit scales roughly linearly with crowd size. Under sybil splitting (Lambert narrow sense, identical reports, conserved total wager) the arbitrage profit is invariant across k ∈ {1, 3, 5}, confirming Lambert's sybilproofness holds on top of an already-exploited attack. Removing the arbitrage entirely requires moving to the no-arbitrage wagering family (Chen et al. 2014 §4–5), which is outside the scope of this thesis.

---

## 7. Robustness Analysis (18 Behaviour Presets)

> **Note (Nov 2026).** The behaviour adversary catalogue was rebuilt
> around cited threat models (Chen-Devanur-Pennock-Vaughan 2014
> arbitrage, Chun-Shachter 2011 coalition, Lambert 2008 sybilproofness).
> The headline findings below are stable; the detailed quantitative
> tables now live in `onlinev2/outputs/behaviour/experiments/ANALYSIS.md`
> and the thesis chapter `writing/80_robustness.md`. The old 18-preset
> Δ CRPS table is retained as a reference.

### 7.0 Theory-grounded attack results (10–20 seeds, T=1000)

| Attack | Outcome | Source |
|--------|---------|--------|
| Chen-Devanur arbitrage (`ArbitrageSeekingBehaviour`) | Profitable; +11 to +24 across λ grid, monotone in λ | `outputs/.../arbitrage_scan/` |
| Arbitrage × crowd size | Scales roughly linearly with `n_benign`; +50 at (λ=1.0, n=32) | `outputs/.../arbitrage_crowd_size/` |
| Chun-Shachter coalition (`CoordinatedGroupBehaviour`) | +21 (weighted mean), +18 (weighted median) | `outputs/.../collusion_stress/` |
| Informed coalition (coalition + insider) | +34, ≈+40% over pure collusion | `outputs/.../informed_collusion/` |
| Sybil arbitrageur (audit of Lambert sybilproofness) | Profit invariant across k ∈ {1, 3, 5} | `outputs/.../sybil_arbitrage/` |
| Privileged lagged information (AR(1) DGP) | +55 (F_{t-1}-compliant) vs +61 (leakage audit) | `outputs/.../insider_advantage/` |
| Strategic reporting (pull sweep) | Profitable at pull=0.3; self-defeats at pull≥0.6 | `outputs/.../strategic_reporting/` |
| Wash / activity gaming | +68% inflation at near-zero profit (anchor); +113% at −258 profit (split) | `outputs/.../wash_activity_gaming/` |
| Detection-adaptation | Both bankrupted at target=0.2 on uniform y | `outputs/.../detection_adaptation/` |

### 7.1 Legacy 18-preset Δ CRPS table (pre-theory-revamp, retained for reference)

The mechanism was tested against 18 strategic behaviour presets:

### Critical Threats (Delta > 10%)
| Preset | Delta CRPS | Mechanism |
|--------|-----------|-----------|
| Bursty (54% attendance) | +934% | Missing agents = missing information |
| Reputation gamer | +28% | Aggregate anchoring inflates sigma |
| Sandbagger | +22% | Deliberate noise in quantile forecasts |
| Noisy reporter | +18% | Random noise propagates to aggregate |
| Bias | +17% | Persistent directional bias |
| Kelly sizing | +14% | Overconfident staking amplifies errors |
| Miscalibrated | +13% | Overconfidence distorts quantile spread |
| Sybil | +10% | Identity splitting amplifies influence |

### Contained Threats (Delta < 2%)
| Preset | Delta CRPS | Mechanism |
|--------|-----------|-----------|
| Reputation reset | +1.3% | Build-then-exploit detected by EWMA |
| Risk-averse | +1.3% | Hedged reports lose informativeness |
| Manipulator | +1.1% | Point-forecast manipulation contained |
| Budget-constrained | +0.5% | No ruin in 300 rounds |
| Evader | +0.3% | Stealth evasion slows but doesn't escape EWMA |

### Beneficial
| Preset | Delta CRPS | Mechanism |
|--------|-----------|-----------|
| House-money | -1.1% | Winners get more influence, aligns incentives |
| Latency exploiter | -2.9% | Partial outcome info improves aggregate |

**Key insight:** The mechanism is robust to point-forecast attacks (manipulation, evasion, reputation reset) because the EWMA skill gate detects and downweights them within ~7 rounds. However, quantile-level distortions (bias, noise, reputation gaming) are harder to detect because they affect all quantile levels simultaneously. The dominant vulnerability is **participation**: missing agents directly reduce aggregate quality.

---

## 8. Failure Modes

1. **Small panel (N <= 3):** Estimation noise in sigma dominates true skill differences. The mechanism reduces to a noisier version of equal weighting.

2. **Short horizon (T < 50):** The EWMA has not converged. Skill estimates are still noisy and the mechanism assigns near-equal weights.

3. **Non-stationarity:** When forecaster quality changes abruptly, skill estimates become stale. During re-learning (~50 rounds), equal weighting dominates.

4. **Homogeneous skill:** When all forecasters are equally good, there is no skill signal to exploit. The mechanism adds noise without benefit.

---

## 9. Honest Assessment

### What the mechanism does well:
- Correctly identifies and upweights skilled forecasters (perfect rank correlation on real data)
- Budget-balanced and sybil-proof (narrow Lambert sense) by construction
- Robust to point-forecast manipulation (EWMA detects within ~7 rounds)
- 7.1% CRPS reduction on real wind data; near-tied on electricity (post-audit, strictly-causal)

### What the mechanism does NOT do:
- It does not consistently beat simpler methods (median, inverse-variance) on pure CRPS
- It is **not arbitrage-free**: the Chen-Devanur (2014) arbitrage interval applies to every WSWM, including this one. Theory-grounded arbitrage seekers extract +11 to +24 profit over 1000 rounds. Preventing arbitrage requires moving to the no-arbitrage wagering family (Chen et al. 2014 §4–5), which is outside this thesis's scope.
- It is **not coalition-proof**: Chun-Shachter coalitions earn +18 to +33 over 1000 rounds depending on whether members share privileged information.
- The advantage depends heavily on parameter tuning (gamma, rho)
- The deposit policy is the key lever, and the "right" deposit policy is application-dependent
- Quantile-level attacks (bias, noise) are not well-contained

### The thesis argument:
The mechanism's contribution is not just aggregation accuracy. Simpler methods (median, inverse-variance) can match or beat it on CRPS. The mechanism's value is the **complete economic structure**: it provides incentive-compatible settlement (agents are rewarded for accuracy), budget balance (no external funding), sybil-proofness (splitting identity provides zero advantage), and online adaptivity (learns skill without prior knowledge). No simpler method provides all four properties simultaneously.

---

## 10. Connection to Literature

### Lambert (2008)
The original self-financed wagering mechanism. Agents submit point forecasts and deposits. Settlement is budget-balanced and incentive-compatible. This thesis extends it to:
- Probabilistic (quantile) forecasts instead of point forecasts
- Online skill estimation via EWMA
- Skill-gated effective wagers

### Raja et al. (2024)
Market-for-trading-forecasts wagering mechanism (Raja, Pinson, Kazempour, Grammatico 2024, *International Journal of Forecasting*). Provides a history-free per-round market as the closest related work. This thesis adds:
- The online skill layer (EWMA + exponential mapping)
- Systematic robustness testing (18 behaviour presets)
- Real-data validation on Elia wind and electricity

### Key theoretical properties preserved:
- Budget balance (Lambert 2008, Theorem 1)
- Incentive compatibility for the median (Lambert 2008, Theorem 2)
- Sybil-proofness (Lambert 2008, Proposition 3)

---

## 11. Dashboard Architecture

The dashboard is a React (Vite) application with:

### Pages
- **Home:** Research question, mechanism overview, key findings
- **Evidence (Results):** Real data comparison, accuracy, concentration, calibration, ablation, scientific analysis
- **Robustness (Behaviour):** 11 tabs covering 9 behaviour families, 18 presets
- **Explorer:** Interactive mechanism walkthrough
- **Notes:** Experiments and methodology

### Data Flow
1. Python experiments generate JSON/CSV outputs
2. Dashboard loads data via fetch from `public/data/`
3. In-browser TypeScript mechanism runs demo simulations for fallback
4. Recharts renders all visualisations

### Key Components
- **DeltaBarChart:** Method comparison (CRPS delta vs baseline)
- **TradeOffScatter:** Accuracy vs concentration trade-off
- **WaterfallChart:** Incremental CRPS improvement decomposition
- **ConcentrationPanel:** Gini, HHI, N_eff by method
- **Skill Recognition:** Horizontal bar chart + sigma trajectory

---

## 12. Data Files

| File | Contents |
|------|----------|
| `comparison.json` (wind) | 8 methods, 17,544 rounds, per-round CRPS, skill history, DM tests |
| `comparison.json` (electricity) | Same structure for electricity prices |
| `deposit_sensitivity.json` | Fixed/exponential/bankroll deposit policy comparison |
| `thesis_results.json` | 5 key claims with evidence and limitations |
| `failure_modes.json` | 4 documented failure modes with CRPS deltas |
| `analysis_gaps.json` | 5 analysis gaps (all resolved) |

---

## 13. Reproduction

From repo root:
```bash
cd onlinev2 && pip install -e .
python experiments.py --exp all
cd ../dashboard && npm install && npm run dev
```

Tests:
```bash
cd onlinev2 && pytest tests/           # 334 tests
cd dashboard && npx vitest run         # 126 tests
cd onlinev2 && ruff check .            # Lint
cd dashboard && npx tsc -b             # Type check
```
