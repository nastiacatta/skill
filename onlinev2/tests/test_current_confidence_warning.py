import pytest

from onlinev2.simulation import run_simulation


def test_current_round_confidence_emits_warning():
    """lag_confidence=False must emit a RuntimeWarning about deposits depending
    on the current report, so users know this is not theorem-safe."""
    with pytest.warns(RuntimeWarning, match="current report"):
        run_simulation(
            T=5,
            n_forecasters=3,
            scoring_mode="quantiles_crps",
            deposit_mode="bankroll",
            lag_confidence=False,
            seed=1,
        )


def test_strict_truthfulness_rejects_current_round_confidence():
    """strict_truthfulness=True with lag_confidence=False must raise, not warn.
    This gives thesis authors a concrete opt-in guard against accidentally
    running a theorem-claiming pipeline with report-dependent deposits.
    """
    with pytest.raises(ValueError, match="strict_truthfulness=True"):
        run_simulation(
            T=5,
            n_forecasters=3,
            scoring_mode="quantiles_crps",
            deposit_mode="bankroll",
            lag_confidence=False,
            strict_truthfulness=True,
            seed=1,
        )


def test_strict_truthfulness_allows_lagged_confidence():
    """strict_truthfulness=True with lag_confidence=True is the intended
    theorem-preserving configuration; it must run without raising and
    without the RuntimeWarning."""
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("error", RuntimeWarning)  # treat as errors
        result = run_simulation(
            T=5,
            n_forecasters=3,
            scoring_mode="quantiles_crps",
            deposit_mode="bankroll",
            lag_confidence=True,
            strict_truthfulness=True,
            seed=1,
        )
    # sanity: run_simulation returned a dict with the logged guard flag.
    assert result["params"]["strict_truthfulness"] is True
    assert result["params"]["lag_confidence"] is True
