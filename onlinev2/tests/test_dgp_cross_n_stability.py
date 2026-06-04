"""DGP-audit pass-5 fix: adding a forecaster to a synthetic panel
should not change the realisations of existing forecasters.

Before the fix, each DGP drew per-agent arrays from a shared RNG
with ``size=(n, T)``, so bumping ``n`` shifted the entire RNG state
and changed every downstream draw. Any cross-``n`` sensitivity
experiment that kept the seed fixed was therefore comparing
incomparable worlds.

After the fix, per-agent draws come from independent sub-streams
spawned from the seed's SeedSequence, keyed by agent index.
"""
from __future__ import annotations

import numpy as np

from onlinev2.dgps.aggregation import DGP_AGGREGATION_METHOD1
from onlinev2.dgps.baseline import DGP_BASELINE
from onlinev2.dgps.latent_fixed import DGP_LATENT_FIXED


SEED = 42


class TestBaselineDGPCrossN:
    """Baseline DGP: adding a forecaster leaves y and earlier agents intact."""

    def test_y_unchanged_when_n_grows(self):
        out_5 = DGP_BASELINE.generate(seed=SEED, T=200, n_forecasters=5)
        out_10 = DGP_BASELINE.generate(seed=SEED, T=200, n_forecasters=10)
        # Exogenous y must not depend on n.
        np.testing.assert_allclose(out_5.y, out_10.y, atol=0.0)

    def test_first_n_noise_levels_unchanged(self):
        out_5 = DGP_BASELINE.generate(seed=SEED, T=200, n_forecasters=5)
        out_10 = DGP_BASELINE.generate(seed=SEED, T=200, n_forecasters=10)
        np.testing.assert_allclose(out_5.tau_true, out_10.tau_true[:5], atol=0.0)

    def test_first_n_reports_unchanged(self):
        out_5 = DGP_BASELINE.generate(seed=SEED, T=200, n_forecasters=5)
        out_10 = DGP_BASELINE.generate(seed=SEED, T=200, n_forecasters=10)
        np.testing.assert_allclose(out_5.reports, out_10.reports[:5], atol=0.0)


class TestLatentFixedDGPCrossN:
    """Latent-fixed DGP: y and earlier agents' reports stable when n grows."""

    def test_y_unchanged_when_n_grows(self):
        tau_5 = np.array([0.1, 0.2, 0.3, 0.4, 0.5])
        tau_10 = np.concatenate([tau_5, np.array([0.6, 0.7, 0.8, 0.9, 1.0])])
        out_5 = DGP_LATENT_FIXED.generate(seed=SEED, T=200, n=5, tau_i=tau_5)
        out_10 = DGP_LATENT_FIXED.generate(seed=SEED, T=200, n=10, tau_i=tau_10)
        np.testing.assert_allclose(out_5.y, out_10.y, atol=0.0)

    def test_first_n_reports_unchanged(self):
        tau_5 = np.array([0.1, 0.2, 0.3, 0.4, 0.5])
        tau_10 = np.concatenate([tau_5, np.array([0.6, 0.7, 0.8, 0.9, 1.0])])
        out_5 = DGP_LATENT_FIXED.generate(seed=SEED, T=200, n=5, tau_i=tau_5)
        out_10 = DGP_LATENT_FIXED.generate(seed=SEED, T=200, n=10, tau_i=tau_10)
        np.testing.assert_allclose(out_5.reports, out_10.reports[:5], atol=0.0)


class TestAggregationDGPCrossN:
    """Aggregation DGP: first-n reports stable; y is endogenous (not stable)."""

    def test_first_n_reports_unchanged_endogenous_y(self):
        out_5 = DGP_AGGREGATION_METHOD1.generate(seed=SEED, T=200, n_forecasters=5)
        out_10 = DGP_AGGREGATION_METHOD1.generate(seed=SEED, T=200, n_forecasters=10)
        # Reports for agents 0..4 must be identical.
        np.testing.assert_allclose(out_5.reports, out_10.reports[:5], atol=0.0)
        # y is endogenous (depends on all n agents) so it will differ
        # — this is a property of the DGP, not an RNG artefact.
        # We assert only that the reports are stable.

    def test_reproducibility_same_n(self):
        """Running twice with the same seed gives bit-identical output."""
        a = DGP_AGGREGATION_METHOD1.generate(seed=SEED, T=100, n_forecasters=7)
        b = DGP_AGGREGATION_METHOD1.generate(seed=SEED, T=100, n_forecasters=7)
        np.testing.assert_allclose(a.y, b.y, atol=0.0)
        np.testing.assert_allclose(a.reports, b.reports, atol=0.0)


class TestSeedIndependence:
    """Different seeds give different outputs (sanity check)."""

    def test_different_seeds_different_output(self):
        a = DGP_BASELINE.generate(seed=1, T=100, n_forecasters=5)
        b = DGP_BASELINE.generate(seed=2, T=100, n_forecasters=5)
        # y should differ; at least one element
        assert not np.allclose(a.y, b.y)
