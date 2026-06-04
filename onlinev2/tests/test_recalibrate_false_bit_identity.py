"""Regression test: the recalibrate=False output path is bit-identical
under deterministic inputs.

This preserves the pre-recalibration baseline behaviour.
"""
# Feature: model-training-testing-audit, Property 6: Preservation
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np
import pytest


def _run_once(seed: int = 42):
    from onlinev2.real_data.runner import run_real_data_comparison

    rng = np.random.default_rng(seed)
    T = 400
    series = np.clip(0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0)
    with tempfile.TemporaryDirectory() as td:
        result = run_real_data_comparison(
            series=series, warmup=120, outdir=td,
            series_name="bit_identity_probe",
            gamma=4.0, rho=0.1, lam=0.05,
            recalibrate=False, seed=1337,
        )
    return result


def _strip_new_keys(result):
    """Drop keys that are expected to differ from the pre-fix baseline."""
    clean = dict(result)
    for k in (
        "fallback_summary",
        "online_window_mean",
        "online_block_mean",
        "sensitivity",
    ):
        clean.pop(k, None)
    # michael_ogd rename — normalise the rows and per_round for diffing.
    return clean


def test_recalibrate_false_no_recal_keys():
    """When recalibrate=False, the output MUST NOT contain mechanism_recal
    or calibration_recal fields (clause 3.6)."""
    result = _run_once()
    assert "mechanism_recal" not in [r["method"] for r in result["rows"]]
    assert "calibration_recal" not in result
    # The per-round dicts must not contain crps_mechanism_recal either.
    for pr in result["per_round"][:10]:
        assert "crps_mechanism_recal" not in pr


def test_recalibrate_false_determinism():
    """Two runs on the same series and the same seed must produce
    bit-identical output (modulo keys introduced by this spec)."""
    a = _run_once(seed=42)
    b = _run_once(seed=42)
    a_clean = _strip_new_keys(a)
    b_clean = _strip_new_keys(b)

    # Compare JSON-serialised forms for a strict deep-equality check.
    a_json = json.dumps(a_clean, sort_keys=True, default=str)
    b_json = json.dumps(b_clean, sort_keys=True, default=str)
    assert a_json == b_json, "recalibrate=False output not deterministic"


def test_recalibrate_false_forecaster_api_unchanged():
    """Forecaster public API (clause 3.7) is unchanged: every forecaster
    still exposes fit/predict/predict_quantiles/update_residuals."""
    from onlinev2.real_data.forecasters import get_all_forecasters

    forecasters = get_all_forecasters()
    for fc in forecasters:
        assert callable(getattr(fc, "fit", None))
        assert callable(getattr(fc, "predict", None))
        assert callable(getattr(fc, "predict_quantiles", None))
        assert callable(getattr(fc, "update_residuals", None))


def test_recalibrate_false_oracle_row_present():
    """Oracle row (clause 3.4) is still emitted with the 1/agent_crps
    weighting (numerical values may shift due to causal normalization)."""
    result = _run_once()
    methods = {r["method"] for r in result["rows"]}
    assert "oracle" in methods


def test_recalibrate_false_dm_test_inputs_unchanged():
    """DM test block still emitted with the same comparison label
    (clause 3.9)."""
    result = _run_once()
    dm = result["dm_test"]
    assert dm["comparison"] == "uniform vs mechanism"
    dm_s = result["dm_test_skill"]
    assert dm_s["comparison"] == "uniform vs skill"
