"""Audit-suite shared fixtures and hypothesis settings.

Exposes the fixed seed registry used across bug-condition tests and
registers two hypothesis profiles:

- ``audit``    — default, ``max_examples=50`` (fast local iteration).
- ``audit_ci`` — activated when ``ONLINEV2_AUDIT_CI=1`` in the env,
                 ``max_examples=200`` (heavier PR / nightly runs).

The ``audit`` and ``audit_slow`` pytest markers are registered in
``onlinev2/pyproject.toml`` so ``pytest -m audit`` / ``-m audit_slow``
select the right subset.
"""
from __future__ import annotations

import os

import pytest
from hypothesis import HealthCheck, settings

AUDIT_SEEDS: list[int] = [0, 1, 2, 42, 2024]
"""Deterministic seed registry. Used by fixtures and for explicit regressions."""

# Register hypothesis profiles. deadline=None so slow backends (ARIMA fit,
# XGBoost fit) don't trip the default per-example timeout.
settings.register_profile(
    "audit",
    max_examples=50,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture],
)
settings.register_profile(
    "audit_ci",
    max_examples=200,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture],
)
_profile = "audit_ci" if os.environ.get("ONLINEV2_AUDIT_CI") == "1" else "audit"
settings.load_profile(_profile)


@pytest.fixture(params=AUDIT_SEEDS, ids=[f"seed-{s}" for s in AUDIT_SEEDS])
def audit_seed(request) -> int:
    """Parametrised fixture: every test using it runs once per AUDIT_SEEDS."""
    return int(request.param)
