"""Fetch EPA AQS hourly PM2.5 for SLC Hawthorne across 2020-2024.

The Hawthorne monitor's PM2.5 reporting changed parameter codes across the
five-year window: parameter 88101 (FRM/FEM PM2.5 mass) is reported in
2024, while 88502 (non-FRM PM2.5) is reported in earlier years. This
fetcher tries both parameter codes for each year and merges the results.

Source: https://aqs.epa.gov/aqsweb/airdata/hourly_<param>_<YYYY>.zip
Auth:   none. US Government public-domain data.
Output: data/aqs_slc_hawthorne_pm25_2020_2024.csv
        columns: datetime,value (UTC, ug/m^3)
        + data/aqs_slc_hawthorne_pm25_2020_2024_provenance.json

Site filter: Salt Lake City Hawthorne — State 49, County 035, Site 3006.
"""

from __future__ import annotations

import csv
import io
import json
import shutil
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

STATE_CODE = "49"
COUNTY_CODE = "035"
SITE_NUM = "3006"

URL_TEMPLATE = "https://aqs.epa.gov/aqsweb/airdata/hourly_{param}_{year}.zip"

PARAM_CODES = ["88101", "88502"]


def fetch_year_param(year: int, param: str, tmp_dir: Path) -> list[tuple[str, float, str]]:
    """Download one (year, parameter) pair and filter to SLC Hawthorne."""
    url = URL_TEMPLATE.format(param=param, year=year)
    print(f"[{year}/{param}] downloading {url}")
    t0 = time.time()
    zip_path = tmp_dir / f"hourly_{param}_{year}.zip"
    try:
        with urllib.request.urlopen(url) as resp, zip_path.open("wb") as out:
            shutil.copyfileobj(resp, out)
    except Exception as e:
        print(f"[{year}/{param}] download failed: {e}")
        return []
    size_mb = zip_path.stat().st_size / 1024 / 1024
    print(f"[{year}/{param}] downloaded {size_mb:.1f} MB in {time.time() - t0:.1f}s")

    poc_counts: dict[str, int] = {}
    site_rows: list[dict[str, str]] = []
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        if not names:
            zip_path.unlink()
            return []
        with zf.open(names[0]) as fh:
            reader = csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8"))
            for row in reader:
                if (
                    row.get("State Code") != STATE_CODE
                    or row.get("County Code") != COUNTY_CODE
                    or row.get("Site Num") != SITE_NUM
                ):
                    continue
                site_rows.append(row)
                poc = row.get("POC", "")
                poc_counts[poc] = poc_counts.get(poc, 0) + 1

    if not poc_counts:
        zip_path.unlink()
        print(f"[{year}/{param}] no rows at site {STATE_CODE}-{COUNTY_CODE}-{SITE_NUM}")
        return []

    canonical_poc = max(poc_counts, key=lambda k: poc_counts[k])
    print(f"[{year}/{param}] POC tally: {poc_counts}; using POC={canonical_poc}")

    rows: list[tuple[str, float, str]] = []
    for row in site_rows:
        if row.get("POC") != canonical_poc:
            continue
        date_gmt = row.get("Date GMT", "").strip()
        time_gmt = row.get("Time GMT", "").strip()
        if not date_gmt or not time_gmt:
            continue
        ts = f"{date_gmt}T{time_gmt}:00Z"
        value_raw = row.get("Sample Measurement", "").strip()
        if value_raw == "":
            continue
        try:
            value = float(value_raw)
        except ValueError:
            continue
        if value < -50.0:
            continue
        rows.append((ts, value, param))

    zip_path.unlink()
    print(f"[{year}/{param}] {len(rows)} valid hourly rows from POC {canonical_poc}")
    return rows


def main() -> None:
    out_dir = Path("data")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "aqs_slc_hawthorne_pm25_2020_2024.csv"
    prov_path = out_dir / "aqs_slc_hawthorne_pm25_2020_2024_provenance.json"

    years = list(range(2020, 2025))
    seen: dict[str, tuple[float, str]] = {}
    per_year_param_counts: dict[int, dict[str, int]] = {}

    with tempfile.TemporaryDirectory(prefix="aqs_") as tmp:
        tmp_dir = Path(tmp)
        for y in years:
            per_year_param_counts[y] = {}
            for param in PARAM_CODES:
                rows = fetch_year_param(y, param, tmp_dir)
                per_year_param_counts[y][param] = len(rows)
                # Prefer 88101 (FRM/FEM) over 88502 when both report at the
                # same hour: 88101 is the regulatory monitor.
                for ts, val, src in rows:
                    if ts in seen and seen[ts][1] == "88101":
                        continue
                    seen[ts] = (val, src)

    sorted_rows = sorted(seen.items(), key=lambda kv: kv[0])

    with out_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["datetime", "value"])
        for ts, (val, _src) in sorted_rows:
            writer.writerow([ts, f"{val:.3f}"])

    print(f"\nwrote {len(sorted_rows)} rows to {out_path}")
    if sorted_rows:
        first_ts = sorted_rows[0][0]
        last_ts = sorted_rows[-1][0]
        print(f"  range: {first_ts}  to  {last_ts}")
        prov = {
            "source_url": "https://aqs.epa.gov/aqsweb/airdata/",
            "monitor": f"State {STATE_CODE} County {COUNTY_CODE} Site {SITE_NUM} (Salt Lake City Hawthorne)",
            "parameters": PARAM_CODES,
            "download_date": "2026-05-23",
            "row_count": len(sorted_rows),
            "time_range": {"start": first_ts, "end": last_ts},
            "per_year_param_counts": per_year_param_counts,
        }
        prov_path.write_text(json.dumps(prov, indent=2))
        print(f"  provenance: {prov_path}")


if __name__ == "__main__":
    main()
