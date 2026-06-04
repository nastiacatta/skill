"""Hypothesis composable strategies for the audit suite.

Every strategy draws inputs in the admissible space for the
subsystem it targets (bug conditions A–E). All floats are
``allow_nan=False, allow_infinity=False``.
"""
from __future__ import annotations

import numpy as np
from hypothesis import strategies as st

from . import dgps

# --- Skill-layer (Bug D) ---------------------------------------------------

_POS_FLOAT = st.floats(
    min_value=1e-3, max_value=10.0, allow_nan=False, allow_infinity=False
)


@st.composite
def skill_inputs(draw) -> tuple[np.ndarray, float, float]:
    """(L, σ_min, γ) — admissible loss vector + skill-map params."""
    n = draw(st.integers(min_value=1, max_value=12))
    L = draw(
        st.lists(
            st.floats(0.0, 10.0, allow_nan=False, allow_infinity=False),
            min_size=n,
            max_size=n,
        )
    )
    sigma_min = draw(st.floats(0.01, 0.5, allow_nan=False, allow_infinity=False))
    gamma = draw(st.floats(0.1, 20.0, allow_nan=False, allow_infinity=False))
    return np.asarray(L, dtype=np.float64), float(sigma_min), float(gamma)


# --- Payoff (Bug E) --------------------------------------------------------


@st.composite
def settlement_inputs(draw):
    """(b, σ, scores, α, U) — admissible settlement panel."""
    n = draw(st.integers(min_value=2, max_value=10))
    b = np.asarray(
        draw(
            st.lists(
                st.floats(0.0, 100.0, allow_nan=False, allow_infinity=False),
                min_size=n,
                max_size=n,
            )
        ),
        dtype=np.float64,
    )
    sigma = np.asarray(
        draw(
            st.lists(
                st.floats(0.01, 1.0, allow_nan=False, allow_infinity=False),
                min_size=n,
                max_size=n,
            )
        ),
        dtype=np.float64,
    )
    scores = np.asarray(
        draw(
            st.lists(
                st.floats(0.0, 1.0, allow_nan=False, allow_infinity=False),
                min_size=n,
                max_size=n,
            )
        ),
        dtype=np.float64,
    )
    alpha = np.asarray(
        draw(st.lists(st.integers(0, 1), min_size=n, max_size=n)),
        dtype=np.int32,
    )
    # Ensure at least one active agent
    if alpha.sum() == n:
        alpha[0] = 0
    U = float(
        draw(st.floats(0.0, 10.0, allow_nan=False, allow_infinity=False))
    )
    return b, sigma, scores, alpha, U


# --- Aggregate quality (Bug B) --------------------------------------------


@st.composite
def quantile_panel_strategy(
    draw, N: int = 4, n_taus: int = 9
) -> np.ndarray:
    """(N, K) monotone-per-row quantile panel in [0, 1]."""
    rows = []
    for _ in range(N):
        # Draw K points in [0,1] and sort → monotone row.
        raw = draw(
            st.lists(
                st.floats(0.0, 1.0, allow_nan=False, allow_infinity=False),
                min_size=n_taus,
                max_size=n_taus,
            )
        )
        row = np.sort(np.asarray(raw, dtype=np.float64))
        rows.append(row)
    return np.vstack(rows)


@st.composite
def wager_vector_strategy(
    draw, N: int = 4, allow_zero: bool = True
) -> np.ndarray:
    """(N,) non-negative wager vector."""
    lo = 0.0 if allow_zero else 1e-6
    vals = draw(
        st.lists(
            st.floats(lo, 100.0, allow_nan=False, allow_infinity=False),
            min_size=N,
            max_size=N,
        )
    )
    return np.asarray(vals, dtype=np.float64)


# --- Michael parity (Bug A) -----------------------------------------------


@st.composite
def ar1_panel_strategy(draw, T: int = 300, N: int = 4):
    """Wraps ``dgps.stationary_ar1`` with a hypothesis-drawn seed."""
    seed = draw(st.integers(min_value=0, max_value=10_000))
    phi = draw(st.floats(0.3, 0.9, allow_nan=False, allow_infinity=False))
    panel, y = dgps.stationary_ar1(seed=int(seed), T=T, N=N, phi=float(phi))
    return panel, y, int(seed)
