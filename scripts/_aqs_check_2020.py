"""Inspect the 2020 AQS zips to see what the SLC Hawthorne site reported.

Uses local /tmp cache if present from earlier runs; otherwise downloads.
"""

from __future__ import annotations

import csv
import io
import shutil
import urllib.request
import zipfile
from pathlib import Path

# State 49 = Utah, County 035 = Salt Lake, Site 3006 = Hawthorne
TARGET = ("49", "035", "3006")

# 88101 = PM2.5 mass, FRM/FEM (the canonical regulatory measurement)
# 88502 = PM2.5 mass, non-FRM/FEM (e.g. real-time nephelometer)
PARAM_CODES = ["88101", "88502"]


def fetch_to_cache(url: str, cache_path: Path) -> None:
    if cache_path.exists() and cache_path.stat().st_size > 1024:
        return
    print(f"downloading {url}")
    with urllib.request.urlopen(url) as resp, cache_path.open("wb") as out:
        shutil.copyfileobj(resp, out)


def inspect_year(year: int, param: str) -> dict:
    url = f"https://aqs.epa.gov/aqsweb/airdata/hourly_{param}_{year}.zip"
    cache = Path(f"/tmp/hourly_{param}_{year}.zip")
    try:
        fetch_to_cache(url, cache)
    except Exception as e:
        return {"year": year, "param": param, "error": str(e)}

    n_target = 0
    pocs = {}
    with zipfile.ZipFile(cache) as zf:
        names = zf.namelist()
        with zf.open(names[0]) as fh:
            reader = csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8"))
            for row in reader:
                if (
                    row.get("State Code") == TARGET[0]
                    and row.get("County Code") == TARGET[1]
                    and row.get("Site Num") == TARGET[2]
                ):
                    n_target += 1
                    poc = row.get("POC", "")
                    pocs[poc] = pocs.get(poc, 0) + 1
    return {"year": year, "param": param, "rows": n_target, "pocs": pocs}


def main() -> None:
    for year in [2020, 2021, 2022, 2023, 2024]:
        for param in PARAM_CODES:
            r = inspect_year(year, param)
            if "error" in r:
                print(f"  {year} param={param}: ERROR {r['error']}")
            else:
                print(
                    f"  {year} param={param}: {r['rows']} rows at "
                    f"49-035-3006, POC tally {r['pocs']}"
                )


if __name__ == "__main__":
    main()
