#!/usr/bin/env Rscript
# Deprecated — do not run.
#
# This script was an earlier slide-plot generator that used a legacy
# palette (#002147, #0091D5, ...) and would overwrite canonical PNGs
# in `dashboard/public/presentation-plots/` with mismatched colours.
#
# The canonical pipeline now lives under `presentation/R/` and shares
# the slide deck's palette via `presentation/R/theme_thesis.R`.
#
# See `results/README.md` for the figure-to-generator map.

message("onlinev2/scripts/gen_slides_r.R is deprecated.\n",
        "Use the canonical pipeline under presentation/R/ instead. ",
        "See results/README.md.")

quit(status = 1)
