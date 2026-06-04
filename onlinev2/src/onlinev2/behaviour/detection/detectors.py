"""
Baseline detectors operating only on observables.

Observables: account_id, participate, report, deposit, round t.
No access to hidden real-user mappings except for evaluation.

All detectors return a score in [0, 1] with the convention that
higher = more suspicious. Detectors are deterministic functions of their
input and handle degenerate inputs (zero variance, empty sequences)
without raising.
"""
from __future__ import annotations

import warnings
from typing import Any, Dict, List

import numpy as np


def _safe_corrcoef(x: np.ndarray) -> np.ndarray:
    """``np.corrcoef`` that maps 0/0 = NaN to 1.0 (constant columns are
    perfectly correlated in the degenerate sense used by linked-account
    detection).

    Also suppresses the divide-by-zero RuntimeWarning ``numpy`` raises
    when a column has zero variance.
    """
    if x.ndim != 2 or x.shape[1] < 2:
        return np.ones((max(1, x.shape[1]), max(1, x.shape[1])), dtype=float)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        corr = np.corrcoef(x)
    # Constant series produce NaN; treat as perfectly linked (1.0).
    corr = np.where(np.isnan(corr), 1.0, corr)
    return corr


def synchronised_participation_score(
    participation_by_round: List[List[int]],
    account_ids: List[str],
) -> float:
    """
    Detects synchronised participation: accounts that participate in the
    same rounds.

    Observables: participation matrix (round x account).
    Returns score in [0, 1]; higher = more synchronised.
    """
    if not participation_by_round or not account_ids:
        return 0.0
    arr = np.asarray(participation_by_round, dtype=float)
    if arr.size == 0:
        return 0.0
    n_rounds, n_acc = arr.shape
    if n_acc < 2:
        return 0.0
    corr = _safe_corrcoef(arr.T)
    np.fill_diagonal(corr, 0.0)
    mean_corr = float(np.nanmean(corr))
    return float(np.clip(0.5 + 0.5 * mean_corr, 0.0, 1.0))


def correlated_reporting_score(
    reports_by_round: List[Dict[str, float]],
) -> float:
    """
    Detects correlated reporting: accounts with similar reports in the
    same rounds.

    Observables: {account_id: report} per round.
    Returns score in [0, 1]; higher = more correlated.
    """
    if not reports_by_round:
        return 0.0
    all_ids = set()
    for r in reports_by_round:
        all_ids.update(r.keys())
    ids = sorted(all_ids)
    if len(ids) < 2:
        return 0.0
    mat = []
    for r in reports_by_round:
        row = [r.get(i, np.nan) for i in ids]
        mat.append(row)
    arr = np.asarray(mat, dtype=float)
    valid = ~np.isnan(arr)
    if np.sum(valid) < 4:
        return 0.0
    # Replace NaN with column means to allow corrcoef.
    col_means = np.nanmean(arr, axis=0)
    filled = np.where(np.isnan(arr), col_means[None, :], arr)
    corr = _safe_corrcoef(filled.T)
    np.fill_diagonal(corr, 0.0)
    mean_corr = float(np.nanmean(corr))
    return float(np.clip(0.5 + 0.5 * mean_corr, 0.0, 1.0))


def fake_activity_loop_score(
    account_ids: List[str],
    participation_by_round: List[List[int]],
    link_pattern: str = "__",
) -> float:
    """
    Detects wash-style loops: accounts with linked names (e.g.
    ``user__wash_0, user__wash_1``) that participate together.

    Observables: account_ids, participation.
    Returns score in [0, 1]; higher = more suspicious.

    A linked group's sub-correlation with itself is 1 on the diagonal; we
    report the mean of off-diagonal entries (or 1.0 if all members are
    perfectly synchronised).
    """
    if not account_ids or not participation_by_round:
        return 0.0
    linked_groups: Dict[str, List[int]] = {}
    for i, aid in enumerate(account_ids):
        if link_pattern in str(aid):
            parent = str(aid).split(link_pattern)[0]
            linked_groups.setdefault(parent, []).append(i)
    if not linked_groups:
        return 0.0
    scores = []
    arr = np.asarray(participation_by_round, dtype=float)
    if arr.ndim != 2 or arr.size == 0:
        return 0.0
    for parent, indices in linked_groups.items():
        if len(indices) < 2:
            continue
        if arr.shape[1] <= max(indices):
            continue
        sub = arr[:, indices]
        # Off-diagonal mean of the correlation matrix of the sub-group.
        corr = _safe_corrcoef(sub.T)
        k = corr.shape[0]
        if k < 2:
            continue
        off_diag_mask = ~np.eye(k, dtype=bool)
        off_diag = corr[off_diag_mask]
        if off_diag.size == 0:
            continue
        sync = float(np.nanmean(off_diag))
        # Map [-1, 1] correlation into [0, 1] suspicion score.
        scores.append(0.5 + 0.5 * sync)
    if not scores:
        return 0.0
    return float(np.clip(np.mean(scores), 0.0, 1.0))


def anomaly_timing_stake_score(
    deposits_by_round: List[List[float]],
    participation_by_round: List[List[int]],
) -> float:
    """
    Simple anomaly over timing and stake discreteness.
    Observables: deposits, participation per round.
    Returns score in [0, 1]; higher = more anomalous.
    """
    if not deposits_by_round or not participation_by_round:
        return 0.0
    dep = np.asarray(deposits_by_round, dtype=float)
    part = np.asarray(participation_by_round, dtype=float)
    if dep.ndim != 2 or part.ndim != 2 or dep.shape != part.shape:
        return 0.0
    active_deposits = np.where(part > 0.5, dep, np.nan)
    flat = active_deposits[~np.isnan(active_deposits)]
    if flat.size < 2:
        return 0.0
    unique_ratio = len(np.unique(np.round(flat, 2))) / max(1, flat.size)
    discreteness = 1.0 - unique_ratio
    return float(np.clip(discreteness, 0.0, 1.0))


def run_all_detectors(
    actions_history: List[List[Any]],
    round_indices: List[int],
) -> Dict[str, float]:
    """
    Run all baseline detectors on action history.
    actions_history: list of lists of AgentAction-like objects per round.
    round_indices: round numbers.
    Returns dict of detector_name -> score (never NaN).
    """
    if not actions_history:
        return {}
    all_ids: List[str] = []
    for acts in actions_history:
        for a in acts:
            if hasattr(a, "account_id") and a.account_id not in all_ids:
                all_ids.append(a.account_id)
    id_to_idx = {aid: i for i, aid in enumerate(all_ids)}
    participation_by_round = []
    reports_by_round = []
    deposits_by_round = []
    for acts in actions_history:
        part = [0] * len(all_ids)
        reports: Dict[str, float] = {}
        deps = [0.0] * len(all_ids)
        for a in acts:
            if not hasattr(a, "account_id"):
                continue
            idx = id_to_idx.get(a.account_id, -1)
            if idx < 0:
                continue
            part[idx] = 1 if getattr(a, "participate", False) else 0
            if getattr(a, "participate", False) and getattr(a, "report", None) is not None:
                r = a.report
                if isinstance(r, (int, float)):
                    reports[a.account_id] = float(r)
                else:
                    reports[a.account_id] = float(np.mean(r))
            deps[idx] = float(getattr(a, "deposit", 0.0) or 0.0)
        participation_by_round.append(part)
        reports_by_round.append(reports)
        deposits_by_round.append(deps)
    scores = {
        "synchronised_participation": synchronised_participation_score(
            participation_by_round, all_ids
        ),
        "correlated_reporting": correlated_reporting_score(reports_by_round),
        "fake_activity_loop": fake_activity_loop_score(
            all_ids, participation_by_round
        ),
        "anomaly_timing_stake": anomaly_timing_stake_score(
            deposits_by_round, participation_by_round
        ),
    }
    # Belt-and-braces: ensure no NaN escapes into downstream CSVs.
    return {k: 0.0 if (v is None or np.isnan(v)) else float(v) for k, v in scores.items()}
