"""
Core types: DGP metadata, pre-generated data container.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class DGPInfo:
    """Metadata describing a data-generating process."""

    name: str
    output: str  # "point" | "quantiles"
    support: str  # "[0,1]" | "R"
    link: str  # "probit" | "logistic" | "identity"
    truth_source: str  # "exogenous" | "endogenous"
    description: str


@dataclass
class PreGeneratedData:
    """Single typed container for pre-generated experiment data."""

    y: np.ndarray  # (T,)
    reports: np.ndarray | None = None  # (n, T) point reports
    q_reports: np.ndarray | None = None  # (n, T, K) quantile reports
    tau_true: np.ndarray | None = None  # (n,) or forecaster_noise
    taus: np.ndarray | None = None  # (K,) quantile levels
    meta: dict | None = None

