"""Deprecated — do not run.

This script predates the R-based presentation plot pipeline
(`presentation/R/plot_*.R`) and used hardcoded illustrative numbers
on a legacy palette. Running it would overwrite the canonical
R-generated PNGs in `dashboard/public/presentation-plots/` with
stale mock values on the wrong colours.

Use instead:

  # Regenerate any slide figure from live data
  Rscript presentation/R/plot_baseline_comparison.R
  Rscript presentation/R/plot_skill_signal.R
  Rscript presentation/R/plot_skill_recovery.R
  Rscript presentation/R/plot_real_data.R
  Rscript presentation/R/plot_forecast_aggregation.R
  Rscript presentation/R/plot_sybil.R
  Rscript presentation/R/plot_settlement_sanity.R
  Rscript presentation/R/plot_deposit_policy.R

See `results/README.md` for the claim-to-figure map.
"""

import sys


def main() -> int:
    msg = (
        "generate_presentation_plots.py is deprecated.\n"
        "Run the R pipeline under presentation/R/ instead. "
        "See results/README.md for the canonical generator list."
    )
    sys.stderr.write(msg + "\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
