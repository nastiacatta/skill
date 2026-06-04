"""Verify the claim (writing/30_mechanism_design.md §3.3) that the
learned σ ranking and the per-forecaster CRPS ranking agree perfectly
on the Elia wind full-length expanding-mode run.

Reads committed JSON only — does not re-run any pipeline. Safe to call
whenever the comparison JSON is refreshed.

Usage:
    python scripts/verify_t6_spearman.py
"""
import json
import statistics
from pathlib import Path

PATH = Path("dashboard/public/data/real_data/elia_wind/data/comparison.json")


def spearman(xs, ys):
    rx = {v: i + 1 for i, v in enumerate(sorted(xs))}
    ry = {v: i + 1 for i, v in enumerate(sorted(ys))}
    rxv = [rx[x] for x in xs]
    ryv = [ry[y] for y in ys]
    mx = statistics.mean(rxv)
    my = statistics.mean(ryv)
    num = sum((a - mx) * (b - my) for a, b in zip(rxv, ryv))
    dx = (sum((a - mx) ** 2 for a in rxv)) ** 0.5
    dy = (sum((b - my) ** 2 for b in ryv)) ** 0.5
    return num / (dx * dy)


def main():
    d = json.loads(PATH.read_text())
    ss = d["steady_state"]
    pac = d["per_agent_crps"]
    names = d["forecaster_names"]

    sums = {n: 0.0 for n in names}
    counts = {n: 0 for n in names}
    for row in pac:
        for n in names:
            if n in row:
                sums[n] += row[n]
                counts[n] += 1
    crps = {n: sums[n] / counts[n] for n in names if counts[n] > 0}

    print(f"{'Forecaster':28s} {'sigma':>8s} {'CRPS':>9s}")
    rows = []
    for row in ss:
        name = row["forecaster"]
        rows.append((name, row["mean_sigma"], crps[name]))
        print(f"{name:28s} {row['mean_sigma']:>8.3f} {crps[name]:>9.5f}")

    sigmas = [r[1] for r in rows]
    neg_crps = [-r[2] for r in rows]
    s = spearman(sigmas, neg_crps)
    print(f"\nSpearman(sigma, -CRPS) = {s:.4f}")
    if abs(s - 1.0) < 1e-9:
        print("VERIFIED: sigma ranking = CRPS ranking (Spearman = 1.0)")
    else:
        order_sigma = sorted(range(len(rows)), key=lambda i: -rows[i][1])
        order_crps = sorted(range(len(rows)), key=lambda i: rows[i][2])
        print("Rankings disagree:")
        print(" sigma-ranked:", [rows[i][0] for i in order_sigma])
        print(" crps-ranked: ", [rows[i][0] for i in order_crps])


if __name__ == "__main__":
    main()
