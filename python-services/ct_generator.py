"""Modality-aware scanner simulator that wraps dataset images into DICOM files."""

from __future__ import annotations

import argparse
import json
import random
import shutil
from uuid import uuid4
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, PYDICOM_IMPLEMENTATION_UID, generate_uid


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATASET_DIR = ROOT_DIR / "dataset"
PACS_IMAGE_STORAGE_DIR = ROOT_DIR / "pacs_storage"

MODALITY_DICOM_MAP = {
    "XRAY": "DX",
    "CT": "CT",
    "MRI": "MR",
}

ALLOWED_DISEASES = {
    "XRAY": {"pneumonia", "fracture", "tuberculosis", "normal"},
    "CT": {"brain_tumor", "stroke", "kidney_stone"},
    "MRI": {"brain_tumor", "alzheimer", "spinal_disc"},
}


def _find_images(folder: Path) -> list[Path]:
    images: list[Path] = []
    for pattern in ("*.png", "*.jpg", "*.jpeg"):
        images.extend(sorted(folder.glob(pattern)))
    return images


def _pick_dataset_case(dataset_root: Path) -> tuple[str, str, Path]:
    modalities = [m for m in ("XRAY", "CT", "MRI") if (dataset_root / m).exists()]
    if not modalities:
        raise FileNotFoundError(f"No modality folders found in {dataset_root}. Expected XRAY/CT/MRI")

    available_cases: list[tuple[str, str, Path]] = []
    for modality in modalities:
        modality_dir = dataset_root / modality
        for disease_dir in modality_dir.iterdir():
            if not disease_dir.is_dir():
                continue
            if disease_dir.name.lower() not in ALLOWED_DISEASES.get(modality, set()):
                continue
            for image_file in _find_images(disease_dir):
                available_cases.append((modality, disease_dir.name, image_file))

    if not available_cases:
        raise FileNotFoundError(f"No medical images found under {dataset_root}")

    return random.choice(available_cases)


def _load_xray_image(image_path: Path) -> np.ndarray:
    image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise FileNotFoundError(f"Unable to load X-ray image: {image_path}")
    if image.shape != (512, 512):
        image = cv2.resize(image, (512, 512), interpolation=cv2.INTER_AREA)
    return image.astype(np.uint8)

def generate_ct_scan(output_dir: Path, patient_id: str = "PATIENT_001", dataset_dir: Path = DEFAULT_DATASET_DIR) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)

    modality, disease, selected_image = _pick_dataset_case(dataset_dir)

    scan_uid = generate_uid()
    file_name = f"ct_{scan_uid.replace('.', '_')}.dcm"
    output_path = output_dir / file_name

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = CTImageStorage
    file_meta.MediaStorageSOPInstanceUID = scan_uid
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = PYDICOM_IMPLEMENTATION_UID

    ds = FileDataset(str(output_path), {}, file_meta=file_meta, preamble=b"\0" * 128)
    ds.PatientID = patient_id
    ds.PatientName = "Simulated^Patient"
    ds.Modality = MODALITY_DICOM_MAP.get(modality, "OT")
    ds.StudyInstanceUID = generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.SOPClassUID = CTImageStorage
    ds.SOPInstanceUID = scan_uid
    ds.StudyDate = datetime.now(timezone.utc).strftime("%Y%m%d")
    ds.StudyTime = datetime.now(timezone.utc).strftime("%H%M%S")

    PACS_IMAGE_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    pacs_uuid = uuid4().hex[:8]
    stored_image_path = PACS_IMAGE_STORAGE_DIR / f"scan_{pacs_uuid}.png"
    shutil.copy2(selected_image, stored_image_path)

    image = _load_xray_image(stored_image_path)
    rows, cols = image.shape

    ds.Rows = rows
    ds.Columns = cols
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0
    ds.PixelData = image.tobytes()
    ds.ImageComments = json.dumps(
        {
            "modality": modality,
            "disease": disease,
            "source_image": str(selected_image),
            "pacs_image_path": str(stored_image_path),
            "pacs_scan_id": pacs_uuid,
        }
    )

    ds.save_as(str(output_path), write_like_original=False)

    return {
        "status": "SUCCESS",
        "message": "Scan generated successfully",
        "patient_id": patient_id,
        "scan_type": modality,
        "modality": modality,
        "disease": disease,
        "scan_uid": scan_uid,
        "file_name": file_name,
        "dicom_path": str(output_path),
        "source_image": str(selected_image),
        "pacs_image_path": str(stored_image_path),
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic CT DICOM scan")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--patient-id", default="PATIENT_001")
    parser.add_argument("--dataset-dir", default=str(DEFAULT_DATASET_DIR))
    args = parser.parse_args()

    result = generate_ct_scan(Path(args.output_dir), patient_id=args.patient_id, dataset_dir=Path(args.dataset_dir))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
