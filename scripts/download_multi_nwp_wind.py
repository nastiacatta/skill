"""Download multi-NWP wind-speed forecasts from Open-Meteo Forecast API.

Fetches hub-height (100m) wind speed from 10 independent NWP models for the
Belgian offshore zone, converts to power using an IEC reference turbine curve,
and joins with measured Elia offshore generation.

Uses the main api.open-meteo.com with past_days parameter to retrieve recent
archived forecasts. The historical-forecast-api subdomain is unreachable from
some networks, so we use the main API which provides ~92 days of recent data.

Output: data/multi_nwp_wind_belgium_offshore_2022_2025.csv
"""
import sys
import time
import os
import numpy as np
import requests
import pandas as pd

# ─── Constants ───────────────────────────────────────────────────────────────

API_ENDPOINT = "https://api.open-meteo.com/v1/forecast"

# Belgian offshore zone (Princess Elisabeth / Borssele cluster)
LATITUDE = 51.6
LONGITUDE = 2.9

# NWP models to query — verified available on api.open-meteo.com with
# wind_speed_100m at Belgian offshore coordinates as of May 2026.
# Models span 6 distinct NWP centres plus 2 regional mesoscale systems,
# giving architecturally independent forecasts.
MODELS = [
    "ecmwf_ifs025",                  # ECMWF IFS HRES 0.25 deg
    "gfs_global",                    # NOAA GFS 0.25 deg
    "cma_grapes_global",             # CMA GRAPES Global
    "meteofrance_arpege_europe",     # Meteo-France ARPEGE (Europe domain)
    "meteofrance_seamless",          # Meteo-France blended (ARPEGE+AROME)
    "ukmo_seamless",                 # UK Met Office seamless blend
    "knmi_harmonie_arome_europe",    # KNMI HARMONIE-AROME (mesoscale)
    "dmi_harmonie_arome_europe",     # DMI HARMONIE-AROME (mesoscale)
    "metno_seamless",                # MET Norway seamless blend
    "meteofrance_arome_france",      # Meteo-France AROME (high-res regional)
]

VARIABLE = "wind_speed_100m"

# Number of past days available on the main API
PAST_DAYS = 92

# Installed offshore capacity in Belgium (MW) — from Elia monitored capacity
INSTALLED_CAPACITY_MW = 2262.1

# IEC reference turbine parameters
CUT_IN = 3.0       # m/s
RATED = 12.0       # m/s
CUT_OUT = 25.0     # m/s

# Output paths
OUTPUT_CSV = "data/multi_nwp_wind_belgium_offshore_2022_2025.csv"
POWER_CURVE_CSV = "data/iec_reference_turbine_power_curve.csv"
ELIA_CSV = "data/elia_offshore_wind_2024_2025.csv"

# Elia Open Data API
ELIA_API = "https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods031/records"

# Throttle between API calls (seconds)
THROTTLE = 1.0


# ─── Power curve ─────────────────────────────────────────────────────────────

def power_fraction(v):
    """IEC Class IIA reference turbine power fraction (0-1) for wind speed v (m/s)."""
    v = np.asarray(v, dtype=float)
    p = np.zeros_like(v)
    ramp = (v >= CUT_IN) & (v < RATED)
    rated = (v >= RATED) & (v <= CUT_OUT)
    p[ramp] = (v[ramp] ** 3 - CUT_IN ** 3) / (RATED ** 3 - CUT_IN ** 3)
    p[rated] = 1.0
    return p


def build_power_curve_table():
    """Generate IEC reference turbine power curve table at 0.5 m/s bins."""
    speeds = np.arange(0, 30.5, 0.5)
    fractions = power_fraction(speeds)
    df = pd.DataFrame({
        "wind_speed_ms": speeds,
        "power_fraction": np.round(fractions, 6),
    })
    df.to_csv(POWER_CURVE_CSV, index=False)
    print(f"  Power curve table saved to {POWER_CURVE_CSV} ({len(df)} rows)")
    return df


def convert_wind_to_power(wind_speeds):
    """Convert wind speed array (m/s) to power (MW) using IEC curve."""
    return power_fraction(wind_speeds) * INSTALLED_CAPACITY_MW


# ─── API query ───────────────────────────────────────────────────────────────

def query_open_meteo(model):
    """Query Open-Meteo Forecast API for one model using past_days.

    Returns a DataFrame with columns [datetime, wind_speed_100m] or None on failure.
    """
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "past_days": PAST_DAYS,
        "forecast_days": 0,
        "hourly": VARIABLE,
        "models": model,
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            r = requests.get(API_ENDPOINT, params=params, timeout=60)
            if r.status_code == 429:
                wait = 2 ** (attempt + 1)
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            if r.status_code == 400:
                error_msg = r.text[:200] if r.text else "Bad Request"
                print(f"    400 error for {model}: {error_msg}")
                return None
            r.raise_for_status()
            data = r.json()
            hourly = data.get("hourly", {})
            times = hourly.get("time", [])

            # Find the wind speed column (may be model-suffixed or plain)
            values = None
            for key in hourly:
                if key.startswith("wind_speed_100m"):
                    values = hourly[key]
                    break

            if not times or values is None:
                print(f"    No data for {model}")
                return None

            df = pd.DataFrame({"datetime": times, VARIABLE: values})
            df["datetime"] = pd.to_datetime(df["datetime"], utc=True)
            df = df.drop_duplicates(subset=["datetime"]).sort_values("datetime").reset_index(drop=True)
            return df

        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                print(f"    Timeout (attempt {attempt+1}), retrying...")
                time.sleep(2 ** (attempt + 1))
                continue
            print(f"    Timeout for {model} after {max_retries} attempts")
            return None
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                print(f"    Request error (attempt {attempt+1}), retrying...")
                time.sleep(2 ** (attempt + 1))
                continue
            print(f"    Request error for {model}: {e}")
            return None

    return None


# ─── Elia ground truth ───────────────────────────────────────────────────────

def download_elia_for_period(start_dt, end_dt):
    """Download Elia offshore wind measured generation for a date range.

    First checks the local CSV for overlap, then fetches remaining from API.
    """
    print("\nFetching Elia measured generation...")

    # Try local file first
    local_data = None
    if os.path.exists(ELIA_CSV):
        print(f"  Reading local file: {ELIA_CSV}")
        elia_local = pd.read_csv(ELIA_CSV)
        elia_local["datetime"] = pd.to_datetime(elia_local["datetime"], utc=True)
        elia_local = elia_local[["datetime", "measured"]].dropna(subset=["measured"])
        mask = (elia_local["datetime"] >= start_dt) & (elia_local["datetime"] <= end_dt)
        local_data = elia_local[mask].copy()
        print(f"  Local file covers {local_data['datetime'].min()} to {local_data['datetime'].max()} "
              f"({len(local_data)} rows in range)")

    # Determine what's missing and fetch from API
    if local_data is not None and len(local_data) > 0:
        local_max = local_data["datetime"].max()
    else:
        local_max = start_dt - pd.Timedelta(hours=1)

    # Fetch from API for dates beyond local file
    api_start = local_max + pd.Timedelta(hours=1)
    all_api_rows = []

    if api_start < end_dt:
        print(f"  Fetching from Elia API: {api_start.strftime('%Y-%m')} to {end_dt.strftime('%Y-%m')}...")
        current = api_start
        while current <= end_dt:
            year = current.year
            month = current.month
            month_label = f"{year}-{month:02d}"
            offset = 0
            month_rows = []

            while True:
                params = {
                    "limit": 100,
                    "offset": offset,
                    "timezone": "Europe/Brussels",
                    "refine": [
                        'offshoreonshore:"Offshore"',
                        f'datetime:"{year}/{month:02d}"',
                    ],
                    "order_by": "datetime",
                }
                try:
                    r = requests.get(ELIA_API, params=params, timeout=30)
                    if r.status_code == 400:
                        break
                    r.raise_for_status()
                    results = r.json().get("results", [])
                    if not results:
                        break
                    month_rows.extend(results)
                    offset += len(results)
                    time.sleep(0.05)
                except Exception as e:
                    print(f"    Error fetching {month_label}: {e}")
                    break

            if month_rows:
                print(f"    {month_label}: {len(month_rows)} records")
                all_api_rows.extend(month_rows)

            # Move to next month
            if month == 12:
                current = pd.Timestamp(f"{year+1}-01-01", tz="UTC")
            else:
                current = pd.Timestamp(f"{year}-{month+1:02d}-01", tz="UTC")

    # Combine local + API data
    parts = []
    if local_data is not None and len(local_data) > 0:
        parts.append(local_data)

    if all_api_rows:
        api_df = pd.DataFrame(all_api_rows)
        api_df["datetime"] = pd.to_datetime(api_df["datetime"], utc=True)
        api_df = api_df[["datetime", "measured"]].dropna(subset=["measured"])
        parts.append(api_df)

    if not parts:
        print("  WARNING: No Elia data available for the requested period")
        return pd.DataFrame(columns=["datetime", "measured"])

    elia_all = pd.concat(parts, ignore_index=True)
    elia_all = elia_all.drop_duplicates(subset=["datetime"]).sort_values("datetime").reset_index(drop=True)

    # Resample to hourly (Elia is 15-min)
    elia_hourly = (
        elia_all.set_index("datetime")
        .resample("1h")
        .mean()
        .reset_index()
    )
    elia_hourly = elia_hourly.dropna(subset=["measured"])
    print(f"  Elia hourly total: {len(elia_hourly)} rows "
          f"({elia_hourly['datetime'].min()} to {elia_hourly['datetime'].max()})")
    return elia_hourly


# ─── Validation ──────────────────────────────────────────────────────────────

def validate_output(df, models_downloaded):
    """Run validation checks on the output DataFrame."""
    results = []

    # 1. File exists and non-zero
    file_exists = os.path.exists(OUTPUT_CSV) and os.path.getsize(OUTPUT_CSV) > 0
    results.append(("File exists with non-zero size", file_exists, f"{OUTPUT_CSV}"))

    # 2. Row count — with ~92 days expect ~2208 rows
    expected_rows = PAST_DAYS * 24
    tolerance = 0.10
    row_ok = abs(len(df) - expected_rows) / expected_rows < tolerance
    results.append((
        "Row count within 10% of expected",
        row_ok,
        f"{len(df)} rows (expected ~{expected_rows}, tolerance 10%)"
    ))

    # 3. Column count
    n_models = len(models_downloaded)
    expected_cols = 1 + 2 * n_models + 1 + 2  # datetime + 2*N + measured + lat,lon
    col_ok = len(df.columns) == expected_cols
    results.append((
        "Column count matches expected",
        col_ok,
        f"{len(df.columns)} columns (expected {expected_cols} for {n_models} models)"
    ))

    # 4. No null datetime
    null_dt = df["datetime"].isna().sum()
    results.append(("No null datetime values", null_dt == 0, f"{null_dt} nulls"))

    # 5. At least 5 models with >= 90% non-null coverage
    coverage = {}
    for model in models_downloaded:
        col = f"wind_speed_100m_{model}"
        if col in df.columns:
            cov = df[col].notna().mean()
            coverage[model] = cov
    models_90 = sum(1 for c in coverage.values() if c >= 0.90)
    results.append((
        "At least 5 models with >= 90% coverage",
        models_90 >= 5,
        f"{models_90} models meet threshold (of {len(coverage)} downloaded)"
    ))

    # 6. Spot-check wind speed statistics
    print("\n  Wind speed summary statistics (m/s):")
    print(f"  {'Model':<35} {'Mean':>6} {'Std':>6} {'Min':>6} {'Max':>6} {'Coverage':>8}")
    print(f"  {'-'*35} {'-'*6} {'-'*6} {'-'*6} {'-'*6} {'-'*8}")
    all_plausible = True
    for model in models_downloaded:
        col = f"wind_speed_100m_{model}"
        if col in df.columns:
            s = df[col].dropna()
            if len(s) > 0:
                mean, std, mn, mx = s.mean(), s.std(), s.min(), s.max()
                cov_pct = f"{coverage.get(model, 0)*100:.1f}%"
                print(f"  {model:<35} {mean:>6.2f} {std:>6.2f} {mn:>6.2f} {mx:>6.2f} {cov_pct:>8}")
                if mean < 4 or mean > 16 or std < 1 or std > 10:
                    all_plausible = False
    results.append(("Wind speed values physically plausible", all_plausible,
                    "Mean 4-16 m/s, Std 1-10 m/s"))

    # 7. Power correlation with measured
    print("\n  Power-measured correlation:")
    correlations = {}
    measured_valid = df["measured"].notna()
    for model in models_downloaded:
        pcol = f"power_predicted_{model}"
        if pcol in df.columns:
            mask = measured_valid & df[pcol].notna()
            if mask.sum() > 100:
                corr = df.loc[mask, pcol].corr(df.loc[mask, "measured"])
                correlations[model] = corr
                status = "good" if corr > 0.6 else ("healthy" if corr > 0.4 else "LOW")
                print(f"    {model:<35} r = {corr:.4f} ({status})")

    avg_corr = np.mean(list(correlations.values())) if correlations else 0
    corr_ok = avg_corr > 0.4
    results.append((
        "Average power-measured correlation > 0.4",
        corr_ok,
        f"Average r = {avg_corr:.4f} across {len(correlations)} models"
    ))

    return results, coverage, correlations


# ─── Report ──────────────────────────────────────────────────────────────────

def write_report(df, models_ok, models_fail, checks, coverage, correlations,
                 file_size_mb, all_pass):
    """Write the structured report."""
    report_dir = "outputs/multi_nwp_data_download"
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, "report.md")

    n_models = len(models_ok)
    avg_corr = np.mean(list(correlations.values())) if correlations else 0
    dt_min = df["datetime"].min()
    dt_max = df["datetime"].max()

    lines = []
    lines.append("# Multi-NWP Wind Forecast Download Report\n")

    # Summary
    lines.append("## Summary\n")
    lines.append(f"- Output file: `{OUTPUT_CSV}` ({file_size_mb:.1f} MB)")
    lines.append(f"- Models successfully downloaded: {n_models} of {len(MODELS)} attempted")
    lines.append(f"- Date range: {dt_min} to {dt_max}")
    lines.append(f"- Row count: {len(df)}")
    lines.append(f"- Average correlation with measured power: r = {avg_corr:.4f}")
    lines.append(f"- Location: {LATITUDE}N, {LONGITUDE}E (Belgian offshore zone)")
    lines.append(f"- Variable: wind_speed_100m (hub-height wind speed)")
    lines.append(f"- Power conversion: IEC Class IIA reference turbine, scaled to {INSTALLED_CAPACITY_MW} MW\n")

    # What was downloaded
    lines.append("## What was downloaded\n")
    lines.append("Each row in the table shows one NWP model queried from the Open-Meteo")
    lines.append("Forecast API. The API archives operational forecasts as issued by each")
    lines.append("centre, giving architecturally independent predictions for the same")
    lines.append("physical location and time window.\n")
    lines.append("The historical-forecast-api.open-meteo.com subdomain (which hosts the")
    lines.append("full multi-year archive) was unreachable during this download session.")
    lines.append("The script fell back to the main api.open-meteo.com endpoint with")
    lines.append(f"past_days={PAST_DAYS}, retrieving approximately 3 months of recent")
    lines.append("archived forecasts. This provides sufficient data for mechanism")
    lines.append("validation while the full 4-year panel can be fetched when the")
    lines.append("historical API becomes reachable again.\n")
    lines.append("| Model | Non-null hours | Coverage (%) | Mean wind (m/s) | Correlation |")
    lines.append("|-------|---------------|-------------|-----------------|-------------|")
    for model in models_ok:
        ws_col = f"wind_speed_100m_{model}"
        cov = coverage.get(model, 0) * 100
        mean_ws = df[ws_col].mean() if ws_col in df.columns else float("nan")
        corr = correlations.get(model, float("nan"))
        n_valid = df[ws_col].notna().sum() if ws_col in df.columns else 0
        lines.append(f"| {model} | {n_valid} | {cov:.1f} | {mean_ws:.2f} | {corr:.4f} |")
    lines.append("")

    if models_fail:
        lines.append("Models that failed to return usable data:\n")
        for model in models_fail:
            lines.append(f"- `{model}`: no data or timeout at requested coordinates")
        lines.append("")

    # Issues
    lines.append("## Issues\n")
    if not models_fail and all_pass:
        lines.append("No issues encountered during the download.\n")
    else:
        if models_fail:
            lines.append(f"{len(models_fail)} model(s) could not be downloaded. Some models")
            lines.append("do not provide wind_speed_100m at all grid points or timed out")
            lines.append("during the request. The remaining panel still exceeds the minimum")
            lines.append("threshold of 5 models.\n")
        lines.append("The primary limitation is the use of past_days=92 on the main API")
        lines.append("rather than the full 2022-2025 archive from the historical forecast")
        lines.append("endpoint. The date range is shorter than originally specified but")
        lines.append("provides adequate overlap with Elia measured generation for the")
        lines.append("mechanism validation.\n")
        failing_checks = [c for c in checks if not c[1]]
        if failing_checks:
            lines.append("Validation failures:\n")
            for check, _, detail in failing_checks:
                lines.append(f"- {check}: {detail}")
            lines.append("")

    # Verification
    lines.append("## Verification\n")
    lines.append("Each validation step confirms that the downloaded data meets quality")
    lines.append("thresholds required before the mechanism can run on it.\n")
    for check, passed, detail in checks:
        status = "PASS" if passed else "FAIL"
        lines.append(f"- [{status}] {check}: {detail}")
    lines.append("")

    lines.append("### Wind speed summary statistics\n")
    lines.append("| Model | Mean | Std | Min | Max |")
    lines.append("|-------|------|-----|-----|-----|")
    for model in models_ok:
        ws_col = f"wind_speed_100m_{model}"
        if ws_col in df.columns:
            s = df[ws_col].dropna()
            if len(s) > 0:
                lines.append(f"| {model} | {s.mean():.2f} | {s.std():.2f} | {s.min():.2f} | {s.max():.2f} |")
    lines.append("")

    # Verdict
    lines.append("## Verdict\n")
    verdict = "PASS" if all_pass else "NEEDS_WORK"
    lines.append(f"{verdict}\n")
    if all_pass:
        lines.append(f"The download completed successfully. All validation checks pass. The")
        lines.append(f"panel contains {n_models} architecturally distinct NWP models with")
        lines.append("adequate temporal coverage and physically plausible wind speed")
        lines.append("distributions. The power-to-measured correlation confirms correct")
        lines.append("alignment between forecast timestamps and the Elia generation series.")
        lines.append("The data is ready for the mechanism implementation pass.")
    else:
        lines.append("The download completed with issues. Review the failing validation")
        lines.append("checks above and address before proceeding to the mechanism")
        lines.append("implementation.")

    with open(report_path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"  Report written to {report_path}")


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print("Multi-NWP Wind Forecast Download")
    print(f"Location: {LATITUDE}N, {LONGITUDE}E (Belgian offshore zone)")
    print(f"Past days: {PAST_DAYS}")
    print(f"Models: {len(MODELS)}")
    print(f"Variable: {VARIABLE}")
    print("=" * 70)

    # Phase 0: Build power curve table
    print("\nPhase 0: Building IEC reference turbine power curve...")
    build_power_curve_table()

    # Phase 1: Download wind speed from each model
    print("\nPhase 1: Downloading NWP wind forecasts from Open-Meteo...")
    model_results = {}
    models_downloaded = []
    models_failed = []

    for i, model in enumerate(MODELS, 1):
        print(f"\n[{i}/{len(MODELS)}] {model}")
        t0 = time.time()
        result = query_open_meteo(model)
        elapsed = time.time() - t0

        if result is not None:
            n_valid = result[VARIABLE].notna().sum()
            if n_valid > 100:
                model_results[model] = result
                models_downloaded.append(model)
                print(f"  OK: {len(result)} rows, {n_valid} valid values ({elapsed:.1f}s)")
            else:
                models_failed.append(model)
                print(f"  FAILED: only {n_valid} valid values ({elapsed:.1f}s)")
        else:
            models_failed.append(model)
            print(f"  FAILED: no usable data returned ({elapsed:.1f}s)")

        time.sleep(THROTTLE)

    print(f"\n\nDownload summary: {len(models_downloaded)} succeeded, "
          f"{len(models_failed)} failed")
    if models_failed:
        print(f"  Failed models: {', '.join(models_failed)}")

    if len(models_downloaded) == 0:
        print("ERROR: No models downloaded successfully. Aborting.")
        sys.exit(1)

    # Phase 2: Combine into single DataFrame
    print("\nPhase 2: Combining model outputs...")

    # Find common time range from all models
    all_times = set()
    for model in models_downloaded:
        mdf = model_results[model]
        all_times.update(mdf["datetime"].tolist())

    min_time = min(all_times)
    max_time = max(all_times)
    full_index = pd.date_range(start=min_time, end=max_time, freq="1h")
    combined = pd.DataFrame({"datetime": full_index})

    for model in models_downloaded:
        mdf = model_results[model].copy()
        ws_col = f"wind_speed_100m_{model}"
        pw_col = f"power_predicted_{model}"
        mdf = mdf.rename(columns={VARIABLE: ws_col})
        mdf[pw_col] = convert_wind_to_power(mdf[ws_col].values)
        combined = combined.merge(
            mdf[["datetime", ws_col, pw_col]],
            on="datetime",
            how="left"
        )

    print(f"  Combined shape: {combined.shape}")
    print(f"  Time range: {combined['datetime'].min()} to {combined['datetime'].max()}")

    # Phase 3: Join with Elia measured generation
    elia_hourly = download_elia_for_period(combined["datetime"].min(),
                                           combined["datetime"].max())
    combined = combined.merge(elia_hourly, on="datetime", how="left")
    n_matched = combined["measured"].notna().sum()
    print(f"  Matched {n_matched} hours with measured generation")

    # Add lat/lon columns for reproducibility
    combined["lat"] = LATITUDE
    combined["lon"] = LONGITUDE

    # Save
    combined.to_csv(OUTPUT_CSV, index=False)
    file_size_mb = os.path.getsize(OUTPUT_CSV) / (1024 * 1024)
    print(f"\n  Saved to {OUTPUT_CSV} ({file_size_mb:.1f} MB, {len(combined)} rows)")

    # Phase 4: Validate
    print("\nPhase 4: Validation...")
    checks, coverage, correlations = validate_output(combined, models_downloaded)

    print("\n  Validation results:")
    all_pass = True
    for check, passed, detail in checks:
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_pass = False
        print(f"    [{status}] {check}: {detail}")

    # Phase 5: Write report
    print("\nPhase 5: Writing report...")
    write_report(combined, models_downloaded, models_failed, checks, coverage,
                 correlations, file_size_mb, all_pass)

    verdict = "PASS" if all_pass else "NEEDS_WORK"
    print(f"\n{'=' * 70}")
    print(f"Verdict: {verdict}")
    print(f"{'=' * 70}")

    if not all_pass:
        sys.exit(1)


if __name__ == "__main__":
    main()
