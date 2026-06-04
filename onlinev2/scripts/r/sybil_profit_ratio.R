#!/usr/bin/env Rscript
# Sybil: profit difference (primary) and ratio (secondary) vs k
args <- commandArgs(trailingOnly = TRUE)
outdir <- if (length(args) >= 1) args[1] else "outputs"

if (!requireNamespace("ggplot2", quietly = TRUE)) {
  stop("Install ggplot2: install.packages('ggplot2')")
}
library(ggplot2)

PINK <- "#E91E8C"

csv_file <- file.path(outdir, "sybil_profit_ratio.csv")
out_file <- file.path(outdir, "sybil_profit_ratio.png")

if (!file.exists(csv_file)) stop("Missing: ", csv_file)

d <- read.csv(csv_file)

# Primary: profit difference (split - single) with CI
p1 <- ggplot(d, aes(x = k, y = mean_delta)) +
  geom_hline(yintercept = 0, linetype = "solid", color = "gray60", linewidth = 0.4) +
  geom_errorbar(aes(ymin = ci_low, ymax = ci_high), color = PINK, width = 0.2, linewidth = 0.8) +
  geom_line(color = PINK) +
  geom_point(color = PINK, size = 2) +
  labs(
    x = "k (identity splits)",
    y = expression(Delta * " = profit split - profit single"),
    title = "Sybil: profit difference (primary)"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    plot.title = element_text(margin = margin(b = 6)),
    plot.margin = margin(12, 16, 10, 14),
    panel.grid.minor = element_blank()
  )

# Secondary: profit ratio
p2 <- ggplot(d, aes(x = k, y = profit_ratio)) +
  geom_hline(yintercept = 1, linetype = "solid", color = PINK, alpha = 0.6, linewidth = 0.4) +
  geom_line(color = PINK) +
  geom_point(color = PINK, size = 2) +
  labs(x = "k (identity splits)", y = "Profit ratio (split / single)", title = "Sybil: profit ratio (secondary)") +
  theme_minimal(base_size = 11) +
  theme(
    plot.title = element_text(margin = margin(b = 6)),
    plot.margin = margin(12, 16, 10, 14),
    panel.grid.minor = element_blank()
  )

png(out_file, width = 1100, height = 460, res = 110)
if (requireNamespace("gridExtra", quietly = TRUE)) {
  print(gridExtra::grid.arrange(p1, p2, ncol = 2))
} else {
  grid::grid.newpage()
  grid::pushViewport(grid::viewport(layout = grid::grid.layout(1, 2)))
  print(p1, vp = grid::viewport(layout.pos.row = 1, layout.pos.col = 1))
  print(p2, vp = grid::viewport(layout.pos.row = 1, layout.pos.col = 2))
}
invisible(dev.off())
cat("Saved", out_file, "\n")
