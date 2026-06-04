"""Download offshore wind forecast + measured data from Elia Open Data Portal (2024-2025).

The API caps offset at 10,000, so we chunk by month to stay under that limit
(~2,976 records/month at 15-min resolution).
"""
import requests
import pandas as pd
import time

BASE = "https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods031/records"
LIMIT = 100

all_rows = []

for year in [2024, 2025]:
    for month in range(1, 13):
        offset = 0
        month_label = f"{year}-{month:02d}"
        while True:
            params = {
                "limit": LIMIT,
                "offset": offset,
                "timezone": "Europe/Brussels",
                "refine": [
                    'offshoreonshore:"Offshore"',
                    f'datetime:"{year}/{month:02d}"',
                ],
                "order_by": "datetime",
            }
            r = requests.get(BASE, params=params)
            if r.status_code == 400:
                break
            r.raise_for_status()
            data = r.json()
            results = data.get("results", [])
            if not results:
                break
            all_rows.extend(results)
            offset += len(results)
            time.sleep(0.03)
        total_month = offset
        print(f"  {month_label}: {total_month} records  (running total: {len(all_rows)})")

df = pd.DataFrame(all_rows)
df.to_csv("data/elia_offshore_wind_2024_2025.csv", index=False)
print(f"\nDone — {len(df)} rows saved to data/elia_offshore_wind_2024_2025.csv")
print(f"Date range: {df['datetime'].min()} → {df['datetime'].max()}")
print(f"Columns: {list(df.columns)}")
