"""
Central output path builder and artifact saver.

Every experiment writes:
  - config.json
  - summary.json
  - summary.txt
  - metrics_*.csv
  - plots/ (per-experiment plots)

No experiment hand-rolls filenames.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np


def _get_version_info() -> dict:
    info = {}
    try:
        import subprocess
        r = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=Path(__file__).resolve().parents[2],
        )
        if r.returncode == 0:
            info["git_commit"] = r.stdout.strip()[:12]
    except Exception:
        pass
    try:
        import onlinev2
        info["package_version"] = getattr(onlinev2, "__version__", "0.1.0")
    except Exception:
        info["package_version"] = "0.1.0"
    return info


def build_output_paths(base_dir: str, experiment_name: str) -> dict[str, str]:
    """Build standard paths for an experiment run.

    Layout:
        <base_dir>/experiments/<name>/
            data/       — config.json, summary.json, summary.txt, CSVs
            plots/      — all .png files
    """
    root = Path(base_dir) / "experiments" / experiment_name
    data_dir = root / "data"
    plots_dir = root / "plots"
    root.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(exist_ok=True)
    plots_dir.mkdir(exist_ok=True)
    return {
        "root": str(root),
        "data_dir": str(data_dir),
        "config": str(data_dir / "config.json"),
        "summary_json": str(data_dir / "summary.json"),
        "summary_txt": str(data_dir / "summary.txt"),
        "plots_dir": str(plots_dir),
    }


def _to_serializable(obj: Any) -> Any:
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.integer, np.floating)):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_serializable(x) for x in obj]
    return obj


def save_experiment_artifacts(
    paths: dict[str, str],
    config: dict,
    result: dict[str, Any],
    *,
    metrics_csv_name: str = "metrics",
) -> None:
    """Save config, summary, and optional CSV to standard locations."""
    config_serial = _to_serializable(config)
    config_serial["_version"] = _get_version_info()

    with open(paths["config"], "w") as f:
        json.dump(config_serial, f, indent=2)

    summary = {
        "config": config_serial,
        "result": _to_serializable(result),
    }
    with open(paths["summary_json"], "w") as f:
        json.dump(summary, f, indent=2)

    lines = ["Experiment summary\n", "=" * 40 + "\n"]
    for k, v in result.items():
        if isinstance(v, (int, float, str, bool)):
            lines.append(f"{k}: {v}\n")
        elif isinstance(v, np.ndarray) and v.size <= 10:
            lines.append(f"{k}: {v.tolist()}\n")
        else:
            lines.append(f"{k}: (see summary.json)\n")
    with open(paths["summary_txt"], "w") as f:
        f.writelines(lines)

    if "metrics" in result and result["metrics"] is not None:
        arr = result["metrics"]
        if isinstance(arr, np.ndarray) and arr.ndim == 2:
            np.savetxt(
                Path(paths.get("data_dir", paths["root"])) / f"{metrics_csv_name}.csv",
                arr,
                delimiter=",",
                fmt="%.6f",
            )
