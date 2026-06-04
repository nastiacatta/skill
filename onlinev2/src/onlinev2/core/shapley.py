"""
Monte Carlo Shapley value approximation for Michael in-sample contributions.
"""

import numpy as np


def shapley_mc(
    present_idx: np.ndarray,
    value_fn,
    n_perm: int = 128,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """
    Shapley value via permutation Monte Carlo. present_idx are indices of
    available agents; value_fn(coalition) returns coalition value for
    coalition = list of indices in order of joining.
    """
    if rng is None:
        rng = np.random.default_rng()

    present_idx = np.asarray(present_idx, dtype=int)
    n_total = int(present_idx.max()) + 1 if present_idx.size else 0
    phi = np.zeros(n_total, dtype=float)

    if present_idx.size == 0:
        return phi

    for _ in range(n_perm):
        perm = rng.permutation(present_idx)
        coalition = []
        v_prev = 0.0
        for i in perm:
            coalition.append(int(i))
            v_new = float(value_fn(coalition))
            phi[i] += v_new - v_prev
            v_prev = v_new

    phi /= n_perm
    return phi
