"""Regime-shift recovery on the latent-fixed generator.

Experiment F: empirical companion to the EWMA tracking
proposition. The latent-fixed Gaussian panel is run for ``T_PRE`` rounds
under one noise-tier permutation; at the shift round the cohort/noise
mapping is permuted (fresh seed for the new tier-to-cohort map) so the
identities that were strongest become weakest. The mechanism's pooled
CRPS and the uniform-baseline CRPS are tracked round by round across
``N_SEEDS`` independent seeds.

The take-home is the cross-seed median CRPS gap (uniform minus
mechanism) before, around, and after the shift: it should rebuild
within ``O(1/rho)`` rounds plus EWMA settling, recovering the
pre-shift advantage.

Outputs (all written under ``onlinev2/outputs/experiments/F_regime_shift_recovery/``):

- ``per_round.csv``: round-by-round cross-seed median and IQR for
  ``crps_uniform`` and ``crps_mechanism`` (running mean over a 100-round
  window so the trace reads cleanly at print scale).
- ``summary.json``: pre-shift, shift, and post-shift settled means.
- ``config.json``: parameter snapshot for reproducibility.

The driver uses ``run_simulation`` and the latent-fixed quantile
generator only; no edits to ``core/``, ``real_data/``, or ``behaviour/``.
"""
from __future__ import annotations

import json
import pathlib

import numpy as np

from onlinev2.legacy_dgps.latent_fixed import generate_truth_and_quantile_reports_latent
from onlinev2.mechanism.scoring import crps_hat_from_quantiles
from onlinev2.simulation import run_simulation


NU_VALUES = np.array([0.15, 0.22, 0.32, 0.46, 0.68, 1.00], dtype=np.float64)
N = len(NU_VALUES)
TAUS = np.array([0.1, 0.25, 0.5, 0.75, 0.9], dtype=np.float64)
SIGMA_Z = 1.0
SIGMA_MIN = 0.10
GAMMA = 16.0
RHO = 0.5
LAM = 0.3
T_TOTAL = 4000
T_SHIFT = 2000  # noise-tier permutation applied at this round
N_SEEDS = 20
WINDOW = 100  # rolling window for display
WARM = 200


def _build_quantile_panel(seed: int, perm: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Latent-fixed quantile panel with optional cohort-to-tier permutation."""
    tau_i = NU_VALUES if perm is None else NU_VALUES[perm]
    y, q_reports, _ = generate_truth_and_quantile_reports_latent(
        T=T_TOTAL,
        n=N,
        tau_i=tau_i,
        taus=TAUS,
        seed=seed,
        sigma_z=SIGMA_Z,
    )
    return y, q_reports


def _stitched_panel(seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Stitch a pre-shift and a post-shift panel at ``T_SHIFT``.

    Pre-shift: cohorts ordered low to high noise (identity permutation).
    Post-shift: a single cyclic shift by ``N // 2`` (here, three slots) so
    the strongest identity becomes the weakest. The same Gaussian base
    seed drives both halves; only the cohort-to-tier mapping changes, so
    the latent truth process is continuous and only the per-cohort
    posterior precision swaps.
    """
    rng = np.random.default_rng(seed)
    base_seed_pre = int(rng.integers(0, 2**31 - 1))
    base_seed_post = int(rng.integers(0, 2**31 - 1))
    perm_post = np.roll(np.arange(N), N // 2)

    y_pre, q_pre = _build_quantile_panel(base_seed_pre, perm=None)
    y_post, q_post = _build_quantile_panel(base_seed_post, perm=perm_post)

    y = np.concatenate([y_pre[:T_SHIFT], y_post[T_SHIFT:]])
    q = np.concatenate([q_pre[:, :T_SHIFT, :], q_post[:, T_SHIFT:, :]], axis=1)
    return y, q, perm_post


def _crps_per_round(y: np.ndarray, q_aggregate: np.ndarray) -> np.ndarray:
    """CRPS-hat per round given a (T, K) aggregate-quantile sequence."""
    T = y.size
    crps = np.zeros(T, dtype=np.float64)
    for t in range(T):
        q_row = np.asarray(q_aggregate[t], dtype=np.float64).reshape(1, -1)
        crps[t] = float(crps_hat_from_quantiles(float(y[t]), q_row, TAUS)[0])
    return crps


def _uniform_aggregate(q: np.ndarray) -> np.ndarray:
    """Equal-weight aggregate of cohort quantile reports, (T, K)."""
    return np.mean(q, axis=0)


def _run_one_seed(seed: int) -> dict:
    y, q, perm_post = _stitched_panel(seed)

    res = run_simulation(
        scoring_mode="quantiles_crps",
        taus=TAUS,
        y_pre=y,
        q_reports_pre=q,
        missing_prob=0.0,
        U=0.0,
        deposit_mode="fixed",
        fixed_deposit=1.0,
        store_history=True,
        gamma=GAMMA,
        rho=RHO,
        sigma_min=SIGMA_MIN,
        lam=LAM,
        seed=seed,
    )

    q_mech = np.asarray(res["r_hat_hist"], dtype=np.float64)
    crps_mech = _crps_per_round(y, q_mech)
    crps_unif = _crps_per_round(y, _uniform_aggregate(q))

    return {
        "seed": seed,
        "crps_mechanism": crps_mech,
        "crps_uniform": crps_unif,
        "perm_post": perm_post.tolist(),
        "sigma_hist": res["sigma_hist"],
    }


def _rolling(arr: np.ndarray, w: int) -> np.ndarray:
    n = arr.size
    out = np.empty(n, dtype=np.float64)
    cs = np.cumsum(np.insert(arr.astype(float), 0, 0.0))
    for i in range(n):
        lo = max(0, i - w + 1)
        out[i] = (cs[i + 1] - cs[lo]) / (i + 1 - lo)
    return out


def _outdir() -> pathlib.Path:
    repo = pathlib.Path(__file__).resolve().parents[3]
    out = repo / "outputs" / "experiments" / "F_regime_shift_recovery"
    out.mkdir(parents=True, exist_ok=True)
    return out


def run() -> None:
    seeds = list(range(N_SEEDS))
    all_mech = np.zeros((N_SEEDS, T_TOTAL), dtype=np.float64)
    all_unif = np.zeros((N_SEEDS, T_TOTAL), dtype=np.float64)
    sigma_runs = np.zeros((N_SEEDS, N, T_TOTAL), dtype=np.float64)

    for idx, s in enumerate(seeds):
        out = _run_one_seed(s)
        all_mech[idx] = _rolling(out["crps_mechanism"], WINDOW)
        all_unif[idx] = _rolling(out["crps_uniform"], WINDOW)
        sigma_runs[idx] = out["sigma_hist"]
        print(f"  seed {s} done")

    median_mech = np.median(all_mech, axis=0)
    median_unif = np.median(all_unif, axis=0)
    iqr_mech_lo = np.quantile(all_mech, 0.25, axis=0)
    iqr_mech_hi = np.quantile(all_mech, 0.75, axis=0)
    iqr_unif_lo = np.quantile(all_unif, 0.25, axis=0)
    iqr_unif_hi = np.quantile(all_unif, 0.75, axis=0)

    sigma_median = np.median(sigma_runs, axis=0)

    out_dir = _outdir()

    rounds = np.arange(T_TOTAL)
    csv_path = out_dir / "per_round.csv"
    with csv_path.open("w") as f:
        f.write(
            "round,median_crps_uniform,median_crps_mechanism,"
            "iqr25_crps_uniform,iqr75_crps_uniform,"
            "iqr25_crps_mechanism,iqr75_crps_mechanism\n"
        )
        for t in rounds:
            f.write(
                f"{int(t)},{median_unif[t]:.8f},{median_mech[t]:.8f},"
                f"{iqr_unif_lo[t]:.8f},{iqr_unif_hi[t]:.8f},"
                f"{iqr_mech_lo[t]:.8f},{iqr_mech_hi[t]:.8f}\n"
            )

    sigma_path = out_dir / "sigma_per_round.csv"
    with sigma_path.open("w") as f:
        cols = ",".join(f"sigma_cohort_{i}" for i in range(N))
        f.write(f"round,{cols}\n")
        for t in rounds:
            row = ",".join(f"{sigma_median[i, t]:.8f}" for i in range(N))
            f.write(f"{int(t)},{row}\n")

    pre_window = slice(max(0, T_SHIFT - 500), T_SHIFT)
    post_window = slice(T_SHIFT + 500, T_SHIFT + 1500)
    far_post_window = slice(T_TOTAL - 500, T_TOTAL)

    summary = {
        "config": {
            "T_TOTAL": T_TOTAL,
            "T_SHIFT": T_SHIFT,
            "N_SEEDS": N_SEEDS,
            "WINDOW": WINDOW,
            "GAMMA": GAMMA,
            "RHO": RHO,
            "LAM": LAM,
            "SIGMA_MIN": SIGMA_MIN,
            "SIGMA_Z": SIGMA_Z,
            "NU_VALUES": NU_VALUES.tolist(),
            "TAUS": TAUS.tolist(),
            "WARM": WARM,
        },
        "pre_shift_mean_crps_mechanism": float(np.mean(median_mech[pre_window])),
        "pre_shift_mean_crps_uniform": float(np.mean(median_unif[pre_window])),
        "post_shift_mean_crps_mechanism": float(np.mean(median_mech[post_window])),
        "post_shift_mean_crps_uniform": float(np.mean(median_unif[post_window])),
        "far_post_mean_crps_mechanism": float(np.mean(median_mech[far_post_window])),
        "far_post_mean_crps_uniform": float(np.mean(median_unif[far_post_window])),
        "pre_shift_gap": float(np.mean(median_unif[pre_window] - median_mech[pre_window])),
        "post_shift_gap": float(np.mean(median_unif[post_window] - median_mech[post_window])),
        "far_post_gap": float(np.mean(median_unif[far_post_window] - median_mech[far_post_window])),
    }

    with (out_dir / "summary.json").open("w") as f:
        json.dump(summary, f, indent=2)

    with (out_dir / "config.json").open("w") as f:
        json.dump(summary["config"], f, indent=2)

    print(f"  wrote {csv_path.relative_to(out_dir.parents[3])}")
    print(f"  pre-shift gap (uniform - mechanism) = {summary['pre_shift_gap']:.6f}")
    print(f"  post-shift gap (uniform - mechanism) = {summary['post_shift_gap']:.6f}")
    print(f"  far-post-shift gap (uniform - mechanism) = {summary['far_post_gap']:.6f}")


if __name__ == "__main__":
    run()
