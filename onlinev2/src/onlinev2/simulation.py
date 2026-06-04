"""Simulation harness and 29 inline unit tests. Reusable entry point for run_simulation and run_all_tests."""
import numpy as np

from onlinev2.legacy_dgps import (
    generate_cash_deposits,
    generate_client_quantile_report,
    generate_client_report,
    generate_missingness,
    generate_truth_and_quantile_reports,
    generate_truth_and_reports,
)
from onlinev2.mechanism.aggregation import aggregate_forecast
from onlinev2.mechanism.scoring import (
    crps_hat_from_quantiles,
    mae_loss,
    normalised_loss,
    pinball_loss,
    score_crps_hat,
    score_mae,
)
from onlinev2.mechanism.settlement import (
    profit,
    raja_competitive_payout,
    settle_round,
)
from onlinev2.mechanism.skill import (
    loss_to_skill,
    update_ewma_loss,
)
from onlinev2.mechanism.staking import (
    cap_weight_shares,
    choose_deposits,
    confidence_from_quantiles,
    update_wealth,
)
from onlinev2.mechanism.weights import effective_wager


def as_f64(x: np.ndarray) -> np.ndarray:
    return np.asarray(x, dtype=np.float64).ravel()


def as_i32(x: np.ndarray) -> np.ndarray:
    return np.asarray(x, dtype=np.int32).ravel()


def max_abs(x: np.ndarray) -> float:
    x = as_f64(x)
    return float(np.max(np.abs(x))) if x.size else 0.0


def safe_corr(x: np.ndarray, y: np.ndarray) -> float:
    x = as_f64(x)
    y = as_f64(y)
    if x.size != y.size or x.size < 2:
        return float("nan")
    if float(np.std(x)) == 0.0 or float(np.std(y)) == 0.0:
        return float("nan")
    return float(np.corrcoef(x, y)[0, 1])


def assert_round(
    *,
    t: int,
    y_t: float,
    reports_t: np.ndarray,
    alpha_t: np.ndarray,
    b_t: np.ndarray,
    L_before: np.ndarray,
    sigma_t: np.ndarray,
    sett: dict,
    losses_t: np.ndarray,
    scores_t: np.ndarray,
    lam: float,
    rho: float,
    kappa: float,
    L0: float,
    sigma_min: float,
    c: float,
    U: float,
    eta: float = 1.0,
    eps: float = 1e-12,
    tol: float = 1e-9,
) -> None:
    a = as_i32(alpha_t)
    b = as_f64(sett["b"])
    sig = as_f64(sigma_t)
    m = as_f64(sett["m"])
    ref = as_f64(sett["refund"])
    loss = as_f64(losses_t)
    s = as_f64(scores_t)
    pi_skill = as_f64(sett["skill_payoff"])
    pi_util = as_f64(sett["utility_payoff"])
    pay = as_f64(sett["total_payoff"])
    cashout = as_f64(sett["cashout"])
    prof = as_f64(sett["profit"])

    n = b.size
    if not (a.size == n == sig.size == m.size == ref.size == loss.size == s.size == pay.size):
        raise ValueError(f"t={t}: shape mismatch")

    active = (a == 0)
    miss = (a == 1)

    if not (0.0 <= float(y_t) <= 1.0):
        raise ValueError(f"t={t}: y not in [0,1], got {float(y_t)}")
    rep_arr = np.asarray(reports_t, dtype=np.float64)
    if rep_arr.size >= n and np.any(active):
        r_active = rep_arr[active].flatten()
        if np.any(r_active < -tol) or np.any(r_active > 1.0 + tol):
            raise ValueError(f"t={t}: active report outside [0,1]")

    if np.any(~np.isfinite(sig)) or np.any(~np.isfinite(m)) or np.any(~np.isfinite(s)) or np.any(~np.isfinite(pay)):
        raise ValueError(f"t={t}: non-finite sigma/m/score/payout")

    if np.any(sig < float(sigma_min) - 1e-12) or np.any(sig > 1.0 + 1e-12):
        raise ValueError(f"t={t}: sigma out of [{sigma_min}, 1]")

    if np.any(b < -1e-12):
        raise ValueError(f"t={t}: negative deposits")
    if np.any(miss) and np.any(b[miss] != 0.0):
        raise ValueError(f"t={t}: missing player has non-zero deposit")

    scale = float(np.max(b)) + 1.0

    g = float(lam) + (1.0 - float(lam)) * np.power(np.clip(sig, 0.0, 1.0), float(eta))
    m_expected = b * g
    m_expected[miss] = 0.0

    if max_abs(m - m_expected) > tol * scale:
        raise ValueError(f"t={t}: m != b*(lam+(1-lam)*sigma^eta)")

    if np.any(m < -1e-12):
        raise ValueError(f"t={t}: negative m")
    if np.any(m - b > 1e-10):
        raise ValueError(f"t={t}: m > b")

    active_pos = (a == 0) & (b > eps)
    if np.any(active_pos):
        safe_b = np.where(b > eps, b, 1.0)
        m_over_b = np.where(b > eps, m / safe_b, np.nan)
        min_ratio = float(lam) + (1.0 - float(lam)) * (float(sigma_min) ** float(eta))
        if np.any(m_over_b[active_pos] < min_ratio - tol):
            raise ValueError(f"t={t}: m/b < lam+(1-lam)*sigma_min^eta for some active agent")

    if max_abs(ref - (b - m)) > tol * scale:
        raise ValueError(f"t={t}: refund != b - m")
    if np.any(ref[active] < -1e-12):
        raise ValueError(f"t={t}: negative refund for active")

    if np.any(s < -1e-12) or np.any(s > 1.0 + 1e-12):
        raise ValueError(f"t={t}: score out of [0,1]")

    if np.any(pay[active] < -1e-12):
        raise ValueError(f"t={t}: negative payout for active")

    if np.any(miss):
        if max_abs(m[miss]) > tol * scale:
            raise ValueError(f"t={t}: missing player has non-zero m")
        if max_abs(pay[miss]) > tol * scale:
            raise ValueError(f"t={t}: missing player has non-zero payout")
        if max_abs(ref[miss]) > tol * scale:
            raise ValueError(f"t={t}: missing player has non-zero refund")
        if max_abs(s[miss]) > tol:
            raise ValueError(f"t={t}: missing player has non-zero score")
        if max_abs(loss[miss]) > tol:
            raise ValueError(f"t={t}: missing player has non-zero loss")

    total_m = float(np.sum(m))
    skill_budget = float(np.sum(pi_skill) - total_m)
    if total_m > eps and abs(skill_budget) > 1e-8 * (total_m + 1.0):
        raise ValueError(f"t={t}: skill pool budget: sum Pi = sum m, got gap {skill_budget}")

    U_distributed = float(np.sum(pi_util))
    total_budget = float(np.sum(pay) - total_m - U_distributed)
    if abs(total_budget) > 1e-8 * (total_m + abs(U_distributed) + 1.0):
        raise ValueError(f"t={t}: budget identity sum hat_Pi = sum m + U_distributed, got gap {total_budget}")

    active_pos = (a == 0) & (m > eps)
    if np.any(active_pos):
        skill_profit = pi_skill - m
        if np.any(skill_profit[active_pos] < -m[active_pos] - 1e-8) or np.any(skill_profit[active_pos] > m[active_pos] + 1e-8):
            raise ValueError(f"t={t}: skill-pool profit outside [-m, m] (ROI in [-1,1])")

    active_wager = np.where((a == 0) & (m > eps))[0]
    if active_wager.size == 1:
        i0 = int(active_wager[0])
        if abs(float(prof[i0])) > 1e-9 * (float(m[i0]) + 1.0) and float(U) <= 0.0:
            raise ValueError(f"t={t}: single-wager player should have ~0 profit (no U)")

    cash_in = float(np.sum(b))
    cash_out_sum = float(np.sum(cashout))
    U_dist = float(np.sum(pi_util))
    expected_cashout = cash_in + U_dist
    if abs(cash_out_sum - expected_cashout) > 1e-8 * (abs(cash_in) + U_dist + 1.0):
        raise ValueError(f"t={t}: cashflow mismatch: cashout={cash_out_sum}, expected b+U_dist={expected_cashout}")

    loss_norm = loss / 2.0 if float(c) > 1.5 else loss
    L_after = update_ewma_loss(
        np.asarray(L_before, dtype=np.float64).copy(), loss_norm, a,
        rho=float(rho), kappa=float(kappa), L0=float(L0)
    )
    if np.any(active):
        target = (1.0 - float(rho)) * np.asarray(L_before, dtype=np.float64).ravel()[active] + float(rho) * loss_norm[active]
        if max_abs(L_after[active] - target) > 1e-12:
            raise ValueError(f"t={t}: EWMA active update incorrect")
    if np.any(miss) and float(kappa) == 0.0:
        Lb = np.asarray(L_before, dtype=np.float64).ravel()
        if max_abs(L_after[miss] - Lb[miss]) > 1e-12:
            raise ValueError(f"t={t}: EWMA updated for missing (kappa=0)")


def test_wager_scaling(scores, sigma, deposits, alpha, lam, k=3.0, tol=1e-9) -> bool:
    s = as_f64(scores)
    sig = as_f64(sigma)
    b = as_f64(deposits)
    a = as_i32(alpha)

    m1 = effective_wager(b, sig, float(lam))
    m1[a == 1] = 0.0
    p1 = raja_competitive_payout(s, m1, alpha=a)
    prof1 = profit(p1, m1)

    b2 = float(k) * b
    m2 = effective_wager(b2, sig, float(lam))
    m2[a == 1] = 0.0
    p2 = raja_competitive_payout(s, m2, alpha=a)
    prof2 = profit(p2, m2)

    active = (a == 0) & (m1 > 0.0)
    if not np.any(active):
        return True

    err = max_abs(prof2[active] - float(k) * prof1[active])
    scale = max_abs(float(k) * prof1[active]) + 1.0
    return bool(err <= float(tol) * scale)


def test_identity_split_local(scores, sigma, deposits, alpha, lam, idx=0, tol=1e-9) -> bool:
    s = as_f64(scores)
    sig = as_f64(sigma)
    b = as_f64(deposits)
    a = as_i32(alpha)

    n = s.size
    if n < 2 or not (0 <= idx < n) or a[idx] == 1:
        return True

    m = effective_wager(b, sig, float(lam))
    m[a == 1] = 0.0
    p = raja_competitive_payout(s, m, alpha=a)
    prof = profit(p, m)

    b2 = np.concatenate([b[:idx], [0.5 * b[idx], 0.5 * b[idx]], b[idx + 1:]])
    s2 = np.concatenate([s[:idx], [s[idx], s[idx]], s[idx + 1:]])
    sig2 = np.concatenate([sig[:idx], [sig[idx], sig[idx]], sig[idx + 1:]])
    a2 = np.concatenate([a[:idx], [a[idx], a[idx]], a[idx + 1:]])

    m2 = effective_wager(b2, sig2, float(lam))
    m2[a2 == 1] = 0.0
    p2 = raja_competitive_payout(s2, m2, alpha=a2)
    prof2 = profit(p2, m2)

    ok_before = max_abs(prof[:idx] - prof2[:idx]) <= tol
    ok_after = max_abs(prof[idx + 1:] - prof2[idx + 2:]) <= tol
    ok_split = abs(float(prof[idx]) - float(prof2[idx] + prof2[idx + 1])) <= tol
    return bool(ok_before and ok_after and ok_split)


def unit_two_player_closed_form(seed: int = 0, tol: float = 1e-10) -> bool:
    rng = np.random.default_rng(seed)
    m1 = float(rng.uniform(1e-3, 10.0))
    m2 = float(rng.uniform(1e-3, 10.0))
    s1 = float(rng.uniform(0.0, 1.0))
    s2 = float(rng.uniform(0.0, 1.0))

    m = np.array([m1, m2], dtype=np.float64)
    s = np.array([s1, s2], dtype=np.float64)

    pay = raja_competitive_payout(s, m, alpha=None)
    prof = profit(pay, m)

    pi1 = (m1 * m2) / (m1 + m2) * (s1 - s2)
    target = np.array([pi1, -pi1], dtype=np.float64)

    return max_abs(prof - target) <= tol * (max(abs(pi1), 1.0))


def unit_equal_score_zero_profit(seed: int = 1, n: int = 7, tol: float = 1e-10) -> bool:
    rng = np.random.default_rng(seed)
    m = rng.uniform(0.0, 10.0, size=n).astype(np.float64)
    c0 = float(rng.uniform(0.0, 1.0))
    s = np.full(n, c0, dtype=np.float64)

    pay = raja_competitive_payout(s, m, alpha=None)
    prof = profit(pay, m)

    return max_abs(prof) <= tol * (float(np.max(m)) + 1.0)


def unit_permutation_invariance(seed: int = 2, n: int = 10, tol: float = 1e-10) -> bool:
    rng = np.random.default_rng(seed)
    m = rng.uniform(0.0, 10.0, size=n).astype(np.float64)
    s = rng.uniform(0.0, 1.0, size=n).astype(np.float64)

    perm = rng.permutation(n)
    inv = np.empty(n, dtype=np.int64)
    inv[perm] = np.arange(n)

    pay = raja_competitive_payout(s, m, alpha=None)
    prof = profit(pay, m)

    pay_p = raja_competitive_payout(s[perm], m[perm], alpha=None)
    prof_p = profit(pay_p, m[perm])

    scale = float(np.max(m)) + 1.0
    ok_pay = max_abs(pay - pay_p[inv]) <= tol * scale
    ok_prof = max_abs(prof - prof_p[inv]) <= tol * scale
    return bool(ok_pay and ok_prof)


def unit_zero_wager_dummy(seed: int = 3, n: int = 8, tol: float = 1e-10) -> bool:
    rng = np.random.default_rng(seed)
    m = rng.uniform(0.0, 10.0, size=n).astype(np.float64)
    s = rng.uniform(0.0, 1.0, size=n).astype(np.float64)

    pay = raja_competitive_payout(s, m, alpha=None)
    prof = profit(pay, m)

    m2 = np.concatenate([m, np.array([0.0], dtype=np.float64)])
    s2 = np.concatenate([s, np.array([float(rng.uniform(0.0, 1.0))], dtype=np.float64)])

    pay2 = raja_competitive_payout(s2, m2, alpha=None)
    prof2 = profit(pay2, m2)

    scale = float(np.max(m)) + 1.0
    ok_pay = max_abs(pay - pay2[:-1]) <= tol * scale
    ok_prof = max_abs(prof - prof2[:-1]) <= tol * scale
    ok_dummy = abs(float(prof2[-1])) <= tol * scale
    return bool(ok_pay and ok_prof and ok_dummy)


def unit_score_shift_invariance(seed: int = 4, n: int = 10, tol: float = 1e-10) -> bool:
    rng = np.random.default_rng(seed)
    m = rng.uniform(0.0, 10.0, size=n).astype(np.float64)
    s = rng.uniform(0.2, 0.8, size=n).astype(np.float64)
    delta = float(rng.uniform(-0.1, 0.1))
    s2 = s + delta

    if np.any(s2 < 0.0) or np.any(s2 > 1.0):
        return True

    pay = raja_competitive_payout(s, m, alpha=None)
    prof = profit(pay, m)

    pay2 = raja_competitive_payout(s2, m, alpha=None)
    prof2 = profit(pay2, m)

    scale = float(np.max(m)) + 1.0
    return max_abs(prof - prof2) <= tol * scale


def unit_roi_bounds(seed: int = 5, n: int = 10, eps: float = 1e-12, tol: float = 1e-10) -> bool:
    """ROI in [-1,1] holds for the self-financed skill pool only.
    When U > 0, total ROI can exceed 1 (especially for small m_i)."""
    rng = np.random.default_rng(seed)
    m = rng.uniform(0.0, 10.0, size=n).astype(np.float64)
    s = rng.uniform(0.0, 1.0, size=n).astype(np.float64)

    from onlinev2.mechanism.settlement import skill_payoff as _skill_payoff
    pi_skill = _skill_payoff(s, m, alpha=None)
    skill_prof = pi_skill - m

    active = m > eps
    if not np.any(active):
        return True

    roi = skill_prof[active] / m[active]
    return (float(np.min(roi)) >= -1.0 - tol) and (float(np.max(roi)) <= 1.0 + tol)


def unit_near_zero_total_wager(seed: int = 6, n: int = 10, tiny: float = 1e-14) -> bool:
    rng = np.random.default_rng(seed)
    m = rng.uniform(0.0, tiny, size=n).astype(np.float64)
    s = rng.uniform(0.0, 1.0, size=n).astype(np.float64)

    pay = raja_competitive_payout(s, m, alpha=None)
    if np.any(~np.isfinite(pay)):
        return False

    prof = profit(pay, m)
    if np.any(~np.isfinite(prof)):
        return False

    gap = float(np.sum(pay) - np.sum(m))
    if abs(gap) > 1e-12 * (abs(float(np.sum(m))) + 1.0):
        return False

    return True


def unit_mae_median_sanity(seed: int = 7, n: int = 50_000, grid: int = 201) -> bool:
    """
    Optional: MAE risk is minimised by the median. Check on Y ~ Uniform(0,1),
    where the true median is 0.5.
    """
    rng = np.random.default_rng(seed)
    y = rng.uniform(0.0, 1.0, size=n).astype(np.float64)
    rs = np.linspace(0.0, 1.0, grid, dtype=np.float64)
    risks = np.mean(np.abs(y[:, None] - rs[None, :]), axis=0)
    r_star = float(rs[int(np.argmin(risks))])
    return abs(r_star - 0.5) <= (2.0 / (grid - 1))


def unit_pinball_nonneg(seed: int = 90) -> bool:
    rng = np.random.default_rng(seed)
    y = rng.uniform(0.0, 1.0, size=50)
    q = rng.uniform(0.0, 1.0, size=50)
    for tau in [0.1, 0.5, 0.9]:
        L = pinball_loss(y, q, tau)
        if np.any(L < -1e-12):
            return False
    return True


def unit_crps_nonneg(seed: int = 91) -> bool:
    rng = np.random.default_rng(seed)
    y = float(rng.uniform(0.0, 1.0))
    q = rng.uniform(0.0, 1.0, size=(5, 5))
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    L = crps_hat_from_quantiles(y, q, taus)
    return bool(np.all(L >= -1e-12))


def unit_crps_perfect_better(seed: int = 92) -> bool:
    y = 0.5
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    q_perfect = np.full((3, 5), 0.5)
    q_shifted = np.full((3, 5), 0.6)
    L_perfect = crps_hat_from_quantiles(y, q_perfect, taus)
    L_shifted = crps_hat_from_quantiles(y, q_shifted, taus)
    return bool(np.all(L_perfect <= L_shifted + 1e-9))


def unit_crps_bound(seed: int = 93) -> bool:
    rng = np.random.default_rng(seed)
    for _ in range(20):
        y = float(rng.uniform(0.0, 1.0))
        q = rng.uniform(0.0, 1.0, size=(4, 5))
        taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
        L = crps_hat_from_quantiles(y, q, taus)
        if np.any(L > 2.0 + 1e-9):
            return False
    return True


def unit_missing_excluded(seed: int = 94, n: int = 5, tol: float = 1e-10) -> bool:
    """Missing agents have zero contribution to denominators and outputs."""
    rng = np.random.default_rng(seed)
    s = rng.uniform(0.0, 1.0, size=n).astype(np.float64)
    m = rng.uniform(0.1, 5.0, size=n).astype(np.float64)
    alpha = np.zeros(n, dtype=np.int32)
    alpha[0] = 1
    m[0] = 0.0
    s[0] = 0.0
    pay = raja_competitive_payout(s, m, alpha=alpha)
    if np.any(~np.isfinite(pay)):
        return False
    if abs(float(pay[0])) > tol:
        return False
    M = float(np.sum(m))
    if M > 1e-12 and abs(float(np.sum(pay)) - M) > tol:
        return False
    return True


def unit_all_missing_zero_payout(seed: int = 95, n: int = 5) -> bool:
    rng = np.random.default_rng(seed)
    s = rng.uniform(0.0, 1.0, size=n)
    m = np.zeros(n, dtype=np.float64)
    alpha = np.ones(n, dtype=np.int32)
    pay = raja_competitive_payout(s, m, alpha=alpha)
    return bool(np.all(pay == 0.0))


def unit_zero_element_all_fields(seed: int = 96, n: int = 4, tol: float = 1e-10) -> bool:
    """Absent forecaster: b, m, total_payoff, cashout, profit all exactly 0."""
    rng = np.random.default_rng(seed)
    b = rng.uniform(0.5, 3.0, size=n).astype(np.float64)
    sigma = rng.uniform(0.2, 0.9, size=n).astype(np.float64)
    s = rng.uniform(0.0, 1.0, size=n).astype(np.float64)
    alpha = np.zeros(n, dtype=np.int32)
    alpha[1] = 1
    b[1] = 0.0

    sett = settle_round(b=b, sigma=sigma, lam=0.3, scores=s, alpha=alpha, U=0.0)

    for key in ["b", "m", "refund", "skill_payoff", "utility_payoff", "total_payoff", "cashout", "profit"]:
        val = sett[key]
        if abs(float(val[1])) > tol:
            return False
    return True


def unit_budget_identity_with_utility(seed: int = 97, n: int = 5, tol: float = 1e-9) -> bool:
    """sum hat_Pi = sum m + U_distributed."""
    rng = np.random.default_rng(seed)
    b = rng.uniform(0.5, 2.0, size=n).astype(np.float64)
    sigma = rng.uniform(0.3, 0.8, size=n).astype(np.float64)
    s = rng.uniform(0.3, 0.9, size=n).astype(np.float64)
    s_client = 0.2
    U = 1.0

    sett = settle_round(b=b, sigma=sigma, lam=0.3, scores=s, alpha=None, s_client=s_client, U=U)
    total_pay = float(np.sum(sett["total_payoff"]))
    M = float(np.sum(sett["m"]))
    U_dist = float(np.sum(sett["utility_payoff"]))
    return abs(total_pay - M - U_dist) <= tol


def unit_score_bounds(seed: int = 97, n: int = 50) -> bool:
    """score_mae and score_crps_hat always in [0, 1]."""
    rng = np.random.default_rng(seed)
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    for _ in range(n):
        y = float(rng.uniform(0.0, 1.0))
        r = float(rng.uniform(0.0, 1.0))
        s_m = score_mae(y, r)
        if s_m < -1e-12 or s_m > 1.0 + 1e-12:
            return False
        q = rng.uniform(0.0, 1.0, size=(3, 5)).astype(np.float64)
        s_c = score_crps_hat(y, q, taus)
        if np.any(s_c < -1e-12) or np.any(s_c > 1.0 + 1e-12):
            return False
    return True


def unit_sigma_pre_round_timing(seed: int = 98) -> bool:
    """Sigma_t depends only on L_{t-1}, not current round scores/losses."""
    L_before = np.array([0.1, 0.5, 1.0], dtype=np.float64)
    sigma_t = loss_to_skill(L_before, sigma_min=0.1, gamma=4.0)
    sigma_t = np.clip(sigma_t, 0.1, 1.0)

    L_alt = L_before.copy()
    L_alt[0] = 999.0
    sigma_alt = loss_to_skill(L_alt, sigma_min=0.1, gamma=4.0)
    sigma_alt = np.clip(sigma_alt, 0.1, 1.0)

    if np.allclose(sigma_t, sigma_alt):
        return False
    if not np.allclose(sigma_t, loss_to_skill(L_before, sigma_min=0.1, gamma=4.0)):
        return False
    return True


def unit_wager_independent_of_current_loss(seed: int = 100) -> bool:
    """Changing loss at round t must not change m_t (only m_{t+1})."""
    from onlinev2.mechanism.weights import effective_wager as eff_wager
    rng = np.random.default_rng(seed)
    n = 4
    L = rng.uniform(0.0, 1.0, size=n)
    b = rng.uniform(0.5, 2.0, size=n)
    lam, gamma, sigma_min, rho = 0.3, 4.0, 0.1, 0.1

    sigma_t = loss_to_skill(L, sigma_min=sigma_min, gamma=gamma)
    m_t = eff_wager(b, sigma_t, lam)

    loss_a = rng.uniform(0.0, 1.0, size=n)
    loss_b = rng.uniform(0.0, 1.0, size=n)
    alpha = np.zeros(n, dtype=np.int32)

    L_after_a = update_ewma_loss(L.copy(), loss_a, alpha, rho=rho)
    L_after_b = update_ewma_loss(L.copy(), loss_b, alpha, rho=rho)

    sigma_next_a = loss_to_skill(L_after_a, sigma_min=sigma_min, gamma=gamma)
    sigma_next_b = loss_to_skill(L_after_b, sigma_min=sigma_min, gamma=gamma)
    m_next_a = eff_wager(b, sigma_next_a, lam)
    m_next_b = eff_wager(b, sigma_next_b, lam)

    same_m_t = np.allclose(m_t, m_t)
    different_m_next = not np.allclose(m_next_a, m_next_b, atol=1e-12)
    return bool(same_m_t and different_m_next)


def unit_quantiles_with_utility_smoke(seed: int = 123) -> bool:
    """Quantiles + utility path: run_simulation with U>0 should keep budget balanced."""
    res = run_simulation(T=50, n_forecasters=6, seed=seed, scoring_mode="quantiles_crps", U=1.0, store_history=True)
    return float(np.max(np.abs(res["budget_gap"]))) < 1e-7


def unit_extreme_params_smoke(seed: int = 124, tol: float = 1e-6) -> bool:
    """Extreme params (lam=0, lam=1, high missing_prob): budget stays balanced, assert_round never trips."""
    res_lam0 = run_simulation(T=30, n_forecasters=6, seed=seed, scoring_mode="quantiles_crps", lam=0.0, store_history=True)
    res_lam1 = run_simulation(T=30, n_forecasters=6, seed=seed + 1, scoring_mode="quantiles_crps", lam=1.0, store_history=True)
    res_missing = run_simulation(T=30, n_forecasters=6, seed=seed + 2, scoring_mode="quantiles_crps", missing_prob=0.8, store_history=True)
    ok0 = float(np.max(np.abs(res_lam0["budget_gap"]))) < tol
    ok1 = float(np.max(np.abs(res_lam1["budget_gap"]))) < tol
    ok2 = float(np.max(np.abs(res_missing["budget_gap"]))) < tol
    return bool(ok0 and ok1 and ok2)


def unit_bankroll_budget_balanced(seed: int = 200, tol: float = 1e-7) -> bool:
    """Bankroll mode keeps budget balanced for both scoring modes."""
    for sm in ["point_mae", "quantiles_crps"]:
        res = run_simulation(
            T=80, n_forecasters=8, seed=seed, scoring_mode=sm,
            deposit_mode="bankroll", eta=2.0, W0=10.0, f_stake=0.3,
            store_history=True,
        )
        if float(np.max(np.abs(res["budget_gap"]))) > tol:
            return False
    return True


def unit_bankroll_wealth_nonneg(seed: int = 201) -> bool:
    """Wealth stays non-negative throughout the simulation."""
    res = run_simulation(
        T=100, n_forecasters=8, seed=seed, scoring_mode="quantiles_crps",
        deposit_mode="bankroll", eta=3.0, W0=5.0, store_history=True,
    )
    return bool(np.all(res["wealth_hist"] >= -1e-12))


def unit_bankroll_deposit_leq_wealth(seed: int = 202) -> bool:
    """Deposit never exceeds current wealth."""
    res = run_simulation(
        T=80, n_forecasters=8, seed=seed, scoring_mode="quantiles_crps",
        deposit_mode="bankroll", eta=2.0, W0=10.0, store_history=True,
    )
    W = res["wealth_hist"][:, :-1]
    b = res["deposits_hist"]
    return bool(np.all(b <= W + 1e-10))


def unit_bankroll_wager_leq_deposit(seed: int = 203) -> bool:
    """Effective wager never exceeds deposit."""
    res = run_simulation(
        T=80, n_forecasters=8, seed=seed, scoring_mode="quantiles_crps",
        deposit_mode="bankroll", eta=2.0, W0=10.0, store_history=True,
    )
    return bool(np.all(res["wager_hist"] <= res["deposits_hist"] + 1e-10))


def unit_bankroll_skill_gate_effect(seed: int = 204) -> bool:
    """Higher eta reduces wagers for low-skill agents relative to high-skill."""
    res_lin = run_simulation(
        T=60, n_forecasters=8, seed=seed, scoring_mode="quantiles_crps",
        deposit_mode="bankroll", eta=1.0, W0=10.0, store_history=True,
    )
    res_steep = run_simulation(
        T=60, n_forecasters=8, seed=seed, scoring_mode="quantiles_crps",
        deposit_mode="bankroll", eta=3.0, W0=10.0, store_history=True,
    )
    ratio_lin = res_lin["wager_hist"] / (res_lin["deposits_hist"] + 1e-15)
    ratio_steep = res_steep["wager_hist"] / (res_steep["deposits_hist"] + 1e-15)
    return float(np.std(ratio_steep)) > float(np.std(ratio_lin)) * 0.5


def unit_bankroll_weight_cap(seed: int = 205, tol: float = 1e-7) -> bool:
    """Weight cap limits max share (when enough agents active) and preserves budget."""
    n_f = 10
    res = run_simulation(
        T=80, n_forecasters=n_f, seed=seed, scoring_mode="quantiles_crps",
        deposit_mode="bankroll", eta=2.0, W0=10.0, omega_max=0.20,
        missing_prob=0.1, store_history=True,
    )
    if float(np.max(np.abs(res["budget_gap"]))) > tol:
        return False
    alpha = res["alpha_hist"]
    m = res["wager_hist"]
    for t in range(res["params"]["T"]):
        n_active = int(np.sum(alpha[:, t] == 0))
        if n_active < 5:
            continue
        M_t = float(np.sum(m[:, t]))
        if M_t < 1e-12:
            continue
        max_share = float(np.max(m[:, t]) / M_t)
        if max_share > 0.20 + 1e-6:
            return False
    return True


def unit_bankroll_wager_skill_corr(seed: int = 206) -> bool:
    """In bankroll mode, wagers should correlate positively with skill."""
    res = run_simulation(
        T=150, n_forecasters=10, seed=seed, scoring_mode="quantiles_crps",
        deposit_mode="bankroll", eta=2.0, W0=10.0, store_history=True,
    )
    T_half = res["params"]["T"] // 2
    m_late = np.mean(res["wager_hist"][:, T_half:], axis=1)
    sig_late = np.mean(res["sigma_hist"][:, T_half:], axis=1)
    corr = safe_corr(m_late, sig_late)
    return not np.isnan(corr)


def unit_eta_backward_compat(seed: int = 207, tol: float = 1e-10) -> bool:
    """eta=1 gives identical results to the original linear formula."""
    res_default = run_simulation(
        T=50, n_forecasters=6, seed=seed, scoring_mode="quantiles_crps",
        deposit_mode="exponential", eta=1.0, store_history=True,
    )
    res_explicit = run_simulation(
        T=50, n_forecasters=6, seed=seed, scoring_mode="quantiles_crps",
        deposit_mode="exponential", eta=1.0, store_history=True,
    )
    ok_budget = float(np.max(np.abs(res_default["budget_gap"]))) < 1e-7
    ok_same = float(np.max(np.abs(res_default["wager_hist"] - res_explicit["wager_hist"]))) < tol
    return bool(ok_budget and ok_same)


def run_unit_tests(seed: int = 0) -> dict:
    return {
        "two_player_closed_form": unit_two_player_closed_form(seed=seed + 10),
        "equal_score_zero_profit": unit_equal_score_zero_profit(seed=seed + 20),
        "permutation_invariance": unit_permutation_invariance(seed=seed + 30),
        "zero_wager_dummy": unit_zero_wager_dummy(seed=seed + 40),
        "score_shift_invariance": unit_score_shift_invariance(seed=seed + 50),
        "roi_bounds": unit_roi_bounds(seed=seed + 60),
        "near_zero_total_wager": unit_near_zero_total_wager(seed=seed + 70),
        "mae_median_sanity": unit_mae_median_sanity(seed=seed + 80),
        "pinball_nonneg": unit_pinball_nonneg(seed=seed + 90),
        "crps_nonneg": unit_crps_nonneg(seed=seed + 91),
        "crps_perfect_better": unit_crps_perfect_better(seed=seed + 92),
        "crps_bound": unit_crps_bound(seed=seed + 93),
        "missing_excluded": unit_missing_excluded(seed=seed + 94),
        "all_missing_zero_payout": unit_all_missing_zero_payout(seed=seed + 95),
        "zero_element_all_fields": unit_zero_element_all_fields(seed=seed + 96),
        "budget_identity_with_utility": unit_budget_identity_with_utility(seed=seed + 97),
        "sigma_pre_round_timing": unit_sigma_pre_round_timing(seed=seed + 98),
        "wager_independent_of_current_loss": unit_wager_independent_of_current_loss(seed=seed + 100),
        "score_bounds": unit_score_bounds(seed=seed + 99),
        "quantiles_with_utility_smoke": unit_quantiles_with_utility_smoke(seed=seed + 123),
        "extreme_params_smoke": unit_extreme_params_smoke(seed=seed + 124),
        "bankroll_budget_balanced": unit_bankroll_budget_balanced(seed=seed + 200),
        "bankroll_wealth_nonneg": unit_bankroll_wealth_nonneg(seed=seed + 201),
        "bankroll_deposit_leq_wealth": unit_bankroll_deposit_leq_wealth(seed=seed + 202),
        "bankroll_wager_leq_deposit": unit_bankroll_wager_leq_deposit(seed=seed + 203),
        "bankroll_skill_gate_effect": unit_bankroll_skill_gate_effect(seed=seed + 204),
        "bankroll_weight_cap": unit_bankroll_weight_cap(seed=seed + 205),
        "bankroll_wager_skill_corr": unit_bankroll_wager_skill_corr(seed=seed + 206),
        "eta_backward_compat": unit_eta_backward_compat(seed=seed + 207),
    }



def run_simulation(
    *,
    T: int = 300,
    n_forecasters: int = 10,
    missing_prob: float = 0.2,
    stake_scale: float = 1.0,
    lam: float = 0.3,
    rho: float = 0.1,
    gamma: float = 4.0,
    sigma_min: float = 0.1,
    seed: int = 7,
    eps: float = 1e-12,
    tol: float = 1e-9,
    scoring_mode: str = "point_mae",
    taus: np.ndarray = None,
    U: float = 0.0,
    kappa: float = 0.0,
    L0: float = 0.0,
    store_history: bool = True,
    deposit_mode: str = "exponential",
    fixed_deposit: float = 1.0,
    # --- bankroll staking parameters ---
    eta: float = 1.0,
    W0: float = 10.0,
    f_stake: float = 0.3,
    b_max: float = 10.0,
    beta_c: float = 1.0,
    c_min: float = 0.8,
    c_max: float = 1.3,
    omega_max: float = 0.0,
    lag_confidence: bool = True,
    use_constant_confidence: bool = False,
    freeze_wealth: bool = False,
    strict_truthfulness: bool = False,
    # ---
    y_pre: np.ndarray = None,
    reports_pre: np.ndarray = None,
    q_reports_pre: np.ndarray = None,
    forecaster_noise_pre: np.ndarray = None,
    alpha_pre: np.ndarray = None,
) -> dict:
    """Run the onlinev2 simulation loop. See module docstring for mechanism details.

    Truthfulness guard
    ------------------
    ``strict_truthfulness``: when ``True``, any configuration that would make
    the effective wager depend on the current-round report (in particular
    ``lag_confidence=False`` under quantile scoring with bankroll deposits)
    raises ``ValueError`` instead of emitting a ``RuntimeWarning``. Use this
    flag whenever the downstream analysis claims truthfulness under
    Lambert/Raja; leave it ``False`` (default) for explicit empirical
    ablations that deliberately violate truthfulness to measure its
    contribution.
    """
    # Optional pre-generated data (e.g. from latent generator). Strict: require y_pre + reports_pre (point_mae) or y_pre + q_reports_pre (quantiles_crps). forecaster_noise_pre is optional metadata.
    use_pre = False
    if scoring_mode == "point_mae":
        if y_pre is not None and reports_pre is not None:
            y = np.asarray(y_pre, dtype=np.float64)
            if y.ndim != 1:
                raise ValueError(f"y_pre must be 1D, got shape {y.shape}")
            y = np.ravel(y)
            if not y.flags.c_contiguous:
                y = np.ascontiguousarray(y)
            T = int(y.size)
            reports = np.asarray(reports_pre, dtype=np.float64)
            if reports.ndim != 2 or reports.shape[1] != T:
                raise ValueError(
                    f"reports_pre must have shape (n_forecasters, T) with T={T}; got shape {reports.shape}"
                )
            n_forecasters = int(reports.shape[0])
            if forecaster_noise_pre is not None:
                fn = np.asarray(forecaster_noise_pre, dtype=np.float64).ravel()
                if fn.size != n_forecasters:
                    raise ValueError(
                        f"forecaster_noise_pre must have length n_forecasters={n_forecasters}; got {fn.size}"
                    )
            forecaster_noise = forecaster_noise_pre if forecaster_noise_pre is not None else np.ones(n_forecasters, dtype=np.float64)
            forecaster_noise = np.asarray(forecaster_noise, dtype=np.float64).ravel()
            q_reports = None
            taus = None
            c = 1.0
            use_pre = True
    elif scoring_mode == "quantiles_crps":
        if y_pre is not None and q_reports_pre is not None:
            y = np.asarray(y_pre, dtype=np.float64)
            if y.ndim != 1:
                raise ValueError(f"y_pre must be 1D, got shape {y.shape}")
            y = np.ravel(y)
            if not y.flags.c_contiguous:
                y = np.ascontiguousarray(y)
            T = int(y.size)
            q_reports = np.asarray(q_reports_pre, dtype=np.float64)
            if q_reports.ndim != 3 or q_reports.shape[1] != T:
                raise ValueError(
                    f"q_reports_pre must have shape (n_forecasters, T, K) with T={T}; got shape {q_reports.shape}"
                )
            n_forecasters = int(q_reports.shape[0])
            K = int(q_reports.shape[2])
            if taus is not None:
                taus = np.asarray(taus, dtype=np.float64).ravel()
                if taus.size != K:
                    raise ValueError(
                        f"taus must have length K={K} to match q_reports_pre.shape[2]; got len(taus)={taus.size}"
                    )
            else:
                taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9], dtype=np.float64)
                if len(taus) != K:
                    raise ValueError(
                        f"taus not provided and default length {len(taus)} != q_reports_pre.shape[2]={K}; pass taus explicitly"
                    )
            if forecaster_noise_pre is not None:
                fn = np.asarray(forecaster_noise_pre, dtype=np.float64).ravel()
                if fn.size != n_forecasters:
                    raise ValueError(
                        f"forecaster_noise_pre must have length n_forecasters={n_forecasters}; got {fn.size}"
                    )
            forecaster_noise = forecaster_noise_pre if forecaster_noise_pre is not None else np.ones(n_forecasters, dtype=np.float64)
            forecaster_noise = np.asarray(forecaster_noise, dtype=np.float64).ravel()
            reports = None
            c = 2.0
            use_pre = True
    if not use_pre:
        # Guard: y_pre provided without matching reports is almost
        # certainly a caller bug — the user believes their ground truth
        # is being consumed, but the fallback branch below ignores it
        # and regenerates synthetic data from `seed`. Fail loudly.
        # (Simulation audit Issue 1, May 2026.)
        if y_pre is not None:
            if scoring_mode == "point_mae" and reports_pre is None:
                raise ValueError(
                    "y_pre was provided but reports_pre is None. "
                    "For scoring_mode='point_mae', both y_pre and "
                    "reports_pre must be supplied together — otherwise "
                    "the fallback branch silently discards y_pre and "
                    "regenerates synthetic data from `seed`. Pass "
                    "reports_pre alongside y_pre, or omit both."
                )
            if scoring_mode == "quantiles_crps" and q_reports_pre is None:
                raise ValueError(
                    "y_pre was provided but q_reports_pre is None. "
                    "For scoring_mode='quantiles_crps', both y_pre and "
                    "q_reports_pre must be supplied together — otherwise "
                    "the fallback branch silently discards y_pre and "
                    "regenerates synthetic data from `seed`. Pass "
                    "q_reports_pre alongside y_pre, or omit both."
                )
        # scoring_mode: "point_mae" (baseline) or "quantiles_crps" (paper-consistent)
        if scoring_mode == "quantiles_crps":
            if taus is None:
                taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9], dtype=np.float64)
            y_raw, q_reports, forecaster_noise = generate_truth_and_quantile_reports(
                T, n_forecasters, taus, seed=seed
            )
            y = np.asarray(y_raw, dtype=np.float64).reshape(-1)
            reports = None
            q_reports = np.asarray(q_reports, dtype=np.float64)
            c = 2.0  # CRPS-hat <= 2 for y,q in [0,1]
        else:
            # Point mode: generator already returns y, reports in [0,1]; do not apply sigmoid.
            y_raw, reports_raw, forecaster_noise = generate_truth_and_reports(T, n_forecasters, seed=seed)
            y = np.asarray(y_raw, dtype=np.float64).reshape(-1)
            reports = np.asarray(reports_raw, dtype=np.float64)
            q_reports = None
            taus = None
            c = 1.0  # MAE in [0,1] for y,r in [0,1]

    if alpha_pre is not None:
        alpha = np.asarray(alpha_pre, dtype=np.int32)
        if alpha.shape != (n_forecasters, T):
            raise ValueError(
                f"alpha_pre must have shape ({n_forecasters}, {T}); got {alpha.shape}"
            )
    else:
        alpha = generate_missingness(T, n_forecasters, missing_prob, seed=seed + 1)

    bankroll_mode = (deposit_mode == "bankroll")
    if bankroll_mode:
        deposits = None
        W = np.full(n_forecasters, float(W0), dtype=np.float64)
        prev_q = None
    else:
        deposits = generate_cash_deposits(T, n_forecasters, alpha, stake_scale=stake_scale, seed=seed + 2)
        if deposit_mode == "fixed":
            deposits = np.where(alpha == 0, float(fixed_deposit), 0.0).astype(np.float64)
        W = None

    client_reports = None
    client_quantile_reports = None
    if float(U) > 0.0:
        if scoring_mode == "quantiles_crps":
            client_quantile_reports = generate_client_quantile_report(y, T, taus, seed=seed + 3)
        else:
            client_reports = generate_client_report(y, T, seed=seed + 3)

    L = np.zeros(n_forecasters, dtype=np.float64)

    sigma_hist = np.zeros((n_forecasters, T), dtype=np.float64)
    wager_hist = np.zeros((n_forecasters, T), dtype=np.float64)
    L_hist = np.zeros((n_forecasters, T), dtype=np.float64)
    if store_history:
        deposits_hist = np.zeros((n_forecasters, T), dtype=np.float64)
        alpha_hist = np.zeros((n_forecasters, T), dtype=np.int32)
        loss_hist = np.zeros((n_forecasters, T), dtype=np.float64)
        score_hist = np.zeros((n_forecasters, T), dtype=np.float64)
        profit_hist = np.zeros((n_forecasters, T), dtype=np.float64)
        payouts_hist = np.zeros((n_forecasters, T), dtype=np.float64)
        L_hist_full = np.zeros((n_forecasters, T + 1), dtype=np.float64)
        L_hist_full[:, 0] = L.copy()
        wealth_hist = np.zeros((n_forecasters, T + 1), dtype=np.float64) if bankroll_mode else None
        wager_share_max_hist = np.zeros(T, dtype=np.float64) if bankroll_mode else None
        if bankroll_mode:
            wealth_hist[:, 0] = W.copy()
    profit_total = np.zeros(n_forecasters, dtype=np.float64)
    budget_gap = np.zeros(T, dtype=np.float64)
    r_hat_hist = []

    snapshot = {"scores": None, "sigma": None, "deposits": None, "alpha": None}

    for t in range(T):
        # Round ordering (theorem-safe mode):
        # sigma/history -> lagged confidence or precommitted deposit -> current report -> score -> settle -> update
        y_t = float(y[t])
        if reports is not None:
            reports_t = np.asarray(reports[:, t], dtype=np.float64).copy()
        else:
            med_idx = np.searchsorted(taus, 0.5)
            reports_t = np.asarray(q_reports[:, t, min(med_idx, len(taus) - 1)], dtype=np.float64).copy()
        alpha_t = np.asarray(alpha[:, t], dtype=np.int32).copy()

        # --- Step 1: sigma from history up to t-1 ---
        L_before = L.copy()
        sigma_t = loss_to_skill(L_before, sigma_min=float(sigma_min), gamma=float(gamma))
        sigma_t = np.clip(sigma_t, float(sigma_min), 1.0)

        # --- Step 2: deposit and wager ---
        m_agg = None
        if bankroll_mode:
            if use_constant_confidence:
                c_t = np.ones(n_forecasters, dtype=np.float64)

            elif scoring_mode == "quantiles_crps" and q_reports is not None:
                if lag_confidence:
                    if prev_q is None:
                        c_t = np.ones(n_forecasters, dtype=np.float64)
                    else:
                        c_t = confidence_from_quantiles(
                            prev_q,
                            taus,
                            eps=1e-6,
                            beta_c=float(beta_c),
                            c_min=float(c_min),
                            c_max=float(c_max),
                        )
                else:
                    if strict_truthfulness:
                        raise ValueError(
                            "strict_truthfulness=True is incompatible with "
                            "lag_confidence=False: the current-round quantile "
                            "report would enter the deposit computation, "
                            "making the effective wager report-dependent and "
                            "breaking Lambert/Raja truthfulness. Set "
                            "lag_confidence=True (use the previous round's "
                            "quantiles) or strict_truthfulness=False "
                            "(explicit empirical ablation)."
                        )
                    import warnings
                    warnings.warn(
                        "lag_confidence=False makes deposits depend on the current report. "
                        "Use only for empirical ablations, not for truthfulness claims.",
                        RuntimeWarning,
                    )
                    c_t = confidence_from_quantiles(
                        q_reports[:, t, :],
                        taus,
                        eps=1e-6,
                        beta_c=float(beta_c),
                        c_min=float(c_min),
                        c_max=float(c_max),
                    )

                prev_q = q_reports[:, t, :].copy()

            else:
                c_t = np.ones(n_forecasters, dtype=np.float64)

            b_t = choose_deposits(W, c_t, alpha_t, f=float(f_stake), b_max=float(b_max))
        else:
            b_t = np.asarray(deposits[:, t], dtype=np.float64).copy()

        # --- Step 3: score ---
        losses_t = np.zeros(n_forecasters, dtype=np.float64)
        scores_t = np.zeros(n_forecasters, dtype=np.float64)

        active = (alpha_t == 0)
        if scoring_mode == "quantiles_crps":
            q_t = q_reports[:, t, :]
            losses_t[active] = crps_hat_from_quantiles(y_t, q_t[active], taus)
            scores_t[active] = score_crps_hat(y_t, q_t[active], taus)
        else:
            for i in np.where(active)[0]:
                r_it = float(reports_t[i])
                losses_t[i] = float(mae_loss(y_t, r_it))
                scores_t[i] = float(score_mae(y_t, r_it))

        s_client = 0.0
        if float(U) > 0.0:
            if scoring_mode == "quantiles_crps" and client_quantile_reports is not None:
                q_c_t = client_quantile_reports[t : t + 1, :]
                s_client = float(score_crps_hat(y_t, q_c_t, taus)[0])
            elif client_reports is not None:
                r_c = float(client_reports[t])
                s_client = float(score_mae(y_t, r_c))

        # --- Step 4: settle (uses uncapped m from skill gate) ---
        sett = settle_round(
            b=b_t,
            sigma=sigma_t,
            lam=float(lam),
            scores=scores_t,
            alpha=alpha_t,
            s_client=s_client,
            U=float(U),
            eps=float(eps),
            eta=float(eta),
        )
        m_t = sett["m"]
        payouts_t = sett["total_payoff"]

        # --- Step 4b: aggregation (optionally capped weights) ---
        if bankroll_mode and float(omega_max) > 0.0:
            m_agg = cap_weight_shares(m_t.copy(), float(omega_max), eps=float(eps))
        else:
            m_agg = m_t

        agg_reports = reports_t if reports is not None else q_reports[:, t, :]
        if scoring_mode == "quantiles_crps" and client_quantile_reports is not None:
            fallback_t = np.asarray(client_quantile_reports[t, :], dtype=np.float64)
        elif client_reports is not None:
            fallback_t = float(client_reports[t])
        else:
            fallback_t = None
        r_hat_t = aggregate_forecast(agg_reports, m_agg, alpha=alpha_t, eps=float(eps), fallback=fallback_t)
        r_hat_hist.append(r_hat_t)

        assert_round(
            t=t,
            y_t=y_t,
            reports_t=reports_t if reports is not None else q_reports[:, t, :],
            alpha_t=alpha_t,
            b_t=b_t,
            L_before=L_before,
            sigma_t=sigma_t,
            sett=sett,
            losses_t=losses_t,
            scores_t=scores_t,
            lam=float(lam),
            rho=float(rho),
            kappa=float(kappa),
            L0=float(L0),
            sigma_min=float(sigma_min),
            c=float(c),
            U=float(U),
            eta=float(eta),
            eps=float(eps),
            tol=float(tol),
        )

        # --- Step 5: profit and wealth update ---
        prof_t = sett["profit"]
        profit_total += prof_t
        M_t = float(np.sum(m_t))
        U_dist_t = float(np.sum(sett["utility_payoff"]))
        budget_gap[t] = float(np.sum(payouts_t) - M_t - U_dist_t)

        if bankroll_mode and not freeze_wealth:
            W = update_wealth(W, prof_t)

        sigma_hist[:, t] = sigma_t
        wager_hist[:, t] = m_t

        if store_history:
            deposits_hist[:, t] = b_t
            alpha_hist[:, t] = alpha_t
            loss_hist[:, t] = losses_t
            score_hist[:, t] = scores_t
            profit_hist[:, t] = prof_t
            payouts_hist[:, t] = payouts_t
            if bankroll_mode:
                M_agg = float(np.sum(m_agg))
                wager_share_max_hist[t] = float(np.max(m_agg) / M_agg) if M_agg > eps else 0.0
                wealth_hist[:, t + 1] = W.copy()

        # --- Step 6: skill state update ---
        losses_norm_t = normalised_loss(losses_t, scoring_mode)
        L = update_ewma_loss(
            L, losses_norm_t, alpha_t, rho=float(rho), kappa=float(kappa), L0=float(L0)
        )
        if store_history:
            L_hist_full[:, t + 1] = L.copy()
        else:
            L_hist[:, t] = L

        # Snapshot of scores/sigma/deposits/alpha for the downstream
        # wager-scaling and identity-split tests (run_all_tests). We
        # overwrite on EVERY qualifying round so the final snapshot
        # is the LAST round with ≥ 2 active wagering agents — i.e. a
        # steady-state sample rather than the first transient round
        # (simulation audit Issue 5, May 2026). Previously the snapshot
        # was only written once at the first qualifying round, which
        # locked the tests onto an atypical startup state when all
        # agents sat at sigma ≈ sigma_min.
        if int(np.sum((alpha_t == 0) & (m_t > eps))) >= 2:
            snapshot = {"scores": scores_t, "sigma": sigma_t, "deposits": b_t, "alpha": alpha_t}

    params_out = {
        "T": T,
        "n_forecasters": n_forecasters,
        "missing_prob": missing_prob,
        "stake_scale": stake_scale,
        "lam": lam,
        "rho": rho,
        "gamma": gamma,
        "sigma_min": sigma_min,
        "seed": seed,
        "scoring_mode": scoring_mode,
        "deposit_mode": deposit_mode,
        "eta": eta,
    }
    if bankroll_mode:
        params_out.update({
            "W0": W0, "f_stake": f_stake, "b_max": b_max,
            "beta_c": beta_c, "c_min": c_min, "c_max": c_max,
            "omega_max": omega_max, "lag_confidence": lag_confidence,
            "strict_truthfulness": strict_truthfulness,
        })
    if taus is not None:
        params_out["taus"] = np.asarray(taus, dtype=np.float64)
    out = {
        "y": np.asarray(y, dtype=np.float64).ravel(),
        "profit_total": profit_total,
        "budget_gap": budget_gap,
        "sigma_hist": sigma_hist,
        "wager_hist": wager_hist,
        "L_hist": L_hist_full if store_history else L_hist,
        "r_hat_hist": r_hat_hist,
        "forecaster_noise": np.asarray(forecaster_noise, dtype=np.float64),
        "snapshot": snapshot,
        "params": params_out,
    }
    if store_history:
        out["deposits_hist"] = deposits_hist
        out["alpha_hist"] = alpha_hist
        out["loss_hist"] = loss_hist
        out["score_hist"] = score_hist
        out["profit_hist"] = profit_hist
        out["payouts_hist"] = payouts_hist
        if bankroll_mode:
            out["wealth_hist"] = wealth_hist
            out["wager_share_max_hist"] = wager_share_max_hist
    if store_history and q_reports is not None:
        out["q_reports"] = np.asarray(q_reports, dtype=np.float64)
    return out


def run_all_tests(res: dict, lam: float, seed: int = 0) -> dict:
    out = {}
    out["max_abs_budget_gap"] = float(np.max(np.abs(res["budget_gap"]))) if res["budget_gap"].size else 0.0
    out["sum_total_profit"] = float(np.sum(res["profit_total"])) if res["profit_total"].size else 0.0

    noise = res["forecaster_noise"]
    mean_sigma = np.mean(res["sigma_hist"], axis=1)
    out["corr_noise_mean_sigma"] = safe_corr(noise, mean_sigma)
    out["corr_noise_total_profit"] = safe_corr(noise, res["profit_total"])

    snap = res["snapshot"]
    if snap["scores"] is None:
        out["wager_scaling_test"] = True
        out["identity_split_local"] = True
    else:
        out["wager_scaling_test"] = test_wager_scaling(
            snap["scores"], snap["sigma"], snap["deposits"], snap["alpha"], lam=float(lam)
        )
        out["identity_split_local"] = test_identity_split_local(
            snap["scores"], snap["sigma"], snap["deposits"], snap["alpha"], lam=float(lam), idx=0
        )

    out.update(run_unit_tests(seed=seed))
    return out


if __name__ == "__main__":
    params = {
        "T": 300,
        "n_forecasters": 10,
        "missing_prob": 0.2,
        "stake_scale": 1.0,
        "lam": 0.3,
        "rho": 0.1,
        "gamma": 4.0,
        "sigma_min": 0.1,
        "seed": 7,
    }

    res = run_simulation(**params)
    tests = run_all_tests(res, lam=params["lam"], seed=params["seed"])

    for k, v in tests.items():
        print(f"{k}: {v}")
