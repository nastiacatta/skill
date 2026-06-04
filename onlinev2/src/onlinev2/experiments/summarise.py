"""
Auto-written experiment summary: summary.json and summary.md in every experiment folder.
"""
from __future__ import annotations

import json
import math
import os
from typing import Any, Dict, List, Optional, Union

EXPERIMENT_DESCRIPTIONS: Dict[str, str] = {
    "behaviour_matrix": (
        "Holds the mechanism fixed and varies only behaviour modules: benign baselines, "
        "realistic frictions (bursty, wealth shocks, risk aversion, discrete staking), "
        "and adversaries (sybils, arbitrageur, collusion, manipulator, insider)."
    ),
    "preference_stress_test": (
        "Holds signal quality fixed and compares truthful reporting vs hedged risk-averse "
        "reporting to evaluate bias and welfare."
    ),
    "intermittency_stress_test": (
        "Compares IID vs bursty vs edge-threshold vs avoid-skill-decay participation, "
        "and compares missingness handling settings."
    ),
    "arbitrage_scan": (
        "Runs arbitrageurs across a parameter grid to see when arbitrage appears "
        "and whether it dominates wealth."
    ),
    "detection_adaptation": (
        "Compares a fixed manipulator with an adaptive evader that balances manipulation "
        "with detector evasion."
    ),
    "collusion_stress": "Compares no collusion vs collusion group; measures within-group synchrony and impact.",
    "insider_advantage": "Compares no insider vs insider; measures insider profit advantage from privileged information.",
    "wash_activity_gaming": "Compares no wash vs wash trader; measures activity inflation from fake interactions.",
    "strategic_reporting": "Compares truthful vs strategic reporter; measures aggregate forecast impact.",
    "identity_attack_matrix": "Compares single account vs sybil split vs reputation reset vs collusive multi-account.",
    "drift_adaptation": "Compares fast vs slow adaptor to drift in the outcome process.",
    "stake_policy_matrix": "Compares fixed fraction vs Kelly-like vs house-money vs lumpy vs break-even vs volatility-sensitive staking.",
    "settlement_sanity": "Random wagers and scores — verify budget balance, non-negativity, equal-score zero profit.",
    "skill_wager": "How skill and wager evolve with intermittent participation.",
    "forecast_aggregation": "Mechanism | Bankroll-Confidence vs baselines.",
    "calibration": "Quantile reliability curve: empirical coverage vs nominal tau.",
    "parameter_sweep": "Grid over lambda and sigma_min. Heatmaps of CRPS, Gini.",
    "sybil": "Split one agent into k identities — verify Sybil resistance.",
    "scoring_validation": "Point/MAE vs quantiles/CRPS validation.",
    "fixed_deposit": "Fixed deposits — only skill drives wagers and profits.",
    "skill_recovery": "Latent truth + Bayes-consistent forecasters — verify skill recovery.",
    "baseline_dgp": "Visualise the baseline DGP: truth vs reports, noise levels.",
    "latent_fixed_dgp": "Visualise the latent-fixed DGP: shrinkage, calibration, fan charts.",
    "aggregation_dgp": "Diagnostic plots for aggregation DGPs (endogenous truth).",
    "dgp_comparison": "Side-by-side comparison of all distinct DGPs.",
    "weight_rule_comparison": "Compare five weight rules under two deposit policies.",
    "deposit_policy_comparison": "Compare four deposit policies under the Mechanism weight rule.",
    "selective_participation": "Strategic timing of absence vs random absence.",
    "weight_learning_comparison": "Compare weight learning across exogenous and endogenous DGPs.",
    "master_comparison": "All weighting methods (equal, stake-only, skill-only, blended, bankroll) on same panel; paired deltas vs equal.",
    "bankroll_ablation": "Five-step bankroll pipeline: Full vs A- (no confidence), B- (fixed deposit), C- (no skill gate), D- (no cap), E- (freeze wealth).",
}


def _sanitise_value(v: Any) -> Any:
    """Replace NaN/Inf with None for JSON serialisation. Recurse into dicts and lists."""
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if isinstance(v, dict):
        return {k: _sanitise_value(val) for k, val in v.items()}
    if isinstance(v, (list, tuple)):
        return [_sanitise_value(item) for item in v]
    # numpy scalars
    try:
        import numpy as np
        if isinstance(v, (np.floating, np.integer)):
            fv = float(v)
            if math.isnan(fv) or math.isinf(fv):
                return None
            return fv
        if isinstance(v, np.ndarray):
            return _sanitise_value(v.tolist())
    except ImportError:
        pass
    return v


def _metric_with_ci(
    values: List[float],
) -> Dict[str, Optional[float]]:
    """Compute mean, se, ci_low, ci_high from a list of finite values.

    Returns a dict with keys ``mean``, ``se``, ``ci_low``, ``ci_high``.
    Non-finite values are filtered out. If no finite values remain, all fields
    are ``None``.
    """
    import numpy as np

    arr = np.array(values, dtype=np.float64)
    finite = arr[np.isfinite(arr)]
    if finite.size == 0:
        return {"mean": None, "se": None, "ci_low": None, "ci_high": None}
    mean_val = float(np.mean(finite))
    if finite.size > 1:
        se_val = float(np.std(finite, ddof=1) / np.sqrt(finite.size))
    else:
        se_val = 0.0
    return {
        "mean": mean_val,
        "se": se_val,
        "ci_low": mean_val - 1.96 * se_val,
        "ci_high": mean_val + 1.96 * se_val,
    }


def write_experiment_summary(
    paths: Any,
    config: Dict[str, Any],
    logs: Dict[str, Any],
) -> None:
    """Write ``summary.json`` and ``summary.md`` in the experiment folder.

    Parameters
    ----------
    paths
        Object with ``.root`` (experiment root directory).
    config
        Experiment configuration. Expected keys include ``experiment_name``,
        ``dgp_name``, ``T``, ``n_forecasters`` / ``n_users`` / ``n_accounts``,
        ``n_seeds``, ``scoring_mode``, and mechanism parameters.
    logs
        Headline metrics. Values may be single floats or lists of per-seed
        values. When a list is provided, ``mean``, ``se``, ``ci_low``, and
        ``ci_high`` are computed automatically.

    The resulting ``summary.json`` contains:
    - ``mean``, ``se``, ``ci_low``, ``ci_high`` for each headline metric
    - Experiment configuration (DGP name, T, n_forecasters, n_seeds, scoring mode)
    - Valid JSON with all values finite (NaN/Inf replaced with ``null``)
    """
    root = getattr(paths, "root", None)
    if not root:
        return
    os.makedirs(root, exist_ok=True)

    exp_name = config.get("experiment_name", "experiment")
    description = EXPERIMENT_DESCRIPTIONS.get(exp_name, "No description available.")

    # Build headline results with CI where possible
    headline: Dict[str, Any] = {}
    _known_metric_keys = [
        "mean_crps", "mean_mae", "final_rolling_score", "mean_N_t",
        "mean_gap", "mean_HHI", "mean_N_eff", "mean_top1_share",
        "final_gini", "final_ruin_rate", "max_wealth_share",
        "attacker_weight_share", "attacker_cumulative_profit",
        "distortion_vs_baseline",
    ]
    for k in _known_metric_keys:
        if k not in logs:
            continue
        v = logs[k]
        if isinstance(v, (list, tuple)):
            headline[k] = _metric_with_ci(v)
        elif isinstance(v, (int, float)):
            headline[k] = {"mean": v, "se": None, "ci_low": None, "ci_high": None}
        else:
            headline[k] = v

    # Also include any extra keys not in the known list
    for k, v in logs.items():
        if k in _known_metric_keys or k in headline:
            continue
        if isinstance(v, (list, tuple)):
            headline[k] = _metric_with_ci(v)
        elif isinstance(v, (int, float)):
            headline[k] = {"mean": v, "se": None, "ci_low": None, "ci_high": None}
        else:
            headline[k] = v

    # Build experiment configuration block
    experiment_config = {
        "dgp_name": config.get("dgp_name", config.get("experiment_name", "N/A")),
        "T": config.get("T", "N/A"),
        "n_forecasters": config.get(
            "n_forecasters",
            config.get("n_users", config.get("n_accounts", "N/A")),
        ),
        "n_seeds": config.get("n_seeds", config.get("nSeeds", "N/A")),
        "scoring_mode": config.get("scoring_mode", "N/A"),
    }

    summary_dict = {
        "experiment_name": exp_name,
        "description": description,
        "config": experiment_config,
        "full_config": config,
        "headline_results": headline,
    }

    # Sanitise: replace NaN/Inf with None
    summary_dict = _sanitise_value(summary_dict)

    json_path = os.path.join(root, "summary.json")
    with open(json_path, "w") as f:
        json.dump(summary_dict, f, indent=2, default=str)

    # --- Markdown summary ---
    md_lines = [
        "# Experiment summary",
        "",
        "## What this experiment is testing",
        "",
        description,
        "",
        "## Configuration",
        "",
        f"- DGP / setup: {experiment_config['dgp_name']}",
        f"- Rounds: {experiment_config['T']}",
        f"- Forecasters / users: {experiment_config['n_forecasters']}",
        f"- Seeds: {experiment_config['n_seeds']}",
        f"- Scoring mode: {experiment_config['scoring_mode']}",
        f"- Behaviour preset: {config.get('behaviour_preset', 'N/A')}",
        f"- Mechanism: λ={config.get('lam', 'N/A')}, η={config.get('eta', 'N/A')}, σ_min={config.get('sigma_min', 'N/A')}, ω_max={config.get('omega_max', 'N/A')}",
        "",
        "## Headline results (numbers)",
        "",
    ]
    for k, v in headline.items():
        if isinstance(v, dict) and "mean" in v:
            mean_str = f"{v['mean']:.4g}" if v["mean"] is not None else "N/A"
            if v.get("se") is not None and v["se"] > 0:
                md_lines.append(
                    f"- **{k}**: {mean_str} ± {v['se']:.4g} "
                    f"[{v.get('ci_low', 'N/A'):.4g}, {v.get('ci_high', 'N/A'):.4g}]"
                )
            else:
                md_lines.append(f"- **{k}**: {mean_str}")
        elif v is not None and isinstance(v, (int, float)):
            md_lines.append(f"- **{k}**: {v:.4g}")
        else:
            md_lines.append(f"- **{k}**: {v}")
    if not headline:
        md_lines.append("- (No headline metrics collected for this run.)")
    md_lines.extend([
        "",
        "## How to read the plots",
        "",
        "1. **Participation over time**: $N_t$ = number of active accounts per round. Drops indicate missingness.",
        "2. **Gap distribution**: Histogram of time between consecutive participations per account. Bursty behaviour shows larger gaps.",
        "3. **Stake distributions**: Pooled deposits $b_{i,t}$ and effective wagers $m_{i,t}$. Shape indicates staking policy.",
        "4. **Stake as a signal**: Scatter of $m_{i,t}$ vs forecast width. Negative relation suggests confidence-based staking.",
        "5. **Calibration + sharpness**: Empirical coverage of 80% intervals vs nominal; sharpness histogram (narrower = more confident).",
        "6. **Concentration over time**: Top-1/top-5 weight share and HHI / $N^{\\mathrm{eff}}_t$. High concentration means few agents dominate.",
        "7. **Wealth health**: Gini(wealth) and ruin rate over time. High Gini or rising ruin rate indicates inequality or distress.",
        "8. **Arbitrage heatmap** (arbitrage_scan only): $A(\\theta)$ = max_r min_y π(r,y;θ). Positive values indicate arbitrage.",
        "",
    ])

    md_path = os.path.join(root, "summary.md")
    with open(md_path, "w") as f:
        f.write("\n".join(md_lines))
