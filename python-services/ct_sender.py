"""CT scanner simulator that sends DICOM images to PACS using C-STORE."""

from __future__ import annotations

import argparse
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import (
    ExplicitVRLittleEndian,
    CTImageStorage,
    PYDICOM_IMPLEMENTATION_UID,
    generate_uid,
)
from pynetdicom import AE, StoragePresentationContexts


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
SCANS_DIR = DATA_DIR / "scans"
LOG_PATH = DATA_DIR / "transfer_logs.csv"


def ensure_sample_dicom(sample_path: Path) -> Path:
    """Create a synthetic CT DICOM if missing."""
    sample_path.parent.mkdir(parents=True, exist_ok=True)
    if sample_path.exists():
        return sample_path

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = CTImageStorage
    file_meta.MediaStorageSOPInstanceUID = generate_uid()
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = PYDICOM_IMPLEMENTATION_UID

    ds = FileDataset(str(sample_path), {}, file_meta=file_meta, preamble=b"\0" * 128)
    ds.PatientID = "PATIENT_001"
    ds.PatientName = "Demo^Patient"
    ds.Modality = "CT"
    ds.StudyInstanceUID = generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.SOPClassUID = CTImageStorage
    ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
    ds.StudyDate = datetime.now().strftime("%Y%m%d")
    ds.StudyTime = datetime.now().strftime("%H%M%S")

    rows, cols = 512, 512
    img = np.random.normal(loc=90, scale=25, size=(rows, cols)).clip(0, 255).astype(np.uint8)

    # Add a bright synthetic lesion-like region for demo purposes.
    rr, cc = np.ogrid[:rows, :cols]
    mask = (rr - 230) ** 2 + (cc - 300) ** 2 <= 35 ** 2
    img[mask] = 250

    ds.Rows = rows
    ds.Columns = cols
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0
    ds.PixelData = img.tobytes()

    ds.save_as(str(sample_path), write_like_original=False)
    return sample_path


def send_with_retry(
    dicom_path: Path,
    pacs_host: str,
    pacs_port: int,
    retry_limit: int = 2,
) -> dict:
    """Send DICOM via C-STORE with retry and latency simulation."""
    dataset = pydicom.dcmread(str(dicom_path))
    file_size_kb = dicom_path.stat().st_size / 1024.0

    ae = AE(ae_title="CT_SCANNER")
    for cx in StoragePresentationContexts:
        ae.add_requested_context(cx.abstract_syntax)

    transfer_status = "FAILED"
    total_latency_ms = 0.0
    attempt = 0

    for attempt in range(retry_limit + 1):
        simulated_network_delay = random.uniform(0.1, 1.2)
        time.sleep(simulated_network_delay)

        metadata = {
            "latency_ms": round(simulated_network_delay * 1000, 2),
            "retry_count": attempt,
            "sent_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        dataset.ImageComments = json.dumps(metadata)

        start = time.perf_counter()
        assoc = ae.associate(pacs_host, pacs_port, ae_title="PACS_SCP")
        assoc_ms = (time.perf_counter() - start) * 1000
        total_latency_ms += metadata["latency_ms"] + assoc_ms

        if not assoc.is_established:
            continue

        status = assoc.send_c_store(dataset)
        assoc.release()

        if status and status.Status == 0x0000:
            transfer_status = "SUCCESS"
            break

    return {
        "patient_id": str(getattr(dataset, "PatientID", "UNKNOWN")),
        "sop_instance_uid": str(getattr(dataset, "SOPInstanceUID", "")),
        "latency_ms": round(total_latency_ms, 2),
        "image_size_kb": round(file_size_kb, 2),
        "retry_count": attempt,
        "transfer_status": transfer_status,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def append_log(metrics: dict) -> None:
    """Append transfer metrics to CSV log."""
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame([metrics])
    if LOG_PATH.exists():
        existing = pd.read_csv(LOG_PATH)
        df = pd.concat([existing, df], ignore_index=True)
    df.to_csv(LOG_PATH, index=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="CT sender simulator")
    parser.add_argument("--pacs-host", default="127.0.0.1")
    parser.add_argument("--pacs-port", type=int, default=11112)
    parser.add_argument("--dicom", default=str(SCANS_DIR / "sample_ct.dcm"))
    args = parser.parse_args()

    dicom_path = ensure_sample_dicom(Path(args.dicom))
    metrics = send_with_retry(dicom_path, args.pacs_host, args.pacs_port)
    append_log(metrics)
    print("Transfer metrics:")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
