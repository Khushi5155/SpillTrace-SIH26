from data.scoring.phase3_features import validate_phase3_features


def test_validate_phase3_features_returns_dict():
    result = validate_phase3_features(spatial_proximity_score=0.8, temporal_overlap_score=0.7, heading_compatibility_score=0.6, route_intersection_score=0.5, track_continuity_score=0.9, ais_completeness=0.85, uncertainty_score=0.1, scoring_version="v1.0")
    assert isinstance(result, dict)
    assert "total_score" in result
    assert 0.0 <= result["total_score"] <= 1.0
    for key in ["spatial_proximity_score", "temporal_overlap_score", "heading_compatibility_score", "route_intersection_score", "track_continuity_score", "ais_completeness"]:
        assert key in result
        assert 0.0 <= result[key] <= 1.0

