"""Fetch EPA AQS hourly PM2.5 for one monitor across one or more years.

Source: https://aqs.epa.gov/aqsweb/airdata/hourly_88101_YYYY.zip
        (parameter 88101 = PM2.5 mass, hourly)
Auth:   none. US Government public-domain data.
Usage:  python3 scripts/fetch_aqs_pm25.py [YYYY ...]
        defaults to 2019..2024 if no years given.

Output: data/aqs_slc_hawthorne_pm25_<first>_<last>.csv
        columns: datetime,value (UTC, ug/m^3)
        sorted by datetime, deduplicated, gap-aware.

Site filter: Salt Lake City Hawthorne — State 49, County 035, Site 3006.
"""

from __future__ import annotations

import csv
import io
import shutil
import sys
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

# Salt Lake City Hawthorne PM2.5 monitor
STATE_CODE = "49"
COUNTY_CODE = "035"
SITE_NUM = "3006"

URL_TEMPLATE = "https://aqs.epa.gov/aqsweb/airdata/hourly_88101_{year}.zip"


def fetch_year(year: int, tmp_dir: Path) -> list[tuple[str, float]]:
    """Download one year, filter to the SLC Hawthorne site, return rows.

    POC selection: at this site, multiple parameter-occurrence-codes
    coexist (e.g. POC 2 has full-year FEM coverage, POC 4 a partial
    FRM cross-check). We pick the POC with the most rows in this
    file to maximise coverage. State explicitly in the chapter that
    we use the canonical FEM monitor.
    """
    url = URL_TEMPLATE.format(year=year)
    print(f"[{year}] downloading {url}")
    t0 = time.time()
    zip_path = tmp_dir / f"hourly_88101_{year}.zip"
    with urllib.request.urlopen(url) as resp, zip_path.open("wb") as out:
        shutil.copyfileobj(resp, out)
    size_mb = zip_path.stat().st_size / 1024 / 1024
    print(f"[{year}] downloaded {size_mb:.1f} MB in {time.time() - t0:.1f}s")

    # First pass: count rows per POC at the target site to pick the
    # canonical POC for this year.
    poc_counts: dict[str, int] = {}
    site_rows: list[dict[str, str]] = []
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        if not names:
            raise RuntimeError(f"empty zip for {year}")
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
        # Soft-fail: the Hawthorne monitor's PM2.5 reporting changed
        # parameter codes in some years (e.g. 2020 reports under 88502
        # rather than 88101). Returning an empty list lets the caller
        # continue with the years that do have data.
        print(f"[{year}] WARNING: no rows at site "
              f"{STATE_CODE}-{COUNTY_CODE}-{SITE_NUM} in {year}; "
              f"skipping this year")
        return []

    canonical_poc = max(poc_counts, key=lambda k: poc_counts[k])
    print(f"[{year}] POC tally at site "
          f"{STATE_CODE}-{COUNTY_CODE}-{SITE_NUM}: {poc_counts}; "
          f"using POC={canonical_poc}")

    rows: list[tuple[str, float]] = []
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
        # AQS uses negative sentinels for invalid readings. PM2.5 has a
        # hard physical floor at zero; small negatives are instrument
        # noise and are kept (some literature winsorises at zero).
        if value < -50.0:
            continue
        rows.append((ts, value))

    # Free the raw zip immediately; we keep only the filtered rows.
    zip_path.unlink()
    print(f"[{year}] {len(rows)} valid hourly rows from POC "
          f"{canonical_poc}")
    return rows


def main(years: list[int]) -> None:
    out_dir = Path("data")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = (
        out_dir / f"aqs_slc_hawthorne_pm25_{years[0]}_{years[-1]}.csv"
    )

    all_rows: list[tuple[str, float]] = []
    with tempfile.TemporaryDirectory(prefix="aqs_") as tmp:
        tmp_dir = Path(tmp)
        for y in years:
            try:
                all_rows.extend(fetch_year(y, tmp_dir))
            except Exception as e:
                print(f"[{y}] FAILED: {e}", file=sys.stderr)
                raise

    # Dedupe and sort. The AQS export sometimes has overlapping
    # entries when a row is corrected; keep the last value.
    seen: dict[str, float] = {}
    for ts, val in all_rows:
        seen[ts] = val
    sorted_rows = sorted(seen.items(), key=lambda kv: kv[0])

    with out_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["datetime", "value"])
        for ts, val in sorted_rows:
            writer.writerow([ts, f"{val:.3f}"])
    print(f"\nwrote {len(sorted_rows)} rows to {out_path}")
    print(f"  size: {out_path.stat().st_size / 1024:.1f} KB")
    if sorted_rows:
        print(f"  range: {sorted_rows[0][0]}  to  {sorted_rows[-1][0]}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        years_arg = [int(a) for a in sys.argv[1:]]
    else:
        years_arg = list(range(2019, 2025))
    main(years_arg)
