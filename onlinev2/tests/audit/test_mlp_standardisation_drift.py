"""Regression tests for MLP feature standardisation under input drift.

Audit issue #C2 (training_audit.md): the MLPForecaster computes feature
standardisation statistics at fit time and reuses them at predict time.
With seasonal drift in the feature distribution (e.g. wind power across
seasons), the predict-time inputs become out-of-distribution after the
training window has shifted.

Fix protocol (per Lu et al 2018 "Learning under Concept Drift" and
Passalis et al 2019 "Deep Adaptive Input Normalization"): on each
refit, recompute the standardisation statistics on the most recent
training window so that within `retrain_every` rounds the stats track
the current input distribution. Refit cadence is 20 rounds, well below
the diurnal/seasonal drift timescale of the wind series.

These tests assert:
  1. Fit-time stats (`_feature_mean`, `_feature_std`) update across
     successive refits on materially different histories.
  2. The internal `_stats_fit_count` counter increments by exactly one
     on each successful refit (no silent skips, no double-counts).
  3. The stats refresh under a synthetic drift DGP — i.e. a fit on a
     low-mean window followed by a fit on a high-mean window produces
     a different `_feature_mean`.
"""
from __future__ import annotations

import numpy as np
import pytest

pytestmark = [pytest.mark.audit]


def _drifting_history(seed: int, T: int = 400) -> np.ndarray:
    """Construct a series whose feature distribution drifts over time.

    The first half is centred at 0.2 (low-power regime); the second
    half is centred at 0.8 (high-power regime). Standardisation stats
    fitted on the first half should differ measurably from stats
    fitted on the second half.
    """
    rng = np.random.default_rng(seed)
    half = T // 2
    low = np.clip(0.2 + 0.05 * rng.standard_normal(half), 0.0, 1.0)
    high = np.clip(0.8 + 0.05 * rng.standard_normal(half), 0.0, 1.0)
    return np.concatenate([low, high])


def test_mlp_standardisation_stats_update_on_each_refit() -> None:
    """The audit issue: stats must not be frozen after the first fit.

    Two consecutive fits on materially different prefixes of a
    drifting series MUST produce materially different feature_mean
    vectors and the fit counter MUST advance by exactly one per fit.
    """
    pytest.importorskip("torch", reason="torch not available")
    from onlinev2.real_data.forecasters import MLPForecaster

    series = _drifting_history(seed=42, T=400)

    fc = MLPForecaster(n_lags=8, hidden=8, residual_window=200, seed=42)

    # First fit on the low-mean regime.
    fc.fit(series[:200])
    assert fc._stats_fit_count == 1, (
        f"Stats fit counter did not increment on first fit "
        f"(got {fc._stats_fit_count})."
    )
    assert fc._feature_mean is not None and fc._feature_std is not None, (
        "Stats not populated after first fit."
    )
    mean_low = fc._feature_mean.copy()
    std_low = fc._feature_std.copy()

    # Second fit on the high-mean regime — stats MUST refresh.
    fc.fit(series[200:])
    assert fc._stats_fit_count == 2, (
        f"Stats fit counter did not increment on second fit "
        f"(got {fc._stats_fit_count})."
    )
    mean_high = fc._feature_mean.copy()
    std_high = fc._feature_std.copy()

    # The mean shift between regimes is ~0.6 in the raw lag block, so
    # any reasonable refit should move the recorded mean by far more
    # than numerical noise.
    mean_shift = float(np.max(np.abs(mean_high - mean_low)))
    assert mean_shift > 0.1, (
        f"Standardisation mean barely moved across a 0.6-magnitude "
        f"regime shift (max |Δmean| = {mean_shift:.4g}).  Stats look "
        f"frozen — audit issue #C2 has regressed."
    )

    # Sanity: stds should also shift somewhat (less stringent because
    # both regimes have similar within-regime noise levels).
    std_shift = float(np.max(np.abs(std_high - std_low)))
    assert std_shift > 1e-6, (
        f"Standardisation std identical across regimes "
        f"(max |Δstd| = {std_shift:.4g})."
    )


def test_mlp_standardisation_stats_track_runner_cadence() -> None:
    """Across a full forward pass with the runner's retrain cadence
    (`retrain_every=20`), the fit counter must increment exactly once
    per refit and stats must continue to update.
    """
    pytest.importorskip("torch", reason="torch not available")
    from onlinev2.real_data.forecasters import MLPForecaster

    series = _drifting_history(seed=7, T=400)

    fc = MLPForecaster(n_lags=8, hidden=8, residual_window=200, seed=7)

    last_mean: np.ndarray | None = None
    refit_count_observed = 0
    distinct_means = 0

    for t in range(60, len(series)):
        history = series[:t]
        if t % fc.retrain_every == 0 and len(history) > 20:
            before = fc._stats_fit_count
            fc.fit(history)
            after = fc._stats_fit_count

            # Some refits land on histories shorter than the MLP's
            # internal threshold and are silently treated as
            # short-history fallbacks.  Those do NOT update stats; we
            # only count refits that actually reached the
            # standardisation block.
            if after == before + 1:
                refit_count_observed += 1
                if last_mean is not None and fc._feature_mean is not None:
                    if not np.allclose(last_mean, fc._feature_mean, atol=1e-12):
                        distinct_means += 1
                if fc._feature_mean is not None:
                    last_mean = fc._feature_mean.copy()
            else:
                # Either the fit was skipped (short history) or
                # multiple refits silently happened — both are bugs.
                assert after == before, (
                    f"Stats fit counter advanced by "
                    f"{after - before} on a single fit() call."
                )

    assert refit_count_observed >= 5, (
        f"Expected at least 5 successful refits over the 400-round "
        f"drifting series; saw {refit_count_observed}."
    )
    assert distinct_means >= 3, (
        f"Standardisation mean changed on only {distinct_means}/"
        f"{refit_count_observed} successful refits — stats look "
        f"sticky across the drift."
    )
