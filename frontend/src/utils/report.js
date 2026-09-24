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

// Frontend fallback renderer used only when the backend HTML report endpoint
// is unavailable. It contains the same live values already assembled in the
// report payload; it does not invent investigation results.
export function buildLocalInvestigationReportHtml(payload) {
  const esc = (value) => String(value ?? "Not available")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const json = (value) => esc(JSON.stringify(value ?? null, null, 2));
  const candidates = payload?.candidates || [];
  const limitations = payload?.limitations || [];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(payload?.title || "SpillTrace Investigation Report")}</title>
<style>
  body{margin:0;background:#f4f7fa;color:#172235;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.5}
  .page{max-width:1040px;margin:32px auto;padding:0 24px 48px}
  .hero{background:#071525;color:#fff;border-radius:18px;padding:28px 32px;margin-bottom:20px}
  .eyebrow{font-size:11px;letter-spacing:.16em;color:#56d8f5;font-weight:700}
  h1{margin:8px 0 6px;font-size:28px} h2{font-size:17px;margin:0 0 12px}
  .muted{color:#68778b}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
  .meta div,.card{background:#fff;border:1px solid #dce4ec;border-radius:12px;padding:15px}
  .label{display:block;color:#738195;font-size:10px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
  .value{font-weight:650;overflow-wrap:anywhere}.section{margin-top:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f9fb;padding:12px;border-radius:9px;font-size:11px}
  table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #e3e9ef;font-size:12px}th{color:#6d7c90;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
  .warning{padding:12px;border-left:3px solid #e3a719;background:#fff8e7;border-radius:6px;margin-top:8px}
  @media(max-width:760px){.meta,.grid{grid-template-columns:1fr 1fr}.page{padding:0 14px 32px}}
</style>
</head>
<body><main class="page">
  <header class="hero">
    <div class="eyebrow">SPILLTRACE · MARINE INTELLIGENCE</div>
    <h1>${esc(payload?.title || "Investigation Report")}</h1>
    <div>Investigation support report · evidence and results available at export time</div>
    <div class="meta">
      <div><span class="label">Status</span><span class="value">${esc(payload?.status)}</span></div>
      <div><span class="label">Spill ID</span><span class="value">${esc(payload?.spill_id)}</span></div>
      <div><span class="label">Scene</span><span class="value">${esc(payload?.scene_id)}</span></div>
      <div><span class="label">Data mode</span><span class="value">${esc(payload?.data_mode)}</span></div>
    </div>
  </header>

  <section class="section grid">
    <div class="card"><h2>Detection</h2><div><span class="label">Area</span><span class="value">${esc(payload?.geometry?.area_km2)} km²</span></div><br><div><span class="label">Centroid</span><span class="value">${esc(payload?.geometry?.centroid)}</span></div><br><div><span class="label">Detector</span><span class="value">${esc(payload?.detector?.detector_name || payload?.detector?.name)}</span></div></div>
    <div class="card"><h2>Scene</h2><div><span class="label">Source</span><span class="value">${esc(payload?.sources?.find?.((s)=>s?.source_type === "SAR")?.label)}</span></div><br><div><span class="label">Scene ID</span><span class="value">${esc(payload?.scene_id)}</span></div></div>
  </section>

  <section class="section card"><h2>Drift analysis</h2><pre>${json(payload?.drift)}</pre></section>
  <section class="section card"><h2>Data compatibility</h2><pre>${json(payload?.compatibility)}</pre></section>

  <section class="section card"><h2>Candidate vessels</h2>${candidates.length ? `<table><thead><tr><th>Rank</th><th>Vessel</th><th>MMSI</th><th>Score</th></tr></thead><tbody>${candidates.map(c=>`<tr><td>${esc(c.rank)}</td><td>${esc(c.vessel_name)}</td><td>${esc(c.mmsi)}</td><td>${esc(c.score)}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">No candidate ranking result is available.</p>`}</section>

  ${limitations.length ? `<section class="section card"><h2>Limitations</h2>${limitations.map(x=>`<div class="warning">${esc(x)}</div>`).join("")}</section>` : ""}
  <section class="section card"><h2>Raw investigation evidence</h2><pre>${json(payload)}</pre></section>
  <p class="muted" style="margin-top:18px;font-size:11px">SpillTrace is an investigation-support system. Candidate rankings do not constitute legal attribution.</p>
</main></body></html>`;
}
