"""
Entry point for simulation and inline unit tests.

Run with package installed (pip install -e . from onlinev2/) or as python -m onlinev2.simulation.
Delegates to onlinev2.simulation.
"""
from onlinev2.simulation import (
    run_all_tests,
    run_simulation,
)

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
