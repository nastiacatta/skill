"""Smoke tests for ``run_regime_shift_restart_per_season`` (task 11.8).

Covers the scaffolding shape + fresh-state invariant on a small
synthetic winter-only series. Does not run the full Elia wind slice;
that is follow-up work and takes ~1 hour wall-clock end-to-end.

Kept to one end-to-end smoke test + one validation-only test so total
runtime stays under a minute. Each forecaster-fit round is the dominant
cost, and we run only the winter season (300 rounds, all four canonical
methods).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from onlinev2.real_data.experiments import (
    run_regime_shift_restart_per_season,
)


def _synthetic_hourly_panel(hours: int = 800, seed: int = 0) -> pd.Series:
    """DatetimeIndex'd hourly series starting 2024-01-01 UTC. Mild
    sinusoid plus Gaussian noise so every forecaster has non-trivial
    signal to track."""
    rng = np.random.default_rng(seed)
    idx = pd.date_range(
        "2024-01-01", periods=hours, freq="1h", tz="UTC"
    )
    t = np.arange(hours, dtype=np.float64)
    values = (
        0.5
        + 0.1 * np.sin(2 * np.pi * t / 168.0)
        + 0.02 * np.cos(2 * np.pi * t / 24.0)
        + rng.normal(0.0, 0.03, size=hours)
    )
    return pd.Series(values, index=idx, name="measured")


def test_restart_per_season_rejects_bad_warmup() -> None:
    """Validation only; no forecaster fit."""
    hourly = _synthetic_hourly_panel(hours=400, seed=0)
    with pytest.raises(ValueError, match="warmup"):
        run_regime_shift_restart_per_season(
            hourly, horizon=1, warmup=500, min_season_len=400
        )


def test_restart_per_season_end_to_end_smoke() -> None:
    """End-to-end: each season that clears ``min_season_len`` produces a
    full ``_run_horizon_comparison`` result. 800 hours starting Jan 1
    means only ``winter`` clears ``min_season_len=300``; the other three
    seasons are listed under ``skipped_seasons``."""
    hourly = _synthetic_hourly_panel(hours=800, seed=0)
    out = run_regime_shift_restart_per_season(
        hourly,
        horizon=1,
        warmup=100,
        min_season_len=300,
    )

    # Top-level shape
    assert out["restart_per_season"] is True
    assert out["horizon"] == 1
    assert out["warmup"] == 100
    assert out["min_season_len"] == 300

    # Only winter ran; the others are in skipped_seasons.
    assert set(out["per_season"].keys()) == {"winter"}
    assert set(out["season_summary"].keys()) == {"winter"}
    skipped_names = {s["season"] for s in out["skipped_seasons"]}
    assert skipped_names == {"spring", "summer", "autumn"}

    # The winter result has the canonical method rows and per_round.
    winter = out["per_season"]["winter"]
    methods = {r["method"] for r in winter.get("rows", [])}
    assert {"uniform", "skill", "mechanism"}.issubset(methods)
    assert len(winter["per_round"]) > 0
    first = winter["per_round"][0]
    assert "crps_uniform" in first
    assert "crps_mechanism" in first

    # season_summary has the canonical keys and finite values.
    summary = out["season_summary"]["winter"]
    assert set(summary.keys()) >= {
        "n_rounds",
        "uniform",
        "mechanism",
        "skill",
        "delta_mechanism",
        "pct_mechanism",
        "delta_skill",
        "pct_skill",
    }
    assert summary["n_rounds"] >= 300
    assert np.isfinite(summary["uniform"])
    assert np.isfinite(summary["mechanism"])
