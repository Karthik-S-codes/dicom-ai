import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000
});

export async function generateScan(payload = {}) {
  const response = await api.post('/api/generateScan', payload);
  return response.data;
}

export async function startSimulation(payload = {}) {
  const response = await api.post('/api/startSimulation', payload, { timeout: 180000 });
  return response.data;
}

export async function startTransfer(payload = {}) {
  const response = await api.post('/api/startTransfer', payload, { timeout: 120000 });
  return response.data;
}

export async function analyzeScan(payload = {}) {
  const response = await api.post('/api/analyzeScan', payload);
  return response.data;
}

export async function generateReport(payload = {}) {
  const response = await api.post('/api/generateReport', payload);
  return response.data;
}

export function exportPdfUrl(scanId) {
  return `${API_BASE_URL}/api/exportPDF?id=${scanId}`;
}

export async function fetchScans() {
  const response = await api.get('/api/scans');
  return response.data;
}

export async function fetchAnalytics() {
  const response = await api.get('/api/analytics');
  return response.data;
}

export async function fetchReports() {
  const response = await api.get('/api/reports');
  return response.data;
}

export async function fetchReportById(scanId) {
  const response = await api.get(`/api/report/${scanId}`);
  return response.data;
}

export async function fetchStudies() {
  const response = await api.get('/api/studies');
  return response.data;
}

export async function fetchStudyById(studyId) {
  const response = await api.get(`/api/study/${studyId}`);
  return response.data;
}

export async function signupUser(payload) {
  const response = await api.post('/api/auth/signup', payload);
  return response.data;
}

export async function loginUser(payload) {
  const response = await api.post('/api/auth/login', payload);
  return response.data;
}

export function resolveAssetUrl(assetPath) {
  if (!assetPath) return '';
  if (assetPath.startsWith('http')) return assetPath;
  return `${API_BASE_URL}${assetPath}`;
}
