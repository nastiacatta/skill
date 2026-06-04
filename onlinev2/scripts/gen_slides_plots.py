"""Deprecated — do not run.

This script was an earlier iteration that produced slide PNGs with
hardcoded illustrative numbers on a legacy palette. It would
overwrite the R-generated canonical versions in
`dashboard/public/presentation-plots/`.

Use the R pipeline under `presentation/R/` instead. See the
figure-to-generator map in `results/README.md`.
"""

import sys


def main() -> int:
    msg = (
        "gen_slides_plots.py is deprecated.\n"
        "Run the R pipeline under presentation/R/ instead. "
        "See results/README.md for the canonical generator list."
    )
    sys.stderr.write(msg + "\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
