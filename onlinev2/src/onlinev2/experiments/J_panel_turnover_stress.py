"""Panel-turnover stress experiment (row J).

Stress-tests the staleness-decay parameter ``kappa`` on a turnover
schedule with one exit at ``T/3`` and one fresh-quality entry on the
latent-fixed Gaussian generator at ``kappa=0.05``, ``rho=0.5``,
``T~=4000``, and 20 seeds. The deliverable reports steady-state
recovery against the no-turnover baseline together with the
magnitude of the transient bump triggered by the entry / exit event.

The driver only consumes the existing ``run_simulation`` harness from
``onlinev2.simulation`` and the latent-fixed generator from
``onlinev2.legacy_dgps``; it does not modify ``core/``,
``real_data/``, or ``behaviour/``. Outputs land under
``onlinev2/outputs/experiments/J_panel_turnover_stress/``.
"""
from __future__ import annotations

import json
import pathlib
from typing import Iterable

import numpy as np

from onlinev2.legacy_dgps import generate_truth_and_quantile_reports_latent
from onlinev2.mechanism.scoring import crps_hat_from_quantiles
from onlinev2.simulation import run_simulation


TAU_BASE = np.array([0.15, 0.22, 0.32, 0.46, 0.68, 1.00], dtype=np.float64)
TAUS_QUANTILES = np.array([0.1, 0.25, 0.5, 0.75, 0.9], dtype=np.float64)


def _outdir() -> pathlib.Path:
    repo = pathlib.Path(__file__).resolve().parents[3]
    out = repo / "outputs" / "experiments" / "J_panel_turnover_stress"
    out.mkdir(parents=True, exist_ok=True)
    return out


def _crps_per_round(y, taus, res):
    """Return the per-round mechanism CRPS using ``res``'s ``r_hat_hist``."""
    T = int(y.size)
    out = np.full(T, np.nan, dtype=np.float64)
    for t in range(T):
        rh = np.asarray(res["r_hat_hist"][t], dtype=np.float64)
        if rh.size == taus.size and np.all(np.isfinite(rh)):
            out[t] = float(
                crps_hat_from_quantiles(float(y[t]), rh.reshape(1, -1), taus)[0]
            )
    return out


def _build_alpha(T, n, exit_round, exit_idx, entry_round, entry_idx):
    """Active-mask schedule. ``alpha=1`` means the forecaster is absent."""
    alpha = np.zeros((n, T), dtype=np.int32)
    if entry_idx is not None:
        alpha[entry_idx, :entry_round] = 1
    if exit_idx is not None:
        alpha[exit_idx, exit_round:] = 1
    return alpha


def run_panel_turnover_stress(
    T: int = 4000,
    seeds: Iterable[int] | None = None,
    kappa: float = 0.05,
    rho: float = 0.5,
    gamma: float = 16.0,
    sigma_min: float = 0.10,
    lam: float = 0.0,
    eta: float = 2.0,
    sigma_z: float = 1.0,
):
    """Run the turnover-vs-baseline panel and write artefacts.

    The panel has six entrants whose noise scales are ``TAU_BASE``.
    Under the turnover arm the highest-noise forecaster (index 5)
    exits at ``round = T // 3`` and a fresh-quality entrant whose
    noise matches the panel-mean noise ``mean(TAU_BASE)`` joins at
    the same round, keeping the active panel size constant. Under
    the baseline arm the same six forecasters participate throughout.
    """
    if seeds is None:
        seeds = list(range(20))
    seeds = list(seeds)
    out_dir = _outdir()

    n_base = TAU_BASE.size
    fresh_tau = float(np.mean(TAU_BASE))

    # Append a seventh forecaster with fresh-quality noise; it sits
    # absent under the no-turnover arm and joins after T/3 under the
    # turnover arm.
    tau_with_entrant = np.concatenate([TAU_BASE, [fresh_tau]])
    n_total = tau_with_entrant.size

    exit_round = T // 3
    exit_idx = int(np.argmax(TAU_BASE))   # the highest-noise incumbent
    entry_idx = n_base                    # the appended fresh-quality slot

    crps_baseline = np.full((len(seeds), T), np.nan, dtype=np.float64)
    crps_turnover = np.full((len(seeds), T), np.nan, dtype=np.float64)

    for si, s in enumerate(seeds):
        # The same DGP draw underlies both arms so the comparison is paired.
        y, q_reports, _ = generate_truth_and_quantile_reports_latent(
            T=T, n=n_total, tau_i=tau_with_entrant,
            taus=TAUS_QUANTILES, seed=s, sigma_z=sigma_z,
        )

        # --- baseline arm: entrant always absent (so panel is the six incumbents) ---
        alpha_base = _build_alpha(T, n_total, T + 1, None, T + 1, entry_idx)
        res_base = run_simulation(
            T=T, n_forecasters=n_total, scoring_mode="quantiles_crps",
            taus=TAUS_QUANTILES, y_pre=y, q_reports_pre=q_reports,
            forecaster_noise_pre=tau_with_entrant,
            alpha_pre=alpha_base,
            seed=int(s),
            store_history=True,
            deposit_mode="fixed", fixed_deposit=1.0,
            lam=float(lam), rho=float(rho), gamma=float(gamma),
            sigma_min=float(sigma_min), kappa=float(kappa), eta=float(eta),
        )
        c_base = _crps_per_round(y, TAUS_QUANTILES, res_base)

        # --- turnover arm: entrant joins at T/3, incumbent exits at T/3 ---
        alpha_turn = _build_alpha(T, n_total, exit_round, exit_idx,
                                  exit_round, entry_idx)
        res_turn = run_simulation(
            T=T, n_forecasters=n_total, scoring_mode="quantiles_crps",
            taus=TAUS_QUANTILES, y_pre=y, q_reports_pre=q_reports,
            forecaster_noise_pre=tau_with_entrant,
            alpha_pre=alpha_turn,
            seed=int(s),
            store_history=True,
            deposit_mode="fixed", fixed_deposit=1.0,
            lam=float(lam), rho=float(rho), gamma=float(gamma),
            sigma_min=float(sigma_min), kappa=float(kappa), eta=float(eta),
        )
        c_turn = _crps_per_round(y, TAUS_QUANTILES, res_turn)

        crps_baseline[si] = c_base
        crps_turnover[si] = c_turn
        print(f"  seed {s} done")

    # --- aggregate cross-seed traces ---
    def _nanmean_axis0(arr):
        return np.array([
            float(np.nanmean(arr[:, t])) if np.any(np.isfinite(arr[:, t])) else np.nan
            for t in range(arr.shape[1])
        ])

    def _nanse_axis0(arr):
        out = np.full(arr.shape[1], np.nan, dtype=np.float64)
        for t in range(arr.shape[1]):
            col = arr[:, t]
            col = col[np.isfinite(col)]
            if col.size > 1:
                out[t] = float(np.std(col, ddof=1) / np.sqrt(col.size))
        return out

    base_mean = _nanmean_axis0(crps_baseline)
    turn_mean = _nanmean_axis0(crps_turnover)
    base_se = _nanse_axis0(crps_baseline)
    turn_se = _nanse_axis0(crps_turnover)

    # Per-round trace.
    csv_path = out_dir / "per_round_traces.csv"
    with csv_path.open("w") as f:
        f.write("round,base_mean_crps,turn_mean_crps,base_se_crps,turn_se_crps,delta_mean_crps\n")
        for t in range(T):
            delta = (
                turn_mean[t] - base_mean[t]
                if np.isfinite(turn_mean[t]) and np.isfinite(base_mean[t])
                else float("nan")
            )
            f.write(
                f"{int(t)},{base_mean[t]:.8f},{turn_mean[t]:.8f},"
                f"{base_se[t]:.8f},{turn_se[t]:.8f},{delta:.8f}\n"
            )

    # Steady-state recovery: tail mean over the last quarter of the run.
    tail_start = (3 * T) // 4
    base_tail = base_mean[tail_start:]
    turn_tail = turn_mean[tail_start:]
    base_tail_finite = base_tail[np.isfinite(base_tail)]
    turn_tail_finite = turn_tail[np.isfinite(turn_tail)]
    base_tail_mean = float(np.mean(base_tail_finite)) if base_tail_finite.size else float("nan")
    turn_tail_mean = float(np.mean(turn_tail_finite)) if turn_tail_finite.size else float("nan")
    if np.isfinite(base_tail_mean) and base_tail_mean > 0 and np.isfinite(turn_tail_mean):
        steady_state_recovery_pct = 100.0 * (turn_tail_mean - base_tail_mean) / base_tail_mean
    else:
        steady_state_recovery_pct = float("nan")

    # Transient-bump magnitude: maximum positive Δ within the entry / exit
    # window of length 5 / rho rounds after the event.
    bump_window = int(round(1.0 / max(rho, 1e-6)))
    bump_window = max(bump_window, 1)
    win_lo = exit_round
    win_hi = min(T, exit_round + 5 * bump_window)
    delta_window = turn_mean[win_lo:win_hi] - base_mean[win_lo:win_hi]
    delta_window = delta_window[np.isfinite(delta_window)]
    if delta_window.size:
        transient_bump_abs = float(np.max(delta_window))
    else:
        transient_bump_abs = float("nan")
    if np.isfinite(base_tail_mean) and base_tail_mean > 0 and np.isfinite(transient_bump_abs):
        transient_bump_pct = 100.0 * transient_bump_abs / base_tail_mean
    else:
        transient_bump_pct = float("nan")

    summary = {
        "config": {
            "T": T,
            "n_panel_active": int(n_base),
            "n_total_slots": int(n_total),
            "tau_base": TAU_BASE.tolist(),
            "fresh_entrant_tau": fresh_tau,
            "exit_round": int(exit_round),
            "exit_idx": int(exit_idx),
            "entry_round": int(exit_round),
            "entry_idx": int(entry_idx),
            "kappa": float(kappa),
            "rho": float(rho),
            "gamma": float(gamma),
            "sigma_min": float(sigma_min),
            "lam": float(lam),
            "eta": float(eta),
            "sigma_z": float(sigma_z),
            "seeds": [int(s) for s in seeds],
            "bump_window_rounds": int(bump_window),
            "bump_window_max_round": int(win_hi),
        },
        "base_tail_crps": base_tail_mean,
        "turnover_tail_crps": turn_tail_mean,
        "steady_state_recovery_pct_vs_baseline": steady_state_recovery_pct,
        "transient_bump_abs_crps": transient_bump_abs,
        "transient_bump_pct_vs_baseline_tail": transient_bump_pct,
    }

    with (out_dir / "summary.json").open("w") as f:
        json.dump(summary, f, indent=2)

    with (out_dir / "config.json").open("w") as f:
        json.dump(summary["config"], f, indent=2)

    # Per-seed traces — useful for later confidence-interval refinement.
    np.savez_compressed(
        out_dir / "per_seed_traces.npz",
        seeds=np.asarray(seeds, dtype=np.int64),
        crps_baseline=crps_baseline,
        crps_turnover=crps_turnover,
    )

    print(
        f"[J_panel_turnover_stress] base_tail={base_tail_mean:.5f}  "
        f"turn_tail={turn_tail_mean:.5f}  "
        f"recovery={steady_state_recovery_pct:.2f}%  "
        f"transient_bump={transient_bump_pct:.2f}% (abs {transient_bump_abs:.5f})"
    )
    print(f"[J_panel_turnover_stress] wrote {csv_path}")
    print(f"[J_panel_turnover_stress] wrote {out_dir / 'summary.json'}")
    return summary


if __name__ == "__main__":
    run_panel_turnover_stress()
