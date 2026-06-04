"""Sub-task 2.5 — grid-search (gamma, rho) for Spearman >= 0.80 on all seeds.

Mirrors the test harness in ``test_spearman_0_80_known_sigma`` so the
selected (gamma, rho) is the one that would pass the PBT.

This is a script, not a pytest test. Run directly:

    cd onlinev2 && python tests/audit/_retune_skill.py
"""
from __future__ import annotations

import sys
import os

_THIS = os.path.dirname(os.path.abspath(__file__))
_TESTS = os.path.abspath(os.path.join(_THIS, os.pardir))
if _TESTS not in sys.path:
    sys.path.insert(0, _TESTS)

import numpy as np
from scipy.stats import spearmanr

from audit import dgps as _dgps
from onlinev2.core.scoring import crps_hat_from_quantiles
from onlinev2.core.skill import loss_to_skill, update_ewma_loss

AUDIT_SEEDS = [0, 1, 2, 42, 2024]
SIGMA_MIN = 0.1

GAMMA_GRID = [0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0]
RHO_GRID = [0.05, 0.1, 0.15, 0.2, 0.3, 0.5]

# Current "defaults" used by the failing PBT: gamma=4.0, rho=0.1.
CURRENT_GAMMA = 4.0
CURRENT_RHO = 0.1


def spearman_for(seed: int, gamma: float, rho: float) -> float:
    panel, y = _dgps.known_sigma_panel(seed=seed, T=2000, N=4)
    taus = _dgps.TAUS_DEFAULT
    N = panel.shape[1]
    L = np.full(N, 0.5, dtype=np.float64)
    alpha = np.zeros(N, dtype=np.int32)
    for t in range(1, panel.shape[0]):
        q_t = panel[t]
        losses = crps_hat_from_quantiles(float(y[t]), q_t, taus) / 2.0
        L = update_ewma_loss(L, losses, alpha, rho=rho, kappa=0.0, L0=0.0)
    sigma = loss_to_skill(L, SIGMA_MIN, gamma)
    truth_rank = -np.arange(N, dtype=float)
    corr, _ = spearmanr(sigma, truth_rank)
    return float(corr)


def main() -> None:
    best = None
    print(f"{'gamma':>6} {'rho':>5} | {'min':>6} {'mean':>6} | seed0 seed1 seed2 seed42 seed2024")
    for gamma in GAMMA_GRID:
        for rho in RHO_GRID:
            seed_corrs = [spearman_for(s, gamma, rho) for s in AUDIT_SEEDS]
            m = min(seed_corrs)
            mu = float(np.mean(seed_corrs))
            line = (
                f"{gamma:6.2f} {rho:5.2f} | {m:6.3f} {mu:6.3f} | "
                + " ".join(f"{c:5.3f}" for c in seed_corrs)
            )
            # Only surface candidates that pass the PBT (strict > not >=).
            passes_all = m > 0.80 + 1e-9
            if passes_all:
                line += "  PASS"
            print(line)
            if passes_all:
                # Tiebreak: smallest deviation from current defaults, weighted
                # 1:10 to favour keeping rho close (prompt guidance).
                distance = (gamma - CURRENT_GAMMA) ** 2 + 10.0 * (rho - CURRENT_RHO) ** 2
                cand = (distance, -m, gamma, rho, seed_corrs)
                if best is None or cand < best:
                    best = cand

    if best is None:
        print("\nNO (gamma, rho) produces min-over-seeds Spearman > 0.80 strictly.")
        # Fall back: pick the one that maximises min.
        print("Falling back to best achievable min Spearman...")
        best_corr = -np.inf
        best_params = None
        for gamma in GAMMA_GRID:
            for rho in RHO_GRID:
                seed_corrs = [spearman_for(s, gamma, rho) for s in AUDIT_SEEDS]
                m = min(seed_corrs)
                if m > best_corr:
                    best_corr = m
                    best_params = (gamma, rho, seed_corrs)
        print(
            f"\nCLOSEST: gamma={best_params[0]}, rho={best_params[1]}, "
            f"min={best_corr:.4f}"
        )
        print(f"per-seed: {best_params[2]}")
        return

    _, _, g, r, corrs = best
    print(
        f"\nRECOMMENDATION: gamma={g}, rho={r} "
        f"(min={-best[1]:.4f}, delta to defaults={best[0]:.4f})"
    )
    print(f"per-seed spearman: {corrs}")


if __name__ == "__main__":
    main()
