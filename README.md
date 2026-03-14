# DICOM-AI Medical Imaging System

Fully interactive hospital imaging workflow simulator:

1. Generate CT Scan
2. Transfer Image via DICOM
3. Monitor Transfer with AI
4. Store Image in PACS Server
5. Analyze Scan for Disease
6. Display Highlighted Image
7. Generate Medical Report
8. Export Report as PDF

## 1) Project Structure

```text
dicom-ai-system
├── python-services
│   ├── ct_generator.py
│   ├── dicom_sender.py
│   ├── pacs_server.py
│   ├── ct_sender.py
│   ├── transfer_ai.py
│   ├── disease_detection.py
│   └── report_generator.py
├── backend
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── routes
│   │   └── scanRoutes.js
│   ├── models
│   │   └── Scan.js
│   └── controllers
│       └── scanController.js
├── frontend
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src
│       ├── App.jsx
│       ├── main.jsx
│       ├── styles.css
│       ├── components
│       │   ├── LatencyChart.jsx
│       │   ├── PipelineProgress.jsx
│       │   └── StatusBadge.jsx
│       ├── pages
│       │   └── Dashboard.jsx
│       └── services
│           └── api.js
├── data
│   ├── pacs
│   ├── original
│   ├── scans
│   ├── highlighted
│   └── reports
├── requirements.txt
└── README.md
```

---

## 2) Workflow Orchestration

React dashboard triggers backend APIs step-by-step.
Backend executes Python services via `child_process`.

- `POST /api/generateScan` → `ct_generator.py`
- `POST /api/startTransfer` → `dicom_sender.py` (uses `transfer_ai.py`) + PACS C-STORE
- `POST /api/analyzeScan` → `disease_detection.py`
- `POST /api/generateReport` → `report_generator.py` (text + PDF)
- `GET /api/exportPDF?id=<scanId>` → download PDF
- `POST /api/startSimulation` → full 8-stage pipeline in one call
- `GET /api/analytics` → latency/success/confidence analytics
- `GET /api/reports` → historical report list

## 3) Frontend Pages

- `/home` (landing page)
- `/dashboard`
- `/simulation`
- `/analytics`
- `/reports`
- `/about`
- `/login`

Includes a collapsible sidebar, status badges, charts, report export, and full simulation workflow.

---

## 4) Dependencies Installation

### Python services

```powershell
cd "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Backend

```powershell
cd "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\backend"
npm install
```

### Frontend

```powershell
cd "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\frontend"
npm install
```

---

## 5) Run Components (Local End-to-End)

Open separate terminals.

### A) Start MongoDB

Run local MongoDB service (default URI used by backend):

```text
mongodb://127.0.0.1:27017/dicom_ai
```

### B) Start backend API

Create `.env` in `backend` (or copy from `.env.example`):

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/dicom_ai
PORT=5000
PYTHON_EXECUTABLE=c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\.venv\Scripts\python.exe
```

```powershell
cd "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\backend"
node server.js
```

Backend runs at `http://127.0.0.1:5000`.

### C) Start PACS server

```powershell
cd "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\python-services"
& "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\.venv\Scripts\python.exe" pacs_server.py --host 0.0.0.0 --port 11112
```

### D) Start frontend dashboard

```powershell
cd "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\frontend"
npm run dev
```

Open: `http://127.0.0.1:5173`

### E) Run CT simulator manually (optional)

```powershell
cd "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\python-services"
& "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\.venv\Scripts\python.exe" ct_generator.py --output-dir "c:\Users\Karthik\OneDrive\Desktop\PES_Hack\dicom-ai-system\data\scans"
```

Recommended flow is UI buttons in dashboard.

---

## 6) API Endpoints

### `POST /api/generateScan`
Generate CT DICOM.

```bash
curl -X POST http://127.0.0.1:5000/api/generateScan -H "Content-Type: application/json" -d "{}"
```

### `POST /api/startTransfer`
Start DICOM C-STORE transfer and return transfer telemetry.

```bash
curl -X POST http://127.0.0.1:5000/api/startTransfer -H "Content-Type: application/json" -d "{}"
```

### `POST /api/analyzeScan`
Analyze PACS DICOM and generate original/highlighted images.

```bash
curl -X POST http://127.0.0.1:5000/api/analyzeScan -H "Content-Type: application/json" -d "{}"
```

### `POST /api/generateReport`
Generate structured report and PDF.

```bash
curl -X POST http://127.0.0.1:5000/api/generateReport -H "Content-Type: application/json" -d "{}"
```

### `GET /api/exportPDF?id=<scanId>`
Download generated report PDF.

```bash
curl -L "http://127.0.0.1:5000/api/exportPDF?id=<scanId>" -o report.pdf
```

### `POST /api/startSimulation`
Run entire workflow in a single API call.

```bash
curl -X POST http://127.0.0.1:5000/api/startSimulation -H "Content-Type: application/json" -d "{}"
```

### `GET /api/analytics`
Get analytics metrics for dashboard charts.

```bash
curl http://127.0.0.1:5000/api/analytics
```

### `GET /api/reports`
Get historical report list.

```bash
curl http://127.0.0.1:5000/api/reports
```

### `GET /api/scans`
Get all stored scans.

```bash
curl http://127.0.0.1:5000/api/scans
```

### `GET /api/report/:id`
Get report text for a scan.

```bash
curl http://127.0.0.1:5000/api/report/<scan_id>
```

---

## 7) Data Output Locations

- PACS DICOM files: `data/pacs`
- Generated source scans: `data/scans`
- Original PNG previews: `data/original`
- Highlighted images: `data/highlighted`
- Generated reports (txt/pdf): `data/reports`

---

## 8) Notes

- This project is a simulation for engineering/demo use.
- AI modules are intentionally lightweight mock models.
- Diagnostic decisions must always be made by licensed radiologists.
