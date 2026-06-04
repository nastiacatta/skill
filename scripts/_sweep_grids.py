"""Canonical (γ, ρ, λ) parameter grids for the sensitivity sweep scripts.

Both ``scripts/run_sensitivity_sweep.py`` (full forecasting pass per cell,
~25 min each) and ``scripts/run_sensitivity_sweep_cached.py`` (cache-reusing,
~seconds per cell) MUST import from this module so that ``--grid <name>``
refers to an identical parameter space regardless of which script is invoked.

Previously the two scripts defined ``_GRIDS`` independently and drifted: the
cached script was retargeted around the post-fix optimum (γ=32, ρ=0.7) while
the non-cached script still centred its ``fine_local`` grid on the pre-fix
optimum (γ=16, ρ=0.5). Running the same ``--grid fine_local`` flag on the two
scripts silently produced conflicting "optimal" results. Audit pass 2 (M2).

The cached script is the production path driving the thesis; its grids are canonical here.
The non-cached script remains available as a sanity check on the cache.
"""
from __future__ import annotations

GRIDS: dict[str, dict[str, list[float]]] = {
    "coarse": {
        "gamma": [4.0, 8.0, 16.0],
        "rho": [0.1, 0.3, 0.5],
        "lam": [0.05],
    },
    # Wide sweep: extends the coarse grid at both ends of γ and ρ so the
    # optimum cannot pin at the boundary. λ gets a small off-default value
    # (0.2) so we can see whether a non-trivial skill gate helps.
    "wide": {
        "gamma": [4.0, 8.0, 16.0, 32.0, 64.0],
        "rho": [0.1, 0.3, 0.5, 0.7],
        "lam": [0.05, 0.2],
    },
    "fine": {
        "gamma": [2.0, 4.0, 8.0, 16.0, 32.0],
        "rho": [0.05, 0.1, 0.2, 0.3, 0.5, 0.7],
        "lam": [0.0, 0.05, 0.1, 0.2],
    },
    # Local refinement around the wind-series post-fix optimum
    # (γ, ρ, λ) = (32, 0.7, 0.05) to test whether the optimum is a broad
    # plateau or a narrow peak.
    "fine_local": {
        "gamma": [12.0, 16.0, 20.0, 24.0, 28.0, 32.0, 40.0, 48.0],
        "rho": [0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        "lam": [0.03, 0.05, 0.08, 0.12],
    },
}
