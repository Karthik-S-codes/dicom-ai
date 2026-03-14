import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function LatencyChart({ values }) {
  const data = {
    labels: values.map((_, idx) => `Run ${idx + 1}`),
    datasets: [
      {
        label: 'Latency (ms)',
        data: values,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.25)',
        tension: 0.35
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#e5e7eb' } }
    },
    scales: {
      x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
      y: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } }
    }
  };

  return (
    <section className="panel">
      <h2>Latency History</h2>
      {values.length === 0 ? <p>No transfer data yet.</p> : <Line data={data} options={options} />}
    </section>
  );
}

export default LatencyChart;
