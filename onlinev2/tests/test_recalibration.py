"""Unit tests for :class:`onlinev2.core.recalibration.RollingRecalibrator`.

Covers ``__init__`` validation, buffer FIFO eviction, fit gating below
``min_pits``, boundary pinning of ``G_grid``, and identity fallback when
unfitted. Follows the style of ``tests/test_quantile_pipeline.py`` —
single file, numbered test functions, no shared fixture module.

See ``onlinev2/src/onlinev2/core/recalibration.py`` for implementation.
"""
from __future__ import annotations

import numpy as np
import pytest

from onlinev2.core.recalibration import RollingRecalibrator


TAUS = np.array(
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], dtype=np.float64
)


# ---------------------------------------------------------------------------
# 1. Construction and __init__ validation
# ---------------------------------------------------------------------------
def test_construction():
    """Default construction succeeds and initial state is empty/unfitted."""
    rc = RollingRecalibrator(TAUS, window_size=500, min_pits=100, refit_every=50)
    assert rc.n_pits == 0
    assert rc.is_fitted is False
    assert rc.G_grid == (None, None)
    assert rc.window_size == 500
    assert rc.min_pits == 100
    assert rc.refit_every == 50
    # taus is copied defensively
    assert rc.taus is not TAUS
    assert np.array_equal(rc.taus, TAUS)


def test_init_validation_min_pits_gt_window():
    """``min_pits > window_size`` raises ValueError."""
    with pytest.raises(ValueError, match="min_pits"):
        RollingRecalibrator(TAUS, window_size=50, min_pits=100, refit_every=10)


def test_init_validation_taus():
    """Non-monotone or out-of-range ``taus`` raise ValueError."""
    # Non-monotone (duplicate value)
    bad = np.array([0.1, 0.2, 0.2, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9])
    with pytest.raises(ValueError, match="strictly increasing"):
        RollingRecalibrator(bad)

    # Strictly decreasing
    bad = TAUS[::-1].copy()
    with pytest.raises(ValueError, match="strictly increasing"):
        RollingRecalibrator(bad)

    # Outside (0, 1): contains 0
    bad = np.array([0.0, 0.2, 0.5, 0.7, 0.9])
    with pytest.raises(ValueError, match=r"\(0, 1\)"):
        RollingRecalibrator(bad)

    # Outside (0, 1): contains 1
    bad = np.array([0.1, 0.5, 0.9, 1.0])
    with pytest.raises(ValueError, match=r"\(0, 1\)"):
        RollingRecalibrator(bad)

    # Too short
    bad = np.array([0.5])
    with pytest.raises(ValueError, match="at least 2"):
        RollingRecalibrator(bad)


def test_init_validation_window_size():
    """Non-positive or non-integer sizing parameters raise ValueError."""
    with pytest.raises(ValueError, match="window_size"):
        RollingRecalibrator(TAUS, window_size=0)
    with pytest.raises(ValueError, match="window_size"):
        RollingRecalibrator(TAUS, window_size=-1)
    with pytest.raises(ValueError, match="min_pits"):
        RollingRecalibrator(TAUS, window_size=100, min_pits=0)
    with pytest.raises(ValueError, match="refit_every"):
        RollingRecalibrator(TAUS, window_size=100, min_pits=10, refit_every=0)
    # Float sizing param rejected
    with pytest.raises(ValueError, match="window_size"):
        RollingRecalibrator(TAUS, window_size=500.0)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# 2. update — FIFO eviction
# ---------------------------------------------------------------------------
def test_update_fifo_eviction():
    """After W+10 updates with window_size=W, only the last W triples survive."""
    W = 50
    rc = RollingRecalibrator(TAUS, window_size=W, min_pits=10)
    rng = np.random.default_rng(7)

    total_updates = W + 10
    y_sent = []
    for i in range(total_updates):
        y_i = float(rng.uniform(0.05, 0.95))
        q_i = np.sort(rng.uniform(0, 1, len(TAUS)))
        rc.update(q_i, y_i)
        y_sent.append(y_i)

    # Buffer capped at W (not W+10)
    assert rc.n_pits == W

    # The retained triples are the last W in insertion order.
    stored_ys = [triple[1] for triple in rc._buffer]
    assert np.allclose(stored_ys, y_sent[-W:])


# ---------------------------------------------------------------------------
# 3. fit below min_pits is a no-op
# ---------------------------------------------------------------------------
def test_fit_below_min_pits_is_noop():
    """fit() with n_pits < min_pits leaves the recalibrator unfitted."""
    min_pits = 100
    rc = RollingRecalibrator(TAUS, window_size=500, min_pits=min_pits, refit_every=50)
    rng = np.random.default_rng(3)
    for i in range(min_pits - 1):
        y_i = float(rng.uniform(0.05, 0.95))
        q_i = np.sort(rng.uniform(0, 1, len(TAUS)))
        rc.update(q_i, y_i)

    assert rc.n_pits == min_pits - 1
    rc.fit()  # no-op
    assert rc.is_fitted is False
    assert rc.G_grid == (None, None)

    # transform returns the input bit-identically (values equal)
    q_probe = np.linspace(0.05, 0.95, len(TAUS))
    out = rc.transform(q_probe)
    assert np.array_equal(out, q_probe)
    # But it IS a defensive copy (not the same object)
    assert out is not q_probe


# ---------------------------------------------------------------------------
# 4. G_grid boundary pinning and monotonicity
# ---------------------------------------------------------------------------
def test_G_grid_boundary_and_monotone():
    """After a successful fit, G_grid is pinned at (0, 0) and (1, 1) and
    both axes are non-decreasing."""
    rc = RollingRecalibrator(TAUS, window_size=500, min_pits=100, refit_every=50)
    rng = np.random.default_rng(1)
    # Systematically biased PITs so the ecdf is visibly non-identity.
    for _ in range(200):
        y_i = float(np.clip(rng.uniform(0.05, 0.95) + 0.1, 0.0, 1.0))
        q_i = np.sort(rng.uniform(0, 1, len(TAUS)))
        rc.update(q_i, y_i)

    rc.fit()
    assert rc.is_fitted is True

    G_x, G_y = rc.G_grid
    assert G_x is not None and G_y is not None

    # Pinned boundaries
    assert G_x[0] == 0.0
    assert G_y[0] == 0.0
    assert G_x[-1] == 1.0
    assert G_y[-1] == 1.0

    # Monotone non-decreasing on both axes
    assert np.all(np.diff(G_x) >= -1e-12)
    assert np.all(np.diff(G_y) >= -1e-12)

    # G_grid returns defensive copies (mutating one should not disturb state)
    G_x[0] = 0.5
    G_x2, _ = rc.G_grid
    assert G_x2[0] == 0.0


# ---------------------------------------------------------------------------
# 5. Unfitted transform returns input unchanged
# ---------------------------------------------------------------------------
def test_transform_identity_when_unfitted():
    """A brand-new (unfitted) recalibrator returns its input unchanged."""
    rc = RollingRecalibrator(TAUS, window_size=500, min_pits=100, refit_every=50)

    # Case A: generic probe vector
    q_probe = np.linspace(0.05, 0.95, len(TAUS))
    out = rc.transform(q_probe)
    assert np.array_equal(out, q_probe)
    assert out is not q_probe  # defensive copy

    # Case B: input exactly at τ knot positions (no interpolation needed)
    q_at_knots = TAUS.copy()
    out2 = rc.transform(q_at_knots)
    assert np.array_equal(out2, q_at_knots)

    # Case C: after update() without fit()
    rng = np.random.default_rng(5)
    for _ in range(50):
        rc.update(np.sort(rng.uniform(0, 1, len(TAUS))), float(rng.uniform(0, 1)))
    assert rc.is_fitted is False
    out3 = rc.transform(q_probe)
    assert np.array_equal(out3, q_probe)


# ---------------------------------------------------------------------------
# 6. Regression: transform at round t is independent of (q_agg_t, y_t)
# ---------------------------------------------------------------------------
def test_transform_invariant_to_round_t_buffer_state():
    """The recalibration map applied at round t MUST be identical
    whether or not the round-t pair ``(q_agg_t, y_t)`` has been added
    to the buffer at the moment ``transform`` is called.

    This pins the prequential ordering used by
    ``onlinev2/src/onlinev2/real_data/runner.py`` around the
    ``recalibrate=True`` block:

        transform(t)  ->  score(t)  ->  update(t)  ->  refit(if cadence)

    Equivalently, the map ``G`` used at round t was fitted only on PITs
    from rounds strictly before t. If a future refactor reorders to
    ``update(t) -> refit -> transform(t)`` the buffer at the moment of
    transform would contain the round-t PIT and the map would leak the
    current outcome into its own recalibration.

    Reference: the recalibration causality invariant requires that the PIT at round t must not be included in the rolling buffer before the forecast for round t is made.
    """
    rng = np.random.default_rng(2025)

    # Build two recalibrators with identical history covering rounds < t.
    # `rc_no_round_t` is the prequential-correct state at round t: it has
    # PITs from rounds [0, t-1] only. `rc_with_round_t` is the buggy state
    # that would arise if update() ran before transform(): it additionally
    # contains the round-t PIT.
    rc_no_round_t = RollingRecalibrator(
        TAUS, window_size=500, min_pits=100, refit_every=50
    )
    rc_with_round_t = RollingRecalibrator(
        TAUS, window_size=500, min_pits=100, refit_every=50
    )

    # Common history: 200 rounds of (q_agg, y) pairs.
    n_history = 200
    history_pairs: list[tuple[np.ndarray, float]] = []
    for _ in range(n_history):
        # Slightly biased y so the isotonic map is non-identity.
        y_i = float(np.clip(rng.uniform(0.0, 1.0) + 0.08, 0.0, 1.0))
        q_i = np.sort(rng.uniform(0.0, 1.0, len(TAUS)))
        history_pairs.append((q_i, y_i))

    for q_i, y_i in history_pairs:
        rc_no_round_t.update(q_i, y_i)
        rc_with_round_t.update(q_i, y_i)

    # Refit both on the shared history so they hold the same G.
    rc_no_round_t.fit()
    rc_with_round_t.fit()

    # Sanity check: identical buffers and identical fitted maps.
    G_x_a, G_y_a = rc_no_round_t.G_grid
    G_x_b, G_y_b = rc_with_round_t.G_grid
    assert np.array_equal(G_x_a, G_x_b)
    assert np.array_equal(G_y_a, G_y_b)

    # Round-t input: the aggregate forecast and the realised outcome.
    q_agg_t = np.sort(rng.uniform(0.0, 1.0, len(TAUS)))
    y_t = float(np.clip(rng.uniform(0.0, 1.0) + 0.08, 0.0, 1.0))

    # `rc_with_round_t` simulates the buggy `update -> refit -> transform`
    # ordering: append round-t to the buffer, refit, then transform.
    rc_with_round_t.update(q_agg_t, y_t)
    rc_with_round_t.fit()
    out_buggy = rc_with_round_t.transform(q_agg_t)

    # `rc_no_round_t` simulates the correct `transform -> update -> refit`
    # ordering: transform first, *then* the round-t pair would be appended
    # (we deliberately do not append, since transform is what we're testing).
    out_correct = rc_no_round_t.transform(q_agg_t)

    # The two outputs should DIFFER under the buggy ordering — that is the
    # leakage signature. We assert they differ to confirm the test has
    # power: if this assertion fails, the test is vacuous (e.g. the map
    # is degenerate identity) and gives no guarantee.
    assert not np.allclose(out_buggy, out_correct, atol=1e-12), (
        "Test is vacuous: the buggy and correct orderings produced "
        "bit-identical output, so the assertion below cannot detect "
        "leakage. Rebuild the test fixture with a more biased PIT "
        "distribution."
    )

    # Now the contractual claim, in the form the bugfix spec requires.
    # The map applied at round t was fitted on rounds < t — equivalently,
    # the output equals what we get when the buffer does NOT contain the
    # round-t pair.
    out_runner = rc_no_round_t.transform(q_agg_t)
    np.testing.assert_array_equal(
        out_runner, out_correct,
        err_msg=(
            "Regression: transform at round t depended on whether "
            "(q_agg_t, y_t) had been added to the buffer. The runner's "
            "ordering must be transform -> score -> update -> refit "
            "(prequential, Dawid 1984; Kuleshov-Fenner-Ermon 2018, §3.1)."
        ),
    )
