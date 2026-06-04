"""
Shared helpers for experiment runners: paths, smoothing, CSV, R scripts, unit test.

Used by experiments.runners and by the unit test list run at end of CLI.
"""
from __future__ import annotations

import csv
import os
import subprocess
from pathlib import Path

import numpy as np

from onlinev2.io.output_paths import ALLOWED_BLOCKS, ExperimentPaths


def exp_paths(base_outdir: str, name: str, block: str = "core") -> ExperimentPaths:
    """Create experiment output directories under base_outdir/<block>/experiments/name/."""
    if block not in ALLOWED_BLOCKS:
        raise ValueError(f"block must be one of {sorted(ALLOWED_BLOCKS)}, got {block!r}")
    base_dir = os.path.join(base_outdir, block, "experiments")
    return ExperimentPaths(base_dir, name, block)


def ewma_smooth(x, span=15):
    """Exponentially weighted moving average."""
    alpha = 2 / (span + 1)
    s = np.empty_like(x, dtype=float)
    s[0] = x[0]
    for t in range(1, len(x)):
        s[t] = alpha * x[t] + (1 - alpha) * s[t - 1]
    return s


def rolling_mean(x, w=50):
    """Rolling mean with window w. NaN where window is incomplete."""
    x = np.asarray(x, dtype=np.float64)
    out = np.full_like(x, np.nan)
    for i in range(len(x)):
        sl = x[max(0, i - w + 1) : i + 1]
        finite = sl[np.isfinite(sl)]
        if finite.size:
            out[i] = float(np.mean(finite))
    return out


def cummean(x):
    """Cumulative mean, skipping NaNs."""
    x = np.asarray(x, dtype=np.float64)
    out = np.full_like(x, np.nan)
    fin = np.isfinite(x)
    idx = np.where(fin)[0]
    if idx.size:
        out[idx] = np.cumsum(x[fin]) / np.arange(1, len(idx) + 1)
    return out


def se(vals, S=None):
    """Standard error of the mean. Returns 0 if only one value or all NaN. S unused for compatibility."""
    vals = np.asarray(vals, dtype=np.float64)
    finite = vals[np.isfinite(vals)]
    if finite.size <= 1:
        return 0.0
    return float(np.std(finite, ddof=1) / np.sqrt(finite.size))


def run_r_plot(script_name: str, data_dir: str, plots_dir: str) -> None:
    """Run an R script. Pass data_dir as arg 1, plots_dir as arg 2. Scripts live in repo scripts/r/."""
    # Package layout: .../onlinev2/src/onlinev2/experiments/helpers.py -> parents[3] = onlinev2 project root
    pkg_root = Path(__file__).resolve().parents[3]
    script_path = pkg_root / "scripts" / "r" / script_name
    if not script_path.is_file():
        return
    try:
        subprocess.run(
            ["Rscript", str(script_path), os.path.abspath(data_dir), os.path.abspath(plots_dir)],
            check=False,
            capture_output=True,
            timeout=60,
            cwd=str(pkg_root),
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass


def write_csv(path: str, fieldnames: list[str], rows: list[dict]) -> None:
    """Write rows to a CSV file with header."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def unit_latent_generator_determinism(seed=99, T=30, n=3, tol=1e-15):
    """Latent generators must be deterministic given same seed."""
    from onlinev2.legacy_dgps import (
        generate_truth_and_quantile_reports_latent,
        generate_truth_and_reports_latent,
    )

    tau = np.array([0.2, 0.5, 1.0])[:n]
    taus_q = np.array([0.1, 0.5, 0.9])
    y1, r1, t1 = generate_truth_and_reports_latent(T=T, n=n, tau_i=tau, seed=seed)
    y2, r2, t2 = generate_truth_and_reports_latent(T=T, n=n, tau_i=tau, seed=seed)
    if not (np.allclose(y1, y2, atol=tol) and np.allclose(r1, r2, atol=tol)):
        return False
    yq1, q1, _ = generate_truth_and_quantile_reports_latent(
        T=T, n=n, tau_i=tau, taus=taus_q, seed=seed
    )
    yq2, q2, _ = generate_truth_and_quantile_reports_latent(
        T=T, n=n, tau_i=tau, taus=taus_q, seed=seed
    )
    return bool(np.allclose(yq1, yq2, atol=tol) and np.allclose(q1, q2, atol=tol))


def _sanitise_for_json(v):
    """Replace NaN/Inf with None for JSON serialisation. Recurse into containers."""
    import math

    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if isinstance(v, dict):
        return {k: _sanitise_for_json(val) for k, val in v.items()}
    if isinstance(v, (list, tuple)):
        return [_sanitise_for_json(item) for item in v]
    if isinstance(v, np.floating):
        fv = float(v)
        if math.isnan(fv) or math.isinf(fv):
            return None
        return fv
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.ndarray):
        return _sanitise_for_json(v.tolist())
    return v


def write_standardised_output(
    ep: ExperimentPaths,
    rows: list[dict],
    config: dict,
    baseline_method: str = "equal",
) -> None:
    """Write canonical output files for a multi-method experiment.

    Produces three files in ``ep.data_dir``:

    ``summary.csv``
        One row per (method, seed) with columns: ``method``, ``seed``,
        ``mean_crps``, ``delta_crps_vs_equal``.

    ``paired_delta.csv``
        One row per (method, seed) with columns: ``method``, ``seed``,
        ``delta_crps_vs_equal``, ``delta_gini_vs_equal``,
        ``delta_hhi_vs_equal``, ``delta_n_eff_vs_equal``.

    ``config.json``
        All experiment parameters for reproducibility.

    Parameters
    ----------
    ep : ExperimentPaths
        Experiment output directory paths.
    rows : list[dict]
        Per-(method, seed) result rows. Each dict should contain at least
        ``method``, ``seed``, ``mean_crps``. Optional keys:
        ``delta_crps_vs_equal``, ``delta_gini_vs_equal``,
        ``delta_hhi_vs_equal``, ``delta_n_eff_vs_equal``,
        ``mean_HHI``, ``mean_N_eff``, ``final_gini``.
        If ``delta_crps_vs_equal`` is missing, it is computed as
        ``mean_crps - crps_equal`` for the same seed.
    config : dict
        Experiment parameters (T, n_forecasters, dgp_name, seeds, etc.).
    baseline_method : str
        Method name used as the baseline for delta computation (default: "equal").

    Notes
    -----
    All numeric values are validated: NaN and Inf are replaced with ``None``
    in JSON output and left as empty strings in CSV output.
    """
    import json
    import math

    # Build lookup: seed -> baseline CRPS
    baseline_crps = {}
    baseline_gini = {}
    baseline_hhi = {}
    baseline_n_eff = {}
    for r in rows:
        if r.get("method") == baseline_method:
            s = r.get("seed")
            baseline_crps[s] = r.get("mean_crps", np.nan)
            baseline_gini[s] = r.get("final_gini", np.nan)
            baseline_hhi[s] = r.get("mean_HHI", np.nan)
            baseline_n_eff[s] = r.get("mean_N_eff", np.nan)

    # Ensure delta columns exist
    for r in rows:
        s = r.get("seed")
        mc = r.get("mean_crps", np.nan)
        if "delta_crps_vs_equal" not in r or not np.isfinite(r.get("delta_crps_vs_equal", np.nan)):
            bc = baseline_crps.get(s, np.nan)
            r["delta_crps_vs_equal"] = mc - bc if np.isfinite(mc) and np.isfinite(bc) else np.nan
        if "delta_gini_vs_equal" not in r:
            bg = baseline_gini.get(s, np.nan)
            fg = r.get("final_gini", np.nan)
            r["delta_gini_vs_equal"] = (fg - bg) if np.isfinite(fg) and np.isfinite(bg) else np.nan
        if "delta_hhi_vs_equal" not in r:
            bh = baseline_hhi.get(s, np.nan)
            mh = r.get("mean_HHI", np.nan)
            r["delta_hhi_vs_equal"] = (mh - bh) if np.isfinite(mh) and np.isfinite(bh) else np.nan
        if "delta_n_eff_vs_equal" not in r:
            bn = baseline_n_eff.get(s, np.nan)
            mn = r.get("mean_N_eff", np.nan)
            r["delta_n_eff_vs_equal"] = (mn - bn) if np.isfinite(mn) and np.isfinite(bn) else np.nan

    def _csv_val(v):
        """Format a value for CSV: NaN/Inf become empty string."""
        if v is None:
            return ""
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return ""
        return v

    # --- summary.csv ---
    summary_cols = ["method", "seed", "mean_crps", "delta_crps_vs_equal"]
    summary_rows = [{k: _csv_val(r.get(k)) for k in summary_cols} for r in rows]
    write_csv(ep.data("summary.csv"), summary_cols, summary_rows)

    # --- paired_delta.csv ---
    delta_cols = [
        "method", "seed",
        "delta_crps_vs_equal", "delta_gini_vs_equal",
        "delta_hhi_vs_equal", "delta_n_eff_vs_equal",
    ]
    delta_rows = [{k: _csv_val(r.get(k)) for k in delta_cols} for r in rows]
    write_csv(ep.data("paired_delta.csv"), delta_cols, delta_rows)

    # --- config.json ---
    sanitised_config = _sanitise_for_json(config)
    config_path = ep.data("config.json")
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, "w") as f:
        json.dump(sanitised_config, f, indent=2, default=str)
