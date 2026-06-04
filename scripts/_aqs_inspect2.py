"""Diagnose the 2020 gap at SLC Hawthorne and find continuously-
running SLC PM2.5 monitors."""

from __future__ import annotations

import csv
import io
import shutil
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

URL = "https://aqs.epa.gov/aqsweb/airdata/hourly_88101_{year}.zip"


def get_year(year: int) -> Path:
    cache = Path(f"/tmp/hourly_88101_{year}.zip")
    if cache.exists() and cache.stat().st_size > 1024:
        return cache
    print(f"caching {year}...")
    with urllib.request.urlopen(URL.format(year=year)) as resp, cache.open("wb") as out:
        shutil.copyfileobj(resp, out)
    return cache


def slc_county_summary(year: int) -> dict[str, int]:
    """Count rows per (county, site) within Salt Lake area for one year."""
    p = get_year(year)
    counts: dict[str, int] = defaultdict(int)
    with zipfile.ZipFile(p) as zf:
        with zf.open(zf.namelist()[0]) as fh:
            reader = csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8"))
            for row in reader:
                if row.get("State Code") != "49":
                    continue
                key = f"{row.get('County Code')}-{row.get('Site Num')}"
                counts[key] += 1
    return counts


def main() -> None:
    years = [2019, 2020, 2021, 2022, 2023, 2024]
    by_year: dict[int, dict[str, int]] = {}
    for y in years:
        by_year[y] = slc_county_summary(y)
        print(f"\n[{y}] top 10 Utah PM2.5 sites by row count:")
        sorted_sites = sorted(by_year[y].items(), key=lambda kv: -kv[1])[:10]
        for site, n in sorted_sites:
            marker = " <-- HAWTHORNE" if site == "035-3006" else ""
            print(f"  49-{site}: {n} rows{marker}")

    # Find sites present in every year
    print("\n=== Sites with rows in all six years ===")
    common = set(by_year[years[0]].keys())
    for y in years[1:]:
        common &= set(by_year[y].keys())
    yearly_total: dict[str, int] = {}
    for s in common:
        yearly_total[s] = sum(by_year[y].get(s, 0) for y in years)
    for s, total in sorted(yearly_total.items(), key=lambda kv: -kv[1])[:10]:
        per_year = ", ".join(f"{y}:{by_year[y].get(s, 0)}" for y in years)
        print(f"  49-{s}: total {total} rows  ({per_year})")


if __name__ == "__main__":
    main()
