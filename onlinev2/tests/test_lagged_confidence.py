import numpy as np

from onlinev2.core.staking import confidence_from_quantiles


def test_lagged_confidence_uses_previous_quantiles():
    """Lagged vs current quantiles produce different confidence values,
    confirming that the lag matters for the deposit decision."""
    taus = np.array([0.1, 0.5, 0.9], dtype=float)

    q_prev = np.array([
        [0.48, 0.50, 0.52],  # narrow -> high confidence
        [0.05, 0.50, 0.95],  # wide  -> low confidence
    ], dtype=float)

    q_curr = np.array([
        [0.05, 0.50, 0.95],  # reversed on purpose
        [0.48, 0.50, 0.52],
    ], dtype=float)

    c_prev = confidence_from_quantiles(q_prev, taus, c_min=0.1, c_max=1.3)
    c_curr = confidence_from_quantiles(q_curr, taus, c_min=0.1, c_max=1.3)

    assert not np.allclose(c_prev, c_curr), (
        "Lagged and current quantiles should produce different confidence values"
    )
    assert c_prev[0] > c_prev[1], (
        "Narrow quantiles (agent 0 in prev) should give higher confidence"
    )
    assert c_curr[0] < c_curr[1], (
        "Wide quantiles (agent 0 in curr) should give lower confidence"
    )
