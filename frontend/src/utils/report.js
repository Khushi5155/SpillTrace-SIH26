import { geometryProperties } from "./investigation";

// Builds the exact payload the backend report endpoints already accept.
// (Moved verbatim out of pages/Investigation.jsx.)
export function buildReportPayload({
  spillId,
  detection,
  slickGeojson,
  slickIsMock,
  candidateRun,
  compatibility,
  scene,
  hindcastResult,
  forecastResult,
  aisTracksGeojson,
  detectionError,
}) {
      const geoProps =
        geometryProperties(detection);

      let status = "failed";

      if (
        candidateRun?.candidates?.length
      ) {
        status = "complete";
      } else if (
        detection?.status ===
          "COMPLETED" ||
        slickGeojson
      ) {
        status = "partial";
      } else if (
        compatibility &&
        compatibility.compatible === false
      ) {
        status = "blocked";
      }

      const dataMode =
        slickIsMock
          ? "synthetic_test_fixture"
          : detection?.status ===
              "COMPLETED"
            ? "real"
            : "unavailable";

      const payload = {
        title:
          `SpillTrace Investigation — ${spillId}`,

        status,

        data_mode: dataMode,

        spill_id: spillId,

        scene_id:
          scene?.scene_id || null,

        detector:
          detection?.metadata || {},

        geometry: slickGeojson
          ? {
              geometry_type:
                slickGeojson.geometry
                  ?.type ||
                slickGeojson.type ||
                null,

              centroid:
                geoProps.centroid,

              area_km2:
                geoProps.area_sq_km,

              perimeter_m:
                geoProps.perimeter_m,

              polygon_count: 1,

              geojson:
                slickGeojson,
            }
          : null,

        drift: {
          mode:
            hindcastResult?.data_mode ||
            forecastResult?.data_mode ||
            null,

          run_id:
            hindcastResult?.run_id ||
            forecastResult?.run_id ||
            null,

          origin_time_window:
            hindcastResult
              ? `${hindcastResult.start_time_utc} → ${hindcastResult.end_time_utc}`
              : null,

          forecast_horizon:
            forecastResult
              ? `${forecastResult.start_time_utc} → ${forecastResult.end_time_utc}`
              : null,

          timestep_minutes:
            hindcastResult?.timestep_minutes ||
            forecastResult?.timestep_minutes ||
            null,

          particle_count:
            hindcastResult?.particle_count ||
            forecastResult?.particle_count ||
            null,

          uncertainty_radius_m:
            hindcastResult?.uncertainty_radius_m ??
            forecastResult?.uncertainty_radius_m ??
            null,

          assumptions: [
            ...(hindcastResult?.assumptions ||
              []),
            ...(forecastResult?.assumptions ||
              []),
          ],

          hindcast_geojson:
            hindcastResult?.corridor ||
            null,

          forecast_geojson:
            forecastResult?.corridor ||
            null,
        },

        compatibility: {
          compatible:
            compatibility?.compatible ===
            true,

          status_code:
            compatibility?.status ||
            "unknown",

          reasons:
            compatibility?.reasons || [],

          sar_time_window:
            scene?.acquisition_start_utc &&
            scene?.acquisition_end_utc
              ? `${scene.acquisition_start_utc} → ${scene.acquisition_end_utc}`
              : null,

          geographic_overlap:
            compatibility?.geographic_overlap ??
            null,

          crs_valid:
            compatibility?.crs_valid ??
            null,

          environmental_coverage:
            compatibility?.environmental_coverage ??
            null,
        },

        sources: [
          scene
            ? {
                source_id:
                  scene.scene_id,

                source_type: "SAR",

                label:
                  scene.source ||
                  "SAR scene",

                provenance:
                  "Backend scene metadata",
              }
            : null,

          aisTracksGeojson
            ? {
                source_id:
                  "ais-configured",

                source_type: "AIS",

                label:
                  "AIS track source",

                provenance:
                  "Configured frontend AIS endpoint",
              }
            : null,
        ].filter(Boolean),

        candidates:
          (
            candidateRun?.candidates ||
            []
          ).map((candidate) => ({
            candidate_id:
              candidate.candidate_id,

            vessel_name:
              candidate.vessel_name,

            mmsi:
              candidate.mmsi,

            rank:
              candidate.rank,

            score:
              candidate.score,

            score_contributions:
              candidate.score_contributions ||
              {},

            evidence:
              candidate.evidence_statements ||
              [],

            ais_quality:
              candidate.ais_quality ||
              {},

            source_ids:
              candidate.source_reference
                ? [
                    candidate.source_reference,
                  ]
                : [],
          })),

        limitations: [
          !aisTracksGeojson
            ? "AIS tracks are not available from the configured frontend endpoint."
            : null,

          !candidateRun?.candidates?.length
            ? "No candidate ranking result is available."
            : null,

          slickIsMock
            ? "Slick geometry came from the backend demonstration endpoint, not the real ML detector."
            : null,
        ].filter(Boolean),

        warnings:
          detectionError
            ? [detectionError]
            : [],
      };

  return payload;
}
