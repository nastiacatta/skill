#!/usr/bin/env Rscript
## NO DOTTED LINES: solid/dashed only; dotted patterns render as pixel
## noise at print scale (PLOT_BEST_PRACTICES.md).
## Build writing/figures/forecast_aggregation.pdf in R + ggplot2.
##
## Single question: how does the cumulative-mean CRPS of the
## self-financed mechanism converge against four reference rules
## (uniform, deposit-only, skill-only, best single) on the latent-fixed
## synthetic panel?
##
## Source data is the per-round CRPS time series emitted by the
## forecast-aggregation experiment runner. We plot the cumulative
## (running) mean per series, no smoothing window, no in-figure title.

suppressPackageStartupMessages({
  library(ggplot2)
})

source("scripts/figs/_theme.R")

args <- commandArgs(trailingOnly = TRUE)

candidates <- c(
  "onlinev2/outputs/experiments/forecast_aggregation/data/crps_timeseries.csv",
  "onlinev2/outputs/core/experiments/forecast_aggregation/data/crps_timeseries.csv",
  "outputs/experiments/forecast_aggregation/data/crps_timeseries.csv"
)
if (length(args) >= 1) candidates <- c(args[1], candidates)
data_path <- candidates[file.exists(candidates)][1]
if (is.na(data_path)) {
  stop("forecast_aggregation crps_timeseries.csv not found in known locations.")
}

out_path <- if (length(args) >= 2) args[2] else
  "writing/figures/forecast_aggregation.pdf"

d <- read.csv(data_path, na.strings = c("NA", "nan", "NaN", ""))

required <- c("t", "crps_uniform_cum", "crps_deposit_cum",
              "crps_skill_cum", "crps_mechanism_cum",
              "crps_best_single_cum")
missing <- setdiff(required, names(d))
if (length(missing) > 0) {
  stop("Missing required columns in ", data_path, ": ",
       paste(missing, collapse = ", "))
}

method_levels <- c("Mechanism",
                   "Deposit-only",
                   "Skill-only",
                   "Uniform",
                   "Best single forecaster")

df <- rbind(
  data.frame(t = d$t, crps = d$crps_mechanism_cum,   method = "Mechanism"),
  data.frame(t = d$t, crps = d$crps_deposit_cum,     method = "Deposit-only"),
  data.frame(t = d$t, crps = d$crps_skill_cum,       method = "Skill-only"),
  data.frame(t = d$t, crps = d$crps_uniform_cum,     method = "Uniform"),
  data.frame(t = d$t, crps = d$crps_best_single_cum,
             method = "Best single forecaster")
)
df <- df[is.finite(df$crps), ]
df$method <- factor(df$method, levels = method_levels)

## The first few rounds carry a large transient (cumulative averages
## are unstable when only a handful of observations have accrued). Clip
## the rendered range to the convergence regime so the steady-state
## ordering is the visual focus rather than the warmup spike. The
## warmup window starts at round 10; the cumulative averages are
## computed over the full series.
plot_xmin <- 10
df_plot <- df[df$t >= plot_xmin, ]

palette <- c(
  `Mechanism`              = unname(thesis_palette["proposed"]),       # blue (lead)
  `Deposit-only`           = unname(thesis_palette["proposed_pp"]),    # orange (variant)
  `Skill-only`             = unname(thesis_palette["alt_reference"]),  # purple (alt reference)
  `Uniform`                = unname(thesis_palette["baseline"]),       # grey (baseline)
  `Best single forecaster` = unname(thesis_palette["oracle"])          # black (oracle)
)
linewidths <- c(
  `Mechanism`              = 1.05,
  `Deposit-only`           = 0.80,
  `Skill-only`             = 0.75,
  `Uniform`                = 0.65,
  `Best single forecaster` = 0.75
)
linetypes <- c(
  `Mechanism`              = "solid",
  `Deposit-only`           = "dashed",
  `Skill-only`             = "solid",
  `Uniform`                = "solid",
  `Best single forecaster` = "longdash"
)

y_lim_lo <- 0.017
y_lim_hi <- 0.057

## Draw order: keep the mechanism on top of any coincident series
## (under bankroll deposits the deposit-only and mechanism traces
## almost overlap after round 200).
draw_order <- c("Best single forecaster",
                "Uniform",
                "Skill-only",
                "Deposit-only",
                "Mechanism")
df_plot$method <- factor(df_plot$method, levels = method_levels)
df_plot <- df_plot[order(match(df_plot$method, draw_order), df_plot$t), ]

p <- ggplot(df_plot, aes(x = t, y = crps,
                         colour = method,
                         linewidth = method,
                         linetype = method,
                         group = method)) +
  geom_line() +
  scale_colour_manual(values = palette,    breaks = method_levels) +
  scale_linewidth_manual(values = linewidths, breaks = method_levels) +
  scale_linetype_manual(values = linetypes,   breaks = method_levels) +
  scale_x_continuous(name = "Round t",
                     breaks = scales::pretty_breaks(5),
                     expand = expansion(mult = c(0.01, 0.02))) +
  scale_y_continuous(name = "Cumulative mean CRPS",
                     breaks = seq(0.02, 0.05, by = 0.01),
                     limits = c(y_lim_lo, y_lim_hi),
                     expand = expansion(mult = c(0, 0))) +
  coord_cartesian(ylim = c(y_lim_lo, y_lim_hi), clip = "off") +
  custom_theme(legend_position = "bottom") +
  guides(colour    = guide_legend(nrow = 1, byrow = TRUE,
                                  override.aes = list(linewidth = 0.9)),
         linewidth = "none",
         linetype  = "none")

save_fig(out_path, p, width_in = 5.6, height_in = 2.9)
cat("done: ", out_path, "\n", sep = "")
