# data/etl/build_phase1_ais_coverage.py
import json
from pathlib import Path
import pandas as pd
import numpy as np

# Paths (adjust if your repo layout differs)
BASE_DIR = Path(__file__).resolve().parents[2]  # repo root
PARQUET_PATH = BASE_DIR / "data" / "ais" / "cleaned" / "ais_sample_10000_cleaned.parquet"
OUTPUT_REPORT = BASE_DIR / "data" / "ais" / "reports" / "phase1_ais_coverage_report.json"

# -------------------------
# USER-CONFIGURABLE SECTION
# -------------------------

# Define a region of interest (ROI) in decimal degrees
# Example: a box around a busy shipping area (you can change these)
ROI_LON_MIN = -92.0
ROI_LON_MAX = -90.0
ROI_LAT_MIN = 28.0
ROI_LAT_MAX = 30.0

# Define a time window within the AIS coverage
# Based on your known coverage: 2025-01-08T00:00:00Z to 2025-01-08T18:49:10Z
# We'll choose a 6-hour window to start; you can tighten later.
TIME_WINDOW_START = "2025-01-08T00:00:00+00:00"
TIME_WINDOW_END   = "2025-01-08T00:10:00+00:00"

# Optional: name your test-fixture scenario
TEST_FIXTURE_ID = "SPILL_TEST_FIXTURE_AIS_001"

# -------------------------
# END USER-CONFIGURABLE
# -------------------------

def main():
    df = pd.read_parquet(PARQUET_PATH)

    # Ensure timestamp type
    df["observed_at"] = pd.to_datetime(df["observed_at"], utc=True)

    # Global bounds
    global_lon_min = float(df["longitude"].min())
    global_lon_max = float(df["longitude"].max())
    global_lat_min = float(df["latitude"].min())
    global_lat_max = float(df["latitude"].max())
    global_time_min = df["observed_at"].min().isoformat()
    global_time_max = df["observed_at"].max().isoformat()
    global_rows = len(df)
    global_unique_mmsi = int(df["mmsi"].nunique())

    # Filter by ROI and time window
    time_start = pd.to_datetime(TIME_WINDOW_START, utc=True)
    time_end   = pd.to_datetime(TIME_WINDOW_END,   utc=True)

    mask = (
        (df["longitude"] >= ROI_LON_MIN) &
        (df["longitude"] <= ROI_LON_MAX) &
        (df["latitude"]  >= ROI_LAT_MIN) &
        (df["latitude"]  <= ROI_LAT_MAX) &
        (df["observed_at"] >= time_start) &
        (df["observed_at"] <= time_end)
    )

    df_roi = df.loc[mask].copy()

    roi_rows = len(df_roi)
    roi_unique_mmsi = int(df_roi["mmsi"].nunique()) if roi_rows > 0 else 0

    if roi_rows > 0:
        roi_lon_min = float(df_roi["longitude"].min())
        roi_lon_max = float(df_roi["longitude"].max())
        roi_lat_min = float(df_roi["latitude"].min())
        roi_lat_max = float(df_roi["latitude"].max())
        roi_time_min = df_roi["observed_at"].min().isoformat()
        roi_time_max = df_roi["observed_at"].max().isoformat()
    else:
        roi_lon_min = roi_lon_max = roi_lat_min = roi_lat_max = None
        roi_time_min = roi_time_max = None

    # Simple corridor criteria for Mayank (centroid + radius hint)
    if roi_rows > 0:
        center_lon = float(df_roi["longitude"].mean())
        center_lat = float(df_roi["latitude"].mean())
        # Rough "radius" in degrees (max half-extent)
        radius_deg_lon = max((roi_lon_max - roi_lon_min) / 2, 0.0)
        radius_deg_lat = max((roi_lat_max - roi_lat_min) / 2, 0.0)
    else:
        center_lon = center_lat = radius_deg_lon = radius_deg_lat = None

    report = {
        "test_fixture_id": TEST_FIXTURE_ID,
        "data_source": str(PARQUET_PATH),
        "global_bounds": {
            "rows": global_rows,
            "unique_mmsi": global_unique_mmsi,
            "longitude_range": [global_lon_min, global_lon_max],
            "latitude_range":  [global_lat_min, global_lat_max],
            "time_range": [global_time_min, global_time_max]
        },
        "selected_roi_and_time": {
            "roi_lon_range": [ROI_LON_MIN, ROI_LON_MAX],
            "roi_lat_range": [ROI_LAT_MIN, ROI_LAT_MAX],
            "time_window_start": TIME_WINDOW_START,
            "time_window_end": TIME_WINDOW_END,
            "rows_in_roi_time": roi_rows,
            "unique_mmsi_in_roi_time": roi_unique_mmsi,
            "actual_lon_range": [roi_lon_min, roi_lon_max],
            "actual_lat_range":  [roi_lat_min, roi_lat_max],
            "actual_time_range": [roi_time_min, roi_time_max]
        },
        "suggested_corridor_criteria_for_mayank": {
            "center_lon": center_lon,
            "center_lat": center_lat,
            "approx_radius_deg_lon": radius_deg_lon,
            "approx_radius_deg_lat": radius_deg_lat,
            "note": "These are data-driven hints only. Mayank will define the actual slick centroid, drift direction, and corridor width for the test-fixture scenario."
        },
        "notes": [
            "This report uses only real AIS records from the cleaned Parquet (Day 2 ETL).",
            "No synthetic AIS positions, MMSIs, or candidates are introduced.",
            "The selected ROI+time window is intended for a TEST_FIXTURE scenario aligned with real AIS coverage.",
            "Original SPILL_TEST3_001 remains untouched and must stay blocked with HTTP 409."
        ]
    }

    OUTPUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Phase 1 coverage report written to: {OUTPUT_REPORT}")
    print(f"ROI+time window rows: {roi_rows}, unique MMSIs: {roi_unique_mmsi}")

if __name__ == "__main__":
    main()