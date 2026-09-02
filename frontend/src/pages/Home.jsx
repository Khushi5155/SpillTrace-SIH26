import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  const recentInvestigation = {
    id: "INV-2026-0042",
    region: "Arabian Sea",
    date: "31 Aug 2026",
    status: "Active",
    source: "Copernicus Sentinel-1",
    area: "12.4 km²",
    detectionConfidence: "94%",
  };

  return (
    <section className="dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">MARINE INCIDENT INTELLIGENCE</p>

          <h1>Investigation Dashboard</h1>

          <p>
            Detect, reconstruct and investigate potential marine oil spills
            using SAR imagery, ocean dynamics and AIS data.
          </p>
        </div>

        <button
          className="upload-button"
          onClick={() => navigate("/upload")}
        >
          + New Investigation
        </button>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">ACTIVE INVESTIGATIONS</span>

          <strong className="stat-value">01</strong>

          <span className="stat-description">
            Current investigation
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">SPILL AREA</span>

          <strong className="stat-value">12.4</strong>

          <span className="stat-description">
            km² detected area
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">DETECTION CONFIDENCE</span>

          <strong className="stat-value">94%</strong>

          <span className="stat-description">
            High confidence
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">VESSELS ANALYZED</span>

          <strong className="stat-value">142</strong>

          <span className="stat-description">
            Historical AIS tracks
          </span>
        </div>
      </div>

      {/* Recent Investigation */}
      <div className="recent-spills">
        <div className="section-header">
          <div>
            <p className="eyebrow">LATEST SCENARIO</p>

            <h2>Recent Investigation</h2>
          </div>

          <span className="active-badge">
            ● ACTIVE
          </span>
        </div>

        <div className="investigation-row">
          <div className="investigation-primary">
            <span className="investigation-id">
              {recentInvestigation.id}
            </span>

            <h3>{recentInvestigation.region}</h3>

            <p>
              Historical oil spill reconstruction ·{" "}
              {recentInvestigation.date}
            </p>
          </div>

          <div className="investigation-details">
            <div>
              <span>SOURCE</span>
              <strong>{recentInvestigation.source}</strong>
            </div>

            <div>
              <span>AREA</span>
              <strong>{recentInvestigation.area}</strong>
            </div>

            <div>
              <span>DETECTION</span>
              <strong>{recentInvestigation.detectionConfidence}</strong>
            </div>
          </div>

          <button
            className="view-button"
            onClick={() =>
              navigate(`/investigation/${recentInvestigation.id}`)
            }
          >
            Open Investigation →
          </button>
        </div>
      </div>

      {/* Platform Workflow */}
      <div className="platform-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">SPILLTRACE WORKFLOW</p>

            <h2>Investigation Pipeline</h2>
          </div>
        </div>

        <div className="pipeline">
          <div className="pipeline-step">
            <span>01</span>

            <div>
              <strong>SAR Detection</strong>
              <p>Detect potential oil slicks.</p>
            </div>
          </div>

          <div className="pipeline-arrow">→</div>

          <div className="pipeline-step">
            <span>02</span>

            <div>
              <strong>Origin Hindcast</strong>
              <p>Reconstruct likely origin.</p>
            </div>
          </div>

          <div className="pipeline-arrow">→</div>

          <div className="pipeline-step">
            <span>03</span>

            <div>
              <strong>AIS Analysis</strong>
              <p>Filter compatible vessels.</p>
            </div>
          </div>

          <div className="pipeline-arrow">→</div>

          <div className="pipeline-step">
            <span>04</span>

            <div>
              <strong>Candidate Ranking</strong>
              <p>Explain vessel compatibility.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scientific Disclaimer */}
      <div className="dashboard-disclaimer">
        <strong>Investigation note:</strong>{" "}
        Candidate rankings support investigation and do not constitute
        legal attribution.
      </div>
    </section>
  );
}

export default Home;
