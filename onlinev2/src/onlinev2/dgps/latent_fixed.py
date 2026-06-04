"""
DGP: Truth fixed first (exogenous). Forecasters observe noisy signals of Z_t.

Canonical Bayes-consistent setup (Masters notes §10, Option C):
    Z_t ~ N(0, sigma_Z^2)
    y_t = Phi(Z_t)
    X_{i,t} = Z_t + beta_i + tau_i * eps_{i,t},    eps_{i,t} ~ N(0, 1)

    Posterior for Z_t | X_{i,t}:
        mu_{i,t} = (sigma_Z^2 / (sigma_Z^2 + tau_i^2)) * (X_{i,t} - beta_i)
        v_i      = sigma_Z^2 * tau_i^2 / (sigma_Z^2 + tau_i^2)

    Point report (median-optimal for MAE, probit link):
        r_{i,t} = Phi(mu_{i,t})

    Predictive quantile (Bayes-calibrated, kappa_i = 1):
        q_{i,t}(tau) = Phi(mu_{i,t} + kappa_i * sqrt(v_i) * Phi^{-1}(tau))

The optional ``kappa_i`` keyword (``kwargs["kappa_i"]``) scales the posterior
standard deviation used to build predictive quantiles, exposing a concrete
miscalibration knob:
  * ``kappa_i = 1.0`` -> Bayes-calibrated (default)
  * ``kappa_i < 1``   -> overconfident / under-dispersed forecaster
  * ``kappa_i > 1``   -> underconfident / over-dispersed forecaster

Symbol hygiene: ``beta_i`` = DGP bias (not deposit ``b_i``); ``mu_{i,t}`` =
posterior mean (not wager ``m_i``); ``tau_i`` = forecaster noise std (not
quantile level ``tau``).
"""
from __future__ import annotations

import numpy as np
from scipy.stats import norm

from ..types import DGPInfo
from .protocol import DGPOutput
from .registry import register_dgp


def _phi(z: np.ndarray) -> np.ndarray:
    return norm.cdf(z).astype(np.float64)


class _DGPLatentFixed:
    info = DGPInfo(
        name="latent_fixed",
        output="point",
        support="[0,1]",
        link="probit",
        truth_source="exogenous",
        description="Truth Z_t ~ N(0,σ²) drawn first; forecasters see X_i = Z + β_i + eps_i.",
    )

    def generate(
        self,
        *,
        seed: int,
        T: int,
        n: int,
        tau_i: np.ndarray,
        sigma_z: float = 1.0,
        beta_i: np.ndarray | None = None,
        b_i: np.ndarray | None = None,
        quantiles: np.ndarray | None = None,
        **kwargs,
    ) -> DGPOutput:
        """Generate Bayes-consistent signals, reports and (optional) quantiles.

        Extra kwargs:
          kappa_i : array-like (n,) or scalar, default 1.0
              Per-forecaster miscalibration multiplier on the posterior std
              in the quantile formula. 1.0 = Bayes-calibrated. Accepts a
              scalar broadcast across all forecasters.
        """
        rng = np.random.default_rng(seed)
        tau_true = np.asarray(tau_i, dtype=np.float64).ravel()
        if tau_true.size != n:
            raise ValueError(f"tau_i must have length n (got {tau_true.size})")

        _beta = beta_i if beta_i is not None else b_i
        _beta = np.zeros(n, dtype=np.float64) if _beta is None else np.asarray(_beta, dtype=np.float64).ravel()
        if _beta.size != n:
            raise ValueError(f"beta_i must have length n (got {_beta.size})")

        Z = rng.normal(0.0, sigma_z, size=T).astype(np.float64)
        y = _phi(Z)

        Z_bc = np.broadcast_to(Z, (n, T))
        # Per-agent independent eps streams so that adding agent n+1
        # does not change the realisations of agents 0..n (DGP-audit
        # May 2026, LOW fix). ``tau_i`` is already user-supplied so
        # the noise *levels* were stable before; now the realisations
        # are too.
        ss = rng.bit_generator.seed_seq
        agent_seeds = ss.spawn(n)
        eps = np.zeros((n, T), dtype=np.float64)
        for i in range(n):
            agent_rng = np.random.default_rng(agent_seeds[i])
            eps[i] = agent_rng.normal(0.0, 1.0, size=T)
        tau_bc = np.broadcast_to(tau_true[:, None], (n, T))
        X = Z_bc + _beta[:, None] + tau_bc * eps

        sig2 = float(sigma_z) ** 2
        denom = sig2 + tau_true**2
        mu = (sig2 / denom)[:, None] * (X - _beta[:, None])
        reports = _phi(mu)

        q_reports = None
        taus = None
        if quantiles is not None:
            taus = np.asarray(quantiles, dtype=np.float64).ravel()
            z_tau = norm.ppf(taus).astype(np.float64)
            v = (sig2 * tau_true**2 / denom)[:, None]
            kappa_raw = kwargs.get("kappa_i", np.ones(n, dtype=np.float64))
            kappa_arr = np.asarray(kappa_raw, dtype=np.float64).ravel()
            if kappa_arr.size == 1:
                kappa_arr = np.full(n, float(kappa_arr[0]), dtype=np.float64)
            if kappa_arr.size != n:
                raise ValueError(
                    f"kappa_i must have length n={n} (got {kappa_arr.size}) or be scalar"
                )
            kappa = kappa_arr[:, None, None]
            q_latent = mu[:, :, None] + (kappa * np.sqrt(v)[:, :, None] * z_tau[None, None, :])
            q_reports = _phi(q_latent)
            for i in range(n):
                for t in range(T):
                    o = np.argsort(taus)
                    row = q_reports[i, t, o].copy()
                    q_reports[i, t, o] = np.maximum.accumulate(row)

        return DGPOutput(
            y=y,
            reports=reports,
            q_reports=q_reports,
            tau_true=tau_true,
            taus=taus,
            meta={"sigma_z": sigma_z},
        )


DGP_LATENT_FIXED = register_dgp(_DGPLatentFixed())
