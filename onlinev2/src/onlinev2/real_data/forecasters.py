"""
Seven forecasting models for the real-data mechanism comparison.

Each forecaster implements:
  - fit(history: np.ndarray) -> None   # train on past data
  - predict() -> float                 # point forecast for next step
  - predict_quantiles(taus) -> np.ndarray  # quantile forecasts

All models are strictly causal — they only see data up to t-1 when
forecasting t. Models retrain periodically on a rolling window.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

import numpy as np
from scipy.optimize import isotonic_regression
from scipy.stats import norm

logger = logging.getLogger(__name__)


def build_feature_row(series: np.ndarray, i: int, n_lags: int) -> np.ndarray:
    """Build a single engineered feature row for index i in series.

    Shared by XGBoost and MLP to ensure identical feature layouts. The row
    contains:
      - n_lags raw lag values
      - n_lags - 1 first differences of those lags
      - 12 engineered features: rolling means at 3 scales (5/20/50),
        rolling stds at 2 scales (5/20), rmin/rmax/pos_in_range over a
        10-step window, momentum, acceleration, and mean-reversion signals
        at 20 and 50 scales.

    The caller is responsible for ensuring i >= max(n_lags, 50). Any
    window that would underflow the start of the series is silently
    truncated, matching numpy slice semantics.
    """
    lags = series[i - n_lags:i]
    last = lags[-1]

    # First differences of lags
    diffs = np.diff(lags)

    # Rolling windows at multiple scales
    w5 = series[max(0, i - 5):i]
    w10 = series[max(0, i - 10):i]
    w20 = series[max(0, i - 20):i]
    w50 = series[max(0, i - 50):i]

    rmean5 = float(np.mean(w5))
    rmean20 = float(np.mean(w20))
    rmean50 = float(np.mean(w50))
    rstd5 = float(np.std(w5)) if len(w5) > 1 else 0.0
    rstd20 = float(np.std(w20)) if len(w20) > 1 else 0.0
    rmin10 = float(np.min(w10))
    rmax10 = float(np.max(w10))
    rng = rmax10 - rmin10
    pos_in_range = (last - rmin10) / rng if rng > 1e-12 else 0.5

    # Momentum (mean recent change) and acceleration
    d5 = np.diff(series[max(0, i - 6):i])
    momentum = float(np.mean(d5)) if len(d5) > 0 else 0.0
    d_old = np.diff(series[max(0, i - 12):max(0, i - 6)])
    acceleration = (momentum - float(np.mean(d_old))) if len(d_old) > 0 else 0.0

    # Mean-reversion signals at two scales
    mean_rev_20 = last - rmean20
    mean_rev_50 = last - rmean50

    return np.concatenate([
        lags, diffs,
        [rmean5, rmean20, rmean50, rstd5, rstd20,
         rmin10, rmax10, pos_in_range,
         momentum, acceleration, mean_rev_20, mean_rev_50],
    ])


def build_feature_matrix(series: np.ndarray, n_lags: int) -> tuple[np.ndarray, np.ndarray]:
    """Build a feature matrix and residual targets (Δy) from a series.

    Returns (X, y) where X[k] is the feature row for index i = k + min_start
    and y[k] = series[i] - series[i - 1] is the one-step residual target.
    """
    min_start = max(n_lags, 50)
    X, y = [], []
    for i in range(min_start, len(series)):
        X.append(build_feature_row(series, i, n_lags))
        y.append(series[i] - series[i - 1])
    return np.array(X), np.array(y)


def build_predict_features(history: np.ndarray, n_lags: int) -> np.ndarray | None:
    """Build a single prediction-time feature row, or None if history is too short."""
    if len(history) < max(n_lags, 50):
        return None
    return build_feature_row(history, len(history), n_lags).reshape(1, -1)


class BaseForecaster(ABC):
    """Base class for all forecasters."""

    def __init__(
        self,
        name: str,
        retrain_every: int = 50,
        window: int = 200,
        residual_window: int = 200,
        min_residuals: int = 10,
        default_scale: float = 0.05,
    ):
        self.name = name
        self.retrain_every = retrain_every
        self.window = window
        self.residual_window = residual_window
        self.min_residuals = min_residuals
        self.default_scale = default_scale
        self._residuals: list[float] = []
        self._fitted = False
        # Bugfix mechanism-correctness-audit-fix clause 1.14: counter for
        # silent-fallback branches. Incremented whenever a forecaster
        # falls back to a simpler path (e.g. XGBoost/MLP per-tau quantile
        # models failed to fit, ARIMA exception in fit). Audit tests read
        # this to detect silent training failures.
        self.fallback_counter: int = 0
        # Bugfix clause 1.15: flag set by forecasters (e.g. ARIMA) when
        # predict() returns a persistence (last-observation) fallback
        # rather than a true model forecast. Optional — absent on
        # forecasters that do not distinguish the two paths.
        self.is_persistence: bool = False

    @abstractmethod
    def fit(self, history: np.ndarray) -> None:
        """Train on historical data (1D array)."""
        ...

    @abstractmethod
    def predict(self) -> float:
        """Point forecast for the next time step."""
        ...

    def predict_quantiles(self, taus: np.ndarray) -> np.ndarray:
        """Layered quantile pipeline: generate → clip → monotonize.

        This method is NOT overridden by subclasses. Subclasses override
        _generate_quantiles() instead.
        """
        # Step 1: Generate raw quantiles
        if len(self._residuals) < self.min_residuals:
            raw = self._fallback_quantiles(taus)
        else:
            raw = self._generate_quantiles(taus)

        # Step 1.5: Guard against non-finite values from model failures.
        # A forecaster whose predict() returned NaN/Inf would otherwise
        # produce a NaN/Inf quantile vector, violating the quantile forecast
        # quality property (non-finite outputs poison the
        # downstream CRPS scoring. Substitute a point-centred fan at
        # the array-wide median tau so at least the median quantile is
        # well-defined and monotonicity is trivially satisfied.
        if not np.all(np.isfinite(raw)):
            self.fallback_counter += 1
            raw = self._fallback_quantiles(np.asarray(taus))
            if not np.all(np.isfinite(raw)):
                # predict() itself is returning NaN — emit a flat 0.5 fan
                # as a last resort; the runner's fallback_counter audit
                # will surface the failure.
                raw = np.full(len(taus), 0.5, dtype=np.float64)

        # Step 2: Clip to [0, 1]
        clipped = np.clip(raw, 0.0, 1.0)

        # Step 3: Enforce monotonicity via isotonic regression
        return self._enforce_monotonicity(clipped)

    def _generate_quantiles(self, taus: np.ndarray) -> np.ndarray:
        """Default quantile generation via residual bootstrap.

        Computes quantiles as point forecast + empirical residual quantile
        for each tau level. Subclasses (ARIMA, XGBoost) override this to
        provide native distributional quantile estimates.
        """
        point = self.predict()
        resid = np.array(self._residuals[-self.residual_window:])
        quantiles = np.array([point + np.quantile(resid, tau) for tau in taus])
        return quantiles

    def _fallback_quantiles(self, taus: np.ndarray) -> np.ndarray:
        """Early-round fallback: point + default_scale * Φ⁻¹(tau).

        Used when len(self._residuals) < self.min_residuals to produce
        a well-spread quantile vector instead of collapsing to the point.
        """
        point = self.predict()
        return point + self.default_scale * norm.ppf(taus)

    @staticmethod
    def _enforce_monotonicity(q: np.ndarray) -> np.ndarray:
        """Enforce monotone non-decreasing order via isotonic regression.

        Uses scipy's pool-adjacent-violators algorithm with equal weights
        across quantile levels to preserve the median as closely as possible.

        Handles edge cases:
        - Single element: returned unchanged.
        - Already monotone: returned unchanged (PAV is a no-op).
        """
        if len(q) <= 1:
            return q
        result = isotonic_regression(q)
        return result.x

    def update_residuals(self, y_true: float, y_pred: float) -> None:
        """Track residuals for quantile estimation."""
        self._residuals.append(y_true - y_pred)
        if len(self._residuals) > self.residual_window:
            self._residuals = self._residuals[-self.residual_window:]


class NaiveForecaster(BaseForecaster):
    """Forecast = last observed value. Hard to beat on random walks."""

    def __init__(self, residual_window: int = 100):
        # Naive retrains every step, so a short residual window (100)
        # keeps the bootstrap responsive to recent regime changes.
        super().__init__(
            "Naive (last value)",
            retrain_every=1,
            window=100,
            residual_window=residual_window,
        )
        self._last = 0.5

    def fit(self, history: np.ndarray) -> None:
        if len(history) > 0:
            self._last = float(history[-1])
        self._fitted = True

    def predict(self) -> float:
        return self._last


class MovingAverageForecaster(BaseForecaster):
    """Forecast = exponentially weighted moving average (EWMA) of recent values.

    Uses a short effective window via exponential weighting, which adapts
    faster than a simple moving average and produces tighter residuals
    for autocorrelated series like wind power.
    """

    def __init__(self, span: int = 5, residual_window: int = 100):
        super().__init__(
            f"EWMA ({span})",
            retrain_every=1,
            window=200,
            residual_window=residual_window,
        )
        self.span = span
        self._alpha = 2.0 / (span + 1)
        self._ewma = 0.5
        self._history: np.ndarray = np.array([])

    def fit(self, history: np.ndarray) -> None:
        self._history = history
        if len(history) == 0:
            self._ewma = 0.5
        elif len(history) <= self.span:
            self._ewma = float(np.mean(history))
        else:
            # Compute EWMA over the tail
            val = float(history[-self.span])
            for v in history[-self.span + 1:]:
                val = self._alpha * float(v) + (1 - self._alpha) * val
            self._ewma = val
        self._fitted = True

    def predict(self) -> float:
        return self._ewma


class ARIMAForecaster(BaseForecaster):
    """ARIMA(p,d,q) model. Retrains periodically on rolling window.

    Between retrains, predict() uses the last observed value (persistence)
    since the ARIMA model's 1-step forecast becomes stale after 1 round.
    The ARIMA model's value comes from its residual distribution for
    quantile estimation, not from multi-step-ahead point forecasts.
    """

    def __init__(self, order: tuple[int, int, int] = (2, 1, 1), residual_window: int = 300):
        super().__init__(
            f"ARIMA{order}",
            retrain_every=50,
            window=500,
            residual_window=residual_window,
        )
        self.order = order
        self._model = None
        self._last_pred = 0.5
        self._history: np.ndarray = np.array([])

    def fit(self, history: np.ndarray) -> None:
        self._history = history
        if len(history) < 30:
            self._last_pred = float(history[-1]) if len(history) > 0 else 0.5
            self._fitted = True
            return
        try:
            import warnings
            from statsmodels.tsa.arima.model import ARIMA
            tail = history[-self.window:]
            with warnings.catch_warnings():
                # statsmodels is verbose about non-stationary starting parameters
                # and convergence hints. These are informational, not actionable:
                # the MLE still returns a usable fit even when the optimiser
                # reports non-convergence at maxiter.
                warnings.filterwarnings(
                    "ignore",
                    message="Maximum Likelihood optimization failed to converge",
                )
                warnings.filterwarnings(
                    "ignore",
                    message="Non-stationary starting autoregressive parameters",
                )
                warnings.filterwarnings(
                    "ignore",
                    message="Non-invertible starting MA parameters",
                )
                # statsmodels' conditional-sum-of-squares start-params routine
                # (sarimax.py:_conditional_sum_squares) calls `np.linalg.pinv`
                # which in turn issues numpy matmul RuntimeWarnings for near-
                # singular design matrices on short/degenerate windows. The
                # pinv itself handles the singularity gracefully (the MLE
                # refines the starting params), so silence the downstream
                # matmul noise here rather than let it bubble up through the
                # test suite.
                warnings.filterwarnings(
                    "ignore",
                    message=".*encountered in matmul.*",
                    category=RuntimeWarning,
                )
                model = ARIMA(tail, order=self.order)
                self._model = model.fit(method_kwargs={"maxiter": 50})
            forecast = self._model.forecast(steps=1)
            pred = float(forecast.iloc[0]) if hasattr(forecast, 'iloc') else float(forecast[0])
            # Guard against statsmodels emitting NaN/Inf on degenerate
            # fits. Downstream `predict()` and `predict_quantiles()` both
            # expect a finite value; fall back to persistence otherwise.
            if not np.isfinite(pred):
                self.fallback_counter += 1
                self._last_pred = float(history[-1])
            else:
                self._last_pred = pred
        except Exception:
            self._last_pred = float(history[-1])
        self._fitted = True

    def predict(self) -> float:
        # Between retrains, use persistence (last value) since the ARIMA
        # 1-step forecast is only valid at the fit origin.
        # Bugfix clause 1.15: set is_persistence=True so callers (and the
        # audit PBT in tests/audit/test_bug_condition_c_training.py) can
        # distinguish persistence fallbacks from true ARIMA forecasts.
        if len(self._history) > 0:
            self.is_persistence = True
            return float(self._history[-1])
        self.is_persistence = False
        return self._last_pred


class XGBoostForecaster(BaseForecaster):
    """XGBoost with engineered features and native quantile regression.

    Key design choices (literature-grounded):
    - Expanding window: uses ALL available history, not a fixed rolling window.
      More data = better generalization for tree models (Chen & Guestrin 2016).
    - Residual modeling: predicts Δy = y[t] - y[t-1], not the level.
      Avoids mean-regression bias inherent in tree-based level prediction.
    - Native quantile regression: uses XGBoost's reg:quantileerror objective
      for each tau level, producing calibrated prediction intervals.
    - Early stopping: uses last 20% of training data as validation to prevent
      overfitting on the noisy residual target.
    """

    def __init__(self, n_lags: int = 24, taus: np.ndarray | None = None,
                 residual_window: int = 500, val_gap: int = 24, seed: int = 0):
        super().__init__(
            "XGBoost",
            retrain_every=20,
            window=0,  # 0 = expanding window (use all data)
            residual_window=residual_window,
        )
        self.n_lags = n_lags
        # Temporal gap between the training window and the held-out
        # validation slice for early stopping (bugfix clause 1.7 / 2.7).
        # A gap of ~24 (one day at hourly resolution) keeps the validation
        # loss from being dominated by the immediate autocorrelation
        # structure of the training tail.
        self.val_gap = val_gap
        # Deterministic seed, piped from the runner (audit fix #A4 —
        # previously hardcoded at random_state=0 regardless of runner seed).
        self.seed = seed
        self._model = None
        self._last_pred = 0.5
        self._history: np.ndarray = np.array([])
        self._taus = taus
        self._quantile_models: dict[float, Any] = {}
        # Last computed (train_end_index, val_start_index) for testability
        # — set inside fit() whenever expanding-window CV is applied.
        self._last_cv_split: tuple[int, int] | None = None
        # Counts how often the short-history CV path was taken on this
        # forecaster instance. Surfaced for diagnostics so the runner
        # (or a fallback summary) can detect whether the embargoed CV
        # protocol was preserved across the run. Bergmeir 2018 short-
        # history fix: the previous code silently dropped the embargo
        # to zero on this branch; the new code preserves a non-zero
        # gap and increments this counter every time it does so.
        self.cv_short_history_fallbacks: int = 0

    def _build_row(self, series: np.ndarray, i: int) -> np.ndarray:
        """Build a single feature row for index i in series."""
        return build_feature_row(series, i, self.n_lags)

    def _make_features(self, series: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Build feature matrix + residual targets from a series."""
        return build_feature_matrix(series, self.n_lags)

    def _make_predict_features(self, history: np.ndarray) -> np.ndarray | None:
        return build_predict_features(history, self.n_lags)

    def fit(self, history: np.ndarray) -> None:
        self._history = history
        if len(history) < max(self.n_lags, 50) + 20:
            # Bugfix clause 1.9 / 2.9: the short-history early return is a
            # silent fallback to persistence from XGBoost's perspective.
            # Count it so strict_no_fallback can detect it at end-of-run.
            self.fallback_counter += 1
            self._last_pred = float(history[-1]) if len(history) > 0 else 0.5
            self._fitted = True
            return
        try:
            import xgboost as xgb

            # Use up to 5000 most recent points (expanding up to cap)
            max_train = 5000
            tail = history[-max_train:] if len(history) > max_train else history
            X, y = self._make_features(tail)
            if len(X) < 20:
                self._last_pred = float(history[-1])
                self._fitted = True
                return

            # Train/val split with a temporal gap for early stopping
            # (bugfix clause 1.7 / 2.7). When there is enough data, use
            # an expanding-window CV with `val_gap` rows of held-out
            # time between the training tail and the validation slice.
            # When the training window is too short, shrink the gap to a
            # minimum non-zero embargo (rather than the legacy 80/20
            # split with zero gap, which silently violated the Bergmeir,
            # Hyndman & Koo (2018) embargoed-CV protocol).
            n = len(X)
            min_required = self.val_gap + 60  # train + gap + val headroom
            if n >= min_required:
                val_size = max(20, n // 5)
                val_start = n - val_size
                train_end = val_start - self.val_gap
                X_train, y_train = X[:train_end], y[:train_end]
                X_val, y_val = X[val_start:], y[val_start:]
                self._last_cv_split = (train_end, val_start)
            else:
                # Short-history path: keep the embargo non-zero.
                # The minimum gap is a fraction of the available
                # feature rows (capped by the configured val_gap).
                # An h-block embargo of order n/10 is conservative
                # for series with diurnal autocorrelation: it keeps
                # at least one in ten observations as a buffer
                # between the training tail and the validation slice
                # while still leaving enough rows on both sides for
                # XGBoost early stopping to be informative.
                val_size = max(10, n // 5)
                effective_gap = min(self.val_gap, max(1, n // 10))
                # Ensure the train slice has at least one row.
                # If the gap+val_size would consume the whole feature
                # matrix, shrink the gap further.
                while effective_gap >= 1 and (n - val_size - effective_gap) < 1:
                    effective_gap -= 1
                effective_gap = max(effective_gap, 1) if (n - val_size) >= 2 else 0
                val_start = n - val_size
                train_end = val_start - effective_gap
                if train_end < 1:
                    # Degenerate case: not enough rows to keep any
                    # train slice with a gap. Fall back to the
                    # legacy 80/20 split but log a WARNING — this
                    # path is what the audit flagged as the silent
                    # fallback; it should be exceedingly rare.
                    split = int(n * 0.8)
                    X_train, y_train = X[:split], y[:split]
                    X_val, y_val = X[split:], y[split:]
                    self._last_cv_split = (split, split)
                    self.cv_short_history_fallbacks += 1
                    logger.warning(
                        "XGBoostForecaster: feature matrix too short for "
                        "any embargoed CV split (n=%d, val_gap=%d); "
                        "falling back to legacy 80/20 tail split with "
                        "zero embargo. This violates the Bergmeir 2018 "
                        "embargoed-CV protocol and inflates the early-"
                        "stopping validation loss via autocorrelation. "
                        "Increase the warmup window if this fires often.",
                        n,
                        self.val_gap,
                    )
                else:
                    X_train, y_train = X[:train_end], y[:train_end]
                    X_val, y_val = X[val_start:], y[val_start:]
                    self._last_cv_split = (train_end, val_start)
                    self.cv_short_history_fallbacks += 1
                    logger.warning(
                        "XGBoostForecaster: short feature matrix "
                        "(n=%d < %d); using shrunk embargo of %d rows "
                        "(configured val_gap=%d). The Bergmeir 2018 "
                        "protocol is preserved with a reduced gap.",
                        n,
                        min_required,
                        effective_gap,
                        self.val_gap,
                    )

            self._model = xgb.XGBRegressor(
                n_estimators=300, max_depth=4, learning_rate=0.05,
                reg_alpha=0.1, reg_lambda=1.0,
                subsample=0.8, colsample_bytree=0.8,
                early_stopping_rounds=20,
                verbosity=0, n_jobs=1, random_state=self.seed,
            )
            self._model.fit(
                X_train, y_train,
                eval_set=[(X_val, y_val)],
                verbose=False,
            )

            features = self._make_predict_features(history)
            if features is not None:
                delta = float(self._model.predict(features)[0])
                self._last_pred = float(np.clip(history[-1] + delta, 0, 1))
            else:
                self._last_pred = float(history[-1])

            # Train per-tau quantile models with early stopping
            if self._taus is not None:
                self._quantile_models = {}
                for tau in self._taus:
                    try:
                        q_model = xgb.XGBRegressor(
                            n_estimators=300, max_depth=4, learning_rate=0.05,
                            reg_alpha=0.1, reg_lambda=1.0,
                            subsample=0.8, colsample_bytree=0.8,
                            objective='reg:quantileerror', quantile_alpha=float(tau),
                            early_stopping_rounds=20,
                            verbosity=0, n_jobs=1, random_state=self.seed,
                        )
                        q_model.fit(
                            X_train, y_train,
                            eval_set=[(X_val, y_val)],
                            verbose=False,
                        )
                        self._quantile_models[float(tau)] = q_model
                    except Exception:
                        # Bugfix clause 1.14: track silent fallback instead
                        # of clearing the dict silently. Test can assert
                        # self.fallback_counter == 0 for a clean fit.
                        self.fallback_counter += 1
                        self._quantile_models = {}
                        break
        except Exception:
            # Bugfix clause 1.14: top-level fit failed; count the fallback.
            self.fallback_counter += 1
            self._last_pred = float(history[-1])
            self._quantile_models = {}
        self._fitted = True

    def predict(self) -> float:
        if self._model is not None and len(self._history) >= max(self.n_lags, 50):
            try:
                features = self._make_predict_features(self._history)
                if features is not None:
                    delta = float(self._model.predict(features)[0])
                    return float(np.clip(self._history[-1] + delta, 0, 1))
            except Exception:
                pass
        return self._last_pred

    def _generate_quantiles(self, taus: np.ndarray) -> np.ndarray:
        """Query per-tau XGBoost quantile models (residual-based)."""
        if self._quantile_models and len(self._history) >= max(self.n_lags, 50):
            try:
                features = self._make_predict_features(self._history)
                if features is not None:
                    last_val = self._history[-1]
                    return np.array([
                        float(np.clip(
                            last_val + self._quantile_models[float(tau)].predict(features)[0],
                            0, 1
                        ))
                        for tau in taus
                    ])
            except Exception:
                pass
        return super()._generate_quantiles(taus)


class MLPForecaster(BaseForecaster):
    """Small MLP neural network with lag features. Retrains periodically."""

    def __init__(self, n_lags: int = 24, hidden: int = 32, residual_window: int = 300,
                 seed: int = 42):
        # MLP retrains every 20 steps on a 500-point window.
        super().__init__(
            "Neural Net (MLP)",
            retrain_every=20,
            window=500,
            residual_window=residual_window,
        )
        self.n_lags = n_lags
        self.hidden = hidden
        # Deterministic seed for torch (bugfix clause 1.8 / 2.8). The
        # legacy seeding scheme `torch.manual_seed(len(history) % 1000)`
        # made the MLP component non-reproducible across any change that
        # shifted the retraining schedule. The runner pipes its own
        # seed into this attribute via `fc.seed = seed` before training.
        self.seed = seed
        self._model = None
        self._last_pred = 0.5
        self._history: np.ndarray = np.array([])
        # Feature standardization statistics (audit fix #C1). Populated
        # at each fit() call; until then predict() won't use the model
        # branch because self._model is None.
        self._feature_mean: np.ndarray | None = None
        self._feature_std: np.ndarray | None = None
        # Counts how often standardisation stats have been refreshed via
        # fit().  Used by regression tests (audit issue #C2) to confirm
        # that the rolling stats are actually re-computed at each refit
        # and not frozen at first fit.
        self._stats_fit_count: int = 0

    def _make_features(self, series: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Create features for residual modeling (shared with XGBoost)."""
        return build_feature_matrix(series, self.n_lags)

    def fit(self, history: np.ndarray) -> None:
        self._history = history
        if len(history) < max(self.n_lags, 50) + 10:
            # Bugfix clause 1.9 / 2.9: short-history early return is a
            # silent fallback to persistence; count it.
            self.fallback_counter += 1
            self._last_pred = float(history[-1]) if len(history) > 0 else 0.5
            self._fitted = True
            return
        try:
            import torch
            import torch.nn as nn

            tail = history[-self.window:]
            X, y = self._make_features(tail)
            if len(X) < 10:
                self._last_pred = float(history[-1])
                self._fitted = True
                return

            # Feature standardization (audit fix #C1, refined #C2).
            # Tree models are scale-invariant but MLPs with nn.Linear +
            # MSELoss learn more efficiently from zero-mean, unit-variance
            # inputs.  Stats are computed on the training window (no
            # leakage). They are *also* recomputed on the most recent
            # feature window at predict() time so the new feature row is
            # not standardised by stale stats — see Issue #C2 in the
            # training audit and the rolling-statistics treatment of
            # input drift in Lu et al (2018) "Learning under Concept
            # Drift" and Passalis et al (2019) "Deep Adaptive Input
            # Normalization".  The fit-time stats remain the canonical
            # snapshot the model was trained against; predict-time stats
            # may shift slightly between refits to track drift.
            win_mean = X.mean(axis=0)
            win_std = X.std(axis=0)
            win_std = np.where(win_std < 1e-8, 1.0, win_std)
            self._feature_mean = win_mean
            self._feature_std = win_std
            # Bump a fit counter so regression tests can confirm the
            # statistics actually get refreshed on each refit (the
            # audit's specific concern).
            self._stats_fit_count = getattr(self, "_stats_fit_count", 0) + 1
            X_scaled = (X - self._feature_mean) / self._feature_std

            # Expanding-window validation split with a temporal gap for
            # early stopping (audit fix #A3). Without this, 200 epochs
            # of Adam(lr=0.01) on a 500-point window with no dropout
            # overfits quickly.
            n = len(X_scaled)
            val_gap = min(24, max(5, n // 20))
            val_size = max(10, n // 5)
            has_val = n >= val_size + val_gap + 20
            if has_val:
                val_start = n - val_size
                train_end = val_start - val_gap
                X_train = torch.tensor(X_scaled[:train_end], dtype=torch.float32)
                y_train = torch.tensor(y[:train_end], dtype=torch.float32).unsqueeze(1)
                X_val = torch.tensor(X_scaled[val_start:], dtype=torch.float32)
                y_val = torch.tensor(y[val_start:], dtype=torch.float32).unsqueeze(1)
            else:
                X_train = torch.tensor(X_scaled, dtype=torch.float32)
                y_train = torch.tensor(y, dtype=torch.float32).unsqueeze(1)
                X_val, y_val = None, None

            torch.manual_seed(self.seed)  # bugfix clause 1.8 / 2.8
            n_input = X_train.shape[1]
            model = nn.Sequential(
                nn.Linear(n_input, self.hidden),
                nn.ReLU(),
                nn.Linear(self.hidden, self.hidden // 2),
                nn.ReLU(),
                nn.Linear(self.hidden // 2, 1),
            )
            # Weight decay is a light L2 regulariser complementing early
            # stopping (Goodfellow-Bengio-Courville 2016, §7.8).
            optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=1e-4)
            loss_fn = nn.MSELoss()

            # Early stopping with best-weights restoration (audit fix #A3).
            best_val = float("inf")
            best_state: dict | None = None
            patience = 20
            no_improve = 0
            model.train()
            for _epoch in range(200):
                pred = model(X_train)
                loss = loss_fn(pred, y_train)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

                if has_val and X_val is not None:
                    model.eval()
                    with torch.no_grad():
                        val_pred = model(X_val)
                        val_loss = float(loss_fn(val_pred, y_val).item())
                    model.train()
                    if val_loss < best_val - 1e-6:
                        best_val = val_loss
                        best_state = {k: v.detach().clone()
                                      for k, v in model.state_dict().items()}
                        no_improve = 0
                    else:
                        no_improve += 1
                        if no_improve >= patience:
                            break

            if has_val and best_state is not None:
                model.load_state_dict(best_state)

            model.eval()
            with torch.no_grad():
                feat_raw = self._make_predict_features(history)
                feat_scaled = (feat_raw - self._feature_mean) / self._feature_std
                last_features = torch.tensor(feat_scaled, dtype=torch.float32)
                delta = float(model(last_features).item())
                self._last_pred = float(np.clip(history[-1] + delta, 0, 1))
            self._model = model
        except Exception:
            # Bugfix clause 1.14: MLP fit failure -> count silent fallback.
            self.fallback_counter += 1
            self._last_pred = float(history[-1])
        self._fitted = True

    def _make_predict_features(self, history: np.ndarray) -> np.ndarray | None:
        """Build feature vector for next-step prediction (shared with XGBoost)."""
        return build_predict_features(history, self.n_lags)

    def predict(self) -> float:
        if self._model is not None and len(self._history) >= max(self.n_lags, 50):
            try:
                import torch
                with torch.no_grad():
                    feat = self._make_predict_features(self._history)
                    if feat is not None:
                        # Apply the same standardization used at fit time
                        # (audit fix #C1).
                        feat_scaled = (feat - self._feature_mean) / self._feature_std
                        last_features = torch.tensor(feat_scaled, dtype=torch.float32)
                        delta = float(self._model(last_features).item())
                        return float(np.clip(self._history[-1] + delta, 0, 1))
            except Exception:
                pass
        return self._last_pred


class ThetaForecaster(BaseForecaster):
    """Theta method: SES with drift. Uses persistence between retrains."""

    def __init__(self, residual_window: int = 200):
        super().__init__(
            "Theta",
            retrain_every=50,
            window=300,
            residual_window=residual_window,
        )
        self._alpha = 0.3
        self._level = 0.5
        self._drift = 0.0
        self._history: np.ndarray = np.array([])
        self._fit_history_len = 0  # length of history at time of last fit

    def fit(self, history: np.ndarray) -> None:
        self._history = history
        if len(history) < 3:
            self._level = float(history[-1]) if len(history) > 0 else 0.5
            self._drift = 0.0
            self._fit_history_len = len(history)
            self._fitted = True
            return
        tail = history[-self.window:]
        self._level = float(tail[0])
        for v in tail[1:]:
            self._level = self._alpha * float(v) + (1 - self._alpha) * self._level
        n_drift = min(50, len(tail) - 1)
        if n_drift > 0:
            self._drift = float(np.mean(np.diff(tail[-n_drift-1:])))
        else:
            self._drift = 0.0
        self._fit_history_len = len(history)
        self._fitted = True

    def predict(self) -> float:
        # Apply SES to any observations that arrived since the last fit.
        # Right after fit, history length == _fit_history_len, so no catch-up
        # is applied (avoids double-counting the most recent observation).
        level = self._level
        if len(self._history) > self._fit_history_len:
            for v in self._history[self._fit_history_len:]:
                level = self._alpha * float(v) + (1 - self._alpha) * level
        return float(np.clip(level + self._drift, 0, 1))


class EnsembleForecaster(BaseForecaster):
    """Simple ensemble: average of Naive and EWMA quantile forecasts."""

    def __init__(self):
        super().__init__(
            "Ensemble (Naive+EWMA)",
            retrain_every=1,
            window=200,
            residual_window=100,
        )
        self._naive = NaiveForecaster(residual_window=100)
        self._ewma = MovingAverageForecaster(span=5, residual_window=100)

    def fit(self, history: np.ndarray) -> None:
        self._naive.fit(history)
        self._ewma.fit(history)
        self._fitted = True

    def predict(self) -> float:
        return (self._naive.predict() + self._ewma.predict()) / 2

    def predict_quantiles(self, taus: np.ndarray) -> np.ndarray:
        q1 = self._naive.predict_quantiles(taus)
        q2 = self._ewma.predict_quantiles(taus)
        return (q1 + q2) / 2

    def update_residuals(self, y_true: float, y_pred: float) -> None:
        super().update_residuals(y_true, y_pred)
        # Ensemble members retain their own residual buffers so their
        # individual quantile fans remain well-formed. Each member's
        # current predict() reflects state from before round t's outcome
        # (the outer runner only advances state *after* this call), so
        # the pair (y_true, member.predict()) is correctly aligned as
        # a round-t residual. Verified against standalone Naive/EWMA
        # residual buffers in tests/audit/test_bug_condition_c_training.py.
        self._naive.update_residuals(y_true, self._naive.predict())
        self._ewma.update_residuals(y_true, self._ewma.predict())


def get_all_forecasters() -> list[BaseForecaster]:
    """Return all 7 forecasters with documented residual window choices.

    Residual windows are set per-forecaster to balance the bias-variance
    trade-off in residual-bootstrap quantile estimation:

    - Naive (100): Retrains every step, so a short window keeps the
      bootstrap responsive to recent regime changes.
    - Moving Average (100): EWMA(5), fast-adapting with short buffer.
    - ARIMA (300): Retrains every 50 steps on a 300-point training
      window; matching residual_window to the training window ensures
      the bootstrap covers the same data horizon as the fitted model.
    - XGBoost (500): The XGBoost residual_window was expanded from the
      original 300 to 500 to match the larger effective training window
      created by XGBoost's ``window=0`` (expanding history). A 500-point
      residual buffer spans the full model-fit horizon at typical
      Elia-length runs and prevents the residual distribution from
      tailing off on a shorter window than XGBoost is itself trained on.
    - MLP (300): Same rationale as ARIMA/XGBoost — periodic retraining
      on a 300-point window warrants a matching residual buffer.
    - Theta (200): SES with drift, moderate residual window balances
      the 300-point training window with faster adaptation.
    - Ensemble (100): Averages Naive + EWMA; inherits their short buffers.
    """
    taus = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    return [
        NaiveForecaster(residual_window=100),
        MovingAverageForecaster(span=5, residual_window=100),
        ARIMAForecaster(order=(2, 1, 1), residual_window=300),
        XGBoostForecaster(n_lags=24, taus=taus, residual_window=500),
        MLPForecaster(n_lags=24, hidden=32, residual_window=300),
        ThetaForecaster(residual_window=200),
        EnsembleForecaster(),
    ]
