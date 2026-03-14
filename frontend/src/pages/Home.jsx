import { Link, NavLink } from 'react-router-dom';
import { FiActivity, FiBarChart2, FiCheckCircle, FiCpu, FiFileText, FiServer } from 'react-icons/fi';

const features = [
  { icon: FiActivity, title: 'DICOM Transfer Monitoring', text: 'Real-time transfer telemetry with latency and reliability signals.' },
  { icon: FiServer, title: 'PACS Integration', text: 'Simulated PACS ingestion and storage path visibility for every run.' },
  { icon: FiCpu, title: 'AI Failure Prediction', text: 'Risk scoring with auto-retry messaging for unstable transfer events.' },
  { icon: FiCheckCircle, title: 'Automated Scan Diagnosis', text: 'OpenCV-based lesion-like region detection with confidence estimation.' },
  { icon: FiFileText, title: 'Medical Report Generation', text: 'Structured report creation with PDF export for demo-ready output.' },
  { icon: FiBarChart2, title: 'Operational Analytics', text: 'Latency trends, success rate, and confidence distribution charts.' }
];

function Home() {
  return (
    <main className="home-page">
      <header className="home-navbar panel">
        <div className="home-brand">
          <strong>DICOM-AI</strong>
          <span>Medical Imaging Intelligence</span>
        </div>
        <nav className="home-nav-links">
          <NavLink to="/home" className={({ isActive }) => `home-nav-pill ${isActive ? 'active' : ''}`}>Home</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => `home-nav-pill ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
          <NavLink to="/simulation" className={({ isActive }) => `home-nav-pill ${isActive ? 'active' : ''}`}>Simulation</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `home-nav-pill ${isActive ? 'active' : ''}`}>Analytics</NavLink>
          <NavLink to="/reports" className={({ isActive }) => `home-nav-pill ${isActive ? 'active' : ''}`}>Reports</NavLink>
          <NavLink to="/about" className={({ isActive }) => `home-nav-pill ${isActive ? 'active' : ''}`}>About</NavLink>
          <Link to="/login" className="home-login-pill">Login</Link>
        </nav>
      </header>

      <section className="hero panel home-hero">
        <div className="hero-chip">Hackathon Demo • Full-Stack AI Platform</div>
        <h1>DICOM-AI Medical Imaging Intelligence Platform</h1>
        <p className="hero-subtitle">AI-powered monitoring and analysis for medical imaging transfer systems</p>
        <div className="hero-actions">
          <Link to="/simulation" className="btn-link">Start Simulation</Link>
          <Link to="/dashboard" className="btn-link secondary">View Dashboard</Link>
        </div>
        <div className="hero-stats">
          <article><span>8</span><p>Workflow Stages</p></article>
          <article><span>AI</span><p>Transfer + Detection Models</p></article>
          <article><span>PDF</span><p>Clinical-style Reports</p></article>
        </div>
      </section>

      <section className="panel">
        <h2>Features</h2>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }) => (
            <article className="feature-card" key={title}>
              <div className="feature-icon"><Icon /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>About Project</h2>
        <p>
          This platform simulates an end-to-end hospital imaging workflow: CT generation, DICOM transfer,
          AI-based reliability monitoring, PACS storage, scan analysis, and structured report generation with PDF export.
        </p>
        <div className="workflow-strip">
          <span>Generate CT</span>
          <span>Transfer via DICOM</span>
          <span>AI Monitoring</span>
          <span>PACS Storage</span>
          <span>Analyze + Report</span>
        </div>
      </section>

      <footer className="panel footer home-footer">
        <div className="footer-col">
          <h3>DICOM-AI Medical Imaging Intelligence Platform</h3>
          <p>AI-powered monitoring and analysis for medical imaging transfer systems.</p>
        </div>
        <div className="footer-col footer-meta">
          <h4>Project</h4>
          <p>DICOM- WITH AI Communication Hackathon Demo</p>
          <p>Team Neural Forge</p>
          <p>2026</p>
        </div>
      </footer>
    </main>
  );
}

export default Home;
