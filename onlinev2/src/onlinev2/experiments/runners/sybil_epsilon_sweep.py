"""
Diversified-report sybil leakage ε-sweep.

The narrow Lambert sybil invariance is stated for identical reports
with conserved total wager. In practice an attacker can submit clone
reports that differ by a small amount. This experiment sweeps the
per-clone report-perturbation scale ``ε ∈ {0, 0.005, 0.01, 0.02, 0.05,
0.10}`` for fixed ``k = 3`` clones and measures the mean arbitrage
profit per 1000 rounds. The ε = 0 column reproduces the narrow Lambert
regime and acts as a sanity check; the ε > 0 columns quantify the
empirical leakage of the invariance as the clones diversify.

Output:
    outdir/behaviour/experiments/sybil_epsilon/data/sybil_epsilon.csv
    outdir/behaviour/experiments/sybil_epsilon/data/sybil_epsilon_summary.csv
    outdir/behaviour/experiments/sybil_epsilon/data/sybil_epsilon.json
"""
from __future__ import annotations

import json
from typing import Iterable, List

import numpy as np

from onlinev2.experiments.helpers import exp_paths, write_csv
from onlinev2.experiments.runners.runner_module import _mean_se_ci


DEFAULT_EPS_GRID = (0.0, 0.005, 0.01, 0.02, 0.05, 0.10)


def run_sybil_epsilon(
    eps_grid: Iterable[float] = DEFAULT_EPS_GRID,
    k_accounts: int = 3,
    T: int = 1000,
    n_benign: int = 8,
    seeds: Iterable[int] | None = None,
    outdir: str = "outputs",
    block: str = "behaviour",
):
    from onlinev2.behaviour.adversaries.sybil_arbitrage import SybilArbitrageBehaviour
    from onlinev2.behaviour.composite import CompositeBehaviourModel
    from onlinev2.behaviour.population import build_population
    from onlinev2.behaviour.protocol import RoundPublicState
    from onlinev2.behaviour.traits import UserTraits
    from onlinev2.mechanism.models import MechanismParams, MechanismState
    from onlinev2.mechanism.runner import run_round

    ep = exp_paths(outdir, "sybil_epsilon", block)

    if seeds is None:
        seeds = list(range(10))
    seeds = list(seeds)

    per_seed_rows: List[dict] = []

    for eps in eps_grid:
        for s in seeds:
            rng_s = np.random.default_rng(s)
            y = rng_s.uniform(0.0, 1.0, size=T)

            pop = build_population(n_benign, seed=s)
            parent_traits = UserTraits(
                user_id="sybil_arb",
                initial_wealth=10.0,
                noise_level=0.05,
                stake_fraction=0.4,
            )

            snapshot = {
                "p_others": np.array([0.4, 0.6]),
                "m_others": np.array([0.5, 0.5]),
            }

            def target_others(_state, snap=snapshot):
                return np.asarray(snap["p_others"]), np.asarray(snap["m_others"])

            adv = SybilArbitrageBehaviour(
                traits=parent_traits,
                k_accounts=k_accounts,
                scoring_mode="point_mae",
                target_others=target_others,
                report_epsilon=float(eps),
                epsilon_rng_seed=1000,
            )
            adv.reset(s)

            behaviour = CompositeBehaviourModel(
                pop,
                adversary_behaviours={"sybil_arb_entry": adv},
                scoring_mode="point_mae",
            )
            behaviour.reset(s)

            params = MechanismParams(scoring_mode="point_mae")
            state = MechanismState()
            for u in pop:
                state.wealth[u.traits.user_id] = u.traits.initial_wealth
            per_wealth = parent_traits.initial_wealth / float(k_accounts)
            for j in range(k_accounts):
                state.wealth[f"{parent_traits.user_id}__sybil_{j}"] = per_wealth

            total_profit = 0.0
            n_eff_ts: list = []
            agg_hist: list = []
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

                p_list, m_list = [], []
                for a in actions:
                    if (
                        a.account_id.startswith(parent_traits.user_id)
                        or not a.participate
                    ):
                        continue
                    p_list.append(
                        float(a.report)
                        if not isinstance(a.report, (list, tuple, np.ndarray))
                        else float(np.asarray(a.report).mean())
                    )
                    m_list.append(max(1e-6, float(a.deposit)))

                state, logs = run_round(
                    state=state, params=params, actions=actions, y_t=float(y[t])
                )
                behaviour.observe_round_result(t=t, y_t=float(y[t]), logs_t=logs)

                if p_list:
                    snapshot["p_others"] = np.asarray(p_list, dtype=float)
                    snapshot["m_others"] = np.asarray(m_list, dtype=float)
                agg_hist.append(logs["r_hat"])
                n_eff_ts.append(logs["N_eff"])

                for i, aid in enumerate(logs["ids"]):
                    if aid.startswith(parent_traits.user_id):
                        total_profit += float(logs["profit"][i])

            per_seed_rows.append(
                {
                    "epsilon": float(eps),
                    "k": k_accounts,
                    "seed": s,
                    "total_arbitrage_profit": total_profit,
                    "mean_n_eff": float(np.mean(n_eff_ts)),
                }
            )

    summary_rows = []
    for eps in eps_grid:
        subset = [r for r in per_seed_rows if abs(r["epsilon"] - float(eps)) < 1e-12]
        stats = _mean_se_ci([r["total_arbitrage_profit"] for r in subset])
        neff = _mean_se_ci([r["mean_n_eff"] for r in subset])
        summary_rows.append(
            {
                "epsilon": float(eps),
                "k": k_accounts,
                "mean_profit": stats["mean"],
                "se_profit": stats["se"],
                "ci_low": stats["ci_low"],
                "ci_high": stats["ci_high"],
                "mean_n_eff": neff["mean"],
                "n_seeds": stats["n"],
            }
        )

    # Profit ratio versus eps = 0 benchmark, which is the narrow Lambert
    # invariance case. Any systematic deviation is the leakage of
    # interest.
    base_profit = next(
        (r["mean_profit"] for r in summary_rows if abs(r["epsilon"]) < 1e-12),
        None,
    )
    for r in summary_rows:
        if base_profit is None or abs(base_profit) < 1e-12:
            r["leakage_vs_narrow"] = np.nan
        else:
            r["leakage_vs_narrow"] = 100.0 * (r["mean_profit"] - base_profit) / abs(
                base_profit
            )

    write_csv(
        ep.data("sybil_epsilon.csv"),
        ["epsilon", "k", "seed", "total_arbitrage_profit", "mean_n_eff"],
        per_seed_rows,
    )
    write_csv(
        ep.data("sybil_epsilon_summary.csv"),
        [
            "epsilon",
            "k",
            "mean_profit",
            "se_profit",
            "ci_low",
            "ci_high",
            "mean_n_eff",
            "leakage_vs_narrow",
            "n_seeds",
        ],
        summary_rows,
    )

    out = {
        "config": {
            "k_accounts": k_accounts,
            "T": T,
            "n_benign": n_benign,
            "eps_grid": list(eps_grid),
            "seeds": seeds,
        },
        "summary": summary_rows,
    }
    with open(ep.data("sybil_epsilon.json"), "w") as f:
        json.dump(out, f, indent=2)

    print("\nSybil-ε leakage sweep")
    print("=" * 50)
    for r in summary_rows:
        leak = (
            f"{r['leakage_vs_narrow']:+.2f}%"
            if np.isfinite(r["leakage_vs_narrow"])
            else "—"
        )
        print(
            f"  ε={r['epsilon']:.3f}: profit={r['mean_profit']:+.2f} ± {r['se_profit']:.2f}"
            f"  (leakage vs ε=0: {leak})"
        )
    print(f"[sybil_epsilon] wrote {ep.data('sybil_epsilon.json')}")
    return out


if __name__ == "__main__":
    run_sybil_epsilon()
