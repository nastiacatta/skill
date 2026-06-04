"""Capture a pre-feature ``comparison.json`` snapshot for bit-identity checks.

This script freezes the current mainline behaviour of
``run_real_data_comparison`` so Task 5.4 of the mechanism-recalibration-layer
spec can verify that the additive ``recalibrate=False`` path is bit-identical
after the feature lands.

It runs a fast 1000-point Elia wind slice through the runner with a fixed
seed and writes the result to
``onlinev2/tests/fixtures/pre_recalibration_comparison.json``.

Usage:
    # Initial capture (pre-modification): writes the fixture if missing.
    cd onlinev2 && OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 \
        KMP_DUPLICATE_LIB_OK=TRUE \
        python scripts/capture_pre_recalibration_snapshot.py

    # Post-modification verification: also writes ``pre_recalibration_current.json``
    # for byte-diffing against the committed fixture.
    cd onlinev2 && ... python scripts/capture_pre_recalibration_snapshot.py --verify

By default the script refuses to overwrite an existing fixture — rerun with
``--overwrite`` to explicitly refresh it.
"""
from __future__ import annotations

import argparse
import json
import os
import random

import numpy as np
import pandas as pd

from onlinev2.real_data.forecasters import get_all_forecasters
from onlinev2.real_data.runner import run_real_data_comparison

# Deterministic snapshot seed — any fixed value works, but we keep it
# separate from the seeds used inside ``run_simulation`` (42) so nothing is
# accidentally conflated.
SNAPSHOT_SEED = 20260420
SNAPSHOT_SLICE_LEN = 1000
SNAPSHOT_SERIES_NAME = "pre_recalibration_snapshot"

FIXTURE_NAME = "pre_recalibration_comparison.json"
VERIFY_NAME = "pre_recalibration_current.json"


def _repo_paths() -> tuple[str, str, str]:
    """Return (repo_root, csv_path, fixture_dir)."""
    here = os.path.dirname(os.path.abspath(__file__))
    onlinev2_root = os.path.abspath(os.path.join(here, ".."))
    repo_root = os.path.abspath(os.path.join(onlinev2_root, ".."))
    csv_path = os.path.join(repo_root, "data", "elia_offshore_wind_2024_2025.csv")
    fixture_dir = os.path.join(onlinev2_root, "tests", "fixtures")
    return repo_root, csv_path, fixture_dir


def _run_snapshot() -> dict:
    """Execute the deterministic snapshot run and return the result dict."""
    random.seed(SNAPSHOT_SEED)
    np.random.seed(SNAPSHOT_SEED)

    _, csv_path, fixture_dir = _repo_paths()
    print(f"Loading Elia slice: {csv_path}")
    df = pd.read_csv(csv_path, usecols=["datetime", "measured"])
    series_raw = df["measured"].dropna().to_numpy(dtype=np.float64)
    series = series_raw[:SNAPSHOT_SLICE_LEN]
    print(f"  slice length = {len(series)}")

    outdir = os.path.abspath(os.path.join(fixture_dir, "..", "_snapshot_tmp"))
    os.makedirs(outdir, exist_ok=True)

    forecasters = get_all_forecasters()
    print("Running run_real_data_comparison (default recalibrate=False)...")
    return run_real_data_comparison(
        series=series,
        forecasters=forecasters,
        warmup=100,
        taus=None,
        outdir=outdir,
        series_name=SNAPSHOT_SERIES_NAME,
        gamma=4.0,
        rho=0.1,
        lam=0.05,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__ or "")
    parser.add_argument(
        "--verify",
        action="store_true",
        help=(
            "Run the snapshot and write it to pre_recalibration_current.json "
            "(rather than overwriting the committed pre_recalibration_comparison.json) "
            "so you can diff the two."
        ),
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Force overwrite of the committed fixture.",
    )
    args = parser.parse_args()

    _, _, fixture_dir = _repo_paths()
    os.makedirs(fixture_dir, exist_ok=True)
    fixture_path = os.path.join(fixture_dir, FIXTURE_NAME)
    verify_path = os.path.join(fixture_dir, VERIFY_NAME)

    if args.verify:
        target = verify_path
        # In verify mode we always write — the intent is to produce a
        # comparison artifact.
    else:
        target = fixture_path
        if os.path.exists(target) and not args.overwrite:
            print(
                f"Fixture already exists at {target}.\n"
                f"Run with --overwrite to refresh the committed baseline, "
                f"or with --verify to produce a diff artifact."
            )
            return 1

    result = _run_snapshot()

    with open(target, "w") as f:
        json.dump(result, f, indent=2)
    print(f"Snapshot saved to {target}")
    print(f"  n_rows = {len(result.get('rows', []))}")
    print(f"  n_per_round = {len(result.get('per_round', []))}")
    print(f"  calibration entries = {len(result.get('calibration', []))}")

    # Verify-mode convenience: diff against the committed fixture.
    if args.verify and os.path.exists(fixture_path):
        with open(fixture_path, "rb") as f1, open(target, "rb") as f2:
            a, b = f1.read(), f2.read()
        if a == b:
            print("\nBit-identical to committed fixture ✓")
            return 0
        print("\nBYTE MISMATCH with committed fixture ✗")
        print(f"  fixture bytes = {len(a)}, current bytes = {len(b)}")
        # Provide the first differing byte offset as a hint.
        for i, (ca, cb) in enumerate(zip(a, b)):
            if ca != cb:
                print(f"  first differing byte at offset {i}")
                start = max(0, i - 40)
                end = min(len(a), i + 40)
                print(f"    fixture : ...{a[start:end].decode(errors='replace')}...")
                print(f"    current : ...{b[start:end].decode(errors='replace')}...")
                break
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
