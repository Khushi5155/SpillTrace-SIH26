function SceneMetadata({
  investigation,
  scene,
  manifest,
}) {
  const mockSar =
    investigation?.scenario_manifest?.sar ?? {};

  const backendScene =
    scene ?? manifest?.scene ?? null;

  /* =======================================================
     BACKEND-FIRST DATA
  ======================================================= */

  const source =
    backendScene?.source ||
    mockSar?.source ||
    "Unavailable";

  const acquisitionStart =
    backendScene?.acquisition_start_utc ||
    mockSar?.acquisition_start ||
    null;

  const acquisitionEnd =
    backendScene?.acquisition_end_utc ||
    mockSar?.acquisition_end ||
    null;

  const sourceCrs =
    backendScene?.source_crs ||
    mockSar?.crs ||
    null;

  const outputCrs =
    backendScene?.output_crs ||
    sourceCrs ||
    null;

  const georeferencingMethod =
    backendScene?.georeferencing_method ||
    "Unavailable";

  const georeferencingConfidence =
    backendScene?.georeferencing_confidence ||
    "Unavailable";


  /* =======================================================
     FORMATTERS
  ======================================================= */

  const formatDate = (value) => {
    if (!value) return "Unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Unavailable";
    }

    return date.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
  };


  /* =======================================================
     SCENE BOUNDS

     Current backend does NOT provide bounds.

     Therefore fallback to the existing scenario bounds.
  ======================================================= */

  const backendBounds =
    backendScene?.bounds ||
    manifest?.bounds ||
    null;

  const mockBounds =
    mockSar?.bounds || null;

  const bounds =
    Array.isArray(backendBounds) &&
    backendBounds.length === 4
      ? backendBounds
      : Array.isArray(mockBounds) &&
          mockBounds.length === 4
        ? mockBounds
        : null;


  const [
    minLon,
    minLat,
    maxLon,
    maxLat,
  ] = bounds || [];


  const hasBounds =
    Number.isFinite(Number(minLon)) &&
    Number.isFinite(Number(minLat)) &&
    Number.isFinite(Number(maxLon)) &&
    Number.isFinite(Number(maxLat));


  const boundsAreBackend =
    Array.isArray(backendBounds) &&
    backendBounds.length === 4;


  /* =======================================================
     DATA MODE / REGION
  ======================================================= */

  const dataMode =
    investigation?.data_mode ||
    investigation?.investigation?.data_mode ||
    "Unavailable";

  const region =
    investigation?.region ||
    investigation?.investigation?.region ||
    "Unavailable";

  const fileName =
    mockSar?.file_name ||
    "Unavailable";


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="scene-metadata">

      <div className="section-label">
        SCENE METADATA
      </div>


      <div className="metadata-grid">

        {/* -----------------------------------------------
            ACQUISITION
        ------------------------------------------------ */}

        <div className="metadata-item">

          <span>
            Acquisition
          </span>

          <strong>
            {formatDate(
              acquisitionStart
            )}{" "}
            UTC
          </strong>

          <small>
            to{" "}
            {formatDate(
              acquisitionEnd
            )}{" "}
            UTC
          </small>

        </div>


        {/* -----------------------------------------------
            SOURCE
        ------------------------------------------------ */}

        <div className="metadata-item">

          <span>
            Source
          </span>

          <strong>
            {source}
          </strong>

        </div>


        {/* -----------------------------------------------
            DATA MODE
        ------------------------------------------------ */}

        <div className="metadata-item">

          <span>
            Data Mode
          </span>

          <strong>
            {dataMode}
          </strong>

        </div>


        {/* -----------------------------------------------
            REGION
        ------------------------------------------------ */}

        <div className="metadata-item">

          <span>
            Region
          </span>

          <strong>
            {region}
          </strong>

        </div>


        {/* -----------------------------------------------
            SCENE BOUNDS
        ------------------------------------------------ */}

        <div className="metadata-item metadata-wide">

          <span>
            Scene Bounds
          </span>

          {hasBounds ? (
            <>
              <strong>
                {Number(minLon).toFixed(2)},{" "}
                {Number(minLat).toFixed(2)}
                {" → "}
                {Number(maxLon).toFixed(2)},{" "}
                {Number(maxLat).toFixed(2)}
              </strong>

              <small>
                {boundsAreBackend
                  ? "Backend scene bounds"
                  : "Demo scenario bounds"}
              </small>
            </>
          ) : (
            <strong>
              Not available
            </strong>
          )}

        </div>


        {/* -----------------------------------------------
            CRS
        ------------------------------------------------ */}

        <div className="metadata-item">

          <span>
            CRS
          </span>

          <strong>
            {sourceCrs || "Unavailable"}
          </strong>

          {outputCrs &&
            outputCrs !== sourceCrs && (
              <small>
                Output: {outputCrs}
              </small>
            )}

        </div>


        {/* -----------------------------------------------
            GEOREFERENCING
        ------------------------------------------------ */}

        <div className="metadata-item">

          <span>
            Georeferencing
          </span>

          <strong>
            {georeferencingMethod}
          </strong>

          <small>
            Confidence:{" "}
            {georeferencingConfidence}
          </small>

        </div>


        {/* -----------------------------------------------
            SCENE FILE
        ------------------------------------------------ */}

        <div className="metadata-item metadata-wide">

          <span>
            Scene File
          </span>

          <strong>
            {fileName}
          </strong>

        </div>

      </div>

    </div>
  );
}

export default SceneMetadata;