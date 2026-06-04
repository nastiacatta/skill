#!/usr/bin/env Rscript
# Parameter sweep: heatmaps over lam and sigma_min (CRPS-hat, Gini,
# frac meaningful market).
#
# Chart type: heatmaps with the viridis palette (perceptually uniform,
# colourblind-safe). The original pink gradient was not perceptually
# uniform, made the mid-range indistinguishable, and did not print well
# in greyscale. Tiles use `geom_raster` (faster than `geom_tile`) and
# labels are black/white by luminance so they read on either end of the
# scale. X and Y are treated as ordered factors (not continuous) because
# the grid values are sparse and unevenly spaced.

args <- commandArgs(trailingOnly = TRUE)
outdir <- if (length(args) >= 1) args[1] else "outputs"

if (!requireNamespace("ggplot2", quietly = TRUE)) {
  stop("Install ggplot2: install.packages('ggplot2')")
}
library(ggplot2)
if (requireNamespace("viridisLite", quietly = TRUE)) {
  library(viridisLite)
}

sweep_file <- file.path(outdir, "parameter_sweep.csv")
out_crps <- file.path(outdir, "parameter_sweep_crps.png")
out_gini <- file.path(outdir, "parameter_sweep_gini.png")
out_frac <- file.path(outdir, "parameter_sweep_frac_meaningful.png")

if (!file.exists(sweep_file)) {
  stop("Missing: ", sweep_file)
}
d <- read.csv(sweep_file, na.strings = c("NA", "nan", "NaN", ""))

# Helper: choose label colour by fill luminance so text stays readable
# across the full range of the viridis palette.
label_colour <- function(values, vmin, vmax, cutoff = 0.55) {
  t <- (values - vmin) / (vmax - vmin + 1e-12)
  ifelse(t < cutoff, "white", "grey15")
}

base_theme <- theme_minimal(base_size = 13) +
  theme(
    panel.grid      = element_blank(),
    plot.title      = element_text(face = "bold"),
    legend.position = "right",
    legend.key.height = grid::unit(1.3, "cm"),
    legend.key.width  = grid::unit(0.45, "cm")
  )

# ---- CRPS heatmap ---------------------------------------------------------
d$crps_lab <- label_colour(d$mean_crps_hat,
                           min(d$mean_crps_hat), max(d$mean_crps_hat))

p_crps <- ggplot(d, aes(x = factor(lam),
                        y = factor(sigma_min),
                        fill = mean_crps_hat)) +
  geom_raster() +
  geom_text(aes(label = sprintf("%.3f", mean_crps_hat),
                colour = crps_lab),
            size = 3.2, fontface = "bold", show.legend = FALSE) +
  scale_fill_viridis_c(name = "Mean CRPS", option = "viridis", direction = -1) +
  scale_colour_identity() +
  coord_fixed() +
  labs(x = expression(lambda),
       y = expression(sigma[min]),
       title = "Aggregate loss (CRPS-hat)",
       subtitle = "Lower is better") +
  base_theme

# ---- Gini heatmap ---------------------------------------------------------
d$gini_lab <- label_colour(d$gini_profit,
                           min(d$gini_profit), max(d$gini_profit))

p_gini <- ggplot(d, aes(x = factor(lam),
                        y = factor(sigma_min),
                        fill = gini_profit)) +
  geom_raster() +
  geom_text(aes(label = sprintf("%.2f", gini_profit),
                colour = gini_lab),
            size = 3.2, fontface = "bold", show.legend = FALSE) +
  scale_fill_viridis_c(name = "Gini (profits)", option = "mako", direction = -1) +
  scale_colour_identity() +
  coord_fixed() +
  labs(x = expression(lambda),
       y = expression(sigma[min]),
       title = "Payout concentration (Gini)",
       subtitle = "Lower = more equal payouts") +
  base_theme

# ---- Fraction meaningful heatmap -----------------------------------------
d$frac_lab <- label_colour(d$frac_meaningful_market,
                           min(d$frac_meaningful_market),
                           max(d$frac_meaningful_market))

p_frac <- ggplot(d, aes(x = factor(lam),
                        y = factor(sigma_min),
                        fill = frac_meaningful_market)) +
  geom_raster() +
  geom_text(aes(label = sprintf("%.2f", frac_meaningful_market),
                colour = frac_lab),
            size = 3.2, fontface = "bold", show.legend = FALSE) +
  scale_fill_viridis_c(name = "Fraction",
                       option = "cividis", direction = 1,
                       limits = c(0, 1)) +
  scale_colour_identity() +
  coord_fixed() +
  labs(x = expression(lambda),
       y = expression(sigma[min]),
       title = "Fraction of rounds with meaningful market",
       subtitle = "Higher is better") +
  base_theme

ggsave(out_crps, p_crps, width = 6, height = 5, dpi = 150)
ggsave(out_gini, p_gini, width = 6, height = 5, dpi = 150)
ggsave(out_frac, p_frac, width = 6, height = 5, dpi = 150)
cat("Saved", out_crps, out_gini, out_frac, "\n")
