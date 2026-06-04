#!/usr/bin/env Rscript
# Quantile reliability: empirical coverage p_hat(tau) versus nominal tau.
# Hard rule: no dotted line styles anywhere (PLOT_BEST_PRACTICES.md).
# Hard rule: no in-figure title; the caption carries that role (F4).
args <- commandArgs(trailingOnly = TRUE)
outdir <- if (length(args) >= 1) args[1] else "outputs"

if (!requireNamespace("ggplot2", quietly = TRUE)) {
  stop("Install ggplot2: install.packages('ggplot2')")
}
library(ggplot2)

# Canonical six-role thesis palette (mirrors scripts/figs/_thesis_style.py
# and writing/.tools/thesis_palette.R). Pink anchors the proposed
# mechanism; deep slate is the perfect-calibration reference.
PINK   <- "#F49AC1"
SLATE  <- "#1F2A38"
BORDER <- "#D9D9D9"
GREY   <- "#8C8C8C"

cal_file <- file.path(outdir, "calibration_reliability.csv")
out_pdf  <- file.path(outdir, "calibration_reliability.pdf")
out_png  <- file.path(outdir, "calibration_reliability.png")

if (!file.exists(cal_file)) {
  stop("Missing: ", cal_file)
}
d <- read.csv(cal_file, na.strings = c("NA", "nan", "NaN", ""))

ribbon_df <- data.frame(tau = seq(0, 1, length.out = 200))
ribbon_df$ymin <- pmax(ribbon_df$tau - 0.05, 0)
ribbon_df$ymax <- pmin(ribbon_df$tau + 0.05, 1)

p <- ggplot(d, aes(x = tau, y = p_hat)) +
  geom_ribbon(
    data = ribbon_df,
    aes(x = tau, ymin = ymin, ymax = ymax),
    inherit.aes = FALSE,
    fill = BORDER, alpha = 0.45
  ) +
  geom_abline(slope = 1, intercept = 0, colour = SLATE, linewidth = 0.4) +
  geom_line(colour = PINK, linewidth = 1.0, alpha = 0.95) +
  geom_point(colour = PINK, fill = "white", shape = 21, size = 2.4, stroke = 0.9) +
  scale_x_continuous(
    limits = c(0, 1),
    breaks = seq(0, 1, 0.25),
    expand = expansion(mult = c(0.02, 0.02))
  ) +
  scale_y_continuous(
    limits = c(0, 1),
    breaks = seq(0, 1, 0.25),
    expand = expansion(mult = c(0.02, 0.02))
  ) +
  coord_fixed(ratio = 1, clip = "off") +
  labs(
    x = expression("Nominal quantile " ~ tau),
    y = expression("Empirical coverage " ~ hat(p)(tau))
  ) +
  theme_minimal(base_size = 9) +
  theme(
    plot.title       = element_blank(),
    plot.subtitle    = element_blank(),
    plot.margin      = margin(6, 8, 4, 6),
    panel.grid.minor = element_blank(),
    panel.grid.major = element_line(colour = BORDER, linewidth = 0.2),
    axis.line        = element_line(colour = GREY, linewidth = 0.35),
    axis.ticks       = element_line(colour = GREY, linewidth = 0.3),
    axis.text        = element_text(size = 8, colour = SLATE),
    axis.title       = element_text(size = 9, colour = SLATE)
  )

ggsave(out_pdf, p, width = 3.6, height = 3.6, units = "in",
       device = cairo_pdf, bg = "white")
ggsave(out_png, p, width = 3.6, height = 3.6, units = "in",
       dpi = 320, bg = "white")
cat("Saved", out_pdf, "and", out_png, "\n")
