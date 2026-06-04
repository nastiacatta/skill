"""Baseline DGP: y ~ U(0,1), reports = y + forecaster noise."""
import numpy as np
from scipy.stats import norm


def generate_truth_and_reports(T, n_forecasters, seed=None):
    rng = np.random.default_rng(seed)

    noise = rng.lognormal(mean=-2.5, sigma=0.4, size=n_forecasters)
    noise = np.maximum(noise, 0.01)

    y = rng.uniform(0.0, 1.0, size=T)

    reports = np.zeros((n_forecasters, T), dtype=np.float64)
    for i in range(n_forecasters):
        reports[i] = np.clip(y + rng.normal(0.0, noise[i], size=T), 0.0, 1.0)

    return y, reports, noise


def generate_truth_and_quantile_reports(T, n, taus, seed=None):
    """
    Generate truth y and quantile reports q_reports shape (n, T, K).
    q_{i,t,tau} = clip(mu_{i,t} + sigma_i * Phi^{-1}(tau), 0, 1)
    where mu_{i,t} is point report, sigma_i is agent dispersion (noise).
    """
    taus = np.asarray(taus, dtype=np.float64)
    K = len(taus)

    y, point_reports, noise = generate_truth_and_reports(T, n, seed=seed)
    sigma_i = np.maximum(noise, 0.02)

    q_reports = np.zeros((n, T, K), dtype=np.float64)
    for i in range(n):
        mu = point_reports[i]
        for k, tau in enumerate(taus):
            q_reports[i, :, k] = np.clip(
                mu + sigma_i[i] * norm.ppf(tau), 0.0, 1.0
            )
    # Enforce monotonicity in tau: after clipping, quantiles may cross; sort by tau and apply cummax.
    tau_order = np.argsort(taus)
    for i in range(n):
        for t in range(T):
            q_row = q_reports[i, t, tau_order].copy()
            q_reports[i, t, tau_order] = np.maximum.accumulate(q_row)

    return y, q_reports, noise


def generate_client_report(y, T, seed=None):
    """Client report r_c per round for utility eligibility. r_c = clip(y + noise, 0, 1)."""
    rng = np.random.default_rng(seed)
    noise_scale = 0.1
    return np.clip(
        np.asarray(y, dtype=np.float64).ravel() + rng.normal(0.0, noise_scale, size=T),
        0.0, 1.0
    )


def generate_client_quantile_report(y, T, taus, seed=None):
    """
    Client quantile report for utility eligibility when scoring_mode is quantiles_crps.
    Builds quantiles around a noisy point report so s_client is comparable to forecaster CRPS-hat.
    Returns shape (T, K), monotone in tau.
    """
    rng = np.random.default_rng(seed)
    taus = np.asarray(taus, dtype=np.float64)
    K = len(taus)
    y = np.asarray(y, dtype=np.float64).ravel()
    point = np.clip(
        y + rng.normal(0.0, 0.1, size=T), 0.0, 1.0
    )
    disp = 0.1
    q_reports = np.zeros((T, K), dtype=np.float64)
    for k, tau in enumerate(taus):
        q_reports[:, k] = np.clip(
            point + disp * norm.ppf(tau), 0.0, 1.0
        )
    tau_order = np.argsort(taus)
    for t in range(T):
        q_row = q_reports[t, tau_order].copy()
        q_reports[t, tau_order] = np.maximum.accumulate(q_row)
    return q_reports
