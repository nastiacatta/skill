"""Regression tests for post-audit issues #2 (oracle rename) and
#7 (train_test_split alias rename).

Tests for oracle rename and train_test_split alias consistency.
"""
# Feature: model-training-testing-audit, Property 2: Fix Checking
from __future__ import annotations

import tempfile

import numpy as np


def _run_minimal():
    from onlinev2.real_data.runner import run_real_data_comparison

    rng = np.random.default_rng(0)
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(400)), 0.0, 1.0
    )
    with tempfile.TemporaryDirectory() as td:
        return run_real_data_comparison(
            series=series, warmup=120, outdir=td, series_name="oracle_probe",
            gamma=4.0, rho=0.1, lam=0.05,
        )


def test_oracle_is_per_round_argmin():
    """Post-audit #2: `oracle` is now the per-round argmin across
    forecasters (not inverse-CRPS weighting). It MUST be ≤ best_single
    at every round since best_single is ≥ per-round argmin by
    construction."""
    result = _run_minimal()
    per_round = result["per_round"]
    violations = [
        pr for pr in per_round
        if pr.get("crps_oracle", 0.0) > pr.get("crps_best_single", 0.0) + 1e-9
    ]
    assert not violations, (
        f"oracle > best_single in {len(violations)} rounds; "
        f"first violation: {violations[0]}"
    )


def test_per_round_inv_crps_hindsight_row_emitted():
    """The legacy inverse-CRPS-hindsight weighting is kept under an
    honest label (post-audit #2)."""
    result = _run_minimal()
    methods = {r["method"] for r in result["rows"]}
    assert "per_round_inv_crps_hindsight" in methods
    for pr in result["per_round"][:5]:
        assert "crps_per_round_inv_crps_hindsight" in pr


def test_train_test_split_alias_renamed_children(tmp_path):
    """Post-audit #7: `train_test_split` alias now has first_half_*
    children (not train_*, test_*) and a deprecation note."""
    result = _run_minimal()
    assert "train_test_split" in result
    assert "temporal_stability" in result
    alias = result["train_test_split"]
    assert "DEPRECATED" in alias.get("description", "")
    # Sample one method's sub-dict to confirm the rename.
    some_method = next(iter(alias["methods"]))
    child = alias["methods"][some_method]
    assert "first_half_crps" in child
    assert "second_half_crps" in child
    assert "train_crps" not in child
    assert "test_crps" not in child


def test_forecaster_descriptions_emitted():
    """Post-audit #3: `forecaster_descriptions` surfaces structural
    caveats like ARIMA's is_persistence flag."""
    result = _run_minimal()
    descs = result.get("forecaster_descriptions", {})
    assert descs, "forecaster_descriptions missing from runner output"
    arima_key = next((k for k in descs if "ARIMA" in k), None)
    assert arima_key is not None, f"No ARIMA entry in {list(descs)}"
    assert "last observation" in descs[arima_key]["note"].lower()
