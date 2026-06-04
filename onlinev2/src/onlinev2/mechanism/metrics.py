"""
Compatibility shim: use onlinev2.core.metrics for new code.

This module re-exports from core and adds NetworkExporter.export_csv for
backward compatibility (file I/O lives here, not in core).
"""

import csv
import os

from onlinev2.core.metrics import (
    NetworkExporter as _NetworkExporter,
)
from onlinev2.core.metrics import (
    RoundMetricsLogger,
    compute_gini,
    compute_hhi,
    compute_n_eff,
    compute_pit,
    compute_sharpness,
    validate_quantile_monotonicity,
)


class NetworkExporter(_NetworkExporter):
    """Backward-compat: adds export_csv (I/O); core.NetworkExporter has get_export_data only."""

    def export_csv(self, output_dir: str, prefix: str = "network") -> None:
        """Export adjacency + features to CSV. I/O kept in mechanism shim, not core."""
        os.makedirs(output_dir, exist_ok=True)
        node_rows, edge_rows = self.get_export_data()
        node_path = os.path.join(output_dir, f"{prefix}_nodes.csv")
        with open(node_path, "w", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["agent_id", "mean_stake", "stake_var",
                            "participation_rate", "median_report", "report_width"],
            )
            writer.writeheader()
            for row in node_rows:
                writer.writerow(row)
        edge_path = os.path.join(output_dir, f"{prefix}_edges.csv")
        with open(edge_path, "w", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["source", "target", "report_corr",
                            "stake_corr", "sync_participation"],
            )
            writer.writeheader()
            for row in edge_rows:
                writer.writerow(row)


__all__ = [
    "compute_pit",
    "compute_sharpness",
    "compute_hhi",
    "compute_n_eff",
    "compute_gini",
    "validate_quantile_monotonicity",
    "NetworkExporter",
    "RoundMetricsLogger",
]
