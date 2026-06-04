"""
Regression tests for staking: cap_weight_shares (capped-simplex projection).

For every case we check:
  - sum(m_out) = sum(m_in)  (mass preservation)
  - max_i m_out_i / sum(m_out) <= omega_max  (cap condition)
  - m_out_i >= 0  (non-negativity)
"""
import numpy as np
import pytest

from onlinev2.core.staking import cap_weight_shares


def _check_invariants(m_in: np.ndarray, m_out: np.ndarray, omega_max: float) -> None:
    eps = 1e-10
    total_in = float(np.sum(m_in))
    total_out = float(np.sum(m_out))
    assert abs(total_out - total_in) <= eps, (
        f"mass preservation: sum(m_out)={total_out} != sum(m_in)={total_in}"
    )
    if total_out > eps:
        shares = m_out / total_out
        assert np.all(shares <= omega_max + eps), (
            f"cap: max share {float(np.max(shares))} > omega_max={omega_max}"
        )
    assert np.all(m_out >= -eps), "non-negativity"


@pytest.mark.parametrize("omega_max", [0.25, 0.5, 1.0])
def test_cap_already_within_cap(omega_max: float) -> None:
    """Within cap: shares <= omega_max; output preserves mass and stays within cap."""
    n = 5
    m = np.ones(n, dtype=np.float64) / n  # equal weights, share 1/n each
    if omega_max < 1.0 / n - 1e-12:
        pytest.skip("omega_max < 1/n not feasible")
    m_cap = cap_weight_shares(m, omega_max=omega_max)
    _check_invariants(m, m_cap, omega_max)
    np.testing.assert_allclose(m_cap, m, atol=1e-10)


def test_cap_dominant_trader() -> None:
    """One dominant trader: one mass well above omega_max, rest small; cap should redistribute."""
    omega_max = 0.25
    m = np.array([0.9, 0.02, 0.02, 0.02, 0.04], dtype=np.float64)
    m_cap = cap_weight_shares(m, omega_max=omega_max)
    _check_invariants(m, m_cap, omega_max)
    total = float(m_cap.sum())
    shares = m_cap / total
    assert float(np.max(shares)) <= omega_max + 1e-10
    # Dominant should be at cap
    assert shares[0] >= omega_max - 1e-10


def test_cap_sparse_with_zeros() -> None:
    """Sparse vector with zeros; cap preserves mass and non-negativity."""
    omega_max = 0.25
    m = np.array([0.0, 0.5, 0.0, 0.5, 0.0], dtype=np.float64)
    m_cap = cap_weight_shares(m, omega_max=omega_max)
    _check_invariants(m, m_cap, omega_max)
    # Both active get 0.5 each -> share 0.5 > omega_max, so both at cap 0.25.
    # Remainder 1 - 2*0.25 = 0.5 to the 3 zeros = 1/6 each. Shares: 0.25, 0.25, 1/6, 1/6, 1/6.
    total = float(m_cap.sum())
    assert abs(total - 1.0) <= 1e-10
    shares = m_cap / total
    assert np.all(shares <= omega_max + 1e-10)
    assert np.all(m_cap >= -1e-10)


def test_cap_zero_total() -> None:
    """Zero total mass: return unchanged, sum 0."""
    m = np.zeros(4, dtype=np.float64)
    m_cap = cap_weight_shares(m, omega_max=0.25)
    _check_invariants(m, m_cap, 0.25)
    np.testing.assert_allclose(m_cap, 0.0, atol=1e-12)


def test_cap_omega_max_one() -> None:
    """omega_max >= 1: no capping, output equals input."""
    m = np.array([0.7, 0.2, 0.1], dtype=np.float64)
    m_cap = cap_weight_shares(m, omega_max=1.0)
    _check_invariants(m, m_cap, 1.0)
    np.testing.assert_allclose(m_cap, m, atol=1e-12)
