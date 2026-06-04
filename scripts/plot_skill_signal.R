#!/usr/bin/env Rscript
# Skill Signal: exponential decay curve σ = σ_min + (1 − σ_min) · exp(−γ · L)
# with three example forecasters marked on the curve.

library(ggplot2)
library(showtext)

# Use a clean sans-serif font
font_add_google("Inter", "inter")
showtext_auto()

sigma_min <- 0.1
gamma <- 4

skill <- function(L) sigma_min + (1 - sigma_min) * exp(-gamma * L)

# Curve data
curve_df <- data.frame(L = seq(0, 2.5, length.out = 200))
curve_df$sigma <- skill(curve_df$L)

# Three forecasters at well-separated positions
dots <- data.frame(
  L     = c(0.12, 0.85, 2.10),
  label = c("Skilled (σ = 0.96)", "Medium (σ = 0.53)", "Weak (σ = 0.17)"),
  col   = c("#2E8B8B", "#7C3AED", "#E85D4A")
)
dots$sigma <- skill(dots$L)

p <- ggplot(curve_df, aes(L, sigma)) +
  geom_line(linewidth = 1.4, colour = "#2E8B8B") +
  geom_hline(yintercept = sigma_min, linetype = "solid", colour = "#E85D4A", linewidth = 0.45, alpha = 0.6) +
  annotate("text", x = 2.45, y = sigma_min + 0.03, label = expression(sigma[min]),
           colour = "#E85D4A", size = 4.5, family = "inter") +
  geom_point(data = dots, aes(L, sigma), size = 5, colour = dots$col, fill = dots$col, shape = 21, stroke = 1.5) +
  geom_text(data = dots, aes(L, sigma, label = label), hjust = -0.12, vjust = 0.4,
            size = 4.5, fontface = "bold", colour = dots$col, family = "inter") +
  annotate("text", x = 1.25, y = 1.02,
           label = expression(sigma == sigma[min] + (1 - sigma[min]) %.% e^{-gamma %.% L}),
           size = 5, colour = "#1B2A4A", family = "inter", fontface = "bold") +
  scale_x_continuous(name = "Accumulated Loss (L)", expand = expansion(mult = c(0.02, 0.15))) +
  scale_y_continuous(name = expression(Skill ~ (sigma)), limits = c(0, 1.08), breaks = seq(0, 1, 0.2)) +
  theme_minimal(base_size = 14, base_family = "inter") +
  theme(
    panel.grid.minor = element_blank(),
    panel.grid.major = element_line(colour = "#E2E8F0", linewidth = 0.4),
    axis.title = element_text(face = "bold", colour = "#2D3748"),
    axis.text  = element_text(colour = "#64748B"),
    plot.margin = margin(12, 20, 12, 12)
  )

ggsave("dashboard/public/presentation-plots/skill_signal_clean.png", p,
       width = 8, height = 5.5, dpi = 220, bg = "white")
cat("Saved skill_signal_clean.png\n")
