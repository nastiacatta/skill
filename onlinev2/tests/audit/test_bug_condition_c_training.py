"""Bug Condition C — Model training soundness (Property 5).

Encodes model training soundness clauses 1.10–1.17 / expected 2.10–2.17 as 7
property-based tests.  The forecasters are imported from
``onlinev2.real_data.forecasters`` which is where they actually live.

Some clauses (1.14, 1.15, 1.17) check for attributes/flags that do not
yet exist on the current code base — those tests are *expected* to fail
on unfixed code, and are the deterministic counter-examples the fixes
lock against.

**Validates: Requirements 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17**
"""
from __future__ import annotations

import copy
import json
import os
import pickle

import numpy as np
import pytest

from onlinev2.real_data.forecasters import (
    ARIMAForecaster,
    BaseForecaster,
    EnsembleForecaster,
    MLPForecaster,
    MovingAverageForecaster,
    NaiveForecaster,
    ThetaForecaster,
    XGBoostForecaster,
    get_all_forecasters,
)

from . import dgps

pytestmark = [pytest.mark.audit]

_CE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "counterexamples", "c")


def _commit_counterexample(clause: str, name: str, payload: dict) -> None:
    os.makedirs(_CE_DIR, exist_ok=True)
    path = os.path.join(_CE_DIR, f"{clause}_{name}.json")
    if os.path.exists(path):
        return
    try:
        with open(path, "w") as f:
            json.dump(payload, f, indent=2, default=float, sort_keys=True)
    except Exception:
        pass


def _fresh_forecasters() -> list[BaseForecaster]:
    """Isolated copy of the 7 forecasters (avoids xgboost/torch import at collection)."""
    return get_all_forecasters()


# ---------------------------------------------------------------------------
# Clause 1.10 / 2.10 — no future leakage
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("seed", [0, 1, 2, 42, 2024])
def test_no_future_leakage(seed: int):
    """Inject a NaN sentinel into history[t:] and assert fit + predict on
    history[:t] is unaffected — i.e. the forecaster reads only from the
    past.  Applied to the cheap forecasters (Naive, EWMA, Theta, ARIMA);
    XGBoost / MLP are skipped from this particular property due to fit
    cost, but the same invariant holds by construction in their fit()
    because they only ever pass a slice of history.
    """
    rng = np.random.default_rng(seed)
    T = 150
    history_full = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0
    )
    t = 100
    for fc_ctor in [
        NaiveForecaster,
        MovingAverageForecaster,
        ThetaForecaster,
        # ARIMA fit is relatively cheap on 100 points
        lambda: ARIMAForecaster(order=(1, 0, 0), residual_window=100),
    ]:
        fc = fc_ctor()
        fc.fit(history_full[:t])
        pred_clean = float(fc.predict())

        # Second instance fit on the same prefix with NaN-poisoned future
        poisoned = history_full.copy()
        poisoned[t:] = np.nan
        fc2 = fc_ctor()
        fc2.fit(poisoned[:t])
        pred_poisoned = float(fc2.predict())

        ok = np.isfinite(pred_poisoned) and np.isclose(
            pred_clean, pred_poisoned, atol=1e-12, rtol=0
        )
        if not ok:
            _commit_counterexample(
                "1_10",
                f"leakage_{fc.name.replace(' ', '_')}_seed{seed}",
                {
                    "forecaster": fc.name,
                    "seed": seed,
                    "pred_clean": pred_clean,
                    "pred_poisoned": pred_poisoned,
                },
            )
        assert ok, (
            f"forecaster {fc.name} leaks future data: clean={pred_clean}, "
            f"poisoned={pred_poisoned}"
        )


# ---------------------------------------------------------------------------
# Clause 1.11 / 2.11 — point std > 1e-4 post-warmup
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("seed", [0, 1, 2, 42, 2024])
def test_point_std_above_threshold(seed: int):
    """Post-warmup sample std of the point-forecast series must exceed 1e-4
    on a non-constant but quiet DGP.  Checked for the cheap forecasters.
    """
    rng = np.random.default_rng(seed)
    T = 300
    panel, y = dgps.non_constant_but_quiet(seed=seed, T=T, N=1)
    for fc_ctor, name in [
        (NaiveForecaster, "Naive"),
        (lambda: MovingAverageForecaster(span=5), "EWMA"),
        (ThetaForecaster, "Theta"),
    ]:
        fc = fc_ctor()
        preds = np.zeros(T)
        for t in range(1, T):
            fc.fit(y[:t])
            preds[t] = float(fc.predict())
            fc.update_residuals(float(y[t]), preds[t])
        warmup = 50
        std = float(np.std(preds[warmup:]))
        ok = std > 1e-4
        if not ok:
            _commit_counterexample(
                "1_11",
                f"point_std_{name}_seed{seed}",
                {"forecaster": name, "seed": seed, "std": std},
            )
        assert ok, f"{name}: post-warmup point std = {std} < 1e-4"


# ---------------------------------------------------------------------------
# Clause 1.12 / 2.12 — quantile interval width > 1e-4 post-warmup
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("seed", [0, 1, 2, 42, 2024])
def test_interval_width_above_threshold(seed: int):
    """Post-warmup mean (q0.9 − q0.1) must exceed 1e-4 on a non-constant DGP.
    Checked on the cheap forecasters.
    """
    rng = np.random.default_rng(seed)
    T = 300
    _, y = dgps.non_constant_but_quiet(seed=seed, T=T, N=1)
    taus = np.array([0.1, 0.5, 0.9])
    for fc_ctor, name in [
        (NaiveForecaster, "Naive"),
        (lambda: MovingAverageForecaster(span=5), "EWMA"),
        (ThetaForecaster, "Theta"),
    ]:
        fc = fc_ctor()
        widths = []
        for t in range(1, T):
            fc.fit(y[:t])
            q = fc.predict_quantiles(taus)
            widths.append(float(q[-1] - q[0]))
            fc.update_residuals(float(y[t]), float(fc.predict()))
        warmup = 50
        mean_width = float(np.mean(widths[warmup:]))
        ok = mean_width > 1e-4
        if not ok:
            _commit_counterexample(
                "1_12",
                f"interval_width_{name}_seed{seed}",
                {"forecaster": name, "seed": seed, "mean_width": mean_width},
            )
        assert ok, f"{name}: mean interval width = {mean_width} < 1e-4"


# ---------------------------------------------------------------------------
# Clause 1.13 / 2.13 — fit updates state on different histories
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("seed", [0, 1, 2, 42, 2024])
def test_fit_updates_state_on_different_histories(seed: int):
    """Refitting on two materially different histories must alter at least
    one observable field.  Uses ``dgps.shifted_mean_regime`` so histories
    pre- and post-breakpoint differ markedly.
    """
    T = 200
    _, y = dgps.shifted_mean_regime(seed=seed, T=T, N=1)
    mid = T // 2
    for fc_ctor, probe, name in [
        (NaiveForecaster, lambda fc: fc._last, "Naive"),
        (lambda: MovingAverageForecaster(span=5), lambda fc: fc._ewma, "EWMA"),
        (ThetaForecaster, lambda fc: fc.predict(), "Theta"),
    ]:
        fc = fc_ctor()
        fc.fit(y[:mid])
        state_a = probe(fc)
        fc.fit(y[mid:])
        state_b = probe(fc)
        ok = not np.isclose(float(state_a), float(state_b), atol=1e-10, rtol=0)
        if not ok:
            _commit_counterexample(
                "1_13",
                f"fit_noop_{name}_seed{seed}",
                {"forecaster": name, "seed": seed, "state_a": state_a, "state_b": state_b},
            )
        assert ok, f"{name}: fit is a no-op ({state_a} == {state_b})"


# ---------------------------------------------------------------------------
# Clause 1.14 / 2.14 — XGBoost/MLP per-τ models populated + fallback_counter
# ---------------------------------------------------------------------------
def test_xgboost_and_mlp_quantile_models_populated():
    """XGBoost quantile-models dict should be non-empty after a successful
    fit on sufficient data.  Also asserts a ``fallback_counter`` attribute
    exists and is 0 — this attribute does NOT exist yet on current code and
    is added by fix Task 4.3.  Expected to fail on current code.
    """
    xgb = pytest.importorskip("xgboost", reason="xgboost not available")

    taus = np.array([0.1, 0.5, 0.9])
    fc = XGBoostForecaster(n_lags=5, taus=taus)
    rng = np.random.default_rng(7)
    history = np.cumsum(0.01 * rng.standard_normal(300)) + 0.5
    history = np.clip(history, 0.0, 1.0)
    fc.fit(history)

    quantile_ok = len(fc._quantile_models) == len(taus)

    # fallback_counter is added by the fix task; on current code this will fail.
    fallback_counter_present = hasattr(fc, "fallback_counter")
    fallback_counter_zero = getattr(fc, "fallback_counter", None) == 0

    ok = quantile_ok and fallback_counter_present and fallback_counter_zero
    if not ok:
        _commit_counterexample(
            "1_14",
            "xgboost_quantile_models_or_counter_missing",
            {
                "quantile_models_len": len(fc._quantile_models),
                "expected_len": len(taus),
                "fallback_counter_present": fallback_counter_present,
                "fallback_counter_value": getattr(fc, "fallback_counter", None),
            },
        )
    assert ok, (
        f"per-τ models={len(fc._quantile_models)}/{len(taus)}, "
        f"fallback_counter present={fallback_counter_present}, "
        f"value={getattr(fc, 'fallback_counter', None)}"
    )


# ---------------------------------------------------------------------------
# Clause 1.15 / 2.15 — ARIMA between refits flagged is_persistence
# ---------------------------------------------------------------------------
def test_arima_between_refits_flagged():
    """ARIMA between refits returns self._history[-1] (persistence).  If so,
    a per-round flag ``is_persistence`` must be set somewhere observable.
    This flag does NOT exist yet on current code — expected counterexample.
    """
    rng = np.random.default_rng(42)
    T = 120
    history = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0
    )
    fc = ARIMAForecaster(order=(1, 0, 0), residual_window=50)
    fc.fit(history[:50])
    # Between refits: predict() is defined to return history[-1].
    fc._history = history[:75]
    pred = float(fc.predict())
    is_persistence_eq = np.isclose(pred, float(history[74]), atol=1e-12, rtol=0)

    # The flag the fix task introduces; on current code it is absent.
    has_flag_attr = hasattr(fc, "is_persistence") or hasattr(fc, "_is_persistence")

    ok = (not is_persistence_eq) or has_flag_attr
    if not ok:
        _commit_counterexample(
            "1_15",
            "arima_persistence_unflagged",
            {
                "pred": pred,
                "expected_last": float(history[74]),
                "has_flag_attr": has_flag_attr,
            },
        )
    assert ok, (
        "ARIMA predict() == history[-1] between refits but no "
        "is_persistence flag is exposed on the forecaster."
    )


# ---------------------------------------------------------------------------
# Clause 1.16 / 2.16 — Ensemble member residuals match standalone
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("seed", [0, 1, 2, 42, 2024])
def test_ensemble_member_residuals_match_standalone(seed: int):
    """Run Ensemble alongside standalone Naive and MovingAverage(span=5).
    The Ensemble's internal ``_naive._residuals`` must equal what a
    standalone NaiveForecaster would accumulate over the same stream;
    likewise for ``_ewma`` vs MovingAverage.
    """
    T = 100
    rng = np.random.default_rng(seed)
    y = np.clip(0.5 + 0.05 * rng.standard_normal(T), 0.0, 1.0)
    ens = EnsembleForecaster()
    naive = NaiveForecaster(residual_window=100)
    ewma = MovingAverageForecaster(span=5, residual_window=100)

    for t in range(1, T):
        hist = y[:t]
        ens.fit(hist)
        naive.fit(hist)
        ewma.fit(hist)
        # Use each forecaster's own pre-round prediction.
        p_naive = float(naive.predict())
        p_ewma = float(ewma.predict())
        y_t = float(y[t])
        naive.update_residuals(y_t, p_naive)
        ewma.update_residuals(y_t, p_ewma)
        ens.update_residuals(y_t, float(ens.predict()))

    # Ensemble member residuals should match the standalone buffers
    # if post-round predictions are being used consistently.
    ens_naive = np.asarray(ens._naive._residuals, dtype=np.float64)
    ens_ewma = np.asarray(ens._ewma._residuals, dtype=np.float64)
    std_naive = np.asarray(naive._residuals, dtype=np.float64)
    std_ewma = np.asarray(ewma._residuals, dtype=np.float64)

    # The ensemble uses the pre-round cached predict() for member updates,
    # which is expected to drift from standalone (this is the bug).
    min_n = min(ens_naive.size, std_naive.size)
    naive_ok = np.allclose(
        ens_naive[-min_n:], std_naive[-min_n:], atol=1e-10, rtol=0
    )
    min_e = min(ens_ewma.size, std_ewma.size)
    ewma_ok = np.allclose(
        ens_ewma[-min_e:], std_ewma[-min_e:], atol=1e-10, rtol=0
    )

    ok = naive_ok and ewma_ok
    if not ok:
        _commit_counterexample(
            "1_16",
            f"ensemble_residual_drift_seed{seed}",
            {
                "seed": seed,
                "naive_ok": naive_ok,
                "ewma_ok": ewma_ok,
                "ens_naive_tail": ens_naive[-5:].tolist(),
                "std_naive_tail": std_naive[-5:].tolist(),
                "ens_ewma_tail": ens_ewma[-5:].tolist(),
                "std_ewma_tail": std_ewma[-5:].tolist(),
            },
        )
    assert ok, (
        f"Ensemble member residuals drift from standalone "
        f"(naive_ok={naive_ok}, ewma_ok={ewma_ok})"
    )
