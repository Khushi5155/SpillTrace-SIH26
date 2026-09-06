# data/etl/build_phase3_ais_filter_and_audit.py
import json
from pathlib import Path
import pandas as pd
import numpy as np
from shapely.geometry import Point, shape

BASE_DIR = Path(__file__).resolve().parents[2]

# Inputs
AIS_PARQUET = BASE_DIR / "data" / "ais" / "cleaned" / "ais_sample_10000_cleaned.parquet"

TEST_FIXTURE_ID = "SPILL_TEST_FIXTURE_AIS_003"

CORRIDOR_GEOJSON = (
    BASE_DIR
    / "ml"
    / "test_fixture_outputs"
    / TEST_FIXTURE_ID
    / "origin_corridor.geojson"
)

SLICK_GEOJSON = (
    BASE_DIR
    / "ml"
    / "test_fixture_outputs"
    / TEST_FIXTURE_ID
    / "slick_geometry.geojson"
)

# Outputs
FILTERED_AIS_PARQUET = (
    BASE_DIR
    / "data"
    / "ais"
    / "cleaned"
    / "ais_phase3_fixture_003.parquet"
)
FILTER_REPORT = (
    BASE_DIR
    / "data"
    / "ais"
    / "reports"
    / "phase3_filtering_report_SPILL_TEST_FIXTURE_AIS_003.json"
)
AUDIT_REPORT = (
    BASE_DIR
    / "data"
    / "ais"
    / "reports"
    / "phase3_candidate_input_audit_SPILL_TEST_FIXTURE_AIS_003.json"
)


# -------------------------
# USER-CONFIGURABLE SECTION
# -------------------------

# Time window (must be within global AIS coverage)
TIME_START = "2025-01-08T00:00:00+00:00"
TIME_END = "2025-01-08T00:10:00+00:00"

# Spatial filter: use a simple box around the slick centroid with some margin
# You can tighten this later if needed.
SLICK_CENTER_LON = -90.480124
SLICK_CENTER_LAT = 29.699723
LON_MARGIN_DEG = 1.5
LAT_MARGIN_DEG = 1.5

LON_MIN = SLICK_CENTER_LON - LON_MARGIN_DEG
LON_MAX = SLICK_CENTER_LON + LON_MARGIN_DEG
LAT_MIN = SLICK_CENTER_LAT - LAT_MARGIN_DEG
LAT_MAX = SLICK_CENTER_LAT + LAT_MARGIN_DEG

# -------------------------
# END USER-CONFIGURABLE
# -------------------------


def load_geojson_bounds(path: Path):
    # Return lon/lat bounds of all features in the GeoJSON
    with open(path, "r", encoding="utf-8") as f:
        gj = json.load(f)

    lons = []
    lats = []
    for feat in gj.get("features", []):
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        if geom.get("type") == "Polygon":
            for ring in coords:
                for lon, lat in ring:
                    lons.append(lon)
                    lats.append(lat)
        elif geom.get("type") == "MultiPolygon":
            for poly in coords:
                for ring in poly:
                    for lon, lat in ring:
                        lons.append(lon)
                        lats.append(lat)

    if not lons or not lats:
        return None
    return {
        "lon_min": min(lons),
        "lon_max": max(lons),
        "lat_min": min(lats),
        "lat_max": max(lats),
    }


def load_first_polygon(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    features = geojson.get("features", [])
    if not features:
        raise ValueError(f"No features found in GeoJSON: {path}")

    geometry = features[0].get("geometry")
    if not geometry:
        raise ValueError(f"Feature has no geometry: {path}")

    polygon = shape(geometry)

    if polygon.geom_type not in {"Polygon", "MultiPolygon"}:
        raise ValueError(
            f"Expected Polygon or MultiPolygon, got {polygon.geom_type}: {path}"
        )

    if not polygon.is_valid:
        raise ValueError(f"Invalid geometry in: {path}")

    return polygon


def main():
    df = pd.read_parquet(AIS_PARQUET)
    df["observed_at"] = pd.to_datetime(df["observed_at"], utc=True)
    corridor_bounds = load_geojson_bounds(CORRIDOR_GEOJSON)
    slick_bounds = load_geojson_bounds(SLICK_GEOJSON)

    if corridor_bounds is None:
        raise ValueError(f"Could not read corridor bounds from: {CORRIDOR_GEOJSON}")

    if slick_bounds is None:
        raise ValueError(f"Could not read slick bounds from: {SLICK_GEOJSON}")

    print("Corridor bounds:", corridor_bounds)
    print("Slick bounds:", slick_bounds)

    # Time filter
    t0 = pd.to_datetime(TIME_START, utc=True)
    t1 = pd.to_datetime(TIME_END, utc=True)

    mask_time = (df["observed_at"] >= t0) & (df["observed_at"] <= t1)
    df_t = df.loc[mask_time].copy()

    # Spatial filter: actual Phase 2 origin corridor polygon.
    # GeoJSON/Shapely coordinate order is (longitude, latitude).
    # `covers` includes AIS points that lie exactly on the corridor boundary.
    corridor_polygon = load_first_polygon(CORRIDOR_GEOJSON)
    corridor_bounds = load_geojson_bounds(CORRIDOR_GEOJSON)

    if corridor_bounds is None:
        raise ValueError(f"Could not calculate bounds for corridor: {CORRIDOR_GEOJSON}")

    corridor_match_mask = df_t.apply(
        lambda row: corridor_polygon.covers(
            Point(float(row["longitude"]), float(row["latitude"]))
        ),
        axis=1,
    )

    df_filt = df_t.loc[corridor_match_mask].copy()
    if df_filt.empty:
        print(
            "RESULT: No real AIS positions intersect the supplied "
            "test-fixture corridor during the declared origin window."
        )
        print(
            "STATUS: Allowed TEST_FIXTURE with zero matched AIS. "
            "No candidates will be created or persisted."
        )
    else:
        print(
            f"RESULT: {len(df_filt)} real AIS positions from "
            f"{df_filt['mmsi'].nunique()} unique MMSIs intersect the corridor."
        )

    # Basic filtering stats
    total_rows = len(df)
    total_unique_mmsi = int(df["mmsi"].nunique())

    filtered_rows = len(df_filt)
    filtered_unique_mmsi = int(df_filt["mmsi"].nunique()) if filtered_rows > 0 else 0

    if filtered_rows > 0:
        actual_lon_min = float(df_filt["longitude"].min())
        actual_lon_max = float(df_filt["longitude"].max())
        actual_lat_min = float(df_filt["latitude"].min())
        actual_lat_max = float(df_filt["latitude"].max())
        actual_time_min = df_filt["observed_at"].min().isoformat()
        actual_time_max = df_filt["observed_at"].max().isoformat()
    else:
        actual_lon_min = actual_lon_max = actual_lat_min = actual_lat_max = None
        actual_time_min = actual_time_max = None

    # Save filtered AIS Parquet
    FILTERED_AIS_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    df_filt.to_parquet(FILTERED_AIS_PARQUET, index=False)

    # Filtering report
    filter_report = {
        "test_fixture_id": TEST_FIXTURE_ID,
        "artifact_provenance": {
            "drift_metadata_path": str(
                BASE_DIR
                / "ml"
                / "test_fixture_outputs"
                / TEST_FIXTURE_ID
                / "drift_metadata.json"
            ),
            "corridor_geojson_path": str(CORRIDOR_GEOJSON),
            "slick_geojson_path": str(SLICK_GEOJSON),
            "data_mode": "TEST_FIXTURE",
            "scenario_type": "Analyst Parameter-Driven Scenario Simulation",
            "timestamp_verification": False,
        },
        "input_ais_source": str(AIS_PARQUET),
        "time_window": {
            "configured_start": TIME_START,
            "configured_end": TIME_END,
            "actual_start": actual_time_min,
            "actual_end": actual_time_max,
        },
        "spatial_window": {
            "filter_method": "GeoJSON Polygon covers(Point(longitude, latitude))",
            "corridor_geojson": str(CORRIDOR_GEOJSON),
            "coordinate_order": "[longitude, latitude]",
            "crs": "EPSG:4326",
            "boundary_policy": "included_via_covers",
            "corridor_lon_range": [
                corridor_bounds["lon_min"],
                corridor_bounds["lon_max"],
            ],
            "corridor_lat_range": [
                corridor_bounds["lat_min"],
                corridor_bounds["lat_max"],
            ],
            "actual_lon_range": [actual_lon_min, actual_lon_max],
            "actual_lat_range": [actual_lat_min, actual_lat_max],
        },
        "counts": {
            "input_rows": total_rows,
            "input_unique_mmsi": total_unique_mmsi,
            "filtered_rows": filtered_rows,
            "filtered_unique_mmsi": filtered_unique_mmsi,
        },
        "phase_3_status": {
            "candidate_persistence": "NOT_PERSISTED",
            "persistence_hold_reason": (
                "Phase 3 filtering and audit only; "
                "Phase 4 backend compatibility approval is required before persistence."
            ),
            "candidate_ranking_attempted": False,
            "result_state": (
                "allowed_test_fixture_zero_matching_ais"
                if filtered_rows == 0
                else "real_ais_corridor_matches_available_for_phase_4_review"
            ),
        },
        "notes": [
            "Filtered AIS uses only real records from the cleaned Parquet.",
            "No synthetic AIS positions, MMSIs, scores, or candidate rows are introduced.",
            "Spatial filtering uses the supplied Phase 2 origin_corridor.geojson polygon in EPSG:4326.",
            "The corridor intersection result is data-driven; zero matched AIS is a valid result.",
            "Candidate persistence and ranking are prohibited in Phase 3 pending Phase 4 backend approval.",
            "Original SPILL_TEST3_001 remains unchanged, incompatible, and blocked with HTTP 409.",
        ],
    }

    FILTER_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(FILTER_REPORT, "w", encoding="utf-8") as f:
        json.dump(filter_report, f, indent=2)

    # Candidate-input audit (per MMSI)
    audit_rows = []
    if filtered_rows > 0:
        grouped = df_filt.groupby("mmsi")
        for mmsi, g in grouped:
            g = g.sort_values("observed_at")
            times = g["observed_at"].values
            n_pos = len(g)

            if n_pos > 1:
                deltas = np.diff(times.astype("datetime64[s]").astype(np.int64))
                max_gap_sec = float(np.max(deltas))
                mean_gap_sec = float(np.mean(deltas))
                first_t = g["observed_at"].iloc[0].isoformat()
                last_t = g["observed_at"].iloc[-1].isoformat()
            else:
                max_gap_sec = None
                mean_gap_sec = None
                first_t = last_t = g["observed_at"].iloc[0].isoformat()

            # Simple continuity heuristic:
            # If max gap <= 5 minutes, call it "continuous_enough", else "fragmented"
            if max_gap_sec is not None and max_gap_sec <= 300:
                continuity_status = "continuous_enough"
            else:
                continuity_status = "fragmented_or_single"

            audit_rows.append(
                {
                    "mmsi": int(mmsi),
                    "positions_in_window": n_pos,
                    "first_observed_at": first_t,
                    "last_observed_at": last_t,
                    "max_gap_seconds": max_gap_sec,
                    "mean_gap_seconds": mean_gap_sec,
                    "continuity_status": continuity_status,
                    "data_quality_status": "real_ais_test_fixture",
                    "lineage_id": f"{TEST_FIXTURE_ID}_ais_subset_v1",
                }
            )

    audit_report = {
        "test_fixture_id": TEST_FIXTURE_ID,
        "filtered_ais_source": str(FILTERED_AIS_PARQUET),
        "total_mmsi_in_window": filtered_unique_mmsi,
        "per_mmsi_audit": audit_rows,
        "notes": [
            "Audit computed from real AIS only.",
            "No synthetic records or fabricated gaps.",
            "Continuity status is a simple heuristic for test-fixture use.",
        ],
    }

    AUDIT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(AUDIT_REPORT, "w", encoding="utf-8") as f:
        json.dump(audit_report, f, indent=2)

    print(f"Filtered AIS rows: {filtered_rows}, unique MMSIs: {filtered_unique_mmsi}")
    print(f"Filtered Parquet: {FILTERED_AIS_PARQUET}")
    print(f"Filter report:    {FILTER_REPORT}")
    print(f"Audit report:     {AUDIT_REPORT}")


if __name__ == "__main__":
    main()
