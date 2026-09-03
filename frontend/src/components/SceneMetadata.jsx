function SceneMetadata({ investigation }) {
  const sar = investigation?.scenario_manifest?.sar;

  if (!sar) {
    return null;
  }

  const acquisitionStart = new Date(
    sar.acquisition_start
  ).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  const acquisitionEnd = new Date(
    sar.acquisition_end
  ).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  const [minLon, minLat, maxLon, maxLat] = sar.bounds;

  return (
    <div className="scene-metadata">
      <div className="section-label">
        SCENE METADATA
      </div>

      <div className="metadata-grid">

        <div className="metadata-item">
          <span>Acquisition</span>

          <strong>
            {acquisitionStart} UTC
          </strong>

          <small>
            to {acquisitionEnd} UTC
          </small>
        </div>

        <div className="metadata-item">
          <span>Source</span>

          <strong>
            {sar.source}
          </strong>
        </div>

        <div className="metadata-item">
          <span>Data Mode</span>

          <strong>
            {investigation.data_mode}
          </strong>
        </div>

        <div className="metadata-item">
          <span>Region</span>

          <strong>
            {investigation.region}
          </strong>
        </div>

        <div className="metadata-item metadata-wide">
          <span>Scene Bounds</span>

          <strong>
            {minLon.toFixed(2)}, {minLat.toFixed(2)}
            {" → "}
            {maxLon.toFixed(2)}, {maxLat.toFixed(2)}
          </strong>

          <small>
            EPSG: {sar.crs.replace("EPSG:", "")}
          </small>
        </div>

        <div className="metadata-item metadata-wide">
          <span>Scene File</span>

          <strong>
            {sar.file_name}
          </strong>
        </div>

      </div>
    </div>
  );
}

export default SceneMetadata;
