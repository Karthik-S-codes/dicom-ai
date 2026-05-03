import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import About from './pages/About';
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import PatientStudies from './pages/PatientStudies';
import Reports from './pages/Reports';
import Simulation from './pages/Simulation';
import StudyViewer from './pages/StudyViewer';

function RequireAuth({ children }) {
  return children;
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Navigate to="/home" replace />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route
          element={(
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          )}
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/studies" element={<PatientStudies />} />
          <Route path="/study-viewer/:studyId" element={<StudyViewer />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
