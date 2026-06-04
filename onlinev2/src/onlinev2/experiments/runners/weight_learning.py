"""
Weight learning experiment: run online LMS on aggregation DGP data, return results.
"""
from __future__ import annotations

import numpy as np
from scipy.stats import norm

from ...dgps import get_dgp
from ..config import WeightLearningConfig


def _link_inv(y: np.ndarray, link: str) -> np.ndarray:
    if link == "probit":
        return norm.ppf(np.clip(y, 1e-12, 1.0 - 1e-12)).astype(np.float64)
    return np.asarray(y, dtype=np.float64)


def _project_simplex(v: np.ndarray) -> np.ndarray:
    v = np.asarray(v, dtype=np.float64).flatten()
    n = len(v)
    u = np.sort(v)[::-1]
    cssv = np.cumsum(u) - 1.0
    rho = int(n)
    for k in range(1, n + 1):
        if u[k - 1] > cssv[k - 1] / k:
            rho = k
    tau = cssv[rho - 1] / rho
    return np.maximum(v - tau, 0.0)


def online_weight_learning(
    y: np.ndarray,
    reports: np.ndarray,
    eta: float = 0.05,
    w0: np.ndarray | None = None,
    project_to_simplex: bool = False,
    eta_decay: float = 0.0,
) -> np.ndarray:
    n, T = reports.shape
    w = np.ones(n, dtype=np.float64) / n if w0 is None else np.asarray(w0).ravel().copy()
    if project_to_simplex:
        w = _project_simplex(w)
    w_hist = np.zeros((n, T), dtype=np.float64)
    for t in range(T):
        w_hist[:, t] = w.copy()
        eta_t = eta / (1.0 + t * eta_decay) if eta_decay > 0 else eta
        r_t = reports[:, t]
        y_t = float(y[t])
        y_hat = float(np.dot(w, r_t))
        err = y_t - y_hat
        grad = -2.0 * err * r_t
        w = w - eta_t * grad
        w = _project_simplex(w) if project_to_simplex else np.maximum(w, 0.0)
    return w_hist


def run_weight_learning(config: WeightLearningConfig) -> dict:
    """Run weight learning experiment; return metrics and arrays (no file I/O)."""
    T = config.T
    n = config.n_forecasters
    if config.true_w is not None and len(config.true_w) == n:
        true_w = np.array(config.true_w, dtype=np.float64)
    else:
        true_w = np.ones(n, dtype=np.float64) / n
    w0 = np.ones(n, dtype=np.float64) / n
    link = "probit"

    w_hist_list = []
    final_weights = []
    method_labels = []

    for method in config.methods:
        dgp = get_dgp(f"aggregation_method{method}")
        out = dgp.generate(
            seed=config.seed,
            T=T,
            n_forecasters=n,
            w=true_w,
            normalise_w=config.normalise_w,
            sigma_mu_noise=config.sigma_mu_noise if method == 3 else 0.0,
            link=link,
        )
        y_latent = _link_inv(out.y, link)
        reports_latent = _link_inv(out.reports, link)
        w_hist = online_weight_learning(
            y_latent,
            reports_latent,
            eta=config.eta,
            w0=w0,
            project_to_simplex=False,
            eta_decay=config.eta_decay,
        )
        w_hist_list.append(w_hist)
        final_weights.append(w_hist[:, -1].tolist())
        method_labels.append(f"Method {method}")

    w_hist_stacked = np.stack(w_hist_list, axis=0)
    return {
        "w_hist": w_hist_stacked,
        "true_w": true_w,
        "final_weights": final_weights,
        "method_labels": method_labels,
        "config": config.to_dict(),
    }
