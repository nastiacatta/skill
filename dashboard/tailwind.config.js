/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'Source Serif 4'", "Charter", "'Iowan Old Style'", "Georgia", "serif"],
        sans:  ["Inter", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        mono:  ["'JetBrains Mono'", "ui-monospace", "'SF Mono'", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        // Academic palette — available as bg-paper / text-ink / border-rule etc.
        paper:   "#fbf9f4",
        cream:   "#f5f1e8",
        ink: {
          DEFAULT: "#0b1220",
          muted:   "#2b3246",
          soft:    "#5a6175",
          faint:   "#8c92a3",
        },
        rule:    "#e8e2d2",
        "rule-strong": "#d3ccb9",
        navy: {
          DEFAULT: "#1d3461",
          ink:     "#0f1f3d",
          tint:    "#eef2f9",
        },
        teal: {
          // Override Tailwind's default teal with the academic one;
          // keeps existing text-teal-* classes consistent with the theme.
          50:  "#e7f3f1",
          100: "#d4ebe7",
          500: "#0f766e",
          600: "#0f766e",
          700: "#115e59",
          800: "#0f4a47",
          DEFAULT: "#0f766e",
        },
        amber_academic: {
          DEFAULT: "#b45309",
          tint:    "#fbf3e5",
        },
        crimson: {
          DEFAULT: "#9a1a2f",
          tint:    "#fbecef",
        },
        plum: {
          DEFAULT: "#5b21b6",
          tint:    "#f1ecfb",
        },
      },
      fontSize: {
        // Page-level scale that matches the CSS variables
        "body":  ["16px",   { lineHeight: "1.55" }],
        "lead":  ["18px",   { lineHeight: "1.6"  }],
        "h3":    ["22px",   { lineHeight: "1.4"  }],
        "h2":    ["28px",   { lineHeight: "1.25" }],
        "h1":    ["40px",   { lineHeight: "1.15" }],
      },
      boxShadow: {
        "paper-sm": "0 1px 0 rgba(15, 23, 42, 0.03)",
        "paper-md": "0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 12px -6px rgba(15, 23, 42, 0.06)",
        "paper-lg": "0 2px 4px rgba(15, 23, 42, 0.04), 0 16px 40px -12px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
}
