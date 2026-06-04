#!/usr/bin/env bash
# Create relative symlinks so the dashboard can load experiment data from
# onlinev2 outputs. Run from the repository root.
# Usage: ./scripts/link-dashboard-data.sh
# Links dashboard/public/data/{core,behaviour} to onlinev2/outputs/{core,behaviour}.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTDIR="$REPO_ROOT/onlinev2/outputs"
DATA_DIR="$REPO_ROOT/dashboard/public/data"

# Relative path from dashboard/public/data to onlinev2/outputs
# (data -> public -> dashboard -> repo root)
REL_OUTDIR="../../../onlinev2/outputs"

cd "$DATA_DIR"

if [[ ! -d "$OUTDIR" ]]; then
  echo "Output directory does not exist: $OUTDIR"
  echo "Run Python experiments first, e.g.:"
  echo "  cd onlinev2 && python experiments.py --exp settlement --outdir outputs"
  exit 1
fi

for block in core behaviour; do
  if [[ -d "$OUTDIR/$block" ]]; then
    # If a real directory exists here (e.g. from a prior copy), replace it with a symlink.
    # `ln -sfn` does NOT replace existing directories on macOS; it creates the link inside them.
    if [[ -e "$block" && ! -L "$block" ]]; then
      rm -rf "$block"
    fi
    ln -sfn "$REL_OUTDIR/$block" "$block"
    echo "Linked: $DATA_DIR/$block -> $REL_OUTDIR/$block"
  else
    echo "Skip (missing): $OUTDIR/$block"
  fi
done

echo "Done. Dashboard data dir: $DATA_DIR"
