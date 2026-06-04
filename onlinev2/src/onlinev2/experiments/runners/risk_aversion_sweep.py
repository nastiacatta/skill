"""
Risk-aversion sensitivity sweep.

The Lambert truthfulness theorem assumes strict risk-neutrality over
single-round profit. Under risk aversion the optimal report shifts
toward the centre of the distribution, reducing the effective
quantile spread. This experiment sweeps the shared risk-aversion
level ``γ_ra ∈ {0.0, 0.25, 0.5, 1.0, 2.0, 4.0}`` across a ten-user
panel, replaces every user's reporting policy with the shared
``HedgedReporting`` model (the policy that uses ``risk_aversion``
directly), and measures the mechanism's CRPS against a truthful
baseline at each risk-aversion level.

The question answered is how much risk aversion has to rise before
truthful reporting stops being the best response in practice --- a
quantitative companion to the theoretical caveat in
Chapter~\\ref{ch:mechanism}.

Output:
    outdir/behaviour/experiments/risk_aversion/data/risk_aversion.csv
    outdir/behaviour/experiments/risk_aversion/data/risk_aversion.json
"""
from __future__ import annotations

import json
from dataclasses import replace
from typing import Iterable, List

import numpy as np

from onlinev2.experiments.helpers import exp_paths, write_csv
from onlinev2.experiments.runners.runner_module import _mean_se_ci


DEFAULT_RA_GRID = (0.0, 0.25, 0.5, 1.0, 2.0, 4.0)


def run_risk_aversion_sweep(
    risk_aversion_values: Iterable[float] = DEFAULT_RA_GRID,
    T: int = 1000,
    n_users: int = 10,
    seeds: Iterable[int] | None = None,
    outdir: str = "outputs",
    block: str = "behaviour",
):
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.policies.reporting import (
        HedgedReporting,
        TruthfulReporting,
    )
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.core.scoring import TAUS_COARSE, crps_hat_from_quantiles
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = exp_paths(outdir, "risk_aversion", block)
    if seeds is None:
        seeds = list(range(10))
    seeds = list(seeds)
    taus = TAUS_COARSE
    taus_np = np.asarray(taus, dtype=float)

    per_seed_rows: List[dict] = []

    for ra in risk_aversion_values:
        for s in seeds:
            rng_s = np.random.default_rng(s)
            y = rng_s.uniform(0.0, 1.0, size=T)

            for label, reporting in (
                ("truthful", TruthfulReporting()),
                ("hedged", HedgedReporting()),
            ):
                pop = build_population(n_users, seed=s, reporting_policy=reporting)
                # Override risk_aversion on every user so the shared
                # HedgedReporting policy sees the swept value rather
                # than the per-user draw from ``UserTraits.sample``.
                new_users = [
                    type(u)(
                        traits=replace(u.traits, risk_aversion=float(ra)),
                        participation_policy=u.participation_policy,
                        belief_policy=u.belief_policy,
                        reporting_policy=u.reporting_policy,
                        staking_policy=u.staking_policy,
                        identity_policy=u.identity_policy,
                    )
                    for u in pop
                ]
                pop = new_users

                behaviour = CompositeBehaviourModel(
                    pop,
                    scoring_mode="quantiles_crps",
                    taus=taus,
                )
                behaviour.reset(s)

                params = MechanismParams(scoring_mode="quantiles_crps", taus=taus)
                state = MechanismState()
                for u in pop:
                    state.wealth[u.traits.user_id] = u.traits.initial_wealth

                agg_hist: list = []
                crps_series: list = []
                profits: list = []
                for t in range(T):
                    pub = RoundPublicState(
                        t=t,
                        y_history=y[:t].tolist(),
                        agg_history=agg_hist,
                        weights_prev=state.weights_prev,
                        sigma_prev=state.sigma,
                        wealth_prev=state.wealth,
                        profit_prev=state.profit_prev,
                    )
                    actions = behaviour.act(pub)
                    state, logs = run_round(
                        state=state, params=params, actions=actions, y_t=float(y[t])
                    )
                    behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)
                    # Score the aggregate CRPS from the mechanism's r_hat
                    r_hat_q = np.asarray(logs["r_hat"], dtype=float).reshape(1, -1)
                    if r_hat_q.shape[1] != len(taus):
                        # r_hat for point_mae is a scalar; skip
                        continue
                    c = float(crps_hat_from_quantiles(float(y[t]), r_hat_q, taus_np)[0])
                    crps_series.append(c)
                    profits.append(sum(logs["profit"]))
                    agg_hist.append(logs["r_hat"])

                per_seed_rows.append(
                    {
                        "risk_aversion": float(ra),
                        "scenario": label,
                        "seed": s,
                        "mean_crps": float(np.mean(crps_series)) if crps_series else np.nan,
                        "mean_profit": float(np.mean(profits)),
                        "total_profit": float(np.sum(profits)),
                        "final_gini": float(logs["Gini"]),
                    }
                )

    # Aggregate by (ra, scenario).
    summary_rows = []
    for ra in risk_aversion_values:
        for scenario in ("truthful", "hedged"):
            subset = [
                r for r in per_seed_rows
                if abs(r["risk_aversion"] - float(ra)) < 1e-12
                and r["scenario"] == scenario
            ]
            if not subset:
                continue
            crps_stats = _mean_se_ci([r["mean_crps"] for r in subset])
            profit_stats = _mean_se_ci([r["mean_profit"] for r in subset])
            summary_rows.append(
                {
                    "risk_aversion": float(ra),
                    "scenario": scenario,
                    "mean_crps": crps_stats["mean"],
                    "se_crps": crps_stats["se"],
                    "mean_profit": profit_stats["mean"],
                    "n_seeds": crps_stats["n"],
                }
            )

    # Hedged minus truthful CRPS delta at each ra.
    pairs = {}
    for r in summary_rows:
        pairs.setdefault(r["risk_aversion"], {})[r["scenario"]] = r
    for ra, d in pairs.items():
        if "truthful" in d and "hedged" in d:
            d["hedged"]["delta_crps_vs_truthful"] = (
                d["hedged"]["mean_crps"] - d["truthful"]["mean_crps"]
            )
            d["hedged"]["delta_profit_vs_truthful"] = (
                d["hedged"]["mean_profit"] - d["truthful"]["mean_profit"]
            )
            d["truthful"]["delta_crps_vs_truthful"] = 0.0
            d["truthful"]["delta_profit_vs_truthful"] = 0.0

    write_csv(
        ep.data("risk_aversion.csv"),
        [
            "risk_aversion",
            "scenario",
            "seed",
            "mean_crps",
            "mean_profit",
            "total_profit",
            "final_gini",
        ],
        per_seed_rows,
    )
    write_csv(
        ep.data("risk_aversion_summary.csv"),
        [
            "risk_aversion",
            "scenario",
            "mean_crps",
            "se_crps",
            "mean_profit",
            "delta_crps_vs_truthful",
            "delta_profit_vs_truthful",
            "n_seeds",
        ],
        summary_rows,
    )

    out = {
        "config": {
            "T": T,
            "n_users": n_users,
            "risk_aversion_grid": list(risk_aversion_values),
            "seeds": seeds,
        },
        "summary": summary_rows,
    }
    with open(ep.data("risk_aversion.json"), "w") as f:
        json.dump(out, f, indent=2)

    print("\nRisk-aversion sweep")
    print("=" * 60)
    print(f"{'γ_ra':>5} {'scenario':>10} {'mean_crps':>12} {'Δcrps':>10} {'Δprofit':>10}")
    for r in summary_rows:
        dc = r.get("delta_crps_vs_truthful", 0.0)
        dp = r.get("delta_profit_vs_truthful", 0.0)
        print(
            f"{r['risk_aversion']:>5.2f} {r['scenario']:>10} "
            f"{r['mean_crps']:>12.5f} {dc:>+10.5f} {dp:>+10.3f}"
        )
    print(f"[risk_aversion] wrote {ep.data('risk_aversion.json')}")
    return out


if __name__ == "__main__":
    run_risk_aversion_sweep()
