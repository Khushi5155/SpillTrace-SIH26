# data/etl/inspect_cell_time_distribution.py
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
PARQUET_PATH = BASE_DIR / "data" / "ais" / "cleaned" / "ais_sample_10000_cleaned.parquet"

df = pd.read_parquet(PARQUET_PATH)
df["observed_at"] = pd.to_datetime(df["observed_at"], utc=True)

# Filter to the densest 1° cell: lon_cell=-91, lat_cell=29
df_cell = df[
    (df["longitude"] >= -92) & (df["longitude"] < -90) &
    (df["latitude"]  >=  29) & (df["latitude"]  <  30)
].copy()

print("Cell (-91, 29) rows:", len(df_cell))
if len(df_cell) == 0:
    print("No data in this cell; something is off.")
else:
    print("Time range in this cell:")
    print(df_cell["observed_at"].min(), "to", df_cell["observed_at"].max())

    # Hour-of-day distribution (UTC)
    df_cell["hour_utc"] = df_cell["observed_at"].dt.hour
    hour_counts = df_cell.groupby("hour_utc").size()
    print("\nPositions per UTC hour in this cell:")
    print(hour_counts)