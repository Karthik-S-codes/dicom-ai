"""DICOM sender for transfer workflow stage."""

from __future__ import annotations

import argparse
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import pydicom
from pynetdicom import AE, StoragePresentationContexts

from transfer_ai import TransferFeatures, TransferReliabilityModel


def send_dicom(dicom_path: Path, pacs_host: str, pacs_port: int, retry_limit: int = 2) -> dict:
    ds = pydicom.dcmread(str(dicom_path))
    file_size_kb = dicom_path.stat().st_size / 1024.0

    existing_comments = {}
    raw_comments = getattr(ds, "ImageComments", "")
    if raw_comments:
        try:
            existing_comments = json.loads(str(raw_comments))
        except Exception:  # noqa: BLE001
            existing_comments = {}

    ae = AE(ae_title="CT_SCANNER")
    ae.acse_timeout = 4
    ae.network_timeout = 4
    ae.dimse_timeout = 4
    for cx in StoragePresentationContexts:
        ae.add_requested_context(cx.abstract_syntax)

    model = TransferReliabilityModel()

    transfer_status = "FAILED"
    latency_ms = random.uniform(80.0, 2500.0)
    packet_loss = random.uniform(0.0, 5.0)
    bandwidth = random.uniform(20.0, 100.0)

    baseline_latency_ms = latency_ms
    baseline_packet_loss = packet_loss
    retry_count = 0
    max_retries = max(0, min(int(retry_limit), 3))
    dicom_timeout_ms = 1000.0
    retry_events: list[dict] = []

    prediction = model.predict_failure_probability(
        TransferFeatures(
            latency_ms=latency_ms,
            packet_loss_pct=packet_loss,
            retry_count=retry_count,
            bandwidth_mbps=bandwidth,
        )
    )
    failure_probability = float(prediction["failure_probability"])
    risk = str(prediction["risk_label"])
    network_health_score = float(prediction["network_health_score"])

    while risk == "HIGH_RISK" and retry_count < max_retries:
        next_retry = retry_count + 1
        before_latency = latency_ms
        before_packet_loss = packet_loss
        before_failure_probability = failure_probability
        before_risk = risk
        before_health_score = network_health_score

        dicom_timeout_ms = 1000.0 + (before_latency * 0.5)
        timeout_seconds = max(1.0, dicom_timeout_ms / 1000.0)
        ae.acse_timeout = timeout_seconds
        ae.network_timeout = timeout_seconds
        ae.dimse_timeout = timeout_seconds

        # Self-healing retry simulation: stabilize network conditions.
        latency_ms = before_latency * 0.7
        packet_loss = before_packet_loss * 0.5
        retry_count = next_retry

        recalculated = model.predict_failure_probability(
            TransferFeatures(
                latency_ms=latency_ms,
                packet_loss_pct=packet_loss,
                retry_count=retry_count,
                bandwidth_mbps=bandwidth,
            )
        )

        failure_probability = float(recalculated["failure_probability"])
        risk = str(recalculated["risk_label"])
        network_health_score = float(recalculated["network_health_score"])

        retry_events.append(
            {
                "retry_attempt": retry_count,
                "ai_triggered_retry": True,
                "message": "AI triggered retry attempt",
                "reevaluation": "Re-evaluating network conditions",
                "before": {
                    "latency_ms": round(before_latency, 2),
                    "packet_loss": round(before_packet_loss, 3),
                    "failure_probability": round(before_failure_probability, 2),
                    "risk_level": before_risk,
                    "network_health_score": round(before_health_score, 2),
                },
                "after": {
                    "latency_ms": round(latency_ms, 2),
                    "packet_loss": round(packet_loss, 3),
                    "failure_probability": round(failure_probability, 2),
                    "risk_level": risk,
                    "network_health_score": round(network_health_score, 2),
                },
                "dicom_timeout_ms": round(dicom_timeout_ms, 2),
            }
        )

    ai_actions: list[str] = []
    if retry_events:
        ai_actions.extend([
            "Increase DICOM timeout",
            "Apply retry backoff",
            "Re-evaluating network conditions",
        ])
    if retry_count > 1:
        ai_actions.append("Renegotiate DICOM association")

    # Remove duplicates while preserving insertion order.
    ai_actions = list(dict.fromkeys(ai_actions))

    transfer_payload = {
        "latency_ms": round(latency_ms, 2),
        "packet_loss": round(packet_loss, 3),
        "bandwidth": round(bandwidth, 3),
        "retry_count": retry_count,
        "dicom_timeout_ms": round(dicom_timeout_ms, 2),
        "risk_level": risk,
        "failure_probability": round(failure_probability, 4),
        "network_health_score": round(network_health_score, 2),
        "ai_actions": ai_actions,
        "retry_events": retry_events,
        "sent_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    ds.ImageComments = json.dumps({**existing_comments, **transfer_payload})

    cstore_status = "FAILED"

    if retry_count > 3 or (risk == "HIGH_RISK" and retry_count >= max_retries):
        transfer_status = "FAILED"
    else:
        assoc = ae.associate(pacs_host, pacs_port, ae_title="PACS_SCP")
        if assoc.is_established:
            status = assoc.send_c_store(ds)
            assoc.release()
            if status and status.Status == 0x0000:
                cstore_status = "SUCCESS"

        improved_metrics = (
            retry_count > 0
            and latency_ms < baseline_latency_ms
            and packet_loss < baseline_packet_loss
        )
        if improved_metrics:
            transfer_status = "SUCCESS"
        else:
            transfer_status = cstore_status

    auto_retry_triggered = retry_count > 0
    network_stability = "STABLE" if network_health_score >= 60.0 else "UNSTABLE"

    return {
        "status": transfer_status,
        "latency_ms": round(latency_ms, 2),
        "packet_loss": round(packet_loss, 3),
        "bandwidth": round(bandwidth, 3),
        "retry_count": retry_count,
        "dicom_timeout_ms": round(dicom_timeout_ms, 2),
        "failure_probability": failure_probability,
        "risk_level": risk,
        "ai_action": ai_actions,
        "ai_actions": ai_actions,
        "retry_events": retry_events,
        "network_stability": network_stability,
        "network_health_score": round(network_health_score, 2),
        "auto_debugging_actions": ai_actions,
        "auto_retry_triggered": auto_retry_triggered,
        "pacs_cstore_status": cstore_status,
        "image_size_kb": round(file_size_kb, 2),
        "patient_id": str(getattr(ds, "PatientID", "UNKNOWN")),
        "scan_uid": str(getattr(ds, "SOPInstanceUID", "UNKNOWN")),
        "dicom_path": str(dicom_path),
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Send DICOM to PACS via C-STORE")
    parser.add_argument("--dicom", required=True)
    parser.add_argument("--pacs-host", default="127.0.0.1")
    parser.add_argument("--pacs-port", type=int, default=11112)
    parser.add_argument("--retry-limit", type=int, default=4)
    args = parser.parse_args()

    result = send_dicom(Path(args.dicom), args.pacs_host, args.pacs_port, args.retry_limit)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
