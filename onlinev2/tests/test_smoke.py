"""Smoke tests: tiny T=50 run of each experiment. Run with package installed (pip install -e .)."""

import os
import subprocess
import tempfile


def test_cli_settlement_smoke():
    """Documented CLI path: run settlement experiment and check output dir and unit test file exist.
    Requires package installed (pip install -e .); no PYTHONPATH needed when installed."""
    root = os.path.join(os.path.dirname(__file__), "..")
    env = os.environ.copy()
    with tempfile.TemporaryDirectory() as tmp:
        outdir = os.path.join(tmp, "out")
        result = subprocess.run(
            [
                "python", "-m", "onlinev2.experiments.cli",
                "--exp", "settlement",
                "--block", "core",
                "--outdir", outdir,
            ],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=os.path.abspath(root),
            env=env,
        )
        assert result.returncode == 0, (result.stdout, result.stderr)
        core_exp = os.path.join(outdir, "core", "experiments", "settlement_sanity")
        assert os.path.isdir(core_exp), f"Expected dir {core_exp}"
        assert os.path.isdir(os.path.join(core_exp, "data"))
        assert os.path.isdir(os.path.join(core_exp, "plots"))
        test_results = os.path.join(outdir, "tests", "test_results.txt")
        assert os.path.isfile(test_results), f"Expected {test_results}"


def test_dgp_registry():
    from onlinev2.dgps import DGP_REGISTRY, get_dgp

    assert len(DGP_REGISTRY) >= 4
    dgp = get_dgp("latent_fixed")
    assert dgp.info.truth_source == "exogenous"
    dgp = get_dgp("aggregation_method1")
    assert dgp.info.truth_source == "endogenous"


def test_dgp_baseline_generate():
    from onlinev2.dgps import get_dgp

    dgp = get_dgp("baseline")
    out = dgp.generate(seed=42, T=50, n_forecasters=3)
    assert out.y.shape == (50,)
    assert out.reports.shape == (3, 50)
    assert out.tau_true is not None
    pre = out.to_pre_generated()
    assert pre.y is out.y


def test_dgp_aggregation_generate():
    from onlinev2.dgps import get_dgp

    dgp = get_dgp("aggregation_method1")
    out = dgp.generate(seed=42, T=50, n_forecasters=3, w=[0.5, 0.3, 0.2])
    assert out.y.shape == (50,)
    assert out.reports.shape == (3, 50)


def test_weight_learning_smoke():
    from onlinev2.experiments.config import WeightLearningConfig
    from onlinev2.experiments.runners.weight_learning import run_weight_learning

    config = WeightLearningConfig(T=50, n_forecasters=2, methods=(1,))
    result = run_weight_learning(config)
    assert result["w_hist"].shape[0] == 1
    assert result["w_hist"].shape[1] == 2
    assert result["w_hist"].shape[2] == 50
