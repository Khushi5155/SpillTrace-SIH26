from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import execute_values


BASE_DIR = Path(__file__).resolve().parents[2]
PHASE3_REPORT = BASE_DIR / "data" / "ais" / "reports" / "phase3_six_feature_scores_SPILL_TEST_FIXTURE_AIS_003.json"

# Database connection (from docker-compose.yml)
DB_CONFIG = {
    "dbname": "spilltrace",
    "user": "spilltrace",
    "password": "spilltrace_local_password",
    "host": "localhost",
    "port": 5432,
}

SCENARIO_ID = "SPILL_TEST_FIXTURE_AIS_003"
DATA_MODE = "TEST_FIXTURE"
SCORING_VERSION = "v1.0"


def load_phase3_report(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_spill_event_exists(conn, scenario_id: str, data_mode: str) -> int:
    """
    Ensure spill_events row exists with region_name = scenario_id.
    Return the primary key (id).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id FROM public.spill_events
            WHERE region_name = %s
            """,
            (scenario_id,),
        )
        row = cur.fetchone()
        if row:
            return int(row[0])

        cur.execute(
            """
            INSERT INTO public.spill_events (
                detected_at,
                region_name,
                status,
                source,
                model_version,
                confidence
            ) VALUES (
                NOW(),
                %s,
                'reviewed',
                %s,
                %s,
                NULL
            )
            RETURNING id
            """,
            (
                scenario_id,
                "AIS_TEST_FIXTURE",
                "phase3_six_feature_validation",
            ),
        )
        spill_pk = int(cur.fetchone()[0])
        conn.commit()
        return spill_pk


def persist_candidates(
    conn,
    spill_pk: int,
    per_mmsi_rows: list[dict[str, Any]],
) -> int:
    """Insert candidate rows; return count inserted."""
    rows_to_insert = []
    for r in per_mmsi_rows:
        # Store extended metadata in evidence_json
        evidence = {
            "position_count": r["position_count"],
            "track_start_time": r["track_start_time"],
            "track_end_time": r["track_end_time"],
            "feature_availability": r["feature_availability"],
            "feature_limitations": r["feature_limitations"],
            "gap_statistics": r["gap_statistics"],
            "source_file": r["source_file"],
            "cleaned_parquet_path": r["cleaned_parquet_path"],
            "drift_metadata_path": r["drift_metadata_path"],
            "origin_corridor_path": r["origin_corridor_path"],
            "data_mode": r["data_mode"],
            "scenario_label": r["scenario_label"],
            "timestamp_source_verified": r["timestamp_source_verified"],
            "real_world_attribution_claim_allowed": r["real_world_attribution_claim_allowed"],
        }

        rows_to_insert.append(
            (
                spill_pk,
                int(r["mmsi"]),
                r["candidate_rank"],
                r["total_score"],
                r["ais_completeness"],
                r["track_continuity_score"],
                r["scoring_version"],
                r["spatial_proximity_score"],
                r["temporal_overlap_score"],
                r["heading_compatibility_score"],
                r["route_intersection_score"],
                None,  # uncertainty_score
                json.dumps(evidence),  # evidence_json
            )
        )

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO public.vessel_candidates (
                spill_id,
                mmsi,
                rank,
                total_score,
                ais_completeness,
                track_continuity_score,
                scoring_version,
                spatial_proximity_score,
                temporal_overlap_score,
                heading_compatibility_score,
                route_intersection_score,
                uncertainty_score,
                evidence_json
            ) VALUES %s
            ON CONFLICT (spill_id, mmsi) DO UPDATE SET
                rank = EXCLUDED.rank,
                total_score = EXCLUDED.total_score,
                ais_completeness = EXCLUDED.ais_completeness,
                track_continuity_score = EXCLUDED.track_continuity_score,
                scoring_version = EXCLUDED.scoring_version,
                spatial_proximity_score = EXCLUDED.spatial_proximity_score,
                temporal_overlap_score = EXCLUDED.temporal_overlap_score,
                heading_compatibility_score = EXCLUDED.heading_compatibility_score,
                route_intersection_score = EXCLUDED.route_intersection_score,
                uncertainty_score = EXCLUDED.uncertainty_score,
                evidence_json = EXCLUDED.evidence_json
            """,
            rows_to_insert,
            template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        )
        conn.commit()
        return len(rows_to_insert)


def main():
    report = load_phase3_report(PHASE3_REPORT)

    if report["data_mode"] != DATA_MODE:
        raise ValueError(
            f"Phase 5 aborted: data_mode mismatch. "
            f"Expected {DATA_MODE}, got {report['data_mode']}"
        )

    if report["spill_id"] != SCENARIO_ID:
        raise ValueError(
            f"Phase 5 aborted: spill_id mismatch. "
            f"Expected {SCENARIO_ID}, got {report['spill_id']}"
        )

    # Compute total_score and rank per MMSI
    per_mmsi = report["per_mmsi_scores"]
    for r in per_mmsi:
        r["total_score"] = (
            0.30 * r["spatial_proximity_score"]
            + 0.25 * r["temporal_overlap_score"]
            + 0.15 * r["heading_compatibility_score"]
            + 0.15 * r["route_intersection_score"]
            + 0.10 * r["track_continuity_score"]
            + 0.05 * r["ais_completeness"]
        )

    # Sort by total_score descending, then by mmsi ascending for determinism
    per_mmsi.sort(key=lambda x: (-x["total_score"], x["mmsi"]))
    for idx, r in enumerate(per_mmsi, start=1):
        r["candidate_rank"] = idx

    conn = psycopg2.connect(**DB_CONFIG)
    try:
        spill_pk = ensure_spill_event_exists(conn, SCENARIO_ID, DATA_MODE)
        inserted = persist_candidates(conn, spill_pk, per_mmsi)
        print(f"Phase 5 complete: {inserted} candidates persisted for {SCENARIO_ID}")
        print(f"Spill event primary key (id): {spill_pk}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()