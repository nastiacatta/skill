"""One-off diagnostic: inspect the AQS 2024 PM2.5 file at SLC Hawthorne.

Cache the zip so we don't redownload during the smoke test fix.
"""

from __future__ import annotations

import csv
import io
import shutil
import urllib.request
import zipfile
from pathlib import Path

URL = "https://aqs.epa.gov/aqsweb/airdata/hourly_88101_2024.zip"
CACHE = Path("/tmp/hourly_88101_2024.zip")


def main() -> None:
    if not CACHE.exists() or CACHE.stat().st_size < 1024:
        print("downloading 2024 zip into cache...")
        with urllib.request.urlopen(URL) as resp, CACHE.open("wb") as out:
            shutil.copyfileobj(resp, out)
    print(f"using cached {CACHE} ({CACHE.stat().st_size / 1024 / 1024:.1f} MB)")

    poc_counts: dict[str, int] = {}
    method_type_counts: dict[tuple[str, str], int] = {}
    sample_rows: list[dict[str, str]] = []
    total_hawthorne = 0

    with zipfile.ZipFile(CACHE) as zf:
        names = zf.namelist()
        with zf.open(names[0]) as fh:
            reader = csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8"))
            for row in reader:
                if (
                    row.get("State Code") == "49"
                    and row.get("County Code") == "035"
                    and row.get("Site Num") == "3006"
                ):
                    total_hawthorne += 1
                    poc = row.get("POC", "")
                    method_type = row.get("Method Type", "")
                    poc_counts[poc] = poc_counts.get(poc, 0) + 1
                    key = (poc, method_type)
                    method_type_counts[key] = method_type_counts.get(key, 0) + 1
                    if len(sample_rows) < 4:
                        sample_rows.append({
                            "POC": poc,
                            "Date GMT": row.get("Date GMT", ""),
                            "Time GMT": row.get("Time GMT", ""),
                            "Sample Measurement": row.get("Sample Measurement", ""),
                            "Method Type": method_type,
                            "Parameter Name": row.get("Parameter Name", ""),
                        })

    print(f"\nTotal rows at SLC Hawthorne: {total_hawthorne}")
    print("\nPOC breakdown:")
    for poc, n in sorted(poc_counts.items()):
        print(f"  POC={poc!r:>5}  rows={n}")
    print("\n(POC, Method Type) breakdown:")
    for key, n in sorted(method_type_counts.items()):
        print(f"  POC={key[0]!r:>5}  Method Type={key[1]!r}  rows={n}")
    print("\nFirst 4 sample rows:")
    for r in sample_rows:
        print(" ", r)


if __name__ == "__main__":
    main()
