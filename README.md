# Self-Financed Prediction Markets with Skill-Weighted Stakes

A weighted-score wagering mechanism with an online skill-estimation layer

## Overview

This repository contains the implementation of an online wagering mechanism for probabilistic forecast aggregation with an adaptive skill layer. The central research question is: can a repeated, self-financed prediction market reliably surface forecaster skill over time, and does that skill-weighted aggregation yield better probabilistic forecasts than equal-weight or oracle baselines?

The mechanism extends Lambert (2008)'s self-financed weighted-score wagering to the repeated setting, incorporates the online reputation design of Raja et al. (2024), and benchmarks against the per-quantile OGD aggregator of Vitali & Pinson (2025). The key contribution is a provably incentive-compatible, adaptive skill layer that converges to rank-preserving weights using only online EWMA loss tracking, without any access to ground-truth skill labels.

The per-quantile OGD reference baseline (`onlinev2/src/onlinev2/mechanism/michael_port.py`) is a Python reimplementation of Vitali & Pinson (2025), arXiv:2510.13385, included for benchmarking.

## Repository map

```
onlinev2/        Python research package: mechanism, experiments, tests, real-data runner
dashboard/       React dashboard: interactive visualisation of experiment results
scripts/         Reproduction, data-fetch, and figure scripts
data/            Input datasets (Elia wind, AQS PM2.5, CAMS PM2.5, IEC turbine curve)
REPRODUCE.md     Step-by-step reproduction guide for assessors
LICENSE          MIT licence
CITATION.cff     Citation metadata
```

See `onlinev2/README.md` for the Python package documentation and `dashboard/README.md` for the dashboard.

## Quick start

See [REPRODUCE.md](REPRODUCE.md) for the three reproduction tracks:
- (a) Run Python experiments and tests
- (b) Regenerate key figures from scripts
- (c) View results in the dashboard (no regeneration needed, data ships with the repo)

## References

- Lambert, N. S. (2008). Eliciting truthful forecasts via proper scoring rules combined with wagering. *Unpublished manuscript*.
- Raja, A. and Pinson, P. (2024). A probabilistic prediction market with strategic forecasters. *Preprint*.
- Vitali, M. and Pinson, P. (2025). Probabilistic prediction markets with intermittent contributions. arXiv:2510.13385.
