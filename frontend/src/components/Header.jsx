import { useNavigate } from "react-router-dom";

function Header() {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="brand"
          onClick={() => navigate("/")}
          aria-label="Go to SpillTrace dashboard"
        >
          <span className="brand-mark">ST</span>

          <div className="brand-text">
            <span className="brand-name">SpillTrace</span>
            <span className="brand-subtitle">
              MARINE INTELLIGENCE
            </span>
          </div>
        </button>
      </div>

      <div className="header-center">
        <span className="system-indicator"></span>

        <span className="system-status">
          INVESTIGATION SYSTEM
        </span>

        <span className="status-divider">/</span>

        <span className="system-mode">
          DEMO ENVIRONMENT
        </span>
      </div>

      <div className="header-right">
        <div className="header-info">
          <span className="info-label">SIH 2026</span>
          <span className="info-value">PS 26143</span>
        </div>

        <button
          className="header-upload-button"
          onClick={() => navigate("/upload")}
        >
          <span>+</span>
          New Investigation
        </button>
      </div>
    </header>
  );
}

export default Header;
