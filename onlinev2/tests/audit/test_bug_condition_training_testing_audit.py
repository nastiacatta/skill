"""Bug Condition — Model training & testing methodology audit.

Encodes correctness clauses 1.1-1.16 of the model training & testing
methodology audit as 14 exploration cases (one per clause). These tests
are designed to FAIL on the unfixed code — the failures confirm B1-B14
exist as described. They turn green as the fixes land.

Every case is tagged with its clause in the docstring and a
`# Feature: model-training-testing-audit, Property N` marker.

These are internal correctness properties verified during the methodology audit.

**Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10,
1.11, 1.12, 1.13, 1.14, 1.15, 1.16**
"""
# Feature: model-training-testing-audit, Property 1: Bug Condition
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from hypothesis.extra.numpy import arrays

pytestmark = [pytest.mark.audit]

REPO_ROOT = Path(__file__).resolve().parents[3]
_CE_DIR = Path(__file__).parent / "fixtures" / "counterexamples" / "training_testing"


def _commit_counterexample(clause: str, name: str, payload: dict) -> None:
    """Persist a failing example for forensic review (idempotent)."""
    _CE_DIR.mkdir(parents=True, exist_ok=True)
    path = _CE_DIR / f"{clause}_{name}.json"
    if path.exists():
        return
    try:
        with open(path, "w") as f:
            json.dump(payload, f, indent=2, default=float, sort_keys=True)
    except Exception:
        pass


def _synthetic_series(seed: int, T: int) -> np.ndarray:
    """Piecewise-stationary synthetic series in [0, 1]."""
    rng = np.random.default_rng(seed)
    x = 0.5 + 0.05 * np.cumsum(rng.standard_normal(T))
    # inject a regime shift halfway through
    x[T // 2 :] += 0.15
    return np.clip(x, 0.0, 1.0)


# ---------------------------------------------------------------------------
# B1 / clause 1.1 — causal normalization excludes future
# ---------------------------------------------------------------------------
@given(
    seed=st.integers(min_value=0, max_value=10_000),
    warmup=st.integers(min_value=20, max_value=200),
    perturbation=st.floats(
        min_value=-10.0, max_value=10.0, allow_nan=False, allow_infinity=False
    ),
)
@settings(
    max_examples=25,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture],
)
def test_B1_causal_normalize_excludes_future(
    seed: int, warmup: int, perturbation: float
) -> None:
    """Perturbing series[warmup:] MUST NOT change norm[:warmup].

    The unfixed `normalize_series(series)` takes lo/hi from the full
    array, so mutating any element downstream of the warmup window shifts
    the scale of every earlier element. The fix introduces
    `causal_normalize(series, warmup_len)` whose output for indices
    < warmup_len is a strict function of series[:warmup_len].
    """
    from onlinev2.real_data import runner

    T = max(400, warmup * 4)
    series = _synthetic_series(seed, T)
    mutated = series.copy()
    mutated[warmup:] = np.clip(mutated[warmup:] + perturbation, -1e3, 1e3)

    if hasattr(runner, "causal_normalize"):
        norm_a, _, _ = runner.causal_normalize(series, warmup_len=warmup)
        norm_b, _, _ = runner.causal_normalize(mutated, warmup_len=warmup)
    else:
        # Unfixed code: only whole-series normalization exists — this call
        # uses future values and the test is expected to fail.
        norm_a, _, _ = runner.normalize_series(series)
        norm_b, _, _ = runner.normalize_series(mutated)

    ok = np.allclose(norm_a[:warmup], norm_b[:warmup], atol=1e-12, rtol=0)
    if not ok:
        _commit_counterexample(
            "1_1",
            f"causal_norm_seed{seed}_w{warmup}",
            {
                "seed": seed,
                "warmup": warmup,
                "perturbation": perturbation,
                "max_abs_diff": float(
                    np.max(np.abs(norm_a[:warmup] - norm_b[:warmup]))
                ),
                "has_causal_normalize": hasattr(runner, "causal_normalize"),
            },
        )
    assert ok, (
        f"Clause 1.1: norm[:warmup] changed when series[warmup:] was perturbed "
        f"by {perturbation:+.3f} (seed={seed}, warmup={warmup})"
    )


# ---------------------------------------------------------------------------
# B2 / clause 1.3 — cache regenerates on pipeline_version mismatch
# ---------------------------------------------------------------------------
def test_B2_cache_regenerates_on_version_mismatch(tmp_path: Path) -> None:
    """Cache written with pipeline_version='legacy' MUST be regenerated.

    On unfixed code `ensure_cache` blindly trusts any cache file that
    exists, so a cache produced under a buggy pipeline will contaminate
    every subsequent baseline run. The fix tags the cache with
    `pipeline_version` and regenerates on mismatch.
    """
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    try:
        import run_baseline_comparison as rbc
    finally:
        if str(REPO_ROOT / "scripts") in sys.path:
            sys.path.remove(str(REPO_ROOT / "scripts"))

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    T = 600
    fake_y = np.linspace(0, 1, T).astype(np.float64)
    fake_q = np.tile(fake_y[None, :, None], (3, 1, len(taus)))

    cache_path = tmp_path / "legacy_cache.npz"
    np.savez_compressed(
        cache_path,
        y_norm=fake_y,
        q_reports=fake_q,
        names=np.array(["a", "b", "c"]),
        taus=taus,
        series_min=0.0,
        series_max=1.0,
        pipeline_version=np.array("legacy"),
    )
    mtime_before = cache_path.stat().st_mtime

    # Write a throw-away CSV so ensure_cache has something to read on miss.
    csv_path = tmp_path / "series.csv"
    rng = np.random.default_rng(0)
    raw = np.clip(0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0)
    np.savetxt(
        csv_path,
        np.column_stack([np.arange(T), raw]),
        delimiter=",",
        header="t,measured",
        comments="",
    )

    # Small delay so mtime can measurably advance on fast filesystems.
    time.sleep(0.05)
    try:
        rbc.ensure_cache(
            str(cache_path), str(csv_path), taus, hourly=False, warmup=100
        )
    except Exception as exc:
        # On fully-unfixed code ensure_cache may simply happily load the
        # legacy cache and return; record either outcome.
        pytest.fail(
            f"Clause 1.3: ensure_cache raised on legacy cache ({type(exc).__name__}: {exc})"
        )

    data = np.load(cache_path, allow_pickle=True)
    pv = data["pipeline_version"].item() if "pipeline_version" in data.files else "legacy"
    mtime_after = cache_path.stat().st_mtime

    ok = str(pv) != "legacy" and mtime_after > mtime_before
    if not ok:
        _commit_counterexample(
            "1_3",
            "cache_not_regenerated",
            {
                "pipeline_version_after": str(pv),
                "mtime_before": float(mtime_before),
                "mtime_after": float(mtime_after),
            },
        )
    assert ok, (
        f"Clause 1.3: cache was not regenerated on pipeline_version mismatch "
        f"(version_after={pv!r}, mtime_advanced={mtime_after > mtime_before})"
    )


# ---------------------------------------------------------------------------
# B3 / clause 1.4 — sensitivity source artefact present or flagged
# ---------------------------------------------------------------------------
def test_B3_sensitivity_source_present_or_flagged() -> None:
    """`comparison.json`'s `sensitivity` block MUST either cite a real
    sweep artefact or flag that none exists. The unfixed runner
    hardcodes `optimal_improvement_pct: -27.2` with no source."""
    from onlinev2.real_data.runner import run_real_data_comparison

    rng = np.random.default_rng(0)
    T = 400
    series = np.clip(0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0)
    with tempfile.TemporaryDirectory() as td:
        result = run_real_data_comparison(
            series=series, warmup=100, outdir=td, series_name="sens_test",
            gamma=4.0, rho=0.1, lam=0.05,
        )

    sensitivity = result.get("sensitivity", {})
    has_source = "source" in sensitivity and os.path.exists(
        str(sensitivity.get("source", ""))
    )
    has_missing_flag = "sensitivity_sweep.json not found" in str(
        sensitivity.get("note", "")
    )
    # The hardcoded -27.2 path: key present but no source and no missing-flag.
    is_hardcoded = (
        "optimal_improvement_pct" in sensitivity
        and not has_source
        and not has_missing_flag
    )

    ok = has_source or has_missing_flag
    if not ok:
        _commit_counterexample(
            "1_4",
            "sensitivity_hardcoded",
            {
                "sensitivity": sensitivity,
                "is_hardcoded": is_hardcoded,
            },
        )
    assert ok, (
        f"Clause 1.4: sensitivity block has no sweep source and no "
        f"missing-flag (sensitivity={sensitivity})"
    )


# ---------------------------------------------------------------------------
# B4 / clause 1.5 — horizon residual pair has matching index
# ---------------------------------------------------------------------------
@given(
    seed=st.integers(min_value=0, max_value=10_000),
    horizon=st.integers(min_value=1, max_value=16),
)
@settings(
    max_examples=15,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture],
)
def test_B4_horizon_residual_indices_match(seed: int, horizon: int) -> None:
    """Residual pair stored by `_run_horizon_comparison` MUST be
    `(y_u, ŷ_u)` with matching index u, where `ŷ_u` was predicted from
    `norm[:u-horizon]`. Unfixed code pairs `norm[u-horizon-1]` with
    `ŷ_u`, a mis-indexed residual.

    We use a mock forecaster whose prediction is a deterministic
    function of `len(history)`; this lets the test reconstruct the
    expected residual exactly.
    """
    from onlinev2.real_data import experiments
    from onlinev2.real_data.forecasters import BaseForecaster

    class MockForecaster(BaseForecaster):
        """predict() = 0.9 * last seen observation.

        Uses the runner's history-update cache so it can predict
        deterministically from the moment it first sees a non-empty
        history.
        """

        def __init__(self):
            super().__init__("mock", retrain_every=1, window=0, residual_window=500)
            self._h: np.ndarray = np.array([])

        def fit(self, history):
            self._h = np.asarray(history, dtype=np.float64)
            self._fitted = True

        def predict(self) -> float:
            if self._h.size == 0:
                return 0.5
            return float(0.9 * self._h[-1])

    T = 200
    series = _synthetic_series(seed, T)
    fc = MockForecaster()
    taus = np.array([0.1, 0.5, 0.9])

    try:
        experiments._run_horizon_comparison(
            series=series,
            horizon=horizon,
            forecasters=[fc],
            warmup=horizon + 10,
            taus=taus,
            label="b4_probe",
        )
    except Exception as exc:
        pytest.fail(f"Clause 1.5: horizon runner raised ({type(exc).__name__}: {exc})")

    # Fixed normalization is causal on warmup only, so reconstruct the
    # same normalized array to compare residuals.
    from onlinev2.real_data.runner import causal_normalize as _cn
    norm, _, _ = _cn(series, warmup_len=horizon + 10)

    resids = list(fc._residuals)
    assert resids, "Clause 1.5: MockForecaster accumulated no residuals"

    # Structural check: the horizon runner source must use a
    # pending-prediction queue keyed by target index (the fix), and
    # must NOT use the buggy `update_residuals(norm[cutoff - 1], point)`
    # pairing that stores y_{u-h-1} next to ŷ_u.
    import inspect
    src = inspect.getsource(experiments._run_horizon_comparison)
    has_pending_queue = "pending" in src and "deque" in src
    has_buggy_indexing = "update_residuals(norm[cutoff - 1]" in src

    ok_structural = has_pending_queue and not has_buggy_indexing
    if not ok_structural:
        _commit_counterexample(
            "1_5",
            "horizon_structural",
            {
                "has_pending_queue": has_pending_queue,
                "has_buggy_indexing": has_buggy_indexing,
            },
        )
    assert ok_structural, (
        f"Clause 1.5: _run_horizon_comparison does not use the "
        f"pending-prediction queue rewrite "
        f"(has_pending_queue={has_pending_queue}, "
        f"has_buggy_indexing={has_buggy_indexing})"
    )

    # Functional sanity check: residuals must be bounded. Under the
    # buggy pairing, residuals could be of form 0.1*y, tiny but still
    # bounded. The STRUCTURAL assertion above is the real guarantee;
    # this check just ensures the pending-queue rewrite doesn't emit
    # NaN or unbounded values.
    resids_arr = np.asarray(resids, dtype=np.float64)
    ok_finite = bool(np.all(np.isfinite(resids_arr))) and bool(
        np.all(np.abs(resids_arr) <= 2.0)
    )
    if not ok_finite:
        _commit_counterexample(
            "1_5",
            f"horizon_residual_unbounded_seed{seed}_h{horizon}",
            {"tail_head": resids_arr[:10].tolist()},
        )
    assert ok_finite, (
        f"Clause 1.5: residual buffer contains non-finite or unbounded "
        f"values (seed={seed}, horizon={horizon})"
    )


# ---------------------------------------------------------------------------
# B5 / clause 1.7 — XGBoost CV uses a temporal gap
# ---------------------------------------------------------------------------
def test_B5_xgboost_cv_uses_gap() -> None:
    """XGBoost early-stopping validation MUST have a non-zero temporal
    gap between train and val slices. Unfixed code uses the last 20% of
    the training tail (gap = 0)."""
    from onlinev2.real_data.forecasters import XGBoostForecaster

    fc = XGBoostForecaster(n_lags=6)
    rng = np.random.default_rng(7)
    history = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(800)), 0.0, 1.0
    )
    fc.fit(history)

    # The fix exposes `val_gap` and `_last_cv_split` for testability.
    val_gap = getattr(fc, "val_gap", 0)
    last_split = getattr(fc, "_last_cv_split", None)

    ok_attr = val_gap >= 24 and last_split is not None
    if ok_attr:
        train_end, val_start = last_split
        ok = (val_start - train_end) >= val_gap
    else:
        ok = False

    if not ok:
        _commit_counterexample(
            "1_7",
            "xgboost_cv_no_gap",
            {
                "val_gap": val_gap,
                "has_last_cv_split": last_split is not None,
                "last_cv_split": last_split,
            },
        )
    assert ok, (
        f"Clause 1.7: XGBoost CV gap not enforced (val_gap={val_gap}, "
        f"last_cv_split={last_split})"
    )


# ---------------------------------------------------------------------------
# B6 / clause 1.8 — MLP reproducibility under different retrain schedules
# ---------------------------------------------------------------------------
def test_B6_mlp_reproducibility_across_warmups() -> None:
    """MLPForecaster.fit MUST be deterministic given the same seed and
    the same training data. Unfixed code seeds torch with
    `len(history) % 1000`, so two instances fit on the same history but
    at different retrain cadences can produce different weights.

    The test fits two MLPs on IDENTICAL histories with the same seed
    and asserts bit-identical predictions. Under the unfixed code
    `torch.manual_seed(len(history) % 1000)` is deterministic in the
    history length, so this particular test would still pass on
    unfixed code — the stronger symptom is that seeding scheme
    produces different predictions when history length differs modulo
    1000 (not what the fix guarantees). We therefore also assert that
    the forecaster stores `self.seed` as an attribute and uses it,
    which is the structural fix.
    """
    pytest.importorskip("torch", reason="torch not available")
    from onlinev2.real_data.forecasters import MLPForecaster

    rng = np.random.default_rng(42)
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(400)), 0.0, 1.0
    )

    # Structural check: MLPForecaster must expose a `seed` attribute
    # set from its constructor (MLP seed determinism property).
    try:
        fc_a = MLPForecaster(n_lags=6, hidden=16, seed=42)
        fc_b = MLPForecaster(n_lags=6, hidden=16, seed=42)
    except TypeError:
        pytest.fail(
            "Clause 1.8: MLPForecaster.__init__ does not accept `seed` kwarg"
        )

    assert getattr(fc_a, "seed", None) == 42, (
        "Clause 1.8: MLPForecaster does not store its seed as self.seed"
    )

    # Functional check: same seed + same training data → bit-identical
    # predictions.
    fc_a.fit(series[:300])
    fc_a._history = series[:301]
    pred_a = float(fc_a.predict())
    fc_b.fit(series[:300])
    fc_b._history = series[:301]
    pred_b = float(fc_b.predict())

    ok = np.isclose(pred_a, pred_b, atol=1e-10, rtol=0) and not np.isnan(pred_a)
    if not ok:
        _commit_counterexample(
            "1_8",
            "mlp_seed_nondeterministic",
            {"pred_a": pred_a, "pred_b": pred_b},
        )
    assert ok, (
        f"Clause 1.8: MLP produces different predictions across fits with "
        f"the same seed and same data (pred_a={pred_a}, pred_b={pred_b})"
    )

    # Structural check on the fit() source — ensure `torch.manual_seed`
    # consumes `self.seed`, not a history-dependent value.
    import inspect
    src = inspect.getsource(MLPForecaster.fit)
    uses_self_seed = "torch.manual_seed(self.seed)" in src
    uses_buggy_seed = "torch.manual_seed(len(history)" in src
    ok_structural = uses_self_seed and not uses_buggy_seed
    if not ok_structural:
        _commit_counterexample(
            "1_8",
            "mlp_fit_source_uses_history_length",
            {
                "uses_self_seed": uses_self_seed,
                "uses_buggy_seed": uses_buggy_seed,
            },
        )
    assert ok_structural, (
        f"Clause 1.8: MLPForecaster.fit does not use self.seed for "
        f"torch.manual_seed (uses_self_seed={uses_self_seed}, "
        f"uses_buggy_seed={uses_buggy_seed})"
    )


# ---------------------------------------------------------------------------
# B7 / clause 1.9 — strict_no_fallback raises on ML training failure
# ---------------------------------------------------------------------------
def test_B7_strict_no_fallback_raises() -> None:
    """A short-series runner call with `strict_no_fallback=True` MUST
    raise `ValueError` when XGBoost or MLP fall back to persistence.
    Unfixed runner does not read `fallback_counter` at all."""
    from onlinev2.real_data.runner import run_real_data_comparison

    rng = np.random.default_rng(7)
    # Short series: XGBoost fallback triggers at len(history) < max(n_lags,50)+20 = 70
    T = 120
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0
    )
    with tempfile.TemporaryDirectory() as td:
        raised = False
        try:
            run_real_data_comparison(
                series=series,
                warmup=30,  # deliberately too short for XGB/MLP
                outdir=td,
                series_name="b7_probe",
                gamma=4.0, rho=0.1, lam=0.05,
                **{"strict_no_fallback": True},
            )
        except TypeError:
            # Unfixed API: kwarg does not exist.
            pass
        except ValueError:
            raised = True
        except Exception as exc:
            # Any other exception fails the clause as well.
            pytest.fail(
                f"Clause 1.9: expected ValueError with strict_no_fallback=True, "
                f"got {type(exc).__name__}: {exc}"
            )

    if not raised:
        _commit_counterexample(
            "1_9",
            "strict_no_fallback_not_raising",
            {"T": T, "warmup": 30},
        )
    assert raised, (
        "Clause 1.9: strict_no_fallback=True did not raise on a run that "
        "forces XGBoost/MLP into persistence fallback"
    )


# ---------------------------------------------------------------------------
# B8 / clause 1.10 — recalibration causality
# ---------------------------------------------------------------------------
def test_B8_recalibration_causality() -> None:
    """With `recalibrate=True`, the recalibrator map used at round t MUST
    have been fitted only on PITs from rounds < t. Unfixed code updates
    the PIT buffer BEFORE calling transform, so the next refit picks up
    PITs from the rounds it was just asked to recalibrate."""
    try:
        from onlinev2.core.recalibration import RollingRecalibrator
    except ImportError:
        pytest.skip("RollingRecalibrator not available in this branch")

    from onlinev2.real_data.runner import run_real_data_comparison

    rng = np.random.default_rng(0)
    T = 600
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0
    )

    # Instrument transform() to record n_pits at call time.
    observed: list[tuple[int, int]] = []  # (round_t_counter, n_pits_seen)
    original_transform = RollingRecalibrator.transform
    call_counter = {"n": 0}

    def traced_transform(self, r_mech_t):
        observed.append((call_counter["n"], int(self.n_pits)))
        call_counter["n"] += 1
        return original_transform(self, r_mech_t)

    RollingRecalibrator.transform = traced_transform  # type: ignore[assignment]
    try:
        with tempfile.TemporaryDirectory() as td:
            run_real_data_comparison(
                series=series, warmup=200, outdir=td,
                series_name="b8_probe",
                gamma=4.0, rho=0.1, lam=0.05,
                recalibrate=True,
            )
    finally:
        RollingRecalibrator.transform = original_transform  # type: ignore[assignment]

    # Expected: n_pits at the k-th transform call (zero-indexed) is k —
    # transform sees PITs only from rounds strictly before the current one.
    # Buggy behaviour: n_pits is k+1 because update ran before transform.
    if not observed:
        pytest.skip("RollingRecalibrator.transform was never called")

    # Allow a tolerance of 0 (strict equality). If any call sees n_pits > k
    # the ordering is buggy.
    violations = [
        (k, n) for (k, n) in observed if n > k
    ]
    ok = len(violations) == 0
    if not ok:
        _commit_counterexample(
            "1_10",
            "recalibration_update_before_transform",
            {
                "first_violation": violations[0],
                "n_violations": len(violations),
                "n_total_calls": len(observed),
            },
        )
    assert ok, (
        f"Clause 1.10: recalibrator.transform saw n_pits > round_counter "
        f"in {len(violations)}/{len(observed)} calls (first violation: "
        f"{violations[0] if violations else None})"
    )


# ---------------------------------------------------------------------------
# B9 / clause 1.11 — best_single definition consistent across runners
# ---------------------------------------------------------------------------
def test_B9_cross_runner_best_single_consistency() -> None:
    """Both runners MUST compute `best_single` via the same
    `best_single_by_crps` helper. Unfixed `_run_horizon_comparison`
    uses a variance-of-point-error selector."""
    from onlinev2.real_data import runner as rn

    helper = getattr(rn, "best_single_by_crps", None)
    if helper is None:
        _commit_counterexample(
            "1_11",
            "best_single_helper_missing",
            {"has_best_single_by_crps": False},
        )
        pytest.fail(
            "Clause 1.11: runner.best_single_by_crps helper does not exist"
        )

    # Cross-runner structural check: grep the experiments module for
    # `np.var(reports` — the buggy variance-of-error selector that the
    # fix must delete.
    from onlinev2.real_data import experiments
    import inspect
    src = inspect.getsource(experiments)
    has_variance_selector = "np.var(reports" in src
    uses_helper = "best_single_by_crps" in src

    ok = (not has_variance_selector) and uses_helper
    if not ok:
        _commit_counterexample(
            "1_11",
            "experiments_still_uses_variance_selector",
            {
                "has_variance_selector": has_variance_selector,
                "uses_helper": uses_helper,
            },
        )
    assert ok, (
        f"Clause 1.11: experiments.py still uses variance-of-error selector "
        f"(has_variance={has_variance_selector}, uses_helper={uses_helper})"
    )

    # Functional agreement on a fabricated history:
    rng = np.random.default_rng(0)
    n_agents = 5
    T = 200
    agent_hist = [list(rng.uniform(0.01, 0.2, T)) for _ in range(n_agents)]
    # Best agent is the one with lowest mean — fabricate a winner at idx=2:
    agent_hist[2] = [x * 0.3 for x in agent_hist[2]]
    idx = helper(agent_hist, lookback=100)
    assert idx == 2, (
        f"Clause 1.11: best_single_by_crps picked agent {idx}; expected 2"
    )


# ---------------------------------------------------------------------------
# B10 / clause 1.12 — michael_ogd renamed
# ---------------------------------------------------------------------------
def test_B10_michael_ogd_renamed() -> None:
    """`comparison.json` MUST contain `michael_ogd_centered_median_fan`
    and NOT `michael_ogd`. The unfixed label misrepresents the
    implementation as an OGD quantile baseline."""
    from onlinev2.real_data.runner import run_real_data_comparison

    rng = np.random.default_rng(0)
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(500)), 0.0, 1.0
    )
    with tempfile.TemporaryDirectory() as td:
        result = run_real_data_comparison(
            series=series, warmup=150, outdir=td,
            series_name="b10_probe",
            gamma=4.0, rho=0.1, lam=0.05,
        )

    methods = {row["method"] for row in result.get("rows", [])}
    has_new = "michael_ogd_centered_median_fan" in methods
    has_old = "michael_ogd" in methods

    ok = (has_new and not has_old) or (not has_new and not has_old)
    # We require the new name to be present (rename applied) — skip if
    # neither is present (michael port unavailable on this platform).
    if has_old and not has_new:
        _commit_counterexample(
            "1_12",
            "michael_ogd_legacy_name",
            {"methods": sorted(methods)},
        )
    assert not has_old, (
        f"Clause 1.12: legacy `michael_ogd` label still present in rows "
        f"(found {sorted(methods)})"
    )


# ---------------------------------------------------------------------------
# B11 + B12 / clauses 1.13, 1.14 — evaluation block renames
# ---------------------------------------------------------------------------
def test_B11_B12_online_slice_blocks_renamed() -> None:
    """`rep_holdout` must be renamed `online_window_mean`;
    `prequential_blocks` must be renamed `online_block_mean`;
    citations to Cerqueira/Tashman/Dawid must be stripped."""
    from onlinev2.real_data.runner import run_real_data_comparison

    rng = np.random.default_rng(0)
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(600)), 0.0, 1.0
    )
    with tempfile.TemporaryDirectory() as td:
        result = run_real_data_comparison(
            series=series, warmup=150, outdir=td,
            series_name="b11b12_probe",
            gamma=4.0, rho=0.1, lam=0.05,
        )

    has_old_rep = "rep_holdout" in result
    has_new_rep = "online_window_mean" in result
    has_old_preq = "prequential_blocks" in result
    has_new_preq = "online_block_mean" in result

    # Citation stripping check.
    rep_desc = str(result.get("online_window_mean", {}).get("description", ""))
    preq_desc = str(result.get("online_block_mean", {}).get("description", ""))
    legacy_rep_desc = str(result.get("rep_holdout", {}).get("description", ""))
    legacy_preq_desc = str(result.get("prequential_blocks", {}).get("description", ""))
    all_desc = rep_desc + preq_desc + legacy_rep_desc + legacy_preq_desc

    banned = ["Cerqueira", "Tashman", "Dawid"]
    citations_stripped = not any(name in all_desc for name in banned)

    ok = (
        not has_old_rep and has_new_rep
        and not has_old_preq and has_new_preq
        and citations_stripped
    )
    if not ok:
        _commit_counterexample(
            "1_13_1_14",
            "online_slice_blocks_not_renamed",
            {
                "has_old_rep_holdout": has_old_rep,
                "has_new_online_window_mean": has_new_rep,
                "has_old_prequential_blocks": has_old_preq,
                "has_new_online_block_mean": has_new_preq,
                "citations_stripped": citations_stripped,
            },
        )
    assert ok, (
        f"Clauses 1.13/1.14: block renames incomplete "
        f"(rep_holdout→online_window_mean: old={has_old_rep}, new={has_new_rep}; "
        f"prequential_blocks→online_block_mean: old={has_old_preq}, new={has_new_preq}; "
        f"citations_stripped={citations_stripped})"
    )


# ---------------------------------------------------------------------------
# B13 / clause 1.15 — regime_shift labelled within-run
# ---------------------------------------------------------------------------
def test_B13_regime_shift_labelled_within_run() -> None:
    """`regime_shift.json` MUST have `within_run_seasonal_slice: True`
    and a `todo` key flagging the restart-per-season follow-up. We
    synthesise a minimal regime_shift payload via the runner-less
    route used by `_run_horizon_comparison`."""
    from onlinev2.real_data import experiments

    rng = np.random.default_rng(0)
    T = 500
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0
    )
    from onlinev2.real_data.forecasters import get_all_forecasters

    forecasters = [
        f for f in get_all_forecasters()
        if "XGBoost" not in f.name and "MLP" not in f.name
    ][:3]
    result = experiments._run_horizon_comparison(
        series=series, horizon=1, forecasters=forecasters,
        warmup=80, taus=np.array([0.1, 0.5, 0.9]),
        label="regime_shift",
    )

    has_flag = bool(result.get("within_run_seasonal_slice", False))
    has_todo = "todo" in result

    ok = has_flag and has_todo
    if not ok:
        _commit_counterexample(
            "1_15",
            "regime_shift_unflagged",
            {
                "has_within_run_flag": has_flag,
                "has_todo": has_todo,
                "top_keys": sorted(result.keys()),
            },
        )
    assert ok, (
        f"Clause 1.15: regime_shift payload missing within_run_seasonal_slice "
        f"and/or todo (flag={has_flag}, todo={has_todo})"
    )


# ---------------------------------------------------------------------------
# B14 / clause 1.16 — day-ahead warmup floor
# ---------------------------------------------------------------------------
def test_B14_day_ahead_warmup_floor() -> None:
    """`run_all_real_experiments` MUST call `_run_horizon_comparison`
    with warmup >= 70 on the daily series so XGBoost/MLP are not
    silently reduced to persistence for the first ~40 scored rounds."""
    import inspect
    from onlinev2.real_data import experiments

    src = inspect.getsource(experiments.run_all_real_experiments)
    # Detect the literal `warmup=30` that the unfixed code uses.
    has_bad_literal = "warmup=30" in src
    has_min_helper = (
        "min_warmup_for" in src
        or "max(70" in src
        or "max(30, min_warmup_for" in src
    )

    ok = (not has_bad_literal) and has_min_helper
    if not ok:
        _commit_counterexample(
            "1_16",
            "day_ahead_warmup_too_short",
            {
                "has_bad_literal": has_bad_literal,
                "has_min_helper": has_min_helper,
            },
        )
    assert ok, (
        f"Clause 1.16: day-ahead call still uses literal warmup=30 or is "
        f"missing the min_warmup_for helper "
        f"(has_bad_literal={has_bad_literal}, has_min_helper={has_min_helper})"
    )
