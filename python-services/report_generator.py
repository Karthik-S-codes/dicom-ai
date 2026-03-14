"""Report generation utilities for DICOM-AI Medical Imaging System."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def generate_report_text(
    patient_id: str,
    scan_type: str,
    latency_ms: float,
    retry_count: int,
    transfer_status: str,
    disease_detected: bool,
    confidence: float,
    risk: str,
    coordinates: str,
    diagnosis: str,
    ai_interpretation: str,
    recommendation: str,
) -> str:
    """Generate a clinical-style report text from inference outputs."""
    return (
        f"DICOM-AI Structured Medical Report\n"
        f"Generated: {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}\n"
        f"Patient ID: {patient_id}\n"
        f"Scan Type: {scan_type}\n"
        f"Transfer Status: {transfer_status}\n"
        f"Latency: {latency_ms:.2f} ms\n"
        f"Retry Count: {retry_count}\n"
        f"Risk Level: {risk}\n"
        f"Diagnosis: {diagnosis}\n"
        f"Model Confidence: {confidence:.2%}\n\n"
        f"Detection Coordinates: {coordinates}\n\n"
        f"AI Interpretation: {ai_interpretation}\n"
        f"Impression: {'Classification suggests clinically relevant abnormal findings.' if disease_detected else 'Classification suggests no significant abnormality.'}\n"
        f"Recommendation: {recommendation}\n"
        f"Note: This is an AI-assisted triage output and not a definitive diagnosis."
    )


def save_report(report_text: str, report_dir: Path, scan_uid: str) -> Path:
    """Persist report text to disk and return path."""
    report_dir.mkdir(parents=True, exist_ok=True)
    safe_uid = scan_uid.replace('.', '_')
    report_path = report_dir / f"{safe_uid}_report.txt"
    report_path.write_text(report_text, encoding="utf-8")
    return report_path


def save_report_pdf(report_text: str, pdf_dir: Path, scan_uid: str) -> Path:
    """Render report into a PDF file."""
    pdf_dir.mkdir(parents=True, exist_ok=True)
    safe_uid = scan_uid.replace('.', '_')
    pdf_path = pdf_dir / f"{safe_uid}_report.pdf"

    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    y = height - 50
    c.setFont("Helvetica", 11)

    for line in report_text.splitlines():
        c.drawString(40, y, line[:140])
        y -= 16
        if y < 50:
            c.showPage()
            c.setFont("Helvetica", 11)
            y = height - 50

    c.save()
    return pdf_path


def generate_and_save_report(
    patient_id: str,
    scan_type: str,
    latency_ms: float,
    retry_count: int,
    transfer_status: str,
    disease_detected: bool,
    confidence: float,
    risk: str,
    coordinates: str,
    diagnosis: str,
    ai_interpretation: str,
    recommendation: str,
    report_dir: Path,
    pdf_dir: Path,
    scan_uid: str,
) -> Dict[str, str]:
    """Generate and save report, returning text and file path."""
    text = generate_report_text(
        patient_id,
        scan_type,
        latency_ms,
        retry_count,
        transfer_status,
        disease_detected,
        confidence,
        risk,
        coordinates,
        diagnosis,
        ai_interpretation,
        recommendation,
    )
    txt_path = save_report(text, report_dir, scan_uid)
    pdf_path = save_report_pdf(text, pdf_dir, scan_uid)
    return {"report_text": text, "report_path": str(txt_path), "pdf_path": str(pdf_path)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate report text and PDF")
    parser.add_argument("--patient-id", required=True)
    parser.add_argument("--scan-type", default="CT")
    parser.add_argument("--latency-ms", type=float, default=0.0)
    parser.add_argument("--retry-count", type=int, default=0)
    parser.add_argument("--transfer-status", default="SUCCESS")
    parser.add_argument("--disease-detected", choices=["true", "false"], default="false")
    parser.add_argument("--confidence", type=float, default=0.0)
    parser.add_argument("--risk", default="LOW_RISK")
    parser.add_argument("--coordinates", default="N/A")
    parser.add_argument("--diagnosis", default="No significant abnormality")
    parser.add_argument("--ai-interpretation", default="AI model inference completed")
    parser.add_argument("--recommendation", default="Radiologist review advised")
    parser.add_argument("--report-dir", required=True)
    parser.add_argument("--pdf-dir", required=True)
    parser.add_argument("--scan-uid", required=True)
    args = parser.parse_args()

    result = generate_and_save_report(
        patient_id=args.patient_id,
        scan_type=args.scan_type,
        latency_ms=args.latency_ms,
        retry_count=args.retry_count,
        transfer_status=args.transfer_status,
        disease_detected=args.disease_detected == "true",
        confidence=args.confidence,
        risk=args.risk,
        coordinates=args.coordinates,
        diagnosis=args.diagnosis,
        ai_interpretation=args.ai_interpretation,
        recommendation=args.recommendation,
        report_dir=Path(args.report_dir),
        pdf_dir=Path(args.pdf_dir),
        scan_uid=args.scan_uid,
    )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
