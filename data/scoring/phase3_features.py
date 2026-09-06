from __future__ import annotations

from data.scoring.candidate_scoring import calculate_candidate_score


def validate_phase3_features(
    *,
    spatial_proximity_score: float,
    temporal_overlap_score: float,
    heading_compatibility_score: float,
    route_intersection_score: float,
    track_continuity_score: float,
    ais_completeness: float,
    uncertainty_score: float | None = None,
    scoring_version: str = "v1.0",
) -> dict:
    score_obj = calculate_candidate_score(
        spatial_proximity_score=spatial_proximity_score,
        temporal_overlap_score=temporal_overlap_score,
        heading_compatibility_score=heading_compatibility_score,
        route_intersection_score=route_intersection_score,
        track_continuity_score=track_continuity_score,
        ais_completeness=ais_completeness,
        uncertainty_score=uncertainty_score,
        scoring_version=scoring_version,
    )
    return {
        "spatial_proximity_score": score_obj.spatial_proximity_score,
        "temporal_overlap_score": score_obj.temporal_overlap_score,
        "heading_compatibility_score": score_obj.heading_compatibility_score,
        "route_intersection_score": score_obj.route_intersection_score,
        "track_continuity_score": score_obj.track_continuity_score,
        "ais_completeness": score_obj.ais_completeness,
        "uncertainty_score": score_obj.uncertainty_score,
        "total_score": score_obj.total_score,
        "scoring_version": score_obj.scoring_version,
    }
