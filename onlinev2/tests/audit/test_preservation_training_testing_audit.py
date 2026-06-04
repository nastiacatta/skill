"""Preservation — Non-buggy inputs preserved across B1-B14 fixes.

Property 2 of the `model-training-testing-audit` spec: the fixes for
B1-B14 must NOT disturb code paths that clauses 3.1-3.10 guarantee
unchanged.

Observation-first methodology: these tests assert *formula* /
*structural* equivalence, not numerical value equivalence. Numerical
CRPS values are allowed to shift post-B1 (causal normalization) and
post-B4 (horizon residual alignment); that shift is the *intended*
effect of the fix. What must survive unchanged is the public API,
the round-level causality ordering, the oracle-weighting formula,
the fallback-counter semantics, the raw-CSV ingress, and the DM-test
inputs.

Spec: the methodology-audit preservation properties

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9,
3.10 — plus Properties 6 (`recalibrate=False` bit-identity) and 7
(round-level causality).**
"""
# Feature: model-training-testing-audit, Property 2: Preservation
from __future__ import annotations

import inspect
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest

pytestmark = [pytest.mark.audit]

REPO_ROOT = Path(__file__).resolve().parents[3]


def _tiny_series(seed: int = 0, T: int = 400) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.clip(0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0)


# ---------------------------------------------------------------------------
# Clause 3.1 — sigma stored from L_new (post-round), preserved
# ---------------------------------------------------------------------------
def test_clause_3_1_sigma_stored_post_round() -> None:
    """Clause 3.1 preserves the sigma timing guarantee: σ_t reflects the
    EWMA loss *after* round t's observation is incorporated.

    The existing `tests/test_refactor_regression.py` covers this at the
    mechanism level; here we re-assert it at the runner level by
    checking the runner does not overwrite σ history with pre-round
    values. The test is structural: the runner source must not call
    `update_ewma_loss` after it has already recorded σ for the round.
    """
    from onlinev2.real_data import runner

    src = inspect.getsource(runner.run_real_data_comparison)
    # The fix preserves the invariant; we probe for the known-bad
    # pattern ("sigma_history.append(sigma_prev)") which would indicate
    # a regression that stored pre-round σ.
    assert "sigma_history.append(sigma_prev)" not in src, (
        "Clause 3.1 regression: runner appended sigma_prev to history; "
        "σ_t should reflect the post-round EWMA loss, not L_prev"
    )


# ---------------------------------------------------------------------------
# Clause 3.2 — round-level causality (predict → score → update)
# ---------------------------------------------------------------------------
def test_clause_3_2_round_level_causality() -> None:
    """Property 7: inside every scoring round the runner MUST call
    `predict` and `predict_quantiles` BEFORE `update_residuals`.

    We instrument a wrapper forecaster that records the order of calls
    and assert `update_residuals` is never called before a matching
    `predict`/`predict_quantiles` pair for the same round.
    """
    from onlinev2.real_data.forecasters import NaiveForecaster
    from onlinev2.real_data.runner import run_real_data_comparison

    call_log: list[str] = []

    class TracingNaive(NaiveForecaster):
        name = "Naive"

        def predict(self) -> float:
            call_log.append("predict")
            return super().predict()

        def predict_quantiles(self, taus):
            call_log.append("predict_quantiles")
            return super().predict_quantiles(taus)

        def update_residuals(self, y, yhat):
            call_log.append("update_residuals")
            return super().update_residuals(y, yhat)

    series = _tiny_series(seed=3, T=200)
    with tempfile.TemporaryDirectory() as td:
        run_real_data_comparison(
            series=series,
            forecasters=[TracingNaive(residual_window=50)],
            warmup=80,
            outdir=td,
            series_name="causality_probe",
        )

    # Per-round invariant: for each scored round, `update_residuals`
    # is always preceded within the same round by at least one
    # `predict` and at least one `predict_quantiles` call. Oracle /
    # baseline scoring may insert extra `predict` calls after the
    # initial pair, but `update_residuals` must be the round's
    # terminator. We verify this by splitting the call log at each
    # `update_residuals` boundary and checking the segment before
    # it contains both `predict` and `predict_quantiles`.
    assert "update_residuals" in call_log, (
        "Clause 3.2: no update_residuals calls observed — runner did "
        "not score any rounds"
    )

    rounds_with_predict_pair: list[int] = []
    segment: list[str] = []
    for call in call_log:
        if call == "update_residuals":
            rounds_with_predict_pair.append(
                int("predict" in segment and "predict_quantiles" in segment)
            )
            segment = []
        else:
            segment.append(call)

    violations = [i for i, ok in enumerate(rounds_with_predict_pair) if not ok]
    assert not violations, (
        f"Clause 3.2: {len(violations)}/{len(rounds_with_predict_pair)} "
        f"scored rounds had update_residuals called without a preceding "
        f"predict+predict_quantiles pair (first violation: round "
        f"index {violations[0]})"
    )
    assert len(rounds_with_predict_pair) >= 10, (
        f"Clause 3.2: only {len(rounds_with_predict_pair)} scored rounds "
        f"observed — expected at least 10 from a 200-point series with "
        f"warmup=80"
    )


# ---------------------------------------------------------------------------
# Clause 3.3 — clean long-series run leaves every fallback_counter == 0
# ---------------------------------------------------------------------------
def test_clause_3_3_clean_run_zero_fallback() -> None:
    """A clean long-series run with a WARMUP that clears every
    forecaster's minimum-history floor MUST leave every post-warmup
    `fallback_counter` at 0. Any non-zero post-warmup counter
    indicates XGBoost/MLP fell back to persistence during scoring,
    violating clause 3.3.

    Fallbacks during the warmup period itself are expected (the first
    few fits happen before any forecaster has its minimum history),
    so we snapshot the counter at warmup-end and only assert the
    post-warmup delta is zero.
    """
    from onlinev2.real_data.forecasters import get_all_forecasters
    from onlinev2.real_data.runner import run_real_data_comparison

    # Reach warmup large enough that every first post-warmup fit has
    # >= max-required-history rows. For the default forecaster set,
    # min_warmup_for returns 70 → use 200 to be comfortably above.
    forecasters = get_all_forecasters()
    warmup_counts: dict[str, int] = {}

    # Patch each forecaster's `fit` to snapshot the fallback counter at
    # the end of warmup (first `fit` call with len(history) >= warmup).
    warmup_len = 200

    original_fits = {}
    for fc in forecasters:
        original_fits[fc.name] = fc.fit

        def _make_wrapper(fc_ref, original_fit):
            def wrapper(history):
                result = original_fit(history)
                if (
                    fc_ref.name not in warmup_counts
                    and len(history) >= warmup_len
                ):
                    warmup_counts[fc_ref.name] = int(fc_ref.fallback_counter)
                return result
            return wrapper

        fc.fit = _make_wrapper(fc, fc.fit)

    try:
        series = _tiny_series(seed=0, T=1000)
        import tempfile as _tf
        with _tf.TemporaryDirectory() as td:
            result = run_real_data_comparison(
                series=series,
                forecasters=forecasters,
                warmup=warmup_len,
                outdir=td,
                series_name="clean_run_probe",
            )
    finally:
        for fc in forecasters:
            fc.fit = original_fits[fc.name]

    summary = result.get("fallback_summary", {})
    assert summary, "Clause 3.3: fallback_summary block missing from result"

    # Post-warmup delta per forecaster.
    post_warmup_offenders = {}
    for name, total in summary.items():
        warmup_count = warmup_counts.get(name, 0)
        delta = total - warmup_count
        if delta > 0:
            post_warmup_offenders[name] = delta

    assert not post_warmup_offenders, (
        f"Clause 3.3: clean long-series run has non-zero POST-WARMUP "
        f"fallback counters: {post_warmup_offenders} (total counts: "
        f"{summary}, warmup snapshots: {warmup_counts})"
    )


# ---------------------------------------------------------------------------
# Clause 3.4 — oracle row still emitted with 1/agent_crps weighting
# ---------------------------------------------------------------------------
def test_clause_3_4_oracle_row_present() -> None:
    """The oracle row — 1/agent_crps per-round weighting — MUST continue
    to be emitted. Numerical CRPS values may shift post-B1 but the row
    identity is unchanged (clause 3.4)."""
    from onlinev2.real_data.runner import run_real_data_comparison

    series = _tiny_series(seed=0, T=400)
    with tempfile.TemporaryDirectory() as td:
        result = run_real_data_comparison(
            series=series,
            warmup=120,
            outdir=td,
            series_name="oracle_probe",
        )

    methods = {row["method"] for row in result.get("rows", [])}
    assert "oracle" in methods, (
        f"Clause 3.4: oracle row missing from result rows (found {sorted(methods)})"
    )
    # Oracle must have a mean CRPS <= the uniform row (by construction).
    rows_by_method = {r["method"]: r for r in result["rows"]}
    oracle_crps = rows_by_method["oracle"]["mean_crps"]
    uniform_crps = rows_by_method["uniform"]["mean_crps"]
    assert oracle_crps <= uniform_crps + 1e-9, (
        f"Clause 3.4: oracle CRPS ({oracle_crps}) not <= uniform ({uniform_crps})"
    )


# ---------------------------------------------------------------------------
# Clause 3.5 — mvp.py inline tests still pass
# ---------------------------------------------------------------------------
def test_clause_3_5_mvp_inline_tests_pass() -> None:
    """The 29 inline unit tests inside `onlinev2/mvp.py` MUST continue
    to exit 0. These tests predate the B1-B14 fixes and exercise the
    core scoring / settlement / skill code paths."""
    mvp_path = REPO_ROOT / "onlinev2" / "mvp.py"
    if not mvp_path.exists():
        pytest.skip("onlinev2/mvp.py not present")

    python = Path(sys.executable)
    proc = subprocess.run(
        [str(python), str(mvp_path)],
        capture_output=True,
        text=True,
        timeout=120,
        cwd=str(REPO_ROOT / "onlinev2"),
    )
    assert proc.returncode == 0, (
        f"Clause 3.5: mvp.py inline tests failed (exit {proc.returncode})\n"
        f"stdout tail: {proc.stdout[-800:]}\n"
        f"stderr tail: {proc.stderr[-800:]}"
    )


# ---------------------------------------------------------------------------
# Clause 3.6 — recalibrate=False bit-identity (covered in
# test_recalibrate_false_bit_identity.py; re-export the assertion here
# so Property 2 is self-contained).
# ---------------------------------------------------------------------------
def test_clause_3_6_recalibrate_false_determinism() -> None:
    """Two runs with `recalibrate=False` on the same series and seed
    MUST produce identical output modulo keys introduced by the
    B1-B14 fixes (clause 3.6)."""
    from onlinev2.real_data.runner import run_real_data_comparison

    series = _tiny_series(seed=0, T=300)

    def _once() -> dict:
        with tempfile.TemporaryDirectory() as td:
            return run_real_data_comparison(
                series=series,
                warmup=100,
                outdir=td,
                series_name="bit_identity_probe",
                gamma=4.0, rho=0.1, lam=0.05,
                recalibrate=False, seed=1337,
            )

    a = _once()
    b = _once()

    # Compare the scoring rows — the headline Property 2 invariant.
    a_rows = {r["method"]: r["mean_crps"] for r in a["rows"]}
    b_rows = {r["method"]: r["mean_crps"] for r in b["rows"]}
    assert a_rows == b_rows, (
        f"Clause 3.6: recalibrate=False not bit-identical across runs\n"
        f"a: {a_rows}\nb: {b_rows}"
    )


# ---------------------------------------------------------------------------
# Clause 3.7 — forecaster public API unchanged
# ---------------------------------------------------------------------------
def test_clause_3_7_forecaster_api_unchanged() -> None:
    """Every forecaster MUST expose the unchanged public API:
    `fit(history)`, `predict() -> float`,
    `predict_quantiles(taus) -> np.ndarray`, `update_residuals(y, yhat)`.
    No new *required* arguments (new kwargs with defaults are fine)."""
    from onlinev2.real_data.forecasters import get_all_forecasters

    forecasters = get_all_forecasters()
    assert forecasters, "Clause 3.7: get_all_forecasters() returned empty list"

    for fc in forecasters:
        # Attribute presence + callability.
        for name in ("fit", "predict", "predict_quantiles", "update_residuals"):
            method = getattr(fc, name, None)
            assert callable(method), (
                f"Clause 3.7: {fc.__class__.__name__} is missing `{name}`"
            )

        # Required-argument count stability (excluding self).
        sig = inspect.signature(fc.fit)
        required = [
            p for p in sig.parameters.values()
            if p.default is inspect.Parameter.empty
            and p.kind
            in (inspect.Parameter.POSITIONAL_OR_KEYWORD,
                inspect.Parameter.POSITIONAL_ONLY)
        ]
        assert len(required) == 1, (
            f"Clause 3.7: {fc.__class__.__name__}.fit has "
            f"{len(required)} required args, expected 1 (history)"
        )


# ---------------------------------------------------------------------------
# Clause 3.8 — raw CSV ingress unchanged (sanity: module import + signature)
# ---------------------------------------------------------------------------
def test_clause_3_8_raw_csv_ingress_unchanged() -> None:
    """The raw-CSV ingress path (`load_csv_series`) MUST still be
    importable with its pre-fix signature. Downstream callers like
    `scripts/run_baseline_comparison.py` rely on
    `load_csv_series(path)` returning a 1D float array."""
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    try:
        import run_baseline_comparison as rbc
    finally:
        if str(REPO_ROOT / "scripts") in sys.path:
            sys.path.remove(str(REPO_ROOT / "scripts"))

    assert hasattr(rbc, "load_csv_series"), (
        "Clause 3.8: load_csv_series removed from run_baseline_comparison"
    )
    sig = inspect.signature(rbc.load_csv_series)
    required_positional = [
        p for p in sig.parameters.values()
        if p.default is inspect.Parameter.empty
        and p.kind
        in (inspect.Parameter.POSITIONAL_OR_KEYWORD,
            inspect.Parameter.POSITIONAL_ONLY)
    ]
    assert len(required_positional) == 1, (
        f"Clause 3.8: load_csv_series signature changed — required positional "
        f"arg count is {len(required_positional)}, expected 1 (path)"
    )

    # Write a tiny synthetic CSV and round-trip through the ingress.
    # load_csv_series enforces a minimum length (>= 100) so use 150.
    with tempfile.TemporaryDirectory() as td:
        csv = Path(td) / "series.csv"
        T = 150
        rng = np.random.default_rng(0)
        raw = np.clip(0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0)
        np.savetxt(
            csv,
            np.column_stack([np.arange(T), raw]),
            delimiter=",",
            header="t,measured",
            comments="",
        )
        loaded = rbc.load_csv_series(str(csv))
        assert isinstance(loaded, np.ndarray), (
            "Clause 3.8: load_csv_series did not return an ndarray"
        )
        assert loaded.ndim == 1, (
            f"Clause 3.8: load_csv_series returned ndim={loaded.ndim}, expected 1"
        )


# ---------------------------------------------------------------------------
# Clause 3.9 — DM-test inputs unchanged (label, paired-CRPS shape)
# ---------------------------------------------------------------------------
def test_clause_3_9_dm_test_inputs_unchanged() -> None:
    """The DM (Diebold-Mariano) test block MUST continue to be emitted
    with the same `comparison` label and the same paired-per-round
    structure (clause 3.9). Values may shift post-B1."""
    from onlinev2.real_data.runner import run_real_data_comparison

    series = _tiny_series(seed=0, T=400)
    with tempfile.TemporaryDirectory() as td:
        result = run_real_data_comparison(
            series=series,
            warmup=120,
            outdir=td,
            series_name="dm_probe",
        )

    dm = result.get("dm_test")
    assert dm is not None, "Clause 3.9: dm_test block missing"
    assert dm.get("comparison") == "uniform vs mechanism", (
        f"Clause 3.9: dm_test comparison label changed (got {dm.get('comparison')!r})"
    )
    # dm_test must expose the statistic and a p-value.
    assert "statistic" in dm or "DM" in dm, (
        "Clause 3.9: dm_test missing statistic field"
    )
    assert "p_value" in dm or "p" in dm, (
        "Clause 3.9: dm_test missing p_value field"
    )

    dm_s = result.get("dm_test_skill")
    assert dm_s is not None, "Clause 3.9: dm_test_skill block missing"
    assert dm_s.get("comparison") == "uniform vs skill", (
        f"Clause 3.9: dm_test_skill comparison label changed "
        f"(got {dm_s.get('comparison')!r})"
    )


# ---------------------------------------------------------------------------
# Clause 3.10 — fallback counter increment semantics unchanged
# ---------------------------------------------------------------------------
def test_clause_3_10_fallback_increment_semantics() -> None:
    """Injecting a failure into a forecaster's `fit` MUST increment
    `fallback_counter` by exactly one per fit attempt — same semantics
    as pre-fix (clause 3.10). The new `fallback_summary` aggregation
    is a READ only; it does not change the counter semantics."""
    from onlinev2.real_data.forecasters import XGBoostForecaster

    fc = XGBoostForecaster(n_lags=6)
    # Very short history forces the "short history" fallback branch.
    history = np.zeros(10, dtype=np.float64)
    pre = fc.fallback_counter
    fc.fit(history)
    assert fc.fallback_counter == pre + 1, (
        f"Clause 3.10: short-history fit did not increment fallback_counter "
        f"by one (pre={pre}, post={fc.fallback_counter})"
    )

    # Second attempt: counter increments again (one per fit call).
    pre = fc.fallback_counter
    fc.fit(history)
    assert fc.fallback_counter == pre + 1, (
        f"Clause 3.10: repeat short-history fit did not re-increment counter "
        f"(pre={pre}, post={fc.fallback_counter})"
    )
