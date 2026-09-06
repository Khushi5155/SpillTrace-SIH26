from __future__ import annotations

import json
from pathlib import Path

import psycopg2


BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_JSON = BASE_DIR / "data" / "ais" / "reports" / "phase5_ranking_SPILL_TEST_FIXTURE_AIS_003.json"

DB_CONFIG = {
    "dbname": "spilltrace",
    "user": "spilltrace",
    "password": "spilltrace_local_password",
    "host": "localhost",
    "port": 5432,
}

SCENARIO_ID = "SPILL_TEST_FIXTURE_AIS_003"


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    vc.mmsi,
                    vc.rank,
                    vc.total_score,
                    vc.spatial_proximity_score,
                    vc.temporal_overlap_score,
                    vc.heading_compatibility_score,
                    vc.route_intersection_score,
                    vc.track_continuity_score,
                    vc.ais_completeness,
                    vc.uncertainty_score,
                    vc.scoring_version,
                    vc.evidence_json
                FROM public.vessel_candidates vc
                JOIN public.spill_events se ON vc.spill_id = se.id
                WHERE se.region_name = %s
                ORDER BY vc.rank
                """,
                (SCENARIO_ID,),
            )
            rows = cur.fetchall()
            columns = [
                "mmsi",
                "rank",
                "total_score",
                "spatial_proximity_score",
                "temporal_overlap_score",
                "heading_compatibility_score",
                "route_intersection_score",
                "track_continuity_score",
                "ais_completeness",
                "uncertainty_score",
                "scoring_version",
                "evidence_json",
            ]
            ranking = [dict(zip(columns, row)) for row in rows]

        export = {
            "spill_id": SCENARIO_ID,
            "data_mode": "TEST_FIXTURE",
            "scenario_label": "Analyst Parameter-Driven Scenario Simulation",
            "timestamp_source_verified": False,
            "real_world_attribution_claim_allowed": False,
            "scoring_version": "v1.0",
            "summary": {
                "total_candidates": len(ranking),
                "top_mmsi": ranking[0]["mmsi"] if ranking else None,
                "top_score": ranking[0]["total_score"] if ranking else None,
            },
            "ranking": ranking,
            "notes": [
                "Highest-ranked candidate under available evidence.",
                "This is an investigative lead, not a confirmed polluter.",
                "Phase 4 backend approval received before persistence.",
                "All features computed from real AIS only; no synthetic data.",
            ],
        }

        OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(export, f, indent=2)

        print(f"Ranking export: {OUTPUT_JSON}")
        print(f"Total candidates: {len(ranking)}")
        if ranking:
            print(f"Top MMSI: {ranking[0]['mmsi']} (score: {ranking[0]['total_score']:.4f})")

    finally:
        conn.close()


if __name__ == "__main__":
    main()