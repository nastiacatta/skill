"""
Structured output directory builder for experiments.

Output roots are separated by block:
  - Core experiments:   outputs/core/experiments/<name>/
  - Behaviour experiments: outputs/behaviour/experiments/<name>/

Each experiment gets:
    outputs/<block>/experiments/<name>/
        plots/      — all .png files
        data/       — all .csv files and other data artifacts
"""
from __future__ import annotations

import os

ALLOWED_BLOCKS = frozenset({"core", "behaviour"})


class ExperimentPaths:
    """Holds paths for a single experiment's output directory."""

    def __init__(self, base_dir: str, experiment_name: str, block: str = "core"):
        if block not in ALLOWED_BLOCKS:
            raise ValueError(f"block must be one of {sorted(ALLOWED_BLOCKS)}, got {block!r}")
        self.block = block
        self.root = os.path.join(base_dir, experiment_name)
        self.plots_dir = os.path.join(self.root, "plots")
        self.data_dir = os.path.join(self.root, "data")
        os.makedirs(self.plots_dir, exist_ok=True)
        os.makedirs(self.data_dir, exist_ok=True)

    def plot(self, filename: str) -> str:
        """Full path for a plot file (e.g. 'budget_gap.png')."""
        return os.path.join(self.plots_dir, filename)

    def data(self, filename: str) -> str:
        """Full path for a data file (e.g. 'metrics.csv')."""
        return os.path.join(self.data_dir, filename)

    def __repr__(self) -> str:
        return f"ExperimentPaths(block={self.block!r}, root={self.root!r})"
