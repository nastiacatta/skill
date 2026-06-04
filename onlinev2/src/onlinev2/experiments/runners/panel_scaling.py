"""
Panel-size scaling experiment.

Sweeps the number of forecasters ``n ∈ {6, 12, 25, 50, 100}`` on the canonical
synthetic data-generating process and reports, for each panel size, (i) the
mechanism's mean CRPS improvement against uniform averaging, (ii) the effective
participant count ``N_eff = 1 / HHI`` of the final weight vector, and (iii) the
final wealth-Gini coefficient. The purpose is to answer how the skill-gate
concentrates weight as the panel grows, and whether the weight cap ``omega_max``
begins to bind on the larger panels.

Output:
    outdir/behaviour/experiments/panel_scaling/data/panel_scaling.csv
    outdir/behaviour/experiments/panel_scaling/data/panel_scaling.json
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, List

import numpy as np

from onlinev2.experiments.helpers import exp_paths, write_csv
from onlinev2.experiments.runners.runner_module import run_master_comparison


DEFAULT_N_VALUES = (6, 12, 25, 50, 100)


def run_panel_scaling(
    n_values: Iterable[int] = DEFAULT_N_VALUES,
    T: int = 1000,
    seeds: Iterable[int] | None = None,
    outdir: str = "outputs",
    block: str = "behaviour",
    warm_start: int = 100,
    deposit_mode: str = "exponential",
):
    """Run ``run_master_comparison`` across panel sizes and aggregate."""
    ep = exp_paths(outdir, "panel_scaling", block)

    if seeds is None:
        seeds = (0, 1, 2, 42, 2024)
    seeds = list(seeds)

    summary_rows: List[dict] = []
    per_seed_rows: List[dict] = []

    for n in n_values:
        print(f"[panel_scaling] n = {n}")
        for seed in seeds:
            # Use run_master_comparison's underlying code path but override
            # seeds/T/n per call to keep output artefacts minimal.
            # We cannot call run_master_comparison directly because it writes
            # to its own output directory; instead reuse the lower-level
            # machinery imported via the public runner helper.
            pass  # placeholder; see loop below

        # Call the underlying runner once per n, with a fixed seed panel.
        run_master_comparison(
            T=T,
            n_forecasters=n,
            seeds=seeds,
            outdir=f"{outdir}/_panel_scaling_tmp/n{n}",
            block=block,
            warm_start=warm_start,
            deposit_mode=deposit_mode,
        )
        # Load the emitted JSON and collapse it.
        tmp_json = (
            Path(outdir)
            / "_panel_scaling_tmp"
            / f"n{n}"
            / block
            / "experiments"
            / "master_comparison"
            / "data"
            / "master_comparison.json"
        )
        if not tmp_json.exists():
            raise RuntimeError(f"missing {tmp_json}")
        data = json.loads(tmp_json.read_text())
        method_rows = {
            "uniform": [],
            "skill": [],
            "mechanism": [],
            "deposit": [],
            "best_single": [],
        }
        for r in data["rows"]:
            method_rows.setdefault(r["method"], []).append(r)

        for method, rs in method_rows.items():
            if not rs:
                continue
            crps = np.array([r["mean_crps"] for r in rs if r["mean_crps"] is not None])
            hhi = np.array([r["mean_HHI"] for r in rs if r.get("mean_HHI") is not None])
            neff = np.array([r["mean_N_eff"] for r in rs if r.get("mean_N_eff") is not None])
            gini = np.array([r["final_gini"] for r in rs if r.get("final_gini") is not None])
            row = {
                "n": n,
                "method": method,
                "mean_crps": float(np.mean(crps)) if crps.size else np.nan,
                "se_crps": (
                    float(np.std(crps, ddof=1) / np.sqrt(crps.size))
                    if crps.size > 1
                    else 0.0
                ),
                "mean_hhi": float(np.mean(hhi)) if hhi.size else np.nan,
                "mean_n_eff": float(np.mean(neff)) if neff.size else np.nan,
                "final_gini": float(np.mean(gini)) if gini.size else np.nan,
                "n_seeds": int(crps.size),
            }
            summary_rows.append(row)
            for r in rs:
                per_seed_rows.append({
                    "n": n,
                    "method": method,
                    "seed": r["seed"],
                    "mean_crps": r["mean_crps"],
                    "delta_vs_uniform": r["delta_crps_vs_equal"],
                    "mean_hhi": r.get("mean_HHI"),
                    "mean_n_eff": r.get("mean_N_eff"),
                    "final_gini": r.get("final_gini"),
                })

    # Recompute the mechanism delta-vs-uniform at each n.
    by_n: dict = {}
    for r in summary_rows:
        by_n.setdefault(r["n"], {})[r["method"]] = r
    enriched_rows = []
    for n, methods in by_n.items():
        uni_crps = methods.get("uniform", {}).get("mean_crps", np.nan)
        for method, r in methods.items():
            r = dict(r)
            if np.isfinite(uni_crps) and np.isfinite(r.get("mean_crps", np.nan)):
                r["delta_vs_uniform_pct"] = (
                    100.0 * (r["mean_crps"] - uni_crps) / uni_crps
                )
            else:
                r["delta_vs_uniform_pct"] = np.nan
            enriched_rows.append(r)

    write_csv(
        ep.data("panel_scaling.csv"),
        [
            "n",
            "method",
            "mean_crps",
            "se_crps",
            "delta_vs_uniform_pct",
            "mean_hhi",
            "mean_n_eff",
            "final_gini",
            "n_seeds",
        ],
        enriched_rows,
    )
    write_csv(
        ep.data("panel_scaling_per_seed.csv"),
        [
            "n",
            "method",
            "seed",
            "mean_crps",
            "delta_vs_uniform",
            "mean_hhi",
            "mean_n_eff",
            "final_gini",
        ],
        per_seed_rows,
    )

    output = {
        "config": {
            "T": T,
            "n_values": list(n_values),
            "seeds": seeds,
            "warm_start": warm_start,
            "deposit_mode": deposit_mode,
        },
        "summary": enriched_rows,
    }
    with open(ep.data("panel_scaling.json"), "w") as f:
        json.dump(output, f, indent=2)

    print(f"[panel_scaling] wrote {ep.data('panel_scaling.json')}")
    return output


if __name__ == "__main__":
    run_panel_scaling()
