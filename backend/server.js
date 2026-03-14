require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const scanRoutes = require('./routes/scanRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dicom_ai';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve generated artifacts
app.use('/images', express.static(path.resolve(__dirname, '../data/highlighted')));
app.use('/original', express.static(path.resolve(__dirname, '../data/original')));
app.use('/reports', express.static(path.resolve(__dirname, '../data/reports')));
app.use('/pacs', express.static(path.resolve(__dirname, '../data/pacs')));
app.use('/data', express.static(path.resolve(__dirname, '../data')));
app.use('/dataset', express.static(path.resolve(__dirname, '../dataset')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dicom-ai-backend' });
});

app.use('/api', scanRoutes);
app.use('/api/auth', authRoutes);

app.use((err, _req, res, _next) => {
  // Centralized error response
  res.status(500).json({ message: 'Unexpected server error', error: err.message });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(`MongoDB connected at ${MONGO_URI}`);
    app.listen(PORT, () => {
      console.log(`Backend server listening on http://127.0.0.1:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect MongoDB:', error.message);
    console.warn('Starting backend in in-memory mode (no MongoDB persistence).');
    app.listen(PORT, () => {
      console.log(`Backend server listening on http://127.0.0.1:${PORT}`);
    });
  });
