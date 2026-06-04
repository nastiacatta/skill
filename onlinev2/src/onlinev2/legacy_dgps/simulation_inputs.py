"""Simulation inputs: missingness masks and cash deposits for mvp.run_simulation."""
import numpy as np


def generate_missingness(T, n_forecasters, missing_prob, seed=None):
    rng = np.random.default_rng(seed)

    alpha = (rng.random((n_forecasters, T)) < float(missing_prob)).astype(np.int32)

    for t in range(T):
        if int(alpha[:, t].sum()) == n_forecasters:
            alpha[int(rng.integers(0, n_forecasters)), t] = 0

    return alpha


def generate_cash_deposits(T, n_forecasters, alpha, stake_scale=1.0, seed=None):
    rng = np.random.default_rng(seed)

    deposits = rng.exponential(scale=float(stake_scale), size=(n_forecasters, T)).astype(np.float64)
    deposits[np.asarray(alpha, dtype=np.int32) == 1] = 0.0

    return deposits
