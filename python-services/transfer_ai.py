"""Transfer reliability AI model for DICOM transfer monitoring."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class TransferFeatures:
    latency_ms: float
    packet_loss_pct: float
    retry_count: int
    bandwidth_mbps: float


class TransferReliabilityModel:
    """Predictive model for PACS transfer failure probability."""

    def __init__(self, _random_state: int = 42) -> None:
        _ = _random_state

    @staticmethod
    def _clamp(value: float, low: float, high: float) -> float:
        return max(low, min(high, value))

    def _failure_probability_percent(self, features: TransferFeatures) -> float:
        probability = (
            (features.latency_ms * 0.015)
            + (features.packet_loss_pct * 8.0)
            + (features.retry_count * 6.0)
        )
        return self._clamp(probability, 0.0, 100.0)

    def _network_health_score(self, features: TransferFeatures) -> float:
        score = 100.0 - (
            (features.latency_ms * 0.02)
            + (features.packet_loss_pct * 10.0)
            + (features.retry_count * 8.0)
        )
        return self._clamp(score, 0.0, 100.0)

    def predict_failure_probability(self, features: TransferFeatures) -> Dict[str, Any]:
        """Predict probability of transfer failure for incoming transfer metrics."""
        proba_percent = float(self._failure_probability_percent(features))

        if proba_percent < 20.0:
            label = "LOW_RISK"
        elif proba_percent < 50.0:
            label = "MEDIUM_RISK"
        else:
            label = "HIGH_RISK"

        health_score = float(self._network_health_score(features))

        return {
            "failure_probability": proba_percent,
            "risk_label": label,
            "network_health_score": health_score,
            "features": {
                "latency": features.latency_ms,
                "packet_loss": features.packet_loss_pct,
                "retry_count": features.retry_count,
                "bandwidth": features.bandwidth_mbps,
            },
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Predict DICOM transfer failure probability")
    parser.add_argument("--latency", type=float, default=450)
    parser.add_argument("--packet-loss", type=float, default=1.2)
    parser.add_argument("--retry-count", type=int, default=1)
    parser.add_argument("--bandwidth", type=float, default=55)
    args = parser.parse_args()

    model = TransferReliabilityModel()
    output = model.predict_failure_probability(
        TransferFeatures(
            latency_ms=args.latency,
            packet_loss_pct=args.packet_loss,
            retry_count=args.retry_count,
            bandwidth_mbps=args.bandwidth,
        )
    )
    print(json.dumps(output))
