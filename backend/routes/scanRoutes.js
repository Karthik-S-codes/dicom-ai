const express = require('express');
const {
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
} = require('../controllers/scanController');

const router = express.Router();

router.post('/scan', createScan);
router.post('/startSimulation', startSimulation);
router.post('/generateScan', generateScan);
router.post('/startTransfer', startTransfer);
router.post('/analyzeScan', analyzeScan);
router.post('/generateReport', generateReport);
router.get('/exportPDF', exportPdf);
router.get('/analytics', getAnalytics);
router.get('/reports', getReports);
router.get('/scans', getScans);
router.get('/report/:id', getReportById);
router.get('/studies', getStudies);
router.get('/study/:id', getStudyById);

module.exports = router;
