#!/usr/bin/env Rscript
# Deprecated — do not run.
#
# This script was an earlier, self-contained slide-plot generator that
# defined its own theme and its own mock data for skill_recovery, and
# overlapped with the canonical pipeline now living under
# `presentation/R/`. Running it would overwrite canonical PNGs in
# `dashboard/public/presentation-plots/`.
#
# Use instead:
#
#   Rscript presentation/R/plot_skill_signal.R
#   Rscript presentation/R/plot_skill_recovery.R
#   Rscript presentation/R/plot_real_data.R
#   Rscript presentation/R/plot_deposit_policy.R
#   Rscript presentation/R/plot_baseline_comparison.R
#   Rscript presentation/R/plot_forecast_aggregation.R
#   Rscript presentation/R/plot_sybil.R
#   Rscript presentation/R/plot_settlement_sanity.R
#
# See `results/README.md` for the claim-to-figure map.

message("scripts/plot_all_slides.R is deprecated.\n",
        "Use the canonical pipeline under presentation/R/ instead. ",
        "See results/README.md.")

quit(status = 1)
