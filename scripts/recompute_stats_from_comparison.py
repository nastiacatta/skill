#!/usr/bin/env python3
"""Recompute DM statistics (with Andrews HAC) and bootstrap CIs on the
already-saved per-round CRPS trajectories in ``comparison.json``.

This is the post-hoc fix for issues B1 (legacy DM bandwidth) and C1
(no CI on headline rows) without a multi-hour full re-run of the
17 344-round wind headline. The per-round CRPS values in
``comparison.json`` are the ground-truth trajectories; recomputing
summary statistics from them is strictly additive.

Writes an ``audit_post_hoc.json`` sibling file with the new numbers.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "onlinev2" / "src"))

import numpy as np  # noqa: E402

from onlinev2.real_data.stats import (  # noqa: E402
    BOOTSTRAP_CI_SEED,
    bootstrap_ci,
    diebold_mariano_test,
)


COMPARISON_FILES = [
    REPO_ROOT / "dashboard/public/data/real_data/elia_wind/data/comparison.json",
    REPO_ROOT / "dashboard/public/data/real_data/elia_electricity/data/comparison.json",
]


def _collect_trajectories(comp: dict) -> dict[str, np.ndarray]:
    """Build a dict {method: np.array of per-round CRPS} from per_round."""
    per_round = comp.get("per_round", [])
    if not per_round:
        return {}
    # Discover methods from the first non-empty per-round entry.
    methods = set()
    for entry in per_round:
        for k in entry:
            if k.startswith("crps_"):
                methods.add(k[len("crps_"):])
    traj: dict[str, list[float]] = {m: [] for m in methods}
    for entry in per_round:
        for m in methods:
            v = entry.get(f"crps_{m}", float("nan"))
            traj[m].append(float(v))
    return {m: np.asarray(v, dtype=np.float64) for m, v in traj.items()}


def _recompute_for_series(comp_path: Path) -> dict:
    if not comp_path.exists():
        return {"error": f"{comp_path} not found"}
    comp = json.loads(comp_path.read_text())
    traj = _collect_trajectories(comp)
    if "uniform" not in traj:
        return {"error": "uniform trajectory not found"}

    uniform = traj["uniform"]
    n = int(uniform.size)
    # Block size ≈ one week of hourly resolution, or n/20 if smaller.
    block_size = max(20, min(168, n // 20))

    out: dict = {
        "series_name": comp.get("config", {}).get("series_name"),
        "T_eval": n,
        "block_size": block_size,
        "rules": {},
    }

    for rule, losses in traj.items():
        mask = np.isfinite(losses) & np.isfinite(uniform)
        if mask.sum() < 50:
            continue
        m = losses[mask]
        u = uniform[mask]
        # DM with Andrews auto HAC.
        dm_auto = diebold_mariano_test(u, m, h=1, hac_bandwidth="auto")
        dm_legacy = diebold_mariano_test(u, m, h=1, hac_bandwidth=None)
        # Bootstrap CI on paired delta = mean(method - uniform).
        ci = bootstrap_ci(
            m, u,
            n_bootstrap=1000,
            block_size=block_size,
            alpha=0.05,
            seed=BOOTSTRAP_CI_SEED,
        )
        out["rules"][rule] = {
            "n": int(mask.sum()),
            "mean_crps": float(m.mean()),
            "mean_crps_uniform_aligned": float(u.mean()),
            "delta_crps_vs_uniform": float((m - u).mean()),
            "dm_uniform_vs_method_auto_hac": {
                "statistic": dm_auto["dm_stat"],
                "p_value": dm_auto["p_value"],
                "hac_lag": dm_auto["hac_lag"],
                "hac_mode": dm_auto["hac_bandwidth_mode"],
            },
            "dm_uniform_vs_method_legacy_horizon1": {
                "statistic": dm_legacy["dm_stat"],
                "p_value": dm_legacy["p_value"],
                "hac_lag": dm_legacy["hac_lag"],
            },
            "delta_95pct_bootstrap_ci": {
                "lower": ci["ci_lower"],
                "upper": ci["ci_upper"],
                "se": ci["bootstrap_se"],
            },
        }
    return out


def main() -> int:
    all_out: dict = {}
    for p in COMPARISON_FILES:
        print(f"Processing {p.name} ({p.parent.parent.name}) ...")
        res = _recompute_for_series(p)
        if "error" in res:
            print(f"  SKIP: {res['error']}")
            continue
        out_path = p.parent / "audit_post_hoc.json"
        out_path.write_text(json.dumps(res, indent=2))
        print(f"  wrote {out_path.relative_to(REPO_ROOT)}")
        all_out[p.parent.parent.name] = {"n": res["T_eval"]}

    # Print a headline summary
    print()
    for series, _ in all_out.items():
        out_path = (
            REPO_ROOT / "dashboard/public/data/real_data"
            / series / "data/audit_post_hoc.json"
        )
        data = json.loads(out_path.read_text())
        print(f"=== {series} (T_eval={data['T_eval']}) ===")
        print(f"  block_size = {data['block_size']}")
        for rule in ["mechanism", "skill", "best_single",
                     "per_round_inv_crps_hindsight",
                     "michael_ogd_centered_median_fan",
                     "median", "inverse_variance", "trimmed_mean",
                     "oracle"]:
            r = data["rules"].get(rule)
            if r is None:
                continue
            dm_a = r["dm_uniform_vs_method_auto_hac"]
            dm_l = r["dm_uniform_vs_method_legacy_horizon1"]
            ci = r["delta_95pct_bootstrap_ci"]
            print(
                f"  {rule:<38} Δ={r['delta_crps_vs_uniform']:+.6f}  "
                f"95%CI=[{ci['lower']:+.6f}, {ci['upper']:+.6f}]  "
                f"DM(auto,lag={dm_a['hac_lag']})={dm_a['statistic']:+.2f}  "
                f"DM(legacy)={dm_l['statistic']:+.2f}"
            )
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
