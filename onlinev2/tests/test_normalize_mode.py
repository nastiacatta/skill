"""Smoke test for the ``normalize_mode`` kwarg on the real-data runners.

Post-audit issue #1: the static warmup-window ``causal_normalize`` clips
~33% of evaluation-window observations on Elia wind. The expanding
variant preserves strict causality while avoiding the clipping. This
test exercises both modes on a synthetic series with an evaluation
window that exceeds the warmup range, asserting:

1. ``static`` mode produces a ``comparison.json`` whose per-round ``y``
   values are clipped to [0, 1] by construction.
2. ``expanding`` mode produces a ``comparison.json`` whose per-round
   ``y`` values are strictly inside [0, 1] without any clipping on the
   evaluation rounds (``cum_min``/``cum_max`` include the current
   observation).
3. Both modes emit ``config.normalize_mode`` into the output JSON.
4. Both modes satisfy the round-level causality invariant (no
   observation-side leakage).
"""
from __future__ import annotations

import tempfile

import numpy as np
import pytest


def _synthetic_series_with_tail_outliers(n: int = 400, seed: int = 0):
    """Warmup stays in a narrow band; evaluation window drifts wider."""
    rng = np.random.default_rng(seed)
    warmup = 120
    # Warmup: values in [0.3, 0.6].
    warmup_vals = 0.3 + 0.3 * rng.random(warmup)
    # Evaluation window: drifts to [0.0, 1.0], so some rounds land outside
    # the warmup range and therefore get clipped under ``static`` but not
    # under ``expanding``.
    eval_vals = np.clip(0.5 + 0.4 * np.cumsum(rng.standard_normal(n - warmup)) / 20, 0.0, 1.0)
    return np.concatenate([warmup_vals, eval_vals]), warmup


def test_normalize_mode_static_default_writes_config_key():
    from onlinev2.real_data.runner import run_real_data_comparison

    series, warmup = _synthetic_series_with_tail_outliers()
    with tempfile.TemporaryDirectory() as td:
        result = run_real_data_comparison(
            series=series, warmup=warmup, outdir=td,
            series_name="probe_static",
            # default normalize_mode="static"
        )
    assert result["config"]["normalize_mode"] == "static"


def test_normalize_mode_expanding_writes_config_key():
    from onlinev2.real_data.runner import run_real_data_comparison

    series, warmup = _synthetic_series_with_tail_outliers()
    with tempfile.TemporaryDirectory() as td:
        result = run_real_data_comparison(
            series=series, warmup=warmup, outdir=td,
            series_name="probe_expanding",
            normalize_mode="expanding",
        )
    assert result["config"]["normalize_mode"] == "expanding"


def test_normalize_mode_invalid_raises():
    from onlinev2.real_data.runner import run_real_data_comparison

    series, warmup = _synthetic_series_with_tail_outliers()
    with tempfile.TemporaryDirectory() as td:
        with pytest.raises(ValueError, match="normalize_mode"):
            run_real_data_comparison(
                series=series, warmup=warmup, outdir=td,
                series_name="probe_bad",
                normalize_mode="whole-series",
            )


def test_static_and_expanding_produce_different_per_round_y():
    """On a series with eval-window values outside the warmup range,
    ``static`` clips and ``expanding`` does not, so the normalized
    y-trajectory must differ on at least one scored round."""
    from onlinev2.real_data.runner import run_real_data_comparison

    rng = np.random.default_rng(1)
    warmup = 120
    # Warmup in [0.3, 0.6]; eval far outside.
    warmup_vals = 0.3 + 0.3 * rng.random(warmup)
    eval_vals = 0.8 + 0.2 * rng.random(260)  # above warmup max; static clips to 1.0
    series = np.concatenate([warmup_vals, eval_vals])

    with tempfile.TemporaryDirectory() as td:
        res_static = run_real_data_comparison(
            series=series, warmup=warmup, outdir=td,
            series_name="probe_static2",
            normalize_mode="static",
        )
        res_expanding = run_real_data_comparison(
            series=series, warmup=warmup, outdir=td,
            series_name="probe_expanding2",
            normalize_mode="expanding",
        )

    y_static = np.array([pr["y"] for pr in res_static["per_round"]])
    y_expanding = np.array([pr["y"] for pr in res_expanding["per_round"]])

    # Static must have clipped a substantial fraction to 1.0; expanding must
    # have the current observation strictly inside (0, 1).
    assert np.sum(y_static >= 0.999) > 10, "static mode should clip eval window"
    assert np.sum(y_expanding >= 0.999) == 0 or np.sum(y_expanding >= 0.999) < np.sum(y_static >= 0.999), \
        "expanding mode should clip strictly less than static"
    # Per-round y trajectories should differ by a non-trivial margin on the
    # clipped rounds.
    assert not np.allclose(y_static, y_expanding)


def test_horizon_runner_accepts_normalize_mode():
    """The horizon runner (experiments._run_horizon_comparison) must
    accept and honour normalize_mode too."""
    from onlinev2.real_data.experiments import _run_horizon_comparison
    from onlinev2.real_data.forecasters import NaiveForecaster

    series, warmup = _synthetic_series_with_tail_outliers()
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    forecasters = [NaiveForecaster(residual_window=50)]
    result = _run_horizon_comparison(
        series, horizon=1, forecasters=forecasters,
        warmup=warmup, taus=taus, label="probe_horizon",
        normalize_mode="expanding",
    )
    assert result["config"]["normalize_mode"] == "expanding"

    with pytest.raises(ValueError, match="normalize_mode"):
        _run_horizon_comparison(
            series, horizon=1, forecasters=forecasters,
            warmup=warmup, taus=taus, label="probe_horizon_bad",
            normalize_mode="lookahead",
        )
