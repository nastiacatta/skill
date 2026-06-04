"""
Core deterministic round execution.

run_round is pure given (state, params, actions, y_t). All stochasticity sits
in the DGP and the behaviour layer. This module does not import behaviour;
actions satisfy the AgentInput protocol (see core.types).

Deposits in `actions` are treated as already chosen and locked for the round.
The core does not derive deposits from current reports. Per-round truthfulness
claims therefore require the caller to ensure deposit/exposure is fixed with
respect to the current report.
"""

from __future__ import annotations

import copy
from typing import Any, Dict, List, Tuple

import numpy as np

from onlinev2.core.aggregation import aggregate_forecast, _enforce_quantile_monotonicity
from onlinev2.core.intermittent import michael_predict, michael_update
from onlinev2.core.metrics import (
    compute_gini,
    compute_hhi,
    compute_n_eff,
    compute_pit,
    validate_quantile_monotonicity,
)
from onlinev2.core.michael_allocation import (
    michael_oos_allocation,
    michael_rewards,
    normalise_present,
    update_phi_c,
)
from onlinev2.core.scoring import (
    crps_hat_from_quantiles,
    mae_loss,
    normalised_loss,
    score_crps_hat,
    score_mae,
)
from onlinev2.core.settlement import settle_round
from onlinev2.core.shapley import shapley_mc
from onlinev2.core.skill import (
    default_initial_loss,
    loss_to_skill,
    update_ewma_loss,
)
from onlinev2.core.staking import (
    effective_wager_bankroll,
    effective_wager_capped,
)
from onlinev2.core.types import AgentInput, MechanismParams, MechanismState


def _resolve_michael_tau(params: MechanismParams) -> float:
    """Resolve Michael quantile level (τ). point_mae uses median (0.5) or michael_tau; quantiles_crps uses per-tau in loop."""
    if params.scoring_mode == "point_mae":
        return 0.5 if params.michael_tau is None else float(params.michael_tau)
    raise ValueError(
        "A single michael_tau is not valid for quantiles_crps. "
        "Use one Michael state per quantile level."
    )


def _get_tau_state(per_tau_state: dict, agg_flat: dict, k: int, n: int):
    """Get (w, D) for quantile index k; fallback to flat agg state when per_tau missing (e.g. point_mae)."""
    key = str(k)
    if key in per_tau_state:
        st = per_tau_state[key]
        return np.asarray(st["w"], dtype=float), np.asarray(st["D"], dtype=float)
    if k == 0 and agg_flat.get("w") is not None and agg_flat.get("D") is not None:
        w = np.asarray(agg_flat["w"], dtype=float).ravel()
        D = np.asarray(agg_flat["D"], dtype=float)
        if w.size == n and D.shape == (n, n):
            return w, D
    return np.full(n, 1.0 / n), np.zeros((n, n))


def _validate_actions(actions: List[AgentInput]) -> None:
    for a in actions:
        if a.deposit < 0.0:
            raise ValueError(
                f"Account {a.account_id}: deposit must be >= 0, got {a.deposit}"
            )
        if not a.participate:
            if a.deposit != 0.0:
                raise ValueError(
                    f"Account {a.account_id}: non-participating agent must have deposit=0"
                )
            if a.report is not None:
                raise ValueError(
                    f"Account {a.account_id}: non-participating agent must have report=None"
                )


def _score_actions(
    actions: List[AgentInput],
    y_t: float,
    params: MechanismParams,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute losses and scores for participating agents."""
    n = len(actions)
    losses = np.zeros(n, dtype=np.float64)
    scores = np.zeros(n, dtype=np.float64)
    alpha = np.ones(n, dtype=np.int32)

    for i, act in enumerate(actions):
        if not act.participate:
            continue
        alpha[i] = 0
        if params.scoring_mode == "quantiles_crps":
            q_i = np.asarray(act.report, dtype=np.float64).reshape(1, -1)
            losses[i] = float(crps_hat_from_quantiles(y_t, q_i, params.taus)[0])
            scores[i] = float(score_crps_hat(y_t, q_i, params.taus)[0])
        else:
            r_i = float(act.report)
            losses[i] = float(mae_loss(y_t, r_i))
            scores[i] = float(score_mae(y_t, r_i))

    return losses, scores, alpha


def run_round(
    *,
    state: MechanismState,
    params: MechanismParams,
    actions: List[AgentInput],
    y_t: float,
    s_client: float = 0.0,
) -> Tuple[MechanismState, Dict[str, Any]]:
    """
    Core deterministic round execution.

    Steps: validate actions -> score -> effective wagers -> cap -> aggregate ->
    settle -> update wealth -> update EWMA/sigma -> emit logs.

    Deposits in ``actions`` are treated as locked. The core does not derive
    deposits from current reports. Per-round truthfulness requires the caller
    to ensure deposit/exposure is F_{t-1}-measurable.

    Returns (new_state, logs).
    """
    _validate_actions(actions)

    n = len(actions)
    ids = [a.account_id for a in actions]

    new_state = copy.deepcopy(state)

    init_L = default_initial_loss(
        sigma_min=params.sigma_min,
        gamma=params.gamma,
        sigma_init=params.sigma_init,
    )

    for a in actions:
        if a.account_id not in new_state.ewma_loss:
            new_state.ewma_loss[a.account_id] = float(init_L)
        if a.account_id not in new_state.wealth:
            new_state.wealth[a.account_id] = 0.0

    b = np.array([a.deposit for a in actions], dtype=np.float64)
    L_prev = np.array(
        [new_state.ewma_loss[a.account_id] for a in actions],
        dtype=np.float64,
    )

    sigma_t = loss_to_skill(
        L_prev, sigma_min=params.sigma_min, gamma=params.gamma
    )
    sigma_t = np.clip(sigma_t, params.sigma_min, 1.0)

    losses, scores, alpha = _score_actions(actions, y_t, params)

    m_raw = effective_wager_bankroll(b, sigma_t, params.lam, params.eta)
    m_used = effective_wager_capped(
        b_t=b,
        sigma_t=sigma_t,
        lam=params.lam,
        eta=params.eta,
        alpha_t=alpha,
        omega_max=params.omega_max,
        eps=params.eps,
    )

    # Build reports for aggregation (needed before settlement for michael_split)
    if params.scoring_mode == "quantiles_crps":
        reports_for_agg = np.zeros((n, len(params.taus)), dtype=np.float64)
        for i, a in enumerate(actions):
            if a.participate and a.report is not None:
                reports_for_agg[i] = np.asarray(a.report, dtype=np.float64)
    else:
        reports_for_agg = np.zeros(n, dtype=np.float64)
        for i, a in enumerate(actions):
            if a.participate and a.report is not None:
                reports_for_agg[i] = float(a.report)

    # In quantile mode, Michael backend expects point forecasts. Use wager aggregation
    # for r_hat (full quantile report) to preserve PIT and CRPS. Michael runs only
    # for theta when michael_split allocation is used.
    use_michael_for_agg = (
        params.aggregation_mode == "michael_robust_lr"
        and params.scoring_mode != "quantiles_crps"
    )
    if params.aggregation_mode == "wager" or not use_michael_for_agg:
        r_hat = aggregate_forecast(
            reports_for_agg, m_used, alpha=alpha, eps=params.eps, fallback=None
        )
    else:
        agg = state.agg_state
        if "w" not in agg or "D" not in agg:
            w = np.ones(n, dtype=np.float64) / n
            D = np.zeros((n, n), dtype=np.float64)
        else:
            w = np.asarray(agg["w"], dtype=np.float64).ravel()
            D = np.asarray(agg["D"], dtype=np.float64)
            if w.size != n or D.shape != (n, n):
                w = np.ones(n, dtype=np.float64) / n
                D = np.zeros((n, n), dtype=np.float64)
        x_t = np.asarray(reports_for_agg, dtype=np.float64).ravel().copy()
        x_t[alpha == 1] = 0.0
        y_hat, aux = michael_predict(x_t, alpha, w, D)
        r_hat = float(y_hat)
        aux.get("theta")
        w_new, D_new, _ = michael_update(
            x_t, y_t, alpha, w, D,
            tau=_resolve_michael_tau(params),
            lr=params.michael_lr,
        )
        new_state.agg_state = {"w": w_new, "D": D_new}

    # quantiles_crps + michael_robust_lr: per-tau Michael aggregation
    if (
        params.aggregation_mode == "michael_robust_lr"
        and params.scoring_mode == "quantiles_crps"
    ):
        taus = np.asarray(params.taus, dtype=float)
        K = len(taus)
        per_tau_state = state.agg_state.get("per_tau", {})
        new_per_tau_state = {}
        r_hat = np.zeros(K, dtype=float)

        for k, tau_k in enumerate(taus):
            w_k, D_k = _get_tau_state(per_tau_state, state.agg_state, k, n)
            x_k = reports_for_agg[:, k].copy()
            x_k[alpha == 1] = 0.0

            y_hat_k, _ = michael_predict(x_k, alpha, w_k, D_k)
            w_k_new, D_k_new, _ = michael_update(
                x_k,
                y_t,
                alpha,
                w_k,
                D_k,
                tau=float(tau_k),
                lr=params.michael_lr,
            )
            r_hat[k] = y_hat_k
            new_per_tau_state[str(k)] = {"w": w_k_new, "D": D_k_new}

        new_state.agg_state = {"per_tau": new_per_tau_state}

        # Enforce quantile monotonicity on per-tau Michael aggregate
        r_hat = _enforce_quantile_monotonicity(r_hat)

    # True Michael allocation: utility split from Shapley + oos (bypass Raja)
    if params.allocation_mode == "michael_split":
        U_t = float(params.U)
        taus = (
            np.asarray(params.taus, dtype=float)
            if params.scoring_mode == "quantiles_crps"
            else np.array([0.5], dtype=float)
        )
        K = len(taus)
        per_tau_state = new_state.agg_state.get("per_tau", {})
        phi_c_state = state.allocation_state.get("phi_c", {})
        new_phi_c_state = {}
        rewards_total = np.zeros(n, dtype=float)

        for k, tau_k in enumerate(taus):
            w_k, D_k = _get_tau_state(per_tau_state, new_state.agg_state, k, n)
            if params.scoring_mode == "quantiles_crps":
                x_k = reports_for_agg[:, k].copy()
            else:
                x_k = np.asarray(reports_for_agg, dtype=float).ravel().copy()
            x_k[alpha == 1] = 0.0

            # Per-agent pinball loss for oos allocation.
            # L_tau(y, yhat) = tau*(y-yhat)      if y >= yhat
            #                = (1-tau)*(yhat-y)  otherwise
            # Equivalent: np.where(err>=0, tau*err, (tau-1)*err) with err = y - yhat.
            # Applied identically for both scoring modes so the same canonical
            # pinball enters the OOS score sc_i = 1 - L_i / sum_j L_j.
            present = alpha == 0
            losses_k = np.zeros(n, dtype=float)
            err = y_t - x_k
            losses_k[present] = np.where(
                err[present] >= 0,
                tau_k * err[present],
                (tau_k - 1.0) * err[present],
            )

            r_oos_k = michael_oos_allocation(losses_k, alpha, eps=params.eps)

            phi_prev_k = np.asarray(
                phi_c_state.get(str(k), np.zeros(n)), dtype=float
            ).ravel()
            if phi_prev_k.size != n:
                phi_prev_k = np.zeros(n, dtype=float)

            def coalition_value(coalition):
                if len(coalition) == 0:
                    return 0.0
                idx = np.array(coalition, dtype=int)
                x_sub = x_k[idx]
                y_hat_sub = float(np.mean(x_sub))
                err = y_t - y_hat_sub
                if err >= 0:
                    loss = tau_k * err
                else:
                    loss = (1.0 - tau_k) * (-err)
                return -loss

            present_idx = np.where(alpha == 0)[0]
            # Deterministic per-round, per-τ RNG so Michael-split allocation
            # is reproducible across runs with the same parameters
            # (audit fix M1: shapley.py::shapley_mc uses an unseeded
            # default_rng when no RNG is passed; the previous runner
            # never passed one, making Michael-split non-reproducible).
            shapley_rng = np.random.default_rng(
                int(params.shapley_seed) + K * int(state.t) + int(k)
            )
            phi_s_k = shapley_mc(
                present_idx,
                coalition_value,
                n_perm=params.michael_shapley_mc,
                rng=shapley_rng,
            )
            phi_s_k = np.asarray(phi_s_k, dtype=float).ravel()
            if phi_s_k.size != n:
                phi_s_k = np.resize(phi_s_k, n)
            phi_s_k[alpha == 1] = 0.0

            phi_c_k = update_phi_c(phi_prev_k, phi_s_k, params.michael_lambda)
            r_is_k = normalise_present(phi_c_k, alpha, eps=params.eps)

            U_tau = U_t / K
            rewards_k = michael_rewards(
                U_tau, params.delta_is, r_is_k, r_oos_k
            )
            rewards_total += rewards_k
            new_phi_c_state[str(k)] = phi_c_k

        new_state.allocation_state = {"phi_c": new_phi_c_state}
        prof = np.asarray(rewards_total, dtype=float)
        m_settle = m_used.copy()  # no separate settlement weights in michael_split
        sett = {
            "profit": prof,
            "total_payoff": prof,
            "cashout": prof,
            "refund": np.zeros(n, dtype=float),
        }
    else:
        m_for_settle = m_used.copy()
        m_settle = m_for_settle
        sett = settle_round(
            b=b,
            sigma=sigma_t,
            lam=params.lam,
            scores=scores,
            alpha=alpha,
            s_client=s_client,
            U=params.U,
            eps=params.eps,
            eta=params.eta,
            m_pre=m_for_settle,
        )

    prof = sett["profit"]

    losses_norm = normalised_loss(losses, params.scoring_mode)
    L_new = update_ewma_loss(
        L_prev,
        losses_norm,
        alpha,
        rho=params.rho,
        kappa=params.kappa,
        L0=params.L0,
        m_t=m_used,
        m_ref=params.m_ref,
        use_exposure_weighting=params.use_exposure_weighted_skill,
    )

    sigma_new = loss_to_skill(
        L_new, sigma_min=params.sigma_min, gamma=params.gamma
    )
    sigma_new = np.clip(sigma_new, params.sigma_min, 1.0)

    for i, a in enumerate(actions):
        new_state.ewma_loss[a.account_id] = float(L_new[i])
        new_state.wealth[a.account_id] = max(
            0.0, new_state.wealth.get(a.account_id, 0.0) + float(prof[i])
        )
        new_state.sigma[a.account_id] = float(sigma_new[i])
        new_state.weights_prev[a.account_id] = (
            float(m_used[i]) / float(np.sum(m_used))
            if float(np.sum(m_used)) > params.eps
            else 0.0
        )
        new_state.profit_prev[a.account_id] = float(prof[i])

    new_state.agg_prev = r_hat
    new_state.t = state.t + 1

    M_t = float(np.sum(m_used))
    w_arr = m_used / M_t if M_t > params.eps else np.zeros(n)
    hhi = compute_hhi(w_arr)
    n_eff = compute_n_eff(w_arr)

    wealth_arr = np.array(
        [new_state.wealth[a.account_id] for a in actions], dtype=np.float64
    )
    gini = compute_gini(wealth_arr)

    pit_val = None
    pit_skipped = False
    if params.scoring_mode == "quantiles_crps" and params.taus is not None:
        q_hat = np.asarray(r_hat, dtype=np.float64).ravel()
        if q_hat.size == len(params.taus) and validate_quantile_monotonicity(
            q_hat, params.taus, eps=params.eps
        ):
            pit_val = compute_pit(y_t, q_hat, params.taus)
        else:
            pit_skipped = True

    logs = {
        "t": state.t,
        "y_t": y_t,
        "ids": ids,
        "deposits": b.tolist(),
        "sigma": sigma_t.tolist(),
        "m_raw": m_raw.tolist(),
        "m_agg": m_used.tolist(),
        "m_settle": m_settle.tolist(),
        "m": m_used.tolist(),  # backward compat; prefer m_agg / m_settle for analysis
        "scores": scores.tolist(),
        "losses": losses.tolist(),
        "alpha": alpha.tolist(),
        "profit": prof.tolist(),
        "total_payoff": sett["total_payoff"].tolist(),
        "cashout": sett["cashout"].tolist(),
        "refund": sett["refund"].tolist(),
        "r_hat": r_hat if isinstance(r_hat, float) else r_hat.tolist(),
        "HHI": hhi,
        "N_eff": n_eff,
        "Gini": gini,
        "wealth": {a.account_id: new_state.wealth[a.account_id] for a in actions},
    }
    if pit_val is not None:
        logs["PIT"] = pit_val
    if pit_skipped:
        logs["PIT_skipped"] = True

    return new_state, logs
