function DataQualityPanel({ compatibility }) {
  const [isOpen, setIsOpen] = React.useState(false);

  const data = compatibility ?? {};

  const getStatus = (value) => {
    if (value === true) return "AVAILABLE";
    if (value === false) return "INVALID";
    if (value === null || value === undefined) {
      return "NOT AVAILABLE";
    }

    return String(value).toUpperCase();
  };

  const getStatusClass = (value) => {
    if (value === true) return "quality-good";
    if (value === false) return "quality-bad";
    return "quality-neutral";
  };

  return (
    <section className="data-quality-panel">

      {/* ================================================
          HEADER
      ================================================= */}

      <button
        type="button"
        className="data-quality-header"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-expanded={isOpen}
      >

        <div>
          <span className="section-label">
            DATA QUALITY
          </span>

          <h3>
            ETL & Source Quality
          </h3>

          <p>
            Backend-reported input compatibility
            and data quality information.
          </p>
        </div>

        <span className="data-quality-toggle">
          {isOpen ? "−" : "+"}
        </span>

      </button>


      {/* ================================================
          COLLAPSIBLE CONTENT
      ================================================= */}

      {isOpen && (
        <div className="data-quality-content">

          {/* ---------------------------------------------
              CRS
          --------------------------------------------- */}

          <div className="quality-row">

            <div>
              <strong>
                CRS Validation
              </strong>

              <span>
                Coordinate reference system validity
              </span>
            </div>

            <span
              className={`quality-status ${
                getStatusClass(data.crs_valid)
              }`}
            >
              {getStatus(data.crs_valid)}
            </span>

          </div>


          {/* ---------------------------------------------
              TEMPORAL OVERLAP
          --------------------------------------------- */}

          <div className="quality-row">

            <div>
              <strong>
                Temporal Overlap
              </strong>

              <span>
                SAR / AIS / environmental time coverage
              </span>
            </div>

            <span
              className={`quality-status ${
                getStatusClass(
                  data.temporal_overlap
                )}
              `}
            >
              {getStatus(
                data.temporal_overlap
              )}
            </span>

          </div>


          {/* ---------------------------------------------
              GEOGRAPHIC OVERLAP
          --------------------------------------------- */}

          <div className="quality-row">

            <div>
              <strong>
                Geographic Overlap
              </strong>

              <span>
                Spatial coverage between input datasets
              </span>
            </div>

            <span
              className={`quality-status ${
                getStatusClass(
                  data.geographic_overlap
                )}
              `}
            >
              {getStatus(
                data.geographic_overlap
              )}
            </span>

          </div>


          {/* ---------------------------------------------
              ENVIRONMENTAL COVERAGE
          --------------------------------------------- */}

          <div className="quality-row">

            <div>
              <strong>
                Environmental Coverage
              </strong>

              <span>
                Wind and ocean-current coverage
              </span>
            </div>

            <span
              className={`quality-status ${
                getStatusClass(
                  data.environmental_coverage
                )}
              `}
            >
              {getStatus(
                data.environmental_coverage
              )}
            </span>

          </div>


          {/* ---------------------------------------------
              COMPATIBILITY
          --------------------------------------------- */}

          <div className="quality-row">

            <div>
              <strong>
                Overall Compatibility
              </strong>

              <span>
                Whether the scenario can support attribution
              </span>
            </div>

            <span
              className={`quality-status ${
                data.compatible
                  ? "quality-good"
                  : "quality-bad"
              }`}
            >
              {data.compatible
                ? "COMPATIBLE"
                : "BLOCKED"}
            </span>

          </div>


          {/* ---------------------------------------------
              REASONS
          --------------------------------------------- */}

          {Array.isArray(data.reasons) &&
            data.reasons.length > 0 && (
              <div className="quality-reasons">

                <div className="quality-reasons-title">
                  Backend Notes
                </div>

                {data.reasons.map(
                  (reason, index) => (
                    <div
                      className="quality-note"
                      key={`${reason}-${index}`}
                    >
                      {reason}
                    </div>
                  )
                )}

              </div>
            )}


          {/* ---------------------------------------------
              HONEST DATA STATE
          --------------------------------------------- */}

          <div className="quality-footnote">
            Values shown here are reported by the
            backend. Missing fields are not inferred
            or replaced with simulated values.
          </div>

        </div>
      )}

    </section>
  );
}

export default DataQualityPanel;
