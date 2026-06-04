"""Smoke test for scripts/run_sensitivity_sweep.py and the runner's
sweep_artefact wiring (sensitivity sweep artefact wiring property 1.4 / 2.4)."""
# Feature: model-training-testing-audit, Property 1: Bug Condition
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_runner_reads_sweep_artefact(tmp_path: Path):
    """When sweep_artefact exists, runner must read optimal_* from it
    rather than emitting the hardcoded -27.2 constant."""
    from onlinev2.real_data.runner import run_real_data_comparison

    # Fake sweep artefact
    sweep_file = tmp_path / "sweep.json"
    sweep_data = {
        "elia_probe": {
            "optimal_params": {"gamma": 99.0, "rho": 0.42, "lam": 0.13},
            "optimal_improvement_pct": -7.7,
        }
    }
    sweep_file.write_text(json.dumps(sweep_data))

    rng = np.random.default_rng(0)
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(400)), 0.0, 1.0
    )
    result = run_real_data_comparison(
        series=series, warmup=120, outdir=str(tmp_path),
        series_name="elia_probe",
        sweep_artefact=str(sweep_file),
    )
    sens = result["sensitivity"]
    assert sens["source"] == str(sweep_file)
    assert sens["optimal_params"]["gamma"] == 99.0
    assert sens["optimal_improvement_pct"] == -7.7
    assert "Recomputed on a held-out split" in sens["note"]


def test_runner_flags_missing_sweep(tmp_path: Path):
    """When sweep_artefact is None or missing, runner emits a missing-flag
    note and does NOT populate optimal_*."""
    from onlinev2.real_data.runner import run_real_data_comparison

    rng = np.random.default_rng(1)
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(400)), 0.0, 1.0
    )
    result = run_real_data_comparison(
        series=series, warmup=120, outdir=str(tmp_path),
        series_name="elia_probe",
        sweep_artefact=None,
    )
    sens = result["sensitivity"]
    assert "sensitivity_sweep.json not found" in sens["note"]
    assert "optimal_params" not in sens
    assert "optimal_improvement_pct" not in sens


def test_runner_no_hardcoded_27_2():
    """Grep the runner source: no hardcoded -27.2 anywhere."""
    runner_src = (
        REPO_ROOT / "onlinev2" / "src" / "onlinev2" / "real_data" / "runner.py"
    ).read_text()
    assert "-27.2" not in runner_src
    assert "optimal_improvement_pct: -27.2" not in runner_src


def test_sweep_script_help():
    """The sweep script should at least parse --help without error."""
    script = REPO_ROOT / "scripts" / "run_sensitivity_sweep.py"
    result = subprocess.run(
        [sys.executable, str(script), "--help"],
        capture_output=True, timeout=30,
    )
    assert result.returncode == 0
    assert b"--series" in result.stdout
    assert b"--split" in result.stdout
    assert b"--grid" in result.stdout
