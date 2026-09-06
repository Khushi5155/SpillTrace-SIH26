# data/etl/inspect_ais_global_bounds.py
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
PARQUET_PATH = BASE_DIR / "data" / "ais" / "cleaned" / "ais_sample_10000_cleaned.parquet"

df = pd.read_parquet(PARQUET_PATH)
df["observed_at"] = pd.to_datetime(df["observed_at"], utc=True)

print("Rows:", len(df))
print("Unique MMSIs:", df["mmsi"].nunique())
print("Time range:", df["observed_at"].min(), "to", df["observed_at"].max())
print("Longitude range:", df["longitude"].min(), "to", df["longitude"].max())
print("Latitude range:", df["latitude"].min(), "to", df["latitude"].max())