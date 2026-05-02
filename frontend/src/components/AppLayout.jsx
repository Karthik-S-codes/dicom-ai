import { useState } from 'react';
import {
  FiActivity,
  FiBarChart2,
  FiFileText,
  FiFolder,
  FiGrid,
  FiHome,
  FiInfo,
  FiLogOut,
  FiMenu
} from 'react-icons/fi';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearAuth, isAuthenticated } from '../services/auth';

const navItems = [
  { to: '/home', label: 'Home', icon: FiHome },
  { to: '/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/simulation', label: 'Simulation', icon: FiActivity },
  { to: '/analytics', label: 'Data Analysis', icon: FiBarChart2 },
  { to: '/reports', label: 'Reports', icon: FiFileText },
  { to: '/studies', label: 'Patient Studies', icon: FiFolder },
  { to: '/about', label: 'About', icon: FiInfo }
];

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const authed = isAuthenticated();

  return (
    <div className={`layout ${collapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <button type="button" className="icon-btn" onClick={() => setCollapsed((v) => !v)}>
          <FiMenu />
        </button>
        <NavLink to="/home" className="brand-link">
          <h2 className="brand">DICOM-AI</h2>
        </NavLink>
        <nav>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {authed && (
          <div className="sidebar-footer">
            <button
              type="button"
              className="nav-item logout-btn"
              onClick={() => {
                clearAuth();
                navigate('/login');
              }}
            >
              <FiLogOut /> <span>Logout</span>
            </button>
          </div>
        )}
      </aside>
      <section className="content-area">
        <div className="page-shell">
          <Outlet />
        </div>
      </section>
    </div>
  );
}

export default AppLayout;
