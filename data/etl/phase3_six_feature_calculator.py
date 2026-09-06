from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from shapely.geometry import LineString, Point, shape


# Ensure project root is on sys.path before importing data.*
BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


from data.scoring.phase3_features import validate_phase3_features


AIS_PARQUET = BASE_DIR / "data" / "ais" / "cleaned" / "ais_phase3_fixture_003.parquet"
DRIFT_META = BASE_DIR / "ml" / "test_fixture_outputs" / "SPILL_TEST_FIXTURE_AIS_003" / "drift_metadata.json"
CORRIDOR_GEOJSON = BASE_DIR / "ml" / "test_fixture_outputs" / "SPILL_TEST_FIXTURE_AIS_003" / "origin_corridor.geojson"
OUTPUT_REPORT = BASE_DIR / "data" / "ais" / "reports" / "phase3_six_feature_scores_SPILL_TEST_FIXTURE_AIS_003.json"

# Fixed paths for lineage in the report
SOURCE_FILE = "data/ais/ais_sample_10000.csv"
CLEANED_PARQUET_PATH = "data/ais/cleaned/ais_sample_10000_cleaned.parquet"
DRIFT_METADATA_PATH = "ml/test_fixture_outputs/SPILL_TEST_FIXTURE_AIS_003/drift_metadata.json"
ORIGIN_CORRIDOR_PATH = "ml/test_fixture_outputs/SPILL_TEST_FIXTURE_AIS_003/origin_corridor.geojson"

DATA_MODE = "TEST_FIXTURE"
SCENARIO_LABEL = "Analyst Parameter-Driven Scenario Simulation"
TIMESTAMP_SOURCE_VERIFIED = False
REAL_WORLD_ATTRIBUTION_CLAIM_ALLOWED = False
SCORING_VERSION = "v1.0"

# Expected AIS reporting interval for completeness (Phase 3 rule)
EXPECTED_AIS_INTERVAL_SEC = 30.0


def haversine_meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    R = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def load_corridor_polygon(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        gj = json.load(f)
    features = gj.get("features", [])
    if not features:
        raise ValueError(f"No features in corridor GeoJSON: {path}")
    geom = features[0].get("geometry")
    if not geom:
        raise ValueError(f"Feature has no geometry: {path}")
    return shape(geom)


def min_angle_diff(a: float, b: float) -> float:
    """Return minimum angular difference in [0, 180] between two headings in degrees."""
    diff = abs((a - b + 180.0) % 360.0 - 180.0)
    return min(diff, 360.0 - diff)


def compute_spatial_proximity(lon_lats: list[tuple[float, float]], origin_lon: float, origin_lat: float) -> float:
    if not lon_lats:
        return 0.0
    distances = [haversine_meters(lon, lat, origin_lon, origin_lat) for lon, lat in lon_lats]
    d_min = min(distances)
    return float(max(0.0, 1.0 - d_min / 20_000.0))


def compute_temporal_overlap(
    track_start: pd.Timestamp,
    track_end: pd.Timestamp,
    window_start: pd.Timestamp,
    window_end: pd.Timestamp,
) -> float:
    overlap_start = max(track_start, window_start)
    overlap_end = min(track_end, window_end)
    if overlap_end <= overlap_start:
        return 0.0
    overlap_sec = (overlap_end - overlap_start).total_seconds()
    window_sec = (window_end - window_start).total_seconds()
    if window_sec <= 0:
        return 0.0
    return float(min(1.0, overlap_sec / window_sec))


def compute_heading_compatibility(cog_values: np.ndarray) -> tuple[float, str, list[str]]:
    """
    Returns (score, availability, limitations).
    - If no non-null COG: score=0.0, availability='unavailable_no_cog', limitations explain.
    - Else: compute compatibility against ref_dir=90° (current_dir_to_deg).
    """
    ref_dir = 90.0
    if len(cog_values) == 0:
        limitations = [
            "No non-null COG values available for this MMSI in the origin window.",
            "Heading compatibility set to 0.0 as a lower bound; real compatibility is unknown."
        ]
        return 0.0, "unavailable_no_cog", limitations

    diffs = np.abs(((cog_values - ref_dir + 180.0) % 360.0) - 180.0)
    diffs = np.minimum(diffs, 360.0 - diffs)
    compat = 1.0 - diffs / 180.0
    score = float(np.mean(compat))
    score = float(max(0.0, min(1.0, score)))
    return score, "available_from_real_cog", []


def compute_route_intersection(lon_lats: list[tuple[float, float]], corridor_polygon) -> float:
    if len(lon_lats) < 2:
        return 0.0
    route_line = LineString(lon_lats)
    return 1.0 if route_line.intersects(corridor_polygon) else 0.0


def compute_track_continuity(max_gap_seconds: float) -> float:
    """Frozen semantics: 1 / (1 + max_gap_sec / 300)."""
    if max_gap_seconds is None or max_gap_seconds <= 0:
        return 1.0
    return float(1.0 / (1.0 + max_gap_seconds / 300.0))


def compute_ais_completeness(position_count: int, track_sec: float) -> float:
    """
    Phase 3 rule:
      expected_interval_sec = 30
      expected_count = max(2, ceil(track_sec / expected_interval_sec))
      ais_completeness = min(1.0, position_count / expected_count)
    """
    if track_sec <= 0:
        return 1.0
    expected_count = max(2, math.ceil(track_sec / EXPECTED_AIS_INTERVAL_SEC))
    if expected_count <= 0:
        return 1.0
    score = position_count / expected_count
    return float(min(1.0, max(0.0, score)))


def main():
    df = pd.read_parquet(AIS_PARQUET)
    df["observed_at"] = pd.to_datetime(df["observed_at"], utc=True)

    with open(DRIFT_META, "r", encoding="utf-8") as f:
        drift = json.load(f)

    origin_lon, origin_lat = drift["estimated_origin_centroid"]
    window_start = pd.to_datetime(drift["origin_window_start_utc"], utc=True)
    window_end = pd.to_datetime(drift["origin_window_end_utc"], utc=True)

    corridor_polygon = load_corridor_polygon(CORRIDOR_GEOJSON)

    grouped = df.sort_values(["mmsi", "observed_at"]).groupby("mmsi")

    per_mmsi_rows = []
    complete_feature_records = 0
    excluded_by_reason: dict[str, int] = {}

    for mmsi, g in grouped:
        g = g.reset_index(drop=True)
        position_count = len(g)

        if position_count < 2:
            excluded_by_reason["single_point_mmsi"] = excluded_by_reason.get("single_point_mmsi", 0) + 1
            continue

        lon_lats = list(zip(g["longitude"], g["latitude"]))
        times = g["observed_at"]
        track_start = times.min()
        track_end = times.max()
        track_sec = (track_end - track_start).total_seconds()

        gaps_sec = times.diff().dt.total_seconds().dropna()
        max_gap_sec = float(gaps_sec.max()) if len(gaps_sec) > 0 else 0.0

        # 1. Spatial proximity
        spatial = compute_spatial_proximity(lon_lats, origin_lon, origin_lat)

        # 2. Temporal overlap
        temporal = compute_temporal_overlap(track_start, track_end, window_start, window_end)

        # 3. Heading compatibility
        cog_vals = g["cog_degrees"].dropna().to_numpy()
        heading_score, heading_avail, heading_limits = compute_heading_compatibility(cog_vals)

        # 4. Route intersection
        route_score = compute_route_intersection(lon_lats, corridor_polygon)

        # 5. Track continuity
        continuity = compute_track_continuity(max_gap_sec)

        # 6. AIS completeness
        completeness = compute_ais_completeness(position_count, track_sec)

        # Validate via frozen wrapper
        score_dict = validate_phase3_features(
            spatial_proximity_score=spatial,
            temporal_overlap_score=temporal,
            heading_compatibility_score=heading_score,
            route_intersection_score=route_score,
            track_continuity_score=continuity,
            ais_completeness=completeness,
            uncertainty_score=None,
            scoring_version=SCORING_VERSION,
        )

        # Feature availability and limitations
        feature_availability = {
            "spatial_proximity_score": "available_from_real_positions",
            "temporal_overlap_score": "available_from_real_timestamps",
            "heading_compatibility_score": heading_avail,
            "route_intersection_score": "available_from_real_track_segment",
            "track_continuity_score": "available_from_real_gaps",
            "ais_completeness": "available_from_real_positions_and_times",
        }

        feature_limitations = []
        if heading_limits:
            feature_limitations.extend(heading_limits)
        if max_gap_sec > 300:
            feature_limitations.append(
                f"Large maximum gap ({max_gap_sec:.1f}s) may reduce continuity reliability."
            )
        if completeness < 1.0:
            feature_limitations.append(
                f"AIS completeness below 1.0 ({completeness:.3f}) indicates sparse reporting relative to expected 30s interval."
            )

        if all(v in (
            "available_from_real_positions",
            "available_from_real_timestamps",
            "available_from_real_track_segment",
            "available_from_real_gaps",
            "available_from_real_positions_and_times",
            "available_from_real_cog",
        ) for v in feature_availability.values()) and len(feature_limitations) == 0:
            complete_feature_records += 1

        per_mmsi_rows.append({
            "spill_id": "SPILL_TEST_FIXTURE_AIS_003",
            "mmsi": str(mmsi),
            "position_count": position_count,
            "track_start_time": track_start.isoformat(),
            "track_end_time": track_end.isoformat(),
            "spatial_proximity_score": score_dict["spatial_proximity_score"],
            "temporal_overlap_score": score_dict["temporal_overlap_score"],
            "heading_compatibility_score": score_dict["heading_compatibility_score"],
            "route_intersection_score": score_dict["route_intersection_score"],
            "track_continuity_score": score_dict["track_continuity_score"],
            "ais_completeness": score_dict["ais_completeness"],
            "feature_availability": feature_availability,
            "feature_limitations": feature_limitations,
            "gap_statistics": {
                "max_gap_seconds": max_gap_sec,
                "mean_gap_seconds": float(gaps_sec.mean()) if len(gaps_sec) > 0 else 0.0,
            },
            "source_file": SOURCE_FILE,
            "cleaned_parquet_path": CLEANED_PARQUET_PATH,
            "drift_metadata_path": DRIFT_METADATA_PATH,
            "origin_corridor_path": ORIGIN_CORRIDOR_PATH,
            "data_mode": DATA_MODE,
            "scenario_label": SCENARIO_LABEL,
            "timestamp_source_verified": TIMESTAMP_SOURCE_VERIFIED,
            "real_world_attribution_claim_allowed": REAL_WORLD_ATTRIBUTION_CLAIM_ALLOWED,
            "scoring_version": SCORING_VERSION,
        })

    # Sort deterministically by MMSI
    per_mmsi_rows.sort(key=lambda r: r["mmsi"])

    # Summary counts
    input_rows = len(df)
    filtered_rows = len(df)
    unique_mmsis = df["mmsi"].nunique()
    single_point_mmsis_excluded = excluded_by_reason.get("single_point_mmsi", 0)
    eligible_mmsis = len(per_mmsi_rows)

    report = {
        "spill_id": "SPILL_TEST_FIXTURE_AIS_003",
        "data_mode": DATA_MODE,
        "scenario_label": SCENARIO_LABEL,
        "timestamp_source_verified": TIMESTAMP_SOURCE_VERIFIED,
        "real_world_attribution_claim_allowed": REAL_WORLD_ATTRIBUTION_CLAIM_ALLOWED,
        "scoring_version": SCORING_VERSION,
        "summary": {
            "input_rows": input_rows,
            "filtered_rows": filtered_rows,
            "unique_mmsis": int(unique_mmsis),
            "single_point_mmsis_excluded": single_point_mmsis_excluded,
            "eligible_mmsis": eligible_mmsis,
            "complete_feature_records": complete_feature_records,
            "excluded_by_reason": excluded_by_reason,
        },
        "per_mmsi_scores": per_mmsi_rows,
        "notes": [
            "Read-only feature validation using real AIS only.",
            "No synthetic positions, scores, or candidates created.",
            "Single-point MMSIs excluded per Phase 3 readiness rule.",
            "Heading compatibility computed only from non-null COG values.",
            "Route intersection is computed from real track geometry against the corridor polygon.",
            "AIS completeness uses an expected 30s reporting interval (Phase 3 rule).",
        ],
    }

    OUTPUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Eligible MMSIs: {eligible_mmsis}")
    print(f"Report: {OUTPUT_REPORT}")


if __name__ == "__main__":
    main()