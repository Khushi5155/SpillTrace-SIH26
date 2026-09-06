import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

TEST_FIXTURE_ID = "SPILL_TEST_FIXTURE_AIS_003"

AUDIT_REPORT = (
    BASE_DIR
    / "data"
    / "ais"
    / "reports"
    / f"phase3_candidate_input_audit_{TEST_FIXTURE_ID}.json"
)

OUTPUT_REPORT = (
    BASE_DIR
    / "data"
    / "ais"
    / "reports"
    / f"phase3_feature_readiness_{TEST_FIXTURE_ID}.json"
)


def main():
    with open(AUDIT_REPORT, "r", encoding="utf-8") as f:
        audit = json.load(f)

    rows = audit["per_mmsi_audit"]

    eligible = []
    excluded = []

    for row in rows:
        positions = row["positions_in_window"]

        if positions >= 2:
            eligible.append(
                {
                    "mmsi": row["mmsi"],
                    "positions_in_window": positions,
                    "first_observed_at": row["first_observed_at"],
                    "last_observed_at": row["last_observed_at"],
                    "max_gap_seconds": row["max_gap_seconds"],
                    "mean_gap_seconds": row["mean_gap_seconds"],
                    "continuity_status": row["continuity_status"],
                    "lineage_id": row["lineage_id"],
                    "feature_readiness": {
                        "spatial_proximity_score": "ready",
                        "temporal_overlap_score": "ready",
                        "heading_compatibility_score": "validate_ais_cog_heading",
                        "route_intersection_score": "ready_from_real_track_segment",
                        "track_continuity_score": "ready",
                        "ais_completeness": "ready"
                    }
                }
            )
        else:
            excluded.append(
                {
                    "mmsi": row["mmsi"],
                    "positions_in_window": positions,
                    "first_observed_at": row["first_observed_at"],
                    "last_observed_at": row["last_observed_at"],
                    "exclusion_reason": (
                        "single_real_ais_position_in_corridor_window; "
                        "cannot construct a real route segment or derive "
                        "track-based features without fabrication"
                    ),
                    "lineage_id": row["lineage_id"]
                }
            )

    report = {
        "test_fixture_id": TEST_FIXTURE_ID,
        "data_mode": "TEST_FIXTURE",
        "scenario_type": "Analyst Parameter-Driven Scenario Simulation",
        "timestamp_verification": False,
        "source_audit": str(AUDIT_REPORT),
        "summary": {
            "total_real_mmsi_in_corridor": len(rows),
            "full_feature_eligible_mmsi": len(eligible),
            "excluded_single_point_mmsi": len(excluded),
            "minimum_track_rule": "at least 2 real AIS positions per MMSI"
        },
        "eligible_for_feature_validation": eligible,
        "excluded_from_full_six_feature_scoring": excluded,
        "phase_3_status": {
            "candidate_scoring_attempted": False,
            "candidate_ranking_attempted": False,
            "candidate_persistence": "NOT_PERSISTED",
            "next_required_gate": (
                "Complete feature validation using frozen feature functions, "
                "then obtain explicit Phase 4 backend approval before persistence."
            )
        },
        "notes": [
            "This report is read-only and derived only from real AIS audit records.",
            "No synthetic positions, MMSIs, headings, scores, candidates, or gaps are created.",
            "Single-point vessels remain audit evidence but are not eligible for route- or track-derived scoring.",
            "Original SPILL_TEST3_001 remains unchanged and blocked with HTTP 409."
        ]
    }

    OUTPUT_REPORT.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Total real MMSIs in corridor: {len(rows)}")
    print(f"Eligible for full feature validation: {len(eligible)}")
    print(f"Excluded single-point MMSIs: {len(excluded)}")
    print(f"Readiness report: {OUTPUT_REPORT}")


if __name__ == "__main__":
    main()