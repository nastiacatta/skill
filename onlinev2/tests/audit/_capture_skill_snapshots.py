"""Sub-task 2.2 — capture golden-value snapshots of core/skill.py outputs.

This script is idempotent: ``snapshots.capture`` skips files that already
exist.  Snapshots land under
``onlinev2/tests/audit/snapshots/core.skill.{function}.{seed}.json``.

Functions captured (all on the current mainline ``onlinev2.core.skill``):
- ``loss_to_skill(L_ref, sigma_min=0.1, gamma=2.0)`` — ``L_ref`` drawn
  from ``np.random.default_rng(seed).uniform(0, 2, size=7)``.
- ``update_ewma_loss(L_prev, losses, alpha_t, rho=0.1, kappa=0.0, L0=0.0)``
  — all arrays shape ``(7,)`` drawn from the same seeded RNG.
- ``calibrate_gamma(sigma_ref=0.5, sigma_min=0.1, L_ref)`` — ``L_ref``
  scalar ∈ (0, 5] from the same RNG.
- ``default_initial_loss(sigma_min=0.1, gamma=2.0, sigma_init=0.9)`` —
  no seed dependence but parametrised for manifest consistency.
"""
from __future__ import annotations

import numpy as np

from onlinev2.core.skill import (
    calibrate_gamma,
    default_initial_loss,
    loss_to_skill,
    update_ewma_loss,
)

# ``tests/`` is not an installable package; add it to sys.path so the
# ``audit`` sub-package (conftest, snapshots helper) resolves.
import os
import sys

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_TESTS_DIR = os.path.abspath(os.path.join(_THIS_DIR, os.pardir))
if _TESTS_DIR not in sys.path:
    sys.path.insert(0, _TESTS_DIR)

from audit.conftest import AUDIT_SEEDS  # noqa: E402

# ``audit/snapshots/`` is a package (directory with __init__.py) that
# shadows ``audit/snapshots.py``.  Load the latter by its file path.
import importlib.util as _ilu  # noqa: E402

_SNAP_MOD_PATH = os.path.join(_THIS_DIR, "snapshots.py")
_spec = _ilu.spec_from_file_location("audit_snapshots_module", _SNAP_MOD_PATH)
snapshots = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(snapshots)


def _inputs_for_seed(seed: int):
    """Deterministic inputs for a seed; kept small and representative."""
    rng = np.random.default_rng(seed)
    L_ref = rng.uniform(0.0, 2.0, size=7)
    losses = rng.uniform(0.0, 1.0, size=7)
    alpha_t = (rng.uniform(size=7) > 0.5).astype(np.int32)
    L_prev = rng.uniform(0.0, 2.0, size=7)
    L_ref_scalar = float(rng.uniform(0.01, 5.0))
    return L_ref, losses, alpha_t, L_prev, L_ref_scalar


def main() -> None:
    for seed in AUDIT_SEEDS:
        L_ref, losses, alpha_t, L_prev, L_ref_scalar = _inputs_for_seed(seed)

        snapshots.capture(
            "core.skill.loss_to_skill",
            seed,
            loss_to_skill,
            L_ref,
            0.1,  # sigma_min
            2.0,  # gamma
        )
        snapshots.capture(
            "core.skill.update_ewma_loss",
            seed,
            update_ewma_loss,
            L_prev,
            losses,
            alpha_t,
            rho=0.1,
            kappa=0.0,
            L0=0.0,
        )
        snapshots.capture(
            "core.skill.calibrate_gamma",
            seed,
            calibrate_gamma,
            0.5,  # sigma_ref
            0.1,  # sigma_min
            L_ref_scalar,
        )
        snapshots.capture(
            "core.skill.default_initial_loss",
            seed,
            default_initial_loss,
            0.1,  # sigma_min
            2.0,  # gamma
            0.9,  # sigma_init
        )
        print(f"seed {seed}: snapshots OK")


if __name__ == "__main__":
    main()
