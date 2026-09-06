# data/etl/find_dense_ais_cells.py
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
PARQUET_PATH = BASE_DIR / "data" / "ais" / "cleaned" / "ais_sample_10000_cleaned.parquet"

df = pd.read_parquet(PARQUET_PATH)
df["observed_at"] = pd.to_datetime(df["observed_at"], utc=True)

# Create 1° grid cells
df["lon_cell"] = (df["longitude"] // 1).astype(int)
df["lat_cell"] = (df["latitude"]  // 1).astype(int)

cell_counts = (
    df.groupby(["lon_cell", "lat_cell"])
      .size()
      .reset_index(name="count")
      .sort_values("count", ascending=False)
)

print("Top 10 densest 1°x1° cells (lon_cell, lat_cell, count):")
print(cell_counts.head(10).to_string(index=False))