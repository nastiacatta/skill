"""
DGP: Baseline (legacy / sanity only).

Truth y ~ Uniform[0,1]; reports = clip(y + forecaster noise, 0, 1).
Acceptable for sanity checks, but clipping distorts loss geometry near the
boundaries. Do not use for strong claims about recovering intrinsic skill;
use the latent Bayes-consistent generator for main evaluation.
"""
from __future__ import annotations

import numpy as np
from scipy.stats import norm

from ..types import DGPInfo
from .protocol import DGPOutput
from .registry import register_dgp


class _DGPBaseline:
    info = DGPInfo(
        name="baseline",
        output="point",
        support="[0,1]",
        link="identity",
        truth_source="exogenous",
        description="[Legacy/sanity only] y ~ U(0,1); reports_i = clip(y + noise_i, 0, 1).",
    )

    def generate(
        self,
        *,
        seed: int,
        T: int,
        n_forecasters: int,
        quantiles: np.ndarray | None = None,
        **kwargs,
    ) -> DGPOutput:
        # Independent RNG sub-streams so that changing ``n_forecasters``
        # does not change the realised truth ``y`` or the
        # already-assigned per-forecaster noise for agents < n. This
        # is the DGP-audit HIGH fix (May 2026): the previous
        # implementation drew ``noise`` with size=n_forecasters from a
        # shared RNG, then drew ``y`` afterwards, so bumping n shifted
        # the RNG state and changed every downstream realisation.
        # Cross-n sensitivity experiments sharing a seed were therefore
        # comparing incomparable worlds.
        ss = np.random.SeedSequence(seed)
        # Fixed-purpose children: truth, per-agent noise level, per-agent
        # report noise (arranged as a list so addition of agent i only
        # touches children >= i).
        truth_rng = np.random.default_rng(ss.spawn(1)[0])
        # Reserve a fixed block of agent streams. Using a generous
        # upper bound (4096 agents is far beyond any realistic panel)
        # means ``seed`` keyed into agent-0 is the same irrespective
        # of how many total agents exist.
        _MAX_AGENTS = 4096
        agent_seeds = ss.spawn(_MAX_AGENTS + 1)[1:]  # offset past truth
        if n_forecasters > _MAX_AGENTS:
            raise ValueError(
                f"n_forecasters={n_forecasters} exceeds _MAX_AGENTS={_MAX_AGENTS}"
            )

        y = truth_rng.uniform(0.0, 1.0, size=T).astype(np.float64)

        noise = np.zeros(n_forecasters, dtype=np.float64)
        reports = np.zeros((n_forecasters, T), dtype=np.float64)
        for i in range(n_forecasters):
            agent_rng = np.random.default_rng(agent_seeds[i])
            noise_i = float(np.maximum(agent_rng.lognormal(mean=-2.5, sigma=0.4), 0.01))
            noise[i] = noise_i
            reports[i] = np.clip(y + agent_rng.normal(0.0, noise_i, size=T), 0.0, 1.0)

        q_reports = None
        taus = None
        if quantiles is not None:
            taus = np.asarray(quantiles, dtype=np.float64).ravel()
            K = taus.size
            sigma_i = np.maximum(noise, 0.02)
            q_reports = np.zeros((n_forecasters, T, K), dtype=np.float64)
            for i in range(n_forecasters):
                for k, tau in enumerate(taus):
                    q_reports[i, :, k] = np.clip(
                        reports[i] + sigma_i[i] * norm.ppf(tau), 0.0, 1.0
                    )
            for i in range(n_forecasters):
                o = np.argsort(taus)
                for t in range(T):
                    q_reports[i, t, o] = np.maximum.accumulate(q_reports[i, t, o].copy())

        return DGPOutput(
            y=y,
            reports=reports,
            q_reports=q_reports,
            tau_true=noise,
            taus=taus,
            meta={},
        )


DGP_BASELINE = register_dgp(_DGPBaseline())
