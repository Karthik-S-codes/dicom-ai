import { useState } from 'react';
import { FiActivity, FiBarChart2, FiFileText, FiFolder, FiGrid, FiHome, FiInfo, FiLogIn, FiMenu } from 'react-icons/fi';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/home', label: 'Home', icon: FiHome },
  { to: '/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/simulation', label: 'Simulation', icon: FiActivity },
  { to: '/analytics', label: 'Data Analysis', icon: FiBarChart2 },
  { to: '/reports', label: 'Reports', icon: FiFileText },
  { to: '/studies', label: 'Patient Studies', icon: FiFolder },
  { to: '/about', label: 'About', icon: FiInfo },
  { to: '/login', label: 'Login', icon: FiLogIn }
];

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

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
      </aside>
      <section className="content-area">
        <Outlet />
      </section>
    </div>
  );
}

export default AppLayout;
