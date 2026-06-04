"""Panel size sensitivity analysis module.

Computes ΔCRPS statistics at varying panel sizes to identify the minimum
panel size where the mechanism reliably beats equal weighting.

Requirements: 9.1–9.5
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass

import numpy as np

from onlinev2.analysis.stats import compute_ci, compute_se, sanitise_json

# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class PanelSizeResult:
    """Statistics for a single panel size N."""

    n: int
    mean_delta_crps: float
    se: float
    ci_low: float
    ci_high: float


@dataclass
class PanelSweepResult:
    """Full panel sweep result across multiple panel sizes."""

    results: list[PanelSizeResult]
    minimum_reliable_n: int | None  # None if no N yields CI entirely < 0


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------


def compute_panel_sweep(
    results_by_n: dict[int, list[dict]],
) -> PanelSweepResult:
    """Compute panel sweep statistics from pre-computed per-seed results.

    Parameters
    ----------
    results_by_n : dict[int, list[dict]]
        Mapping from panel size N to a list of per-seed result dicts.
        Each dict must contain keys: ``method``, ``seed``, ``mean_crps``,
        ``delta_crps_vs_equal``.

    Returns
    -------
    PanelSweepResult
        Panel sweep results with per-N statistics and minimum reliable N.
    """
    panel_results: list[PanelSizeResult] = []

    for n in sorted(results_by_n.keys()):
        rows = results_by_n[n]
        # Extract blended method deltas
        blended_deltas: list[float] = []
        for row in rows:
            method = row.get("method", "")
            if method == "blended":
                try:
                    delta = float(row["delta_crps_vs_equal"])
                except (KeyError, ValueError, TypeError):
                    continue
                blended_deltas.append(delta)

        if not blended_deltas:
            # No blended data for this N — still record with NaN
            panel_results.append(
                PanelSizeResult(
                    n=n,
                    mean_delta_crps=float("nan"),
                    se=float("nan"),
                    ci_low=float("nan"),
                    ci_high=float("nan"),
                )
            )
            continue

        arr = np.array(blended_deltas, dtype=np.float64)
        mean_val = float(np.mean(arr))
        se_val = compute_se(arr)
        ci_low, ci_high = compute_ci(mean_val, se_val)

        panel_results.append(
            PanelSizeResult(
                n=n,
                mean_delta_crps=mean_val,
                se=se_val,
                ci_low=ci_low,
                ci_high=ci_high,
            )
        )

    # --- Identify minimum reliable N ---
    minimum_reliable_n: int | None = None
    for result in panel_results:
        if not (np.isnan(result.ci_high) or np.isnan(result.ci_low)):
            if result.ci_high < 0:
                minimum_reliable_n = result.n
                break

    return PanelSweepResult(
        results=panel_results,
        minimum_reliable_n=minimum_reliable_n,
    )


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------


def write_panel_sweep(result: PanelSweepResult, out_path: str) -> None:
    """Serialise a :class:`PanelSweepResult` to JSON.

    Applies :func:`sanitise_json` to replace NaN/Inf with ``None``
    before writing.

    Parameters
    ----------
    result : PanelSweepResult
        The panel sweep result to serialise.
    out_path : str
        Destination file path.
    """
    raw = asdict(result)
    sanitised = sanitise_json(raw)
    os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(sanitised, f, indent=2)
