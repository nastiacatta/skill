"""DGP protocol and output type."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

import numpy as np

from ..types import DGPInfo, PreGeneratedData


@dataclass
class DGPOutput:
    """Output from a DGP.generate() call."""

    y: np.ndarray
    reports: np.ndarray | None = None
    q_reports: np.ndarray | None = None
    tau_true: np.ndarray | None = None
    taus: np.ndarray | None = None
    meta: dict | None = None

    def to_pre_generated(self) -> PreGeneratedData:
        """Convert to PreGeneratedData container."""
        meta = self.meta if self.meta is not None else {}
        return PreGeneratedData(
            y=self.y,
            reports=self.reports,
            q_reports=self.q_reports,
            tau_true=self.tau_true,
            taus=self.taus,
            meta=meta,
        )


class DGP(Protocol):
    """Protocol for data-generating processes."""

    @property
    def info(self) -> DGPInfo:
        ...

    def generate(self, *, seed: int, **kwargs: Any) -> DGPOutput:
        ...
