#!/usr/bin/env python3
"""Run weight learning experiment and save artifacts. Requires package installed (pip install -e .)."""
from pathlib import Path

from onlinev2.experiments.config import WeightLearningConfig
from onlinev2.experiments.runners import run_weight_learning
from onlinev2.io import build_output_paths, save_experiment_artifacts
from onlinev2.plotting import plot_weight_convergence


def main():
    config = WeightLearningConfig(
        name="weight_learning",
        T=20000,
        n_forecasters=3,
        true_w=[0.8, 0.1, 0.5],
        normalise_w=False,
        methods=(1, 2, 3),
    )
    result = run_weight_learning(config)

    paths = build_output_paths("outputs", config.name)
    save_experiment_artifacts(
        paths,
        config.to_dict(),
        {
            "final_weights": result["final_weights"],
            "true_w": result["true_w"].tolist(),
        },
    )

    plot_weight_convergence(
        result["w_hist"],
        result["true_w"],
        method_labels=result["method_labels"],
        smooth_window=config.smooth_window,
        save_path=str(Path(paths["plots_dir"]) / "weight_convergence.png"),
    )
    print(f"Saved to {paths['root']}")


if __name__ == "__main__":
    main()
