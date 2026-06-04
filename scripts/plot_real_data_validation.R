#!/usr/bin/env Rscript
# Real Data Validation: horizontal bar chart of ΔCRPS % vs equal weights
# on Elia wind data (γ=16, ρ=0.5, 17,544 rounds, 7 forecasters).

library(ggplot2)
library(dplyr)
library(showtext)

font_add_google("Inter", "inter")
showtext_auto()

# Data from comparison.json (verified)
uniform_crps <- 0.0679646275779488

df <- data.frame(
  method = c("Trimmed Mean", "Skill-only", "Inverse Variance",
             "Median", "Mechanism (skill × stake)", "Best Single (Naive)", "Oracle"),
  crps   = c(0.0539377, 0.0478516, 0.0465811,
             0.0452927, 0.0450420, 0.0362669, 0.0340054)
) %>%
  mutate(
    pct = (crps - uniform_crps) / uniform_crps * 100,
    highlight = method == "Mechanism (skill × stake)",
    method = factor(method, levels = rev(method))
  )

p <- ggplot(df, aes(x = pct, y = method, fill = highlight)) +
  geom_col(width = 0.7, show.legend = FALSE) +
  geom_text(aes(label = sprintf("%.1f%%", pct)),
            hjust = 1.15, size = 4.5, fontface = "bold", colour = "white", family = "inter") +
  geom_vline(xintercept = 0, linewidth = 0.8, colour = "#2D3748") +
  scale_fill_manual(values = c("TRUE" = "#2E8B8B", "FALSE" = "#94A3B8")) +
  scale_x_continuous(
    name = "ΔCRPS vs equal weights (%)",
    limits = c(-55, 2),
    breaks = seq(-50, 0, 10),
    labels = function(x) paste0(x, "%")
  ) +
  labs(y = NULL, title = "Elia Wind — 17,544 rounds, 7 forecasters (γ = 16, ρ = 0.5)") +
  theme_minimal(base_size = 14, base_family = "inter") +
  theme(
    panel.grid.major.y = element_blank(),
    panel.grid.minor   = element_blank(),
    panel.grid.major.x = element_line(colour = "#E2E8F0", linewidth = 0.4),
    axis.text.y  = element_text(face = "bold", colour = "#2D3748", size = 13),
    axis.text.x  = element_text(colour = "#64748B"),
    axis.title.x = element_text(face = "bold", colour = "#2D3748", margin = margin(t = 8)),
    plot.title   = element_text(face = "bold", colour = "#1B2A4A", size = 15, hjust = 0.5),
    plot.margin  = margin(16, 20, 12, 12)
  )

ggsave("dashboard/public/presentation-plots/real_data_validation.png", p,
       width = 10, height = 5.5, dpi = 220, bg = "white")
cat("Saved real_data_validation.png\n")
