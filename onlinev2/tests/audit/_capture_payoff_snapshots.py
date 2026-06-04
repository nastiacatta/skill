"""Sub-task 3.2 — capture golden-value snapshots of payoff functions.

Covers the payoff module surface listed in
`onlinev2/tests/audit/snapshots/MANIFEST.md` rows for Task 3 (E):
- `core.settlement`: `settle_round`, `skill_payoff`, `utility_payoff`,
  `raja_competitive_payout`
- `core.staking`: `choose_deposits`, `update_wealth`,
  `effective_wager_bankroll`, `cap_weight_shares`
- `core.weights`: `effective_wager`
- `core.michael_allocation`: `michael_oos_allocation`, `michael_rewards`,
  `normalise_present`

Snapshots land under `onlinev2/tests/audit/snapshots/core.<module>.<fn>.<seed>.json`.
Idempotent — `snapshots.capture` skips existing files.
"""
from __future__ import annotations

import os
import sys
import importlib.util as ilu

_THIS = os.path.dirname(os.path.abspath(__file__))
_TESTS = os.path.abspath(os.path.join(_THIS, os.pardir))
if _TESTS not in sys.path:
    sys.path.insert(0, _TESTS)

import numpy as np

from audit.conftest import AUDIT_SEEDS
_spec = ilu.spec_from_file_location("sn", os.path.join(_THIS, "snapshots.py"))
sn = ilu.module_from_spec(_spec); _spec.loader.exec_module(sn)

from onlinev2.core.settlement import (
    settle_round, skill_payoff, utility_payoff, raja_competitive_payout,
)
from onlinev2.core.staking import (
    choose_deposits, update_wealth, effective_wager_bankroll, cap_weight_shares,
)
from onlinev2.core.weights import effective_wager
from onlinev2.core.michael_allocation import (
    michael_oos_allocation, michael_rewards, normalise_present,
)


def _inputs(seed: int):
    rng = np.random.default_rng(seed)
    n = 7
    b = rng.uniform(0.1, 10.0, size=n)
    sigma = rng.uniform(0.1, 1.0, size=n)
    scores = rng.uniform(0.0, 1.0, size=n)
    alpha = (rng.uniform(size=n) > 0.85).astype(np.int32)
    W = rng.uniform(1.0, 100.0, size=n)
    c = rng.uniform(0.0, 1.0, size=n)
    m_input = rng.uniform(0.0, 5.0, size=n)
    losses = rng.uniform(0.0, 1.0, size=n)
    profit = rng.uniform(-2.0, 2.0, size=n)
    return dict(b=b, sigma=sigma, scores=scores, alpha=alpha, W=W, c=c,
                m=m_input, losses=losses, profit=profit, n=n)


def main() -> None:
    for seed in AUDIT_SEEDS:
        inp = _inputs(seed)

        # --- settlement ---
        sn.capture("core.settlement.skill_payoff", seed,
                   skill_payoff, inp["scores"], inp["m"], alpha=inp["alpha"])
        sn.capture("core.settlement.utility_payoff", seed,
                   utility_payoff, inp["scores"], inp["m"],
                   s_client=0.5, U=1.0, alpha=inp["alpha"])
        sn.capture("core.settlement.raja_competitive_payout", seed,
                   raja_competitive_payout, inp["scores"], inp["m"],
                   alpha=inp["alpha"])
        # settle_round returns a dict of arrays
        sr = settle_round(
            b=inp["b"], sigma=inp["sigma"], lam=0.3, scores=inp["scores"],
            alpha=inp["alpha"], s_client=0.5, U=1.0,
        )
        sn.capture("core.settlement.settle_round", seed, lambda: sr)

        # --- staking ---
        sn.capture("core.staking.effective_wager_bankroll", seed,
                   effective_wager_bankroll, inp["b"], inp["sigma"],
                   lam=0.3, eta=1.0)
        sn.capture("core.staking.choose_deposits", seed,
                   choose_deposits, W_t=inp["W"], c_t=inp["c"],
                   alpha_t=inp["alpha"], f=0.1, b_max=5.0)
        sn.capture("core.staking.update_wealth", seed,
                   update_wealth, W_t=inp["W"], profit_t=inp["profit"])
        sn.capture("core.staking.cap_weight_shares", seed,
                   cap_weight_shares, inp["m"], omega_max=0.25)

        # --- weights ---
        sn.capture("core.weights.effective_wager", seed,
                   effective_wager, inp["b"], inp["sigma"], lam=0.3, eta=1.0)

        # --- michael_allocation ---
        sn.capture("core.michael_allocation.michael_oos_allocation", seed,
                   michael_oos_allocation, inp["losses"], inp["alpha"])
        sn.capture("core.michael_allocation.normalise_present", seed,
                   normalise_present, inp["m"], inp["alpha"])
        # michael_rewards needs r_is, r_oos simplex-like vectors
        r_is = inp["losses"] / max(inp["losses"].sum(), 1e-12)
        r_oos = inp["m"] / max(inp["m"].sum(), 1e-12)
        sn.capture("core.michael_allocation.michael_rewards", seed,
                   michael_rewards, U_tau=10.0, delta_is=0.5,
                   r_is=r_is, r_oos=r_oos)

        print(f"seed {seed}: payoff snapshots OK")
    print("ALL PAYOFF SNAPSHOTS CAPTURED")


if __name__ == "__main__":
    main()
