import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStudies } from '../services/api';

function PatientStudiesPacs() {
  const [studies, setStudies] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudies()
      .then(setStudies)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load studies'));
  }, []);

  return (
    <main className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Study Viewer</h1>
        <p className="text-sm text-slate-300">Patient study worklist modeled after hospital PACS systems</p>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg transition">
        {error && <p className="mb-3 rounded-md border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">{error}</p>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700 text-sm">
            <thead className="bg-slate-700/40 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Study ID</th>
                <th className="px-3 py-2 text-left">Patient ID</th>
                <th className="px-3 py-2 text-left">Modality</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Number of Scans</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {studies.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-slate-300" colSpan={5}>No studies available yet. Run a simulation first.</td>
                </tr>
              )}
              {studies.map((study) => (
                <tr
                  key={study.id}
                  className="cursor-pointer transition hover:bg-slate-700/40"
                  onClick={() => navigate(`/study-viewer/${study.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      navigate(`/study-viewer/${study.id}`);
                    }
                  }}
                >
                  <td className="px-3 py-2">{study.study_id}</td>
                  <td className="px-3 py-2">{study.patient_id}</td>
                  <td className="px-3 py-2">{study.modality || 'N/A'}</td>
                  <td className="px-3 py-2">{new Date(study.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-2">{study.number_of_scans || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default PatientStudiesPacs;
