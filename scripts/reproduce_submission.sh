#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT/onlinev2"

# Use a local venv so we don't rely on user site-packages write access.
VENV_DIR="$ROOT/onlinev2/.venv"
if [[ ! -d "$VENV_DIR" ]]; then
  python -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

python -m pip install -U pip
python -m pip install -e ".[dev]"

ruff check .
pytest -q

python -m onlinev2.experiments.cli --exp master_comparison --block core --outdir outputs
python -m onlinev2.experiments.cli --exp bankroll_ablation --block core --outdir outputs
python -m onlinev2.experiments.cli --exp calibration --block experiments --outdir outputs

cd "$ROOT"
./scripts/link-dashboard-data.sh || true

echo ""
echo "Reproduction complete."
echo "Core outputs: onlinev2/outputs/core/experiments"
