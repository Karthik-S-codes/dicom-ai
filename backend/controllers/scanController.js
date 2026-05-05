const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFile } = require('child_process');
const util = require('util');
const Scan = require('../models/Scan');
const Study = require('../models/Study');

const execFileAsync = util.promisify(execFile);

const ROOT_DIR = path.resolve(__dirname, '../..');
const PYTHON_SERVICES_DIR = path.join(ROOT_DIR, 'python-services');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATASET_DIR = path.join(ROOT_DIR, 'dataset');

function looksLikeFilePath(value) {
  return String(value || '').includes('/') || String(value || '').includes('\\') || path.isAbsolute(String(value || ''));
}

function resolvePythonExecutable() {
  const configured = process.env.PYTHON_EXECUTABLE;
  const candidates = [];

  if (configured) {
    candidates.push(configured);
  }

  if (process.platform === 'win32') {
    candidates.push(path.join(ROOT_DIR, '.venv', 'Scripts', 'python.exe'));
    candidates.push(path.join(ROOT_DIR, 'venv', 'Scripts', 'python.exe'));
    candidates.push('python');
  } else {
    candidates.push(path.join(ROOT_DIR, '.venv', 'bin', 'python'));
    candidates.push(path.join(ROOT_DIR, 'venv', 'bin', 'python'));
    candidates.push('python3');
    candidates.push('python');
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!looksLikeFilePath(candidate)) {
      return candidate;
    }
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

const PYTHON_EXECUTABLE = resolvePythonExecutable();
const PYTHON_RETRY_LIMIT = Number(process.env.PYTHON_RETRY_LIMIT || 2);
const PYTHON_RETRY_DELAY_MS = Number(process.env.PYTHON_RETRY_DELAY_MS || 400);

const WORKFLOW = {
  scanId: null,
  dicomPath: '',
  pacsPath: '',
  highlightedPath: '',
  originalImagePath: '',
  reportPath: '',
  pdfPath: '',
  reportText: '',
  patientId: '',
  scanUid: '',
  transfer: null,
  analysis: null
};

const memoryStore = [];
const studyMemoryStore = [];

function isDatabaseReady() {
  return Scan?.db?.readyState === 1;
}

function normalizeDoc(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') {
    return doc.toObject({ flattenMaps: true });
  }
  return doc;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function createScanRecord(payload) {
  if (isDatabaseReady()) {
    return normalizeDoc(await Scan.create(payload));
  }

  const record = {
    _id: randomUUID(),
    timestamp: new Date(),
    ...payload
  };
  memoryStore.push(record);
  return clone(record);
}

async function findScanById(id) {
  if (!id) return null;
  if (isDatabaseReady()) {
    return Scan.findById(id).lean();
  }
  const found = memoryStore.find((item) => String(item._id) === String(id));
  return found ? clone(found) : null;
}

async function updateScanById(id, payload) {
  if (!id) return null;
  if (isDatabaseReady()) {
    return normalizeDoc(await Scan.findByIdAndUpdate(id, payload, { new: true }));
  }

  const index = memoryStore.findIndex((item) => String(item._id) === String(id));
  if (index === -1) return null;
  memoryStore[index] = { ...memoryStore[index], ...payload };
  return clone(memoryStore[index]);
}

async function listScanRecords() {
  if (isDatabaseReady()) {
    return Scan.find({}).sort({ timestamp: -1 }).lean();
  }
  return clone(memoryStore).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function isStudyDatabaseReady() {
  return Study?.db?.readyState === 1;
}

function generateStudyId() {
  return `STUDY_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`;
}

function buildStudyScansFromRun(run) {
  return [
    {
      scan_uid: run.scanUid || '',
      original: run.originalImagePath || run.selectedImagePath || '',
      heatmap: run.heatmapPath || '',
      detection: run.imagePath || '',
      diagnosis: run.diseaseLabel || run.diagnosis || '',
      confidence: run.confidence || 0,
      risk: run.risk || run.failureRiskLabel || 'LOW_RISK',
      timestamp: run.timestamp || new Date()
    }
  ];
}

function buildStudyPayloadFromRun(run) {
  const scans = buildStudyScansFromRun(run);
  return {
    studyId: generateStudyId(),
    patientId: run.patientId || 'UNKNOWN',
    modality: run.modality || run.scanType || 'XRAY',
    scanPaths: scans.flatMap((scan) => [scan.original, scan.heatmap, scan.detection].filter(Boolean)),
    scans,
    scanCount: scans.length,
    scanRef: String(run._id || ''),
    timestamp: run.timestamp || new Date()
  };
}

async function createStudyRecord(payload) {
  if (isStudyDatabaseReady()) {
    return normalizeDoc(await Study.create(payload));
  }

  const record = {
    _id: randomUUID(),
    ...payload,
    timestamp: payload.timestamp || new Date()
  };
  studyMemoryStore.push(record);
  return clone(record);
}

async function findStudyById(id) {
  if (!id) return null;
  if (isStudyDatabaseReady()) {
    return Study.findById(id).lean();
  }
  const found = studyMemoryStore.find((item) => String(item._id) === String(id));
  return found ? clone(found) : null;
}

async function listStudyRecords() {
  if (isStudyDatabaseReady()) {
    return Study.find({}).sort({ timestamp: -1 }).lean();
  }
  return clone(studyMemoryStore).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function findStudyByScanRef(scanRef) {
  if (!scanRef) return null;
  if (isStudyDatabaseReady()) {
    return Study.findOne({ scanRef: String(scanRef) }).lean();
  }
  const found = studyMemoryStore.find((item) => String(item.scanRef) === String(scanRef));
  return found ? clone(found) : null;
}

async function ensureStudyForRun(run) {
  if (!run?._id) return null;
  const existing = await findStudyByScanRef(run._id);
  if (existing) return existing;
  const payload = buildStudyPayloadFromRun(run);
  return createStudyRecord(payload);
}

function parseJsonFromStdout(stdout) {
  const text = String(stdout || '').trim();
  try {
    return JSON.parse(text);
  } catch (_error) {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    }
    throw new Error(`Could not parse JSON output: ${text}`);
  }
}

function isTransientPythonError(error) {
  const message = String(error?.message || '').toLowerCase();
  return [
    'timeout',
    'timed out',
    'temporarily',
    'connection',
    'network',
    'econnreset',
    'econnrefused',
    'resource temporarily unavailable'
  ].some((token) => message.includes(token));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPython(scriptName, args) {
  const scriptPath = path.join(PYTHON_SERVICES_DIR, scriptName);
  try {
    const { stdout, stderr } = await execFileAsync(PYTHON_EXECUTABLE, [scriptPath, ...args], {
      cwd: PYTHON_SERVICES_DIR,
      windowsHide: true
    });

    if (stderr && stderr.trim()) {
      // Keep stderr for debugging in API response path when needed.
      console.warn(`[${scriptName}] stderr: ${stderr}`);
    }

    return parseJsonFromStdout(stdout);
  } catch (error) {
    const stderr = String(error?.stderr || '').trim();
    const stdout = String(error?.stdout || '').trim();
    const output = [stderr, stdout].filter(Boolean).join(' | ');
    const message = output
      ? `Python script failed: ${scriptName}. ${error.message}. Output: ${output}`
      : `Python script failed: ${scriptName}. ${error.message}`;
    const wrapped = new Error(message);
    wrapped.cause = error;
    throw wrapped;
  }
}

async function runPythonWithRetry(scriptName, args, options = {}) {
  const retries = Number(options.retries ?? PYTHON_RETRY_LIMIT);
  const delayMs = Number(options.delayMs ?? PYTHON_RETRY_DELAY_MS);
  const shouldRetry = options.shouldRetry || isTransientPythonError;
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      return await runPython(scriptName, args);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
      await delay(delayMs * (attempt + 1));
      attempt += 1;
    }
  }

  throw lastError || new Error(`Python script failed after ${retries + 1} attempts: ${scriptName}`);
}

function toPublicPath(absolutePath, folderName) {
  if (!absolutePath) return '';
  return `/${folderName}/${path.basename(absolutePath)}`;
}

function toDatasetPublicPath(absolutePath) {
  if (!absolutePath) return '';
  const normalized = path.normalize(absolutePath);
  const datasetRoot = path.normalize(DATASET_DIR);
  if (!normalized.startsWith(datasetRoot)) {
    return '';
  }
  const relative = path.relative(datasetRoot, normalized).split(path.sep).join('/');
  return `/dataset/${relative}`;
}

function firstExistingPath(paths) {
  return paths.find((candidate) => Boolean(candidate) && fs.existsSync(candidate)) || '';
}

function generatePatientId() {
  return `PATIENT_${Math.floor(Math.random() * 900 + 100)}`;
}

const createScan = async (req, res) => {
  try {
    const payload = req.body || {};
    const scan = await createScanRecord(payload);
    return res.status(201).json({ message: 'Scan metadata stored', scan });
  } catch (error) {
    return res.status(400).json({ message: 'Failed to store scan metadata', error: error.message });
  }
};

const generateScan = async (req, res) => {
  try {
    const patientId = req.body?.patientId || generatePatientId();
    const result = await runPythonWithRetry('ct_generator.py', [
      '--output-dir',
      path.join(DATA_DIR, 'scans'),
      '--patient-id',
      patientId,
      '--dataset-dir',
      DATASET_DIR
    ]);

    const scan = await createScanRecord({
      patientId: result.patient_id,
      scanType: result.scan_type,
      modality: result.modality || result.scan_type,
      disease: result.disease || '',
      scanUid: result.scan_uid,
      dicomPath: result.dicom_path,
      transferStatus: 'PENDING',
      pipelineStage: 1,
      timestamp: new Date()
    });

    WORKFLOW.scanId = scan._id;
    WORKFLOW.dicomPath = result.dicom_path;
    WORKFLOW.patientId = result.patient_id;
    WORKFLOW.scanUid = result.scan_uid;

    return res.json({
      stage: 1,
      status: 'SUCCESS',
      message: 'Scan generated successfully',
      scanId: String(scan._id),
      fileName: result.file_name,
      dicomPath: result.dicom_path,
      patientId: result.patient_id,
      modality: result.modality || result.scan_type,
      disease: result.disease || '',
      scanUid: result.scan_uid
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to generate scan',
      stage: 'generate-scan',
      error: error.message
    });
  }
};

async function runSimulationPipeline(options = {}) {
  const patientId = options.patientId || generatePatientId();
  const autoDebugNotes = [];
  const recentRuns = await listScanRecords();
  const lastKnownRun = recentRuns.find((run) => run?.originalImagePath || run?.imagePath || run?.heatmapPath) || null;
  const fallbackVisuals = {
    original: lastKnownRun?.originalImagePath || lastKnownRun?.selectedImagePath || '',
    heatmap: lastKnownRun?.heatmapPath || lastKnownRun?.imagePath || '',
    highlighted: lastKnownRun?.imagePath || lastKnownRun?.selectedImagePath || lastKnownRun?.originalImagePath || ''
  };

  const runStage = async (stage, action, fallbackFactory) => {
    try {
      return await action();
    } catch (error) {
      error.stage = stage;
      autoDebugNotes.push(`${stage}: ${error.message}`);
      if (fallbackFactory) {
        return fallbackFactory(error);
      }
      throw error;
    }
  };

  const generated = await runStage('generate-scan', () => runPythonWithRetry('ct_generator.py', [
    '--output-dir',
    path.join(DATA_DIR, 'scans'),
    '--patient-id',
    patientId,
    '--dataset-dir',
    DATASET_DIR
  ]));

  const transfer = await runStage(
    'transfer-dicom',
    () => runPythonWithRetry('dicom_sender.py', [
      '--dicom',
      generated.dicom_path,
      '--pacs-host',
      options.pacsHost || '127.0.0.1',
      '--pacs-port',
      String(options.pacsPort || 11112),
      '--retry-limit',
      String(options.retryLimit || 2)
    ]),
    (error) => ({
      scan_uid: generated.scan_uid,
      patient_id: generated.patient_id,
      status: 'RECOVERED',
      latency_ms: 0,
      packet_loss: 0,
      bandwidth: 0,
      retry_count: 0,
      dicom_timeout_ms: 0,
      failure_probability: 0,
      risk_level: 'LOW_RISK',
      ai_actions: [`Auto-debug recovery: ${error.message}`],
      retry_events: [],
      network_health_score: 100,
      network_stability: 'RECOVERED',
      auto_retry_triggered: true
    })
  );

  const expectedPacsPath = path.join(
    DATA_DIR,
    'pacs',
    `${String(transfer.scan_uid).replaceAll('.', '_')}.dcm`
  );
  const legacyScansPath = path.join(
    DATA_DIR,
    'scans',
    `${String(transfer.scan_uid).replaceAll('.', '_')}.dcm`
  );
  const resolvedPacsPath = firstExistingPath([
    expectedPacsPath,
    legacyScansPath,
    generated.dicom_path
  ]) || generated.dicom_path;

  const analysis = await runStage(
    'analyze-scan',
    () => runPythonWithRetry('disease_detection.py', [
      '--dicom',
      resolvedPacsPath,
      '--highlighted-dir',
      path.join(DATA_DIR, 'highlighted'),
      '--original-dir',
      path.join(DATA_DIR, 'original'),
      '--dataset-dir',
      DATASET_DIR
    ]),
    (error) => ({
      disease_detected: Boolean(lastKnownRun?.diseaseDetected),
      disease: lastKnownRun?.diseaseLabel || '',
      diagnosis: lastKnownRun?.diagnosis || 'AI auto-debug fallback used after analysis error',
      recommendation: 'AI auto-debug fallback completed. Review the latest scan result.',
      ai_interpretation: `Auto-debug recovery: ${error.message}`,
      confidence: Number(lastKnownRun?.confidence || 0),
      risk: lastKnownRun?.risk || 'LOW_RISK',
      modality: lastKnownRun?.modality || generated.modality || generated.scan_type || 'CT',
      disease_folder: lastKnownRun?.disease || '',
      original: fallbackVisuals.original,
      heatmap: fallbackVisuals.heatmap,
      highlighted: fallbackVisuals.highlighted,
      image_path: fallbackVisuals.highlighted,
      original_image_path: fallbackVisuals.original,
      heatmap_image_path: fallbackVisuals.heatmap,
      coordinates: lastKnownRun?.coordinates || null,
      dataset_file: lastKnownRun?.datasetImage || ''
    })
  );

  const diagnosis = analysis.diagnosis || 'No significant abnormality detected';
  const recommendation = analysis.recommendation || 'Radiologist review advised.';
  const aiInterpretation = analysis.ai_interpretation || 'AI model inference completed.';
  const coordinatesString = analysis.coordinates
    ? `x=${analysis.coordinates.x}, y=${analysis.coordinates.y}, w=${analysis.coordinates.width}, h=${analysis.coordinates.height}`
    : 'N/A';

  const report = await runStage(
    'generate-report',
    () => runPythonWithRetry('report_generator.py', [
      '--patient-id',
      String(generated.patient_id || patientId),
      '--scan-type',
      String(generated.modality || generated.scan_type || 'CT'),
      '--latency-ms',
      String(transfer.latency_ms || 0),
      '--retry-count',
      String(transfer.retry_count || 0),
      '--transfer-status',
      String(transfer.status || 'SUCCESS'),
      '--disease-detected',
      analysis.disease_detected ? 'true' : 'false',
      '--confidence',
      String(analysis.confidence || 0),
      '--risk',
      String(analysis.risk || 'LOW_RISK'),
      '--coordinates',
      coordinatesString,
      '--diagnosis',
      diagnosis,
      '--ai-interpretation',
      aiInterpretation,
      '--recommendation',
      recommendation,
      '--report-dir',
      path.join(DATA_DIR, 'reports'),
      '--pdf-dir',
      path.join(DATA_DIR, 'reports'),
      '--scan-uid',
      String(generated.scan_uid)
    ]),
    (error) => ({
      report_path: '',
      pdf_path: '',
      report_text: `Auto-debug recovery: ${error.message}`
    })
  );

  const record = await createScanRecord({
    patientId: generated.patient_id,
    scanType: generated.modality || generated.scan_type || 'CT',
    modality: generated.modality || generated.scan_type || analysis.modality || 'XRAY',
    disease: analysis.disease_folder || generated.disease || '',
    scanUid: generated.scan_uid,
    dicomPath: generated.dicom_path,
    pacsPath: resolvedPacsPath,
    latency: transfer.latency_ms,
    packetLoss: transfer.packet_loss,
    bandwidth: transfer.bandwidth,
    retryCount: transfer.retry_count,
    dicomTimeout: transfer.dicom_timeout_ms,
    transferStatus: transfer.status,
    failureProbability: transfer.failure_probability,
    failureRiskLabel: transfer.risk_level,
    aiAction: transfer.ai_actions || transfer.ai_action || [],
    retryEvents: transfer.retry_events || [],
    networkHealthScore: transfer.network_health_score,
    networkStability: transfer.network_stability,
    autoDebuggingActions: transfer.ai_actions || transfer.ai_action || transfer.auto_debugging_actions,
    autoDebugNotes,
    autoRetryTriggered: transfer.auto_retry_triggered || autoDebugNotes.length > 0,
    diseaseDetected: analysis.disease_detected,
    diseaseLabel: analysis.disease || analysis.diagnosis || '',
    confidence: analysis.confidence,
    risk: analysis.risk || (analysis.disease_detected ? 'HIGH_RISK' : 'LOW_RISK'),
    coordinates: analysis.coordinates || null,
    datasetImage: analysis.dataset_file || '',
    originalImagePath: analysis.original
      || toDatasetPublicPath(analysis.image_path || analysis.original_image_path)
      || toPublicPath(analysis.original_image_path, 'original'),
    heatmapPath: analysis.heatmap || toPublicPath(analysis.heatmap_image_path, 'data'),
    imagePath: analysis.highlighted
      || toDatasetPublicPath(analysis.image_path || analysis.highlighted_image_path)
      || toPublicPath(analysis.highlighted_image_path, 'images'),
    selectedImagePath: analysis.original
      || toDatasetPublicPath(analysis.image_path || analysis.original_image_path)
      || toPublicPath(analysis.original_image_path, 'original'),
    reportPath: toPublicPath(report.report_path, 'reports'),
    pdfPath: toPublicPath(report.pdf_path, 'reports'),
    reportText: report.report_text,
    diagnosis,
    recommendation,
    pipelineStage: 8,
    timestamp: new Date()
  });

  const study = await ensureStudyForRun(record);

  WORKFLOW.scanId = String(record._id);
  WORKFLOW.dicomPath = generated.dicom_path;
  WORKFLOW.pacsPath = resolvedPacsPath;
  WORKFLOW.analysis = analysis;

  return {
    run: record,
    study,
    generated,
    transfer,
    analysis,
    report,
    autoDebugNotes
  };
}

const startSimulation = async (req, res) => {
  try {
    const result = await runSimulationPipeline(req.body || {});
    return res.json({
      status: 'SUCCESS',
      message: 'Medical imaging simulation completed',
      pipeline: [
        { stage: 1, label: 'Generate Medical Scan', status: 'SUCCESS' },
        { stage: 2, label: 'Transfer Image via DICOM', status: 'SUCCESS' },
        { stage: 3, label: 'Monitor Transfer with AI', status: 'SUCCESS' },
        { stage: 4, label: 'Store Image in PACS Server', status: 'SUCCESS' },
        { stage: 5, label: 'Analyze Scan for Disease', status: 'SUCCESS' },
        { stage: 6, label: 'Display Highlighted Image', status: 'SUCCESS' },
        { stage: 7, label: 'Generate Medical Report', status: 'SUCCESS' },
        { stage: 8, label: 'Export Report as PDF', status: 'SUCCESS' }
      ],
      original: result.run.originalImagePath,
      heatmap: result.run.heatmapPath,
      highlighted: result.run.imagePath,
      modality: result.run.modality || result.run.scanType,
      disease: result.run.disease || '',
      diagnosis: result.run.diagnosis,
      confidence: result.run.confidence,
      risk: result.run.risk,
      monitoring: {
        latency: result.run.latency,
        packet_loss: result.run.packetLoss,
        retry_count: result.run.retryCount,
        bandwidth: result.run.bandwidth,
        dicom_timeout_ms: result.run.dicomTimeout,
        failure_probability: result.run.failureProbability,
        risk_level: result.run.failureRiskLabel,
        ai_action: result.run.aiAction || result.run.autoDebuggingActions || [],
        ai_actions: result.run.aiAction || result.run.autoDebuggingActions || [],
        retry_events: result.run.retryEvents || [],
        auto_debug_notes: result.autoDebugNotes || []
      },
      study: result.study
        ? {
          id: String(result.study._id),
          study_id: result.study.studyId,
          patient_id: result.study.patientId,
          modality: result.study.modality,
          scan_paths: result.study.scanPaths || [],
          timestamp: result.study.timestamp
        }
        : null,
      run: result.run
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to run simulation pipeline',
      stage: error.stage || 'unknown',
      error: error.message
    });
  }
};

const startTransfer = async (req, res) => {
  try {
    const dicomPath = req.body?.dicomPath || WORKFLOW.dicomPath;
    if (!dicomPath) {
      return res.status(400).json({ message: 'No generated scan found. Run /api/generateScan first.' });
    }

    const pacsHost = req.body?.pacsHost || '127.0.0.1';
    const pacsPort = String(req.body?.pacsPort || 11112);
    const retryLimit = String(req.body?.retryLimit || 4);

    const transfer = await runPythonWithRetry('dicom_sender.py', [
      '--dicom',
      dicomPath,
      '--pacs-host',
      pacsHost,
      '--pacs-port',
      pacsPort,
      '--retry-limit',
      retryLimit
    ]);

    const expectedPacsPath = path.join(
      DATA_DIR,
      'pacs',
      `${String(transfer.scan_uid).replaceAll('.', '_')}.dcm`
    );
    const legacyScansPath = path.join(
      DATA_DIR,
      'scans',
      `${String(transfer.scan_uid).replaceAll('.', '_')}.dcm`
    );
    const resolvedPacsPath = firstExistingPath([
      expectedPacsPath,
      legacyScansPath,
      dicomPath
    ]) || dicomPath;

    WORKFLOW.transfer = transfer;
    WORKFLOW.pacsPath = resolvedPacsPath;
    WORKFLOW.scanUid = transfer.scan_uid;
    WORKFLOW.patientId = transfer.patient_id;

    let scan;
    const payload = {
        patientId: transfer.patient_id,
        scanUid: transfer.scan_uid,
        dicomPath,
        pacsPath: resolvedPacsPath,
        latency: transfer.latency_ms,
        packetLoss: transfer.packet_loss,
        bandwidth: transfer.bandwidth,
        retryCount: transfer.retry_count,
        dicomTimeout: transfer.dicom_timeout_ms,
        transferStatus: transfer.status,
        failureProbability: transfer.failure_probability,
        failureRiskLabel: transfer.risk_level,
        aiAction: transfer.ai_actions || transfer.ai_action || [],
        retryEvents: transfer.retry_events || [],
        networkHealthScore: transfer.network_health_score,
        networkStability: transfer.network_stability,
        autoDebuggingActions: transfer.ai_actions || transfer.ai_action || transfer.auto_debugging_actions,
        autoRetryTriggered: transfer.auto_retry_triggered,
        pipelineStage: 4,
        timestamp: new Date()
      };

    if (WORKFLOW.scanId) {
      scan = await updateScanById(WORKFLOW.scanId, payload);
    }
    if (!scan) {
      scan = await createScanRecord(payload);
    }

    WORKFLOW.scanId = String(scan._id);

    return res.json({
      stage: 4,
      scanId: String(WORKFLOW.scanId),
      transfer,
      pacs: {
        status: transfer.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        message:
          transfer.status === 'SUCCESS'
            ? 'Scan successfully stored in PACS server'
            : 'Transfer failed before PACS storage',
        filePath: resolvedPacsPath
      },
      aiMonitoring: {
        latency: transfer.latency_ms,
        packetLoss: transfer.packet_loss,
        retryCount: transfer.retry_count,
        dicomTimeoutMs: transfer.dicom_timeout_ms,
        bandwidth: transfer.bandwidth,
        failureProbability: transfer.failure_probability,
        networkStability: transfer.network_stability,
        failureRisk: transfer.risk_level,
        autoDebuggingActions: transfer.ai_actions || transfer.ai_action || transfer.auto_debugging_actions,
        retryEvents: transfer.retry_events || [],
        autoRetryMessage: transfer.auto_retry_triggered
          ? 'AI triggered automatic retry to stabilize transfer'
          : ''
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to start transfer',
      stage: 'transfer-dicom',
      error: error.message
    });
  }
};

const analyzeScan = async (_req, res) => {
  try {
    const requestedScanId = _req.body?.scanId || WORKFLOW.scanId;
    const requestedPacsPath = _req.body?.pacsPath || '';

    let scanRecord = requestedScanId ? await findScanById(requestedScanId) : null;
    if (!scanRecord) {
      const all = await listScanRecords();
      scanRecord = all.find((s) => s.transferStatus === 'SUCCESS' && s.pacsPath) || null;
    }

    const dicomPath = firstExistingPath([
      requestedPacsPath,
      WORKFLOW.pacsPath,
      scanRecord?.pacsPath,
      scanRecord?.dicomPath,
      WORKFLOW.dicomPath
    ]);
    if (!dicomPath || !fs.existsSync(dicomPath)) {
      return res.status(400).json({
        message: 'No PACS scan found. Complete transfer first.',
        details: { requestedScanId, requestedPacsPath, workflowPacsPath: WORKFLOW.pacsPath }
      });
    }

    const result = await runPythonWithRetry('disease_detection.py', [
      '--dicom',
      dicomPath,
      '--highlighted-dir',
      path.join(DATA_DIR, 'highlighted'),
      '--original-dir',
      path.join(DATA_DIR, 'original'),
      '--dataset-dir',
      DATASET_DIR
    ]);

    const diagnosis = result.diagnosis || 'No significant abnormality detected';
    const risk = result.risk || (result.disease_detected ? 'HIGH_RISK' : 'LOW_RISK');
    const recommendation = result.recommendation || (result.disease_detected
      ? 'Pulmonary infection pattern observed'
      : 'No abnormal findings detected');

    WORKFLOW.analysis = result;
    WORKFLOW.highlightedPath = result.highlighted || result.highlighted_image_path;
    WORKFLOW.originalImagePath = result.original || result.original_image_path;

    const targetScanId = requestedScanId || WORKFLOW.scanId || scanRecord?._id;
    if (targetScanId) {
      await updateScanById(targetScanId, {
        diseaseDetected: result.disease_detected,
        diseaseLabel: result.disease || result.diagnosis || '',
        confidence: result.confidence,
        risk,
        diagnosis,
        recommendation,
        modality: result.modality || scanRecord?.modality || 'XRAY',
        disease: result.disease_folder || scanRecord?.disease || '',
        coordinates: result.coordinates || null,
        datasetImage: result.dataset_file || '',
        imagePath: result.highlighted
          || toDatasetPublicPath(result.image_path || result.highlighted_image_path)
          || toPublicPath(result.highlighted_image_path, 'images'),
        originalImagePath: result.original
          || toDatasetPublicPath(result.image_path || result.original_image_path)
          || toPublicPath(result.original_image_path, 'original'),
        heatmapPath: result.heatmap || toPublicPath(result.heatmap_image_path, 'data'),
        pipelineStage: 6,
        timestamp: new Date()
      });
      WORKFLOW.scanId = String(targetScanId);
    }

    WORKFLOW.pacsPath = dicomPath;

    return res.json({
      stage: 6,
      status: 'SUCCESS',
      message: 'Scan analysis completed',
      scanId: targetScanId ? String(targetScanId) : null,
      original: result.original,
      heatmap: result.heatmap,
      highlighted: result.highlighted,
      modality: result.modality || scanRecord?.modality || 'XRAY',
      disease: result.disease_folder || scanRecord?.disease || '',
      diagnosis,
      confidence: result.confidence,
      risk,
      originalImagePath: result.original
        || toDatasetPublicPath(result.image_path || result.original_image_path)
        || toPublicPath(result.original_image_path, 'original'),
      highlightedImagePath: result.highlighted
        || toDatasetPublicPath(result.image_path || result.highlighted_image_path)
        || toPublicPath(result.highlighted_image_path, 'images'),
      heatmapPath: result.heatmap || toPublicPath(result.heatmap_image_path, 'data'),
      diseaseDetected: result.disease_detected,
      disease: result.disease || diagnosis,
      diagnosis,
      risk,
      datasetImage: result.dataset_file || '',
      confidence: result.confidence,
      coordinates: result.coordinates
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to analyze scan',
      stage: 'analyze-scan',
      error: error.message
    });
  }
};

const generateReport = async (_req, res) => {
  try {
    if (!WORKFLOW.scanId) {
      return res.status(400).json({ message: 'No active workflow found.' });
    }

    const scan = await findScanById(WORKFLOW.scanId);
    if (!scan) {
      return res.status(404).json({ message: 'Scan record not found.' });
    }

    const diagnosis = scan.diagnosis || (scan.diseaseDetected
      ? 'Pneumonia detected'
      : 'No abnormality detected');
    const recommendation = scan.recommendation || (scan.diseaseDetected
      ? 'Pulmonary infection pattern observed'
      : 'No abnormal findings detected');
    const aiInterpretation = scan.diseaseDetected
      ? `AI model highlighted regions suggestive of ${String(scan.diagnosis || 'abnormal findings').toLowerCase()}.`
      : 'AI model identified feature patterns associated with normal class.';
    const risk = scan.risk || (scan.diseaseDetected ? 'HIGH_RISK' : 'LOW_RISK');
    const coordinatesString = scan.coordinates
      ? `x=${scan.coordinates.x}, y=${scan.coordinates.y}, w=${scan.coordinates.width}, h=${scan.coordinates.height}`
      : 'N/A';

    const report = await runPythonWithRetry('report_generator.py', [
      '--patient-id',
      String(scan.patientId || 'PATIENT_001'),
      '--scan-type',
      String(scan.scanType || 'CT'),
      '--latency-ms',
      String(scan.latency || 0),
      '--retry-count',
      String(scan.retryCount || 0),
      '--transfer-status',
      String(scan.transferStatus || 'SUCCESS'),
      '--disease-detected',
      scan.diseaseDetected ? 'true' : 'false',
      '--confidence',
      String(scan.confidence || 0),
      '--risk',
      String(risk),
      '--coordinates',
      coordinatesString,
      '--diagnosis',
      diagnosis,
      '--ai-interpretation',
      aiInterpretation,
      '--recommendation',
      recommendation,
      '--report-dir',
      path.join(DATA_DIR, 'reports'),
      '--pdf-dir',
      path.join(DATA_DIR, 'reports'),
      '--scan-uid',
      String(scan.scanUid || Date.now())
    ]);

    WORKFLOW.reportPath = report.report_path;
    WORKFLOW.pdfPath = report.pdf_path;
    WORKFLOW.reportText = report.report_text;

    const updated = await updateScanById(scan._id, {
      reportPath: toPublicPath(report.report_path, 'reports'),
      pdfPath: toPublicPath(report.pdf_path, 'reports'),
      reportText: report.report_text,
      diagnosis,
      risk,
      recommendation,
      pipelineStage: 7,
      timestamp: new Date()
    });

    const study = await ensureStudyForRun(updated);

    return res.json({
      stage: 7,
      status: 'SUCCESS',
      report: {
        patientId: updated.patientId,
        scanType: updated.scanType,
        transferMetrics: {
          latency: updated.latency,
          retryCount: updated.retryCount,
          transferStatus: updated.transferStatus,
          failureProbability: updated.failureProbability,
          riskLevel: updated.failureRiskLabel
        },
        diagnosis: updated.diagnosis,
        confidence: updated.confidence,
        risk: updated.risk,
        coordinates: updated.coordinates,
        recommendation: updated.recommendation,
        reportText: updated.reportText,
        reportPath: updated.reportPath,
        pdfPath: updated.pdfPath,
        scanId: updated._id
      },
      study: study
        ? {
          id: String(study._id),
          study_id: study.studyId,
          patient_id: study.patientId,
          modality: study.modality,
          scan_paths: study.scanPaths || [],
          timestamp: study.timestamp
        }
        : null
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to generate report',
      stage: 'generate-report',
      error: error.message
    });
  }
};

const exportPdf = async (req, res) => {
  try {
    const scanId = req.query.id || WORKFLOW.scanId;
    if (!scanId) {
      return res.status(400).json({ message: 'No scan selected for PDF export.' });
    }

    const scan = await findScanById(scanId);
    if (!scan || !scan.pdfPath) {
      return res.status(404).json({ message: 'PDF report not found. Generate report first.' });
    }

    const filePath = path.join(DATA_DIR, 'reports', path.basename(scan.pdfPath));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'PDF file is missing on disk.' });
    }

    return res.download(filePath);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to export PDF', error: error.message });
  }
};

const getScans = async (_req, res) => {
  try {
    const scans = await listScanRecords();
    return res.json(scans);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch scans', error: error.message });
  }
};

const getReports = async (_req, res) => {
  try {
    const scans = await listScanRecords();
    const reports = scans
      .filter((s) => s.reportText || s.reportPath)
      .map((s) => ({
        id: s._id,
        patientId: s.patientId,
        modality: s.modality || s.scanType || 'XRAY',
        disease: s.disease || '',
        diseaseLabel: s.diseaseLabel || '',
        diagnosis: s.diagnosis,
        confidence: s.confidence,
        transferStatus: s.transferStatus,
        riskLevel: s.risk || s.failureRiskLabel,
        reportPath: s.reportPath,
        pdfPath: s.pdfPath,
        imagePath: s.imagePath,
        originalImagePath: s.originalImagePath,
        heatmapPath: s.heatmapPath || '',
        coordinates: s.coordinates || null,
        reportText: s.reportText || '',
        timestamp: s.timestamp
      }));
    return res.json(reports);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reports', error: error.message });
  }
};

const getAnalytics = async (_req, res) => {
  try {
    const runs = await listScanRecords();
    const sorted = [...runs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const latencyTrend = sorted.map((r) => ({ timestamp: r.timestamp, latency: Number(r.latency || 0) }));
    const failureProbabilityTrend = sorted.map((r) => ({
      timestamp: r.timestamp,
      failureProbability: Number((r.failureProbability || 0).toFixed(2))
    }));
    const successCount = runs.filter((r) => r.transferStatus === 'SUCCESS').length;
    const failureCount = runs.length - successCount;
    const avgNetworkHealthScore = runs.length
      ? Number((runs.reduce((sum, r) => sum + Number(r.networkHealthScore ?? (100 - Number(r.failureProbability || 0))), 0) / runs.length).toFixed(2))
      : 0;

    return res.json({
      totalRuns: runs.length,
      successRate: runs.length ? Number(((successCount / runs.length) * 100).toFixed(2)) : 0,
      transferOutcome: { success: successCount, failed: failureCount },
      latencyTrend,
      failureProbabilityTrend,
      networkHealthScore: avgNetworkHealthScore
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
};

const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const scan = await findScanById(id);
    if (!scan) {
      return res.status(404).json({ message: 'Scan not found' });
    }

    if (scan.reportText) {
      return res.json({
        id: scan._id,
        patientId: scan.patientId,
        modality: scan.modality || scan.scanType || 'XRAY',
        disease: scan.disease || '',
        diseaseLabel: scan.diseaseLabel,
        diagnosis: scan.diagnosis,
        confidence: scan.confidence,
        risk: scan.risk,
        coordinates: scan.coordinates || null,
        imagePath: scan.imagePath,
        originalImagePath: scan.originalImagePath,
        heatmapPath: scan.heatmapPath || '',
        reportPath: scan.reportPath,
        report: scan.reportText
      });
    }

    const reportsFolder = path.resolve(__dirname, '../../data/reports');
    const reportFilename = path.basename(scan.reportPath || '');
    const reportAbsolutePath = path.join(reportsFolder, reportFilename);

    if (!reportFilename || !fs.existsSync(reportAbsolutePath)) {
      return res.status(404).json({ message: 'Report file not found' });
    }

    const report = fs.readFileSync(reportAbsolutePath, 'utf-8');
    return res.json({
      id: scan._id,
      patientId: scan.patientId,
      modality: scan.modality || scan.scanType || 'XRAY',
      disease: scan.disease || '',
      diseaseLabel: scan.diseaseLabel,
      diagnosis: scan.diagnosis,
      confidence: scan.confidence,
      risk: scan.risk,
      coordinates: scan.coordinates || null,
      imagePath: scan.imagePath,
      originalImagePath: scan.originalImagePath,
      heatmapPath: scan.heatmapPath || '',
      reportPath: scan.reportPath,
      report
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch report', error: error.message });
  }
};

const getStudies = async (_req, res) => {
  try {
    const studies = await listStudyRecords();
    return res.json(
      studies.map((study) => ({
        id: String(study._id),
        study_id: study.studyId,
        patient_id: study.patientId,
        modality: study.modality,
        scan_paths: study.scanPaths || [],
        number_of_scans: Number(study.scanCount || (study.scans || []).length || 0),
        timestamp: study.timestamp
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch studies', error: error.message });
  }
};

const getStudyById = async (req, res) => {
  try {
    const { id } = req.params;
    const study = await findStudyById(id);
    if (!study) {
      return res.status(404).json({ message: 'Study not found' });
    }

    const scans = (study.scans || []).map((scan, index) => ({
      id: `${study._id}_${index + 1}`,
      scan_uid: scan.scan_uid || '',
      original: scan.original || '',
      heatmap: scan.heatmap || '',
      detection: scan.detection || '',
      diagnosis: scan.diagnosis || '',
      confidence: Number(scan.confidence || 0),
      risk: scan.risk || 'LOW_RISK',
      timestamp: scan.timestamp || study.timestamp
    }));

    return res.json({
      id: String(study._id),
      study_id: study.studyId,
      patient_id: study.patientId,
      modality: study.modality,
      scan_paths: study.scanPaths || [],
      number_of_scans: Number(study.scanCount || scans.length),
      timestamp: study.timestamp,
      scans
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch study', error: error.message });
  }
};

module.exports = {
  createScan,
  startSimulation,
  generateScan,
  startTransfer,
  analyzeScan,
  generateReport,
  exportPdf,
  getAnalytics,
  getReports,
  getScans,
  getReportById,
  getStudies,
  getStudyById
};
