import { NavLink } from "react-router-dom";

function Sidebar() {
  const navItems = [
    {
      label: "Dashboard",
      path: "/",
      icon: "⌂",
    },
    {
      label: "New Investigation",
      path: "/upload",
      icon: "+",
    },
  ];

  return (
    <aside className="sidebar">
      {/* Navigation */}
      <div className="sidebar-navigation">
        <div className="sidebar-label">
          WORKSPACE
        </div>

        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon">
                {item.icon}
              </span>

              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* System Information */}
      <div className="sidebar-bottom">
        <div className="sidebar-label">
          SYSTEM
        </div>

        <div className="system-card">
          <div className="system-card-row">
            <span className="system-dot"></span>
            <span>System Online</span>
          </div>

          <div className="system-card-row muted">
            <span>Data Mode</span>
            <strong>REAL DATA</strong>
          </div>
        </div>

        <div className="sidebar-version">
          SpillTrace · SIH 2026
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
