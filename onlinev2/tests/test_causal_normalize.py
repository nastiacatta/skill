"""Unit tests for `causal_normalize` — the strictly-causal replacement
for `normalize_series`.

Tests causal_normalize — the strictly-causal replacement for normalize_series (properties 1.1 / 2.1).
"""
# Feature: model-training-testing-audit, Property 1: Bug Condition
from __future__ import annotations

import numpy as np
import pytest

from onlinev2.real_data.runner import (
    PIPELINE_VERSION,
    causal_normalize,
    normalize_series,
)


def test_causal_normalize_matches_legacy_on_warmup_only():
    """On the warmup prefix alone, causal_normalize MUST match the
    whole-series normalize_series applied to that prefix."""
    rng = np.random.default_rng(0)
    series = rng.standard_normal(500)
    warmup = 200
    norm_causal, lo, hi = causal_normalize(series, warmup_len=warmup)
    norm_legacy, lo_legacy, hi_legacy = normalize_series(series[:warmup])
    assert np.allclose(norm_causal[:warmup], norm_legacy, atol=1e-12)
    assert lo == lo_legacy
    assert hi == hi_legacy


def test_causal_normalize_independent_of_future_values():
    """Perturbing series[warmup:] MUST leave norm[:warmup] byte-identical."""
    rng = np.random.default_rng(1)
    series = rng.standard_normal(1_000)
    warmup = 150
    norm_a, _, _ = causal_normalize(series, warmup_len=warmup)
    mutated = series.copy()
    mutated[warmup:] += 42.0  # large perturbation
    norm_b, _, _ = causal_normalize(mutated, warmup_len=warmup)
    assert np.array_equal(norm_a[:warmup], norm_b[:warmup])


def test_causal_normalize_rejects_too_small_warmup():
    series = np.linspace(0, 1, 100)
    with pytest.raises(ValueError, match=r"warmup_len=\d+ must be >= 2"):
        causal_normalize(series, warmup_len=1)
    with pytest.raises(ValueError, match=r"warmup_len=\d+ must be >= 2"):
        causal_normalize(series, warmup_len=0)


def test_causal_normalize_rejects_oversized_warmup():
    series = np.linspace(0, 1, 100)
    with pytest.raises(ValueError, match=r"warmup_len=\d+ exceeds series length"):
        causal_normalize(series, warmup_len=200)


def test_causal_normalize_rejects_nonfinite():
    bad = np.array([0.1, 0.2, np.nan, 0.4, 0.5])
    with pytest.raises(ValueError, match=r"non-finite value"):
        causal_normalize(bad, warmup_len=3)
    bad2 = np.array([0.1, 0.2, np.inf, 0.4, 0.5])
    with pytest.raises(ValueError, match=r"non-finite value"):
        causal_normalize(bad2, warmup_len=3)


def test_causal_normalize_degenerate_constant_warmup():
    """When the warmup window is constant (hi - lo < 1e-12),
    causal_normalize returns 0.5 everywhere without dividing by zero."""
    series = np.concatenate(
        [np.full(50, 0.7, dtype=np.float64), np.linspace(0.7, 0.9, 50)]
    )
    norm, lo, hi = causal_normalize(series, warmup_len=50)
    assert np.all(norm == 0.5)
    assert lo == 0.7
    assert hi == 0.7


def test_pipeline_version_constant_stable():
    """The pipeline_version tag embedded in caches is a stable string
    that downstream ensure_cache() uses to detect stale caches."""
    assert isinstance(PIPELINE_VERSION, str)
    assert len(PIPELINE_VERSION) > 0


# =============================================================================
# Expanding-window variant (post-audit issue #8)
# =============================================================================


def test_causal_normalize_expanding_strict_causality():
    """Expanding variant: norm[t] depends only on series[:t+1]."""
    from onlinev2.real_data.runner import causal_normalize_expanding

    rng = np.random.default_rng(0)
    series = rng.standard_normal(500)
    warmup = 100
    norm_a, _, _ = causal_normalize_expanding(series, warmup_len=warmup)
    # Perturb everything strictly after index t=200; norm[:201] must be invariant.
    mutated = series.copy()
    mutated[201:] += 42.0
    norm_b, _, _ = causal_normalize_expanding(mutated, warmup_len=warmup)
    assert np.array_equal(norm_a[:201], norm_b[:201])


def test_causal_normalize_expanding_no_clipping_on_eval():
    """Expanding variant: no clipping on evaluation rounds because
    cum_min/cum_max expand to include the current observation."""
    from onlinev2.real_data.runner import causal_normalize_expanding

    # Construct series whose evaluation window exceeds warmup range.
    series = np.concatenate([
        np.array([0.0, 0.5, 1.0], dtype=np.float64),  # warmup: range [0, 1]
        np.array([2.0, -1.0, 3.0], dtype=np.float64),  # eval: exceeds both ends
    ])
    norm, lo_t, hi_t = causal_normalize_expanding(series, warmup_len=3)
    # Warmup window: rescaled to [0, 0.5, 1]
    assert np.allclose(norm[:3], [0.0, 0.5, 1.0])
    # Evaluation rounds: each norm[t] sits in [0, 1] because cum_min/max
    # have expanded to include series[t].
    assert 0.0 <= norm[3] <= 1.0
    assert 0.0 <= norm[4] <= 1.0
    # The round where new max arrives has norm == 1.0 exactly.
    # series[5]=3.0 is the cumulative max at index 5, so norm[5] == 1.0.
    assert np.isclose(norm[5], 1.0)
    # The round where new min arrives has norm == 0.0 exactly.
    # series[4]=-1.0 is the cumulative min at index 4.
    assert np.isclose(norm[4], 0.0)


def test_causal_normalize_expanding_matches_static_on_warmup():
    """Before the evaluation window starts, the expanding variant
    produces the same output as the static variant."""
    from onlinev2.real_data.runner import (
        causal_normalize,
        causal_normalize_expanding,
    )

    rng = np.random.default_rng(1)
    series = rng.standard_normal(200)
    warmup = 50
    norm_static, _, _ = causal_normalize(series, warmup_len=warmup)
    norm_expanding, _, _ = causal_normalize_expanding(series, warmup_len=warmup)
    assert np.allclose(norm_static[:warmup], norm_expanding[:warmup])


def test_causal_normalize_expanding_rejects_nonfinite():
    from onlinev2.real_data.runner import causal_normalize_expanding

    bad = np.array([0.1, 0.2, np.nan, 0.4])
    with pytest.raises(ValueError, match=r"non-finite value"):
        causal_normalize_expanding(bad, warmup_len=2)


def test_causal_normalize_expanding_output_in_unit_interval():
    """Output is always in [0, 1] regardless of input distribution."""
    from onlinev2.real_data.runner import causal_normalize_expanding

    rng = np.random.default_rng(7)
    # Heavy-tailed input
    series = rng.standard_cauchy(1000) * 100.0
    norm, _, _ = causal_normalize_expanding(series, warmup_len=50)
    assert np.all(norm >= 0.0) and np.all(norm <= 1.0)
    assert np.all(np.isfinite(norm))
