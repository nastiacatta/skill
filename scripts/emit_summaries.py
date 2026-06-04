"""Emit canonical summary.json artefacts for weight-rule and bankroll-ablation experiments."""
import csv
import json
import math
import statistics
from collections import defaultdict

def safe_mean(values):
    clean = [v for v in values if not math.isnan(v)]
    if not clean:
        return None
    return statistics.mean(clean)

def main():
    # Task 1: Weight-rule comparison summary.json
    wr_path = "onlinev2/outputs/core/experiments/weight_rule_comparison/data/weight_rule_comparison.csv"
    with open(wr_path) as f:
        reader = csv.DictReader(f)
        wr_rows = list(reader)

    wr_json_rows = []
    for r in wr_rows:
        wr_json_rows.append({
            "deposit_policy": r["deposit_policy"],
            "weight_rule": r["weight_rule"],
            "mean_crps_all": round(float(r["mean_crps_all"]), 6),
            "se_all": round(float(r["se_all"]), 6),
            "mean_crps_warmstart": round(float(r["mean_crps_warmstart"]), 6),
            "se_ws": round(float(r["se_ws"]), 6),
        })

    deposit_policies = sorted(set(r["deposit_policy"] for r in wr_rows))
    weight_rules_seen = []
    for r in wr_rows:
        if r["weight_rule"] not in weight_rules_seen:
            weight_rules_seen.append(r["weight_rule"])

    wr_summary = {
        "experiment_name": "weight_rule_comparison",
        "config": {
            "T": 1000,
            "n_forecasters": 6,
            "n_seeds": 20,
            "deposit_policies": deposit_policies,
            "weight_rules": weight_rules_seen,
        },
        "rows": wr_json_rows,
        "source_csv": "weight_rule_comparison.csv",
    }

    wr_out = "onlinev2/outputs/core/experiments/weight_rule_comparison/data/summary.json"
    with open(wr_out, "w") as f:
        json.dump(wr_summary, f, indent=2)
        f.write("\n")
    print(f"Wrote {wr_out} ({len(wr_json_rows)} rows)")

    # Task 2: Bankroll ablation summary.json (20-seed aggregate)
    ba_path = "onlinev2/outputs/core/experiments/bankroll_ablation/data/bankroll_ablation.csv"
    with open(ba_path) as f:
        reader = csv.DictReader(f)
        ba_rows = list(reader)

    variants_data = defaultdict(list)
    for r in ba_rows:
        variants_data[r["variant"]].append(r)

    variant_order = ["Full", "A-", "B-", "C-", "D-", "E-"]

    ba_variants = []
    for vname in variant_order:
        rows = variants_data[vname]
        n = len(rows)

        crps_vals = [float(r["mean_crps"]) for r in rows]
        delta_vals = [float(r["delta_crps_vs_full"]) for r in rows]
        hhi_vals = [float(r["mean_HHI"]) for r in rows]
        neff_vals = [float(r["mean_N_eff"]) for r in rows]

        gini_raw = []
        for r in rows:
            v = r["final_gini"]
            if v.lower() == "nan" or v == "":
                gini_raw.append(float("nan"))
            else:
                gini_raw.append(float(v))

        mean_crps = round(statistics.mean(crps_vals), 5)
        mean_delta = round(statistics.mean(delta_vals), 5)
        mean_hhi_raw = safe_mean(hhi_vals)
        mean_hhi = round(mean_hhi_raw, 5) if mean_hhi_raw is not None else None
        mean_neff_raw = safe_mean(neff_vals)
        mean_neff = round(mean_neff_raw, 5) if mean_neff_raw is not None else None
        mean_gini_raw = safe_mean(gini_raw)
        mean_gini = round(mean_gini_raw, 5) if mean_gini_raw is not None else None

        nan_gini_count = sum(1 for g in gini_raw if math.isnan(g))

        entry = {
            "variant": vname,
            "mean_crps": mean_crps,
            "delta_crps_vs_full": mean_delta,
            "mean_HHI": mean_hhi,
            "mean_N_eff": mean_neff,
            "final_gini": mean_gini,
            "n_seeds": n,
        }
        if nan_gini_count > 0:
            entry["gini_nan_seeds"] = nan_gini_count

        ba_variants.append(entry)
        print(f"  {vname}: n={n}, mean_crps={mean_crps}, delta={mean_delta}, HHI={mean_hhi}, Gini={mean_gini} (nan_gini={nan_gini_count})")

    ba_summary = {
        "experiment_name": "bankroll_ablation",
        "config": {
            "T": 1000,
            "n_seeds": 20,
            "preset": "exponential_deposits",
            "DGP": "latent_fixed",
            "n_forecasters": 10,
        },
        "variants": ba_variants,
        "n_seeds_per_variant": 20,
        "source_csv": "bankroll_ablation.csv",
    }

    ba_out = "onlinev2/outputs/core/experiments/bankroll_ablation/data/summary.json"
    with open(ba_out, "w") as f:
        json.dump(ba_summary, f, indent=2)
        f.write("\n")
    print(f"Wrote {ba_out} ({len(ba_variants)} variants)")

    # Task 3: Cross-check against prose
    print()
    print("=" * 72)
    print("CROSS-CHECK REPORT")
    print("=" * 72)

    print()
    print("--- Weight-rule comparison (S9/S10) ---")
    print(f"{'Claim':<55} {'Prose':>8} {'Artefact':>10} {'Status':>10}")
    print("-" * 85)

    fixed_rows = {r["weight_rule"]: r for r in wr_rows if r["deposit_policy"] == "fixed_unit"}
    checks_wr = [
        ("Uniform CRPS (fixed deposits)", 0.04340, float(fixed_rows["uniform"]["mean_crps_all"])),
        ("Skill CRPS (fixed deposits)", 0.04188, float(fixed_rows["skill"]["mean_crps_all"])),
        ("Mechanism CRPS (fixed deposits)", 0.04237, float(fixed_rows["mechanism"]["mean_crps_all"])),
        ("Best single CRPS (fixed deposits)", 0.02305, float(fixed_rows["best_single"]["mean_crps_all"])),
    ]

    bankroll_rows = {r["weight_rule"]: r for r in wr_rows if r["deposit_policy"] == "bankroll_conf"}
    checks_wr.append(("Deposit-rule CRPS (bankroll deposits)", 0.02642, float(bankroll_rows["deposit"]["mean_crps_all"])))

    for label, prose_val, artefact_val in checks_wr:
        diff = abs(prose_val - artefact_val)
        if diff < 0.00005:
            status = "OK"
        elif diff < 0.0005:
            status = "PRECISION"
        else:
            status = "DRIFT"
        print(f"{label:<55} {prose_val:>8.5f} {artefact_val:>10.6f} {status:>10}")

    # Bankroll ablation prose checks (S12)
    print()
    print("--- Bankroll ablation (S12) ---")
    print(f"{'Claim':<45} {'Prose':>8} {'Artefact':>10} {'Status':>10}")
    print("-" * 75)

    prose_ba = {
        "Full": {"crps": 0.05326, "hhi": 0.334, "gini": 0.774},
        "A-":   {"crps": 0.05300, "hhi": 0.362, "gini": 0.800},
        "B-":   {"crps": 0.05423, "hhi": 0.129, "gini": 0.000},
        "C-":   {"crps": 0.05304, "hhi": 0.354, "gini": 0.797},
        "D-":   {"crps": 0.02987, "hhi": 0.334, "gini": 0.774},
        "E-":   {"crps": 0.05496, "hhi": 0.130, "gini": 0.000},
    }

    ba_lookup = {v["variant"]: v for v in ba_variants}

    for vname in variant_order:
        pv = prose_ba[vname]
        av = ba_lookup[vname]

        for metric, tol in [("crps", 0.0005), ("hhi", 0.005), ("gini", 0.005)]:
            if metric == "crps":
                artefact_val = av["mean_crps"]
                prose_val = pv["crps"]
                label = f"{vname} CRPS"
            elif metric == "hhi":
                artefact_val = av["mean_HHI"]
                prose_val = pv["hhi"]
                label = f"{vname} HHI"
            else:
                artefact_val = av["final_gini"]
                prose_val = pv["gini"]
                label = f"{vname} Gini"

            if artefact_val is None:
                status = "NULL"
                fmt_art = "null"
            else:
                diff = abs(prose_val - artefact_val)
                if diff < tol / 10:
                    status = "OK"
                elif diff < tol:
                    status = "PRECISION"
                else:
                    status = "DRIFT"
                fmt_art = f"{artefact_val:.5f}"

            print(f"{label:<45} {prose_val:>8.3f} {fmt_art:>10} {status:>10}")

    # D- delta check
    print()
    d_delta_prose = -0.02340
    d_delta_art = ba_lookup["D-"]["delta_crps_vs_full"]
    diff = abs(d_delta_prose - d_delta_art)
    status = "OK" if diff < 0.00005 else ("PRECISION" if diff < 0.0005 else "DRIFT")
    print(f"D- Delta vs Full: prose={d_delta_prose:.5f}, artefact={d_delta_art:.5f}, status={status}")

    # Anomaly checks
    print()
    print("--- Anomaly checks ---")
    for vname in variant_order:
        rows = variants_data[vname]
        crps_vals = [float(r["mean_crps"]) for r in rows]
        mn = statistics.mean(crps_vals)
        sd = statistics.stdev(crps_vals)
        outliers = [i for i, v in enumerate(crps_vals) if abs(v - mn) > 3 * sd]
        if outliers:
            print(f"  {vname}: potential CRPS outlier seeds at indices {outliers}")

        gini_vals = [r["final_gini"] for r in rows]
        nan_count = sum(1 for g in gini_vals if g.lower() == "nan")
        if nan_count > 0:
            print(f"  {vname}: {nan_count}/{len(rows)} seeds have NaN Gini")

    print()
    print("Done.")


if __name__ == "__main__":
    main()
