"""
PacketScope Tracer API Client

This module provides a Python client for interacting with the Tracer API.
"""

import json
import requests
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class TraceResult:
    """Trace result container"""
    target: str
    hops: List[Dict[str, Any]]
    source: str  # "cache" or "live"


@dataclass
class AnalysisResult:
    """Analysis result container"""
    target: str
    anomalies: List[Dict[str, Any]]
    alerts: List[str]
    risk_score: int


class TracerClient:
    """Client for Tracer API"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()

    # ============ Route Tracing ============

    def trace(
        self,
        target: str,
        use_cache: bool = True,
        protocol: str = "icmp",
        port: Optional[int] = None,
    ) -> TraceResult:
        """
        Run a traceroute to the target.

        Args:
            target: IP address or domain name
            use_cache: Whether to use cached results if available
            protocol: "icmp" or "tcp"
            port: Required when protocol is "tcp" (1-65535)

        Returns:
            TraceResult with target, hops, and source info.
        """
        params = {
            "target": target,
            "use_cache": str(use_cache).lower(),
            "protocol": protocol,
        }
        if protocol == "tcp" and port is not None:
            params["port"] = str(port)

        resp = self.session.get(
            f"{self.base_url}/api/trace",
            params=params,
            stream=True,
        )
        resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "")

        # Cached response: application/json with full array
        if "application/json" in content_type and not resp.headers.get("Transfer-Encoding") == "chunked":
            data = resp.json()
            hops = data if isinstance(data, list) else data.get("hops", data.get("result", []))
            return TraceResult(target=target, hops=hops, source="cache")

        # Streaming NDJSON response
        hops = []
        for line in resp.iter_lines(decode_unicode=True):
            if not line:
                continue
            try:
                hop = json.loads(line)
                hops.append(hop)
            except json.JSONDecodeError:
                continue

        return TraceResult(target=target, hops=hops, source="live")

    # ============ Risk Analysis ============

    def analyze(
        self,
        target: str,
        cache: bool = True,
    ) -> AnalysisResult:
        """
        Run anomaly analysis and risk scoring for a target.

        Args:
            target: IP address or domain name
            cache: Whether to use cached trace results

        Returns:
            AnalysisResult with anomalies, alerts, and riskScore.
        """
        params = {"target": target, "cache": str(cache).lower()}
        resp = self.session.get(f"{self.base_url}/api/analyze", params=params)
        resp.raise_for_status()
        data = resp.json()

        return AnalysisResult(
            target=target,
            anomalies=data.get("anomalies", []),
            alerts=data.get("alerts", []),
            risk_score=data.get("riskScore", 0),
        )

    # ============ History ============

    def get_history(self, target: Optional[str] = None) -> Dict[str, Any]:
        """
        Get traceroute history.

        Args:
            target: Optional IP/domain filter. If None, returns all history.

        Returns:
            Dictionary of history records keyed by target.
        """
        params = {}
        if target:
            params["target"] = target
        resp = self.session.get(f"{self.base_url}/api/history", params=params)
        resp.raise_for_status()
        return resp.json()

    # ============ Health Check ============

    def is_ready(self) -> bool:
        """
        Check if the Tracer API is ready.

        Returns:
            True if the service is ready.
        """
        try:
            resp = self.session.get(f"{self.base_url}/api/ready", timeout=5)
            resp.raise_for_status()
            return resp.json().get("ready", False)
        except Exception:
            return False

    def health_check(self) -> Dict[str, Any]:
        """
        Get detailed health status.

        Returns:
            Health status dictionary.
        """
        resp = self.session.get(f"{self.base_url}/api/ready", timeout=5)
        resp.raise_for_status()
        return resp.json()


# ============== Convenience Functions ==============

def quick_trace(target: str, base_url: str = "http://localhost:8000") -> TraceResult:
    """
    Quick trace a target using default settings.

    Args:
        target: IP address or domain name
        base_url: Tracer API base URL

    Returns:
        TraceResult with hops.
    """
    client = TracerClient(base_url)
    return client.trace(target)


def quick_analyze(target: str, base_url: str = "http://localhost:8000") -> AnalysisResult:
    """
    Quick analyze a target using default settings.

    Args:
        target: IP address or domain name
        base_url: Tracer API base URL

    Returns:
        AnalysisResult with risk score and anomalies.
    """
    client = TracerClient(base_url)
    return client.analyze(target)


# ============== Example Usage ==============

if __name__ == "__main__":
    client = TracerClient("http://localhost:8000")

    # Check readiness
    ready = client.is_ready()
    print(f"Tracer API ready: {ready}")

    if ready:
        # Get history
        history = client.get_history()
        print(f"History targets: {list(history.keys())}")

        # Health check
        health = client.health_check()
        print(f"Health: {health}")
