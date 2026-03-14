import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudies } from '../services/api';

function PatientStudies() {
  const [studies, setStudies] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudies()
      .then(setStudies)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load studies'));
  }, []);

  return (
    <main>
      <h1>Patient Studies</h1>
      <p className="subtitle">PACS study list for completed simulation workflows</p>

      <section className="panel table-wrap">
        {error && <p className="error-text">{error}</p>}
        <table>
          <thead>
            <tr>
              <th>Study ID</th>
              <th>Patient ID</th>
              <th>Modality</th>
              <th>Date</th>
              <th>Number of Scans</th>
            </tr>
          </thead>
          <tbody>
            {studies.length === 0 && (
              <tr>
                <td colSpan={5}>No studies available yet. Run a simulation first.</td>
              </tr>
            )}
            {studies.map((study) => (
              <tr
                key={study.id}
                className="study-row"
                onClick={() => navigate(`/study-viewer/${study.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    navigate(`/study-viewer/${study.id}`);
                  }
                }}
              >
                <td>{study.study_id}</td>
                <td>{study.patient_id}</td>
                <td>{study.modality || 'N/A'}</td>
                <td>{new Date(study.timestamp).toLocaleString()}</td>
                <td>{study.number_of_scans || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

export default PatientStudies;
