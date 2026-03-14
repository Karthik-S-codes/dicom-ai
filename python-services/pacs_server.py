"""PACS server that receives DICOM C-STORE and stores scans into PACS storage."""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from pydicom.dataset import FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian
from pynetdicom import AE, AllStoragePresentationContexts, evt


logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("pacs_server")

BASE_DIR = Path(__file__).resolve().parents[1]
PACS_DIR = BASE_DIR / "data" / "pacs"
META_DIR = PACS_DIR / "metadata"


def _extract_transfer_metadata(ds) -> dict:
    metadata = {"latency_ms": 0.0, "retry_count": 0}
    comments = getattr(ds, "ImageComments", None)
    if not comments:
        return metadata

    try:
        parsed = json.loads(comments)
        metadata["latency_ms"] = float(parsed.get("latency_ms", 0.0))
        metadata["retry_count"] = int(parsed.get("retry_count", 0))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to parse transfer metadata from ImageComments: %s", exc)

    return metadata


def _store_dataset(ds, file_path: Path) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_meta = getattr(ds, "file_meta", FileMetaDataset())
    file_meta.TransferSyntaxUID = getattr(file_meta, "TransferSyntaxUID", ExplicitVRLittleEndian)
    ds.file_meta = file_meta
    ds.save_as(str(file_path), write_like_original=False)


def handle_store(event) -> int:
    """Handle incoming C-STORE request."""
    ds = event.dataset
    ds.file_meta = event.file_meta

    sop_uid = str(getattr(ds, "SOPInstanceUID", datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")))
    safe_uid = sop_uid.replace('.', '_')
    dicom_path = PACS_DIR / f"{safe_uid}.dcm"

    try:
        _store_dataset(ds, dicom_path)
        transfer_md = _extract_transfer_metadata(ds)

        meta = {
            "sop_uid": sop_uid,
            "patient_id": str(getattr(ds, "PatientID", "UNKNOWN")),
            "dicom_path": str(dicom_path),
            "latency_ms": float(transfer_md["latency_ms"]),
            "retry_count": int(transfer_md["retry_count"]),
            "received_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        META_DIR.mkdir(parents=True, exist_ok=True)
        (META_DIR / f"{safe_uid}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

        logger.info(
            "Received scan %s | patient=%s | saved=%s",
            sop_uid,
            meta["patient_id"],
            dicom_path,
        )
        return 0x0000

    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to process incoming DICOM: %s", exc)
        return 0xC211


def main() -> None:
    parser = argparse.ArgumentParser(description="Run PACS DICOM C-STORE SCP server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=11112)
    parser.add_argument("--backend-api", default="http://127.0.0.1:5000/api/scan")
    args = parser.parse_args()

    PACS_DIR.mkdir(parents=True, exist_ok=True)
    META_DIR.mkdir(parents=True, exist_ok=True)

    ae = AE(ae_title="PACS_SCP")
    for context in AllStoragePresentationContexts:
        ae.add_supported_context(context.abstract_syntax)

    handlers = [(evt.EVT_C_STORE, handle_store)]

    logger.info("Starting PACS server on %s:%d | PACS store: %s", args.host, args.port, PACS_DIR)
    ae.start_server((args.host, args.port), block=True, evt_handlers=handlers)


if __name__ == "__main__":
    main()
