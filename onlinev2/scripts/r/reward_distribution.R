#!/usr/bin/env Rscript
## Build writing/figures/reward_distribution.pdf in R + ggplot2.
##
## Horizontal bar per forecaster, length = payout share of the
## settled pool. Bars are coloured by the sign of the score margin
## (score minus the wager-weighted cohort mean). A vertical line at
## the deposit share marks each forecaster's break-even contribution
## to the pool. The figure reads off the wealth transfer in a single
## settlement round under the canonical mechanism functions, with
## numbers loaded from the cached CSV produced by
## ``scripts/figs/build_reward_distribution_data.py``.

suppressPackageStartupMessages({
  library(ggplot2)
})

source("scripts/figs/_theme.R")

args <- commandArgs(trailingOnly = TRUE)

candidates <- c(
  "onlinev2/outputs/figs/reward_distribution/per_forecaster.csv",
  "outputs/figs/reward_distribution/per_forecaster.csv"
)
if (length(args) >= 1) candidates <- c(args[1], candidates)
data_path <- candidates[file.exists(candidates)][1]
if (is.na(data_path)) {
  stop("reward_distribution per_forecaster.csv not found.")
}

out_path <- if (length(args) >= 2) args[2] else
  "writing/figures/reward_distribution.pdf"

d <- read.csv(data_path)

required <- c("label", "score_margin", "wager_share", "payout_share")
missing <- setdiff(required, names(d))
if (length(missing) > 0) {
  stop("Missing required columns in ", data_path, ": ",
       paste(missing, collapse = ", "))
}

## Sign categories. The threshold for the near-zero band is
## one percentage point on the bounded-score scale: smaller than
## that does not separate visually from rounding noise.
near_zero_eps <- 0.01
d$sign <- ifelse(d$score_margin >  near_zero_eps, "above cohort mean",
          ifelse(d$score_margin < -near_zero_eps, "below cohort mean",
                 "near cohort mean"))
sign_levels <- c("above cohort mean", "near cohort mean", "below cohort mean")
d$sign <- factor(d$sign, levels = sign_levels)

## Order forecasters from largest payout (top of the chart) to
## smallest, so the visual ordering reads off as the realised
## ranking.
d$label <- factor(d$label, levels = d$label[order(d$payout_share)])

palette <- c(
  `above cohort mean` = unname(thesis_palette["proposed"]),
  `near cohort mean`  = unname(thesis_palette["baseline"]),
  `below cohort mean` = unname(thesis_palette["adversary"])
)

p <- ggplot(d, aes(x = payout_share, y = label, fill = sign)) +
  geom_col(width = 0.62, colour = NEUTRALS$axis, linewidth = 0.25) +
  geom_segment(
    aes(x = wager_share, xend = wager_share,
        y = as.numeric(label) - 0.36,
        yend = as.numeric(label) + 0.36),
    colour = NEUTRALS$dark, linewidth = 0.55, linetype = "dashed",
    inherit.aes = FALSE
  ) +
  geom_text(
    aes(x = wager_share, y = as.numeric(label) + 0.42,
        label = sprintf("deposit %.2f", wager_share)),
    inherit.aes = FALSE,
    colour = NEUTRALS$dark, size = 2.4, hjust = 0, nudge_x = 0.005,
    vjust = 0
  ) +
  scale_fill_manual(values = palette, drop = FALSE,
                    breaks = sign_levels) +
  scale_x_continuous(
    name = "Share of settled pool",
    limits = c(0, max(d$payout_share, d$wager_share) * 1.18),
    expand = expansion(mult = c(0.0, 0.0)),
    breaks = scales::pretty_breaks(5),
    labels = scales::percent_format(accuracy = 1)
  ) +
  scale_y_discrete(name = "Forecaster") +
  custom_theme(legend_position = "bottom") +
  guides(fill = guide_legend(nrow = 1, title = NULL))

save_fig(out_path, p, width_in = 4.6, height_in = 2.6)
cat("done: ", out_path, "\n", sep = "")
