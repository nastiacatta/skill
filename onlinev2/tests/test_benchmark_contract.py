"""Contract tests for the master_comparison benchmark output.

These verify the shape, methods, and determinism of the main thesis benchmark.
Run with: pytest tests/test_benchmark_contract.py -q
"""
from __future__ import annotations

import json
from pathlib import Path

from onlinev2.experiments.runners.runner_module import run_master_comparison


def _load_rows(outdir: Path) -> list[dict]:
    path = outdir / "core" / "experiments" / "master_comparison" / "data" / "master_comparison.json"
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)["rows"]


EXPECTED_METHODS = {"uniform", "deposit", "skill", "mechanism", "best_single"}


def test_master_comparison_has_expected_methods(tmp_path: Path):
    run_master_comparison(
        T=120,
        n_forecasters=6,
        seeds=[101, 102],
        outdir=str(tmp_path),
        block="core",
        warm_start=20,
    )

    rows = _load_rows(tmp_path)
    methods = {row["method"] for row in rows}
    assert methods == EXPECTED_METHODS


def test_master_comparison_has_one_row_per_seed_method(tmp_path: Path):
    seeds = [201, 202, 203]
    run_master_comparison(
        T=100,
        n_forecasters=5,
        seeds=seeds,
        outdir=str(tmp_path),
        block="core",
        warm_start=20,
    )

    rows = _load_rows(tmp_path)
    pairs = {(row["seed"], row["method"]) for row in rows}
    assert len(pairs) == len(seeds) * len(EXPECTED_METHODS)


def test_uniform_delta_is_zero(tmp_path: Path):
    run_master_comparison(
        T=100,
        n_forecasters=5,
        seeds=[301],
        outdir=str(tmp_path),
        block="core",
        warm_start=20,
    )

    rows = _load_rows(tmp_path)
    uniform_rows = [row for row in rows if row["method"] == "uniform"]
    assert len(uniform_rows) == 1
    assert abs(uniform_rows[0]["delta_crps_vs_equal"]) < 1e-12


def test_master_comparison_is_deterministic_for_fixed_seed(tmp_path: Path):
    out1 = tmp_path / "run1"
    out2 = tmp_path / "run2"

    kwargs = dict(
        T=100,
        n_forecasters=5,
        seeds=[401, 402],
        block="core",
        warm_start=20,
    )

    run_master_comparison(outdir=str(out1), **kwargs)
    run_master_comparison(outdir=str(out2), **kwargs)

    rows1 = _load_rows(out1)
    rows2 = _load_rows(out2)
    assert rows1 == rows2
