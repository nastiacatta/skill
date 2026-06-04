#!/usr/bin/env python3
"""Re-run the real-data experiment with per-agent skill history export.

Usage:
    cd onlinev2 && python ../scripts/run_real_data_with_skill.py
    cd onlinev2 && python ../scripts/run_real_data_with_skill.py --tuned
    cd onlinev2 && python ../scripts/run_real_data_with_skill.py --dataset wind --tuned

Outputs to dashboard/public/data/real_data/{elia_wind,elia_electricity}/data/comparison.json

Tuned-parameter provenance (bugfix clause 1.4 / 2.4):
    When ``--tuned`` is supplied and ``--sweep-artefact`` points at an existing
    ``sensitivity_sweep.json``, ``(γ, ρ, λ)`` are read per series from the
    artefact's ``optimal_params`` block rather than hardcoded. The same path is
    passed to ``run_real_data_comparison`` via ``sweep_artefact=`` so the
    emitted ``sensitivity`` block in ``comparison.json`` carries the source
    file and held-out ``optimal_improvement_pct``.
"""
import json
import os
import sys

# Fix OMP threading issues on macOS
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "onlinev2", "src"))

from onlinev2.real_data.runner import run_real_data_comparison
from onlinev2.real_data.loader import load_csv_series


_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_DEFAULT_SWEEP_ARTEFACT = os.path.join(
    _REPO_ROOT, "onlinev2", "outputs", "sensitivity_sweep.json"
)


def _load_sweep_params(
    sweep_artefact: str | None, series_name: str
) -> tuple[dict | None, str | None]:
    """Return ``(optimal_params, resolved_path)`` for ``series_name``.

    ``optimal_params`` is ``None`` when the artefact is missing / malformed /
    lacks a block for the requested series. Non-``None`` results are dicts
    with float ``gamma``, ``rho``, ``lam`` keys.
    """
    if not sweep_artefact:
        return None, None
    if not os.path.isfile(sweep_artefact):
        return None, sweep_artefact
    try:
        with open(sweep_artefact) as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"  ⚠ Could not read sweep artefact {sweep_artefact}: {exc}")
        return None, sweep_artefact
    # Sweep file is keyed by series name (elia_wind / elia_electricity).
    block = data.get(series_name) if isinstance(data, dict) else None
    if not isinstance(block, dict) or "optimal_params" not in block:
        return None, sweep_artefact
    op = block["optimal_params"]
    if not all(k in op for k in ("gamma", "rho", "lam")):
        return None, sweep_artefact
    return (
        {
            "gamma": float(op["gamma"]),
            "rho": float(op["rho"]),
            "lam": float(op["lam"]),
        },
        sweep_artefact,
    )


def run_wind(gamma=4.0, rho=0.1, lam=0.05, sweep_artefact: str | None = None,
             normalize_mode: str = "static"):
    csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "elia_offshore_wind_2024_2025.csv")
    if not os.path.isfile(csv_path):
        print(f"Wind data not found at {csv_path}")
        return
    df = pd.read_csv(csv_path)
    series = df["measured"].dropna().values.astype(np.float64)

    # Clip negative values to 0 (physically impossible for wind generation)
    n_neg = (series < 0).sum()
    if n_neg > 0:
        print(f"  Clipping {n_neg} negative values to 0")
        series = np.clip(series, 0, None)

    # Hourly averaging (not subsampling) — preserves information from 15-min data
    n_full = (len(series) // 4) * 4
    series_hourly = series[:n_full].reshape(-1, 4).mean(axis=1)
    print(f"Wind: {len(series)} raw 15-min points → {len(series_hourly)} hourly (averaged)")
    outdir = os.path.join(os.path.dirname(__file__), "..", "dashboard", "public", "data")
    run_real_data_comparison(
        series=series_hourly, warmup=200, outdir=outdir,
        series_name="elia_wind", gamma=gamma, rho=rho, lam=lam,
        sweep_artefact=sweep_artefact,
        normalize_mode=normalize_mode,
    )


def run_electricity(gamma=4.0, rho=0.1, lam=0.05, sweep_artefact: str | None = None,
                    normalize_mode: str = "static"):
    csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "elia_imbalance_prices_2024_2025.csv")
    if not os.path.isfile(csv_path):
        print(f"Electricity data not found at {csv_path}")
        return
    df = pd.read_csv(csv_path)

    # Use positiveimbalanceprice (€/MWh) — the actual imbalance price
    # The old loader used netregulationvolume (MW) by mistake
    col = "positiveimbalanceprice"
    if col not in df.columns:
        # Fallback to generic loader
        series = load_csv_series(csv_path)
    else:
        series = df[col].dropna().values.astype(np.float64)

    # Winsorize extreme outliers at 1st/99th percentile
    p1, p99 = np.percentile(series, [1, 99])
    n_clipped = ((series < p1) | (series > p99)).sum()
    if n_clipped > 0:
        print(f"  Winsorizing {n_clipped} outliers to [{p1:.1f}, {p99:.1f}]")
        series = np.clip(series, p1, p99)

    print(f"Electricity ({col}): {len(series)} points, range=[{series.min():.1f}, {series.max():.1f}]")
    outdir = os.path.join(os.path.dirname(__file__), "..", "dashboard", "public", "data")
    run_real_data_comparison(
        series=series, warmup=200, outdir=outdir,
        series_name="elia_electricity", gamma=gamma, rho=rho, lam=lam,
        sweep_artefact=sweep_artefact,
        normalize_mode=normalize_mode,
    )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run real-data experiments")
    parser.add_argument("--dataset", choices=["wind", "electricity", "both"], default="both")
    parser.add_argument("--tuned", action="store_true",
                        help="Use tuned parameters. When --sweep-artefact exists, "
                             "(γ, ρ, λ) are read per-series from its optimal_params "
                             "block; otherwise fall back to the legacy "
                             "(γ=16, ρ=0.5, λ=0.05) defaults with a warning.")
    parser.add_argument("--gamma", type=float, default=None,
                        help="Override γ (takes precedence over --tuned and sweep artefact).")
    parser.add_argument("--rho", type=float, default=None,
                        help="Override ρ (takes precedence over --tuned and sweep artefact).")
    parser.add_argument("--lam", type=float, default=None,
                        help="Override λ (takes precedence over --tuned and sweep artefact).")
    parser.add_argument("--sweep-artefact", type=str, default=_DEFAULT_SWEEP_ARTEFACT,
                        help="Path to sensitivity_sweep.json (default: "
                             "onlinev2/outputs/sensitivity_sweep.json). The path is "
                             "passed through to run_real_data_comparison so the "
                             "emitted comparison.json sensitivity block records "
                             "the source, regardless of whether --tuned is set.")
    parser.add_argument("--normalize-mode", choices=["static", "expanding"],
                        default="static",
                        help="Causal normalisation mode. 'static' (default) "
                             "freezes (lo, hi) to the warmup-window range "
                             "and clips eval-window observations outside "
                             "that range (~33%% clipped on Elia wind). "
                             "'expanding' refits (lo_t, hi_t) over "
                             "series[:t+1] for every t >= warmup while "
                             "preserving strict causality — no clipping, "
                             "at the cost of a time-varying scale. See "
                             "post-audit issue #1.")
    args = parser.parse_args()

    # Default (non-tuned) starting parameters.
    default_gamma, default_rho, default_lam = 4.0, 0.1, 0.05
    # Legacy tuned constants (used as fall-back when no sweep artefact is
    # available; kept for backwards-compatible behaviour).
    legacy_tuned_gamma, legacy_tuned_rho, legacy_tuned_lam = 16.0, 0.5, 0.05

    sweep_artefact = args.sweep_artefact

    def _resolve_params(series_name: str) -> tuple[float, float, float, str]:
        """Return ``(gamma, rho, lam, source_label)`` for one series.

        CLI overrides (``--gamma``/``--rho``/``--lam``) always win. Otherwise,
        when ``--tuned`` is set and the artefact exposes ``optimal_params`` for
        the requested series, those are used. Otherwise defaults / legacy
        tuned constants.
        """
        if args.tuned:
            swept, resolved = _load_sweep_params(sweep_artefact, series_name)
            if swept is not None:
                source = f"sweep artefact ({resolved})"
                g, r, l = swept["gamma"], swept["rho"], swept["lam"]
            else:
                if sweep_artefact:
                    if resolved is None or not os.path.isfile(resolved):
                        print(
                            f"  ⚠ --tuned set but sweep artefact not found at "
                            f"{sweep_artefact}; using legacy constants "
                            f"(γ={legacy_tuned_gamma}, ρ={legacy_tuned_rho}, "
                            f"λ={legacy_tuned_lam}) for {series_name}."
                        )
                    else:
                        print(
                            f"  ⚠ --tuned set and artefact {resolved} exists "
                            f"but has no optimal_params for {series_name}; "
                            f"using legacy constants."
                        )
                source = "legacy tuned constants"
                g, r, l = legacy_tuned_gamma, legacy_tuned_rho, legacy_tuned_lam
        else:
            source = "defaults"
            g, r, l = default_gamma, default_rho, default_lam

        if args.gamma is not None:
            g = args.gamma
        if args.rho is not None:
            r = args.rho
        if args.lam is not None:
            l = args.lam
        if args.gamma is not None or args.rho is not None or args.lam is not None:
            source = f"{source} + CLI overrides"
        return g, r, l, source

    if args.dataset in ("wind", "both"):
        gamma, rho, lam, source = _resolve_params("elia_wind")
        print("=" * 60)
        print("Running Elia Wind experiment...")
        print(f"  Parameters: γ={gamma}, ρ={rho}, λ={lam}  ({source})")
        print(f"  Normalisation: {args.normalize_mode}")
        print("=" * 60)
        run_wind(gamma=gamma, rho=rho, lam=lam, sweep_artefact=sweep_artefact,
                 normalize_mode=args.normalize_mode)

    if args.dataset in ("electricity", "both"):
        gamma, rho, lam, source = _resolve_params("elia_electricity")
        print("\n" + "=" * 60)
        print("Running Elia Electricity experiment...")
        print(f"  Parameters: γ={gamma}, ρ={rho}, λ={lam}  ({source})")
        print(f"  Normalisation: {args.normalize_mode}")
        print("=" * 60)
        run_electricity(gamma=gamma, rho=rho, lam=lam, sweep_artefact=sweep_artefact,
                        normalize_mode=args.normalize_mode)
