import json
import os
import re
import socket
import statistics
import subprocess
from datetime import datetime
from functools import lru_cache

import geoip2.database
import requests

from app.jobs.update_threat_intel import update_risky_ips

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
GEOIP_DIR = os.path.join(DATA_DIR, "geoip")
THREAT_DIR = os.path.join(DATA_DIR, "threat")
HISTORY_DIR = os.path.join(DATA_DIR, "history")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(GEOIP_DIR, exist_ok=True)
os.makedirs(THREAT_DIR, exist_ok=True)
os.makedirs(HISTORY_DIR, exist_ok=True)

RISKY_IPS_FILE = os.path.join(THREAT_DIR, "risky_ips.json")
RISKY_IPS = {}

geoip_reader = geoip2.database.Reader(os.path.join(GEOIP_DIR, "GeoLite2-City.mmdb"))
asn_reader = geoip2.database.Reader(os.path.join(GEOIP_DIR, "GeoLite2-ASN.mmdb"))
http_session = requests.Session()


def load_risky_ips():
    global RISKY_IPS
    try:
        with open(RISKY_IPS_FILE, "r") as f:
            RISKY_IPS = json.load(f)
        print(f"[✓] Loaded {len(RISKY_IPS)} risky IPs.")
    except Exception as e:
        update_risky_ips()
        print(f"[!] Failed to load risky IPs: {e}")


load_risky_ips()


def get_timestamp():
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def sanitize_filename(name: str) -> str:
    return re.sub(r"[^0-9a-zA-Z_-]", "_", name)


def get_history_file_path(target: str, ip_address: str) -> str:
    ip_dir = os.path.join(HISTORY_DIR, ip_address)
    os.makedirs(ip_dir, exist_ok=True)
    safe_target = sanitize_filename(target)
    filename = f"{get_timestamp()}-{safe_target}.json"
    return os.path.join(ip_dir, filename)


def get_ip_from_url(target):
    try:
        return socket.gethostbyname(target)
    except socket.gaierror:
        return None


def list_history():
    history_records = {}
    if not os.path.exists(HISTORY_DIR):
        return history_records

    for ip in os.listdir(HISTORY_DIR):
        ip_path = os.path.join(HISTORY_DIR, ip)
        if os.path.isdir(ip_path):
            history_records[ip] = sorted(os.listdir(ip_path), reverse=True)
    return history_records


@lru_cache(maxsize=4096)
def get_ip_info(ip):
    try:
        api_url = f"http://ip-api.com/json/{ip}"
        response = http_session.get(api_url, timeout=3)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                as_info = data.get("as", "")
                asn_number = None
                if as_info.startswith("AS"):
                    asn_number = as_info.split(" ")[0][2:]

                location_data = {
                    "lat": data.get("lat"),
                    "lon": data.get("lon"),
                    "radius_km": None,
                    "timezone": data.get("timezone"),
                }

                return {
                    "location": f"{data.get('city', 'Unknown')}, {data.get('country', 'Unknown')}",
                    "geo": location_data,
                    "asn": asn_number,
                    "isp": data.get("isp", "Unknown"),
                }
    except Exception as e:
        print(f"API 请求失败: {e}")

    try:
        geo_info = geoip_reader.city(ip)
        asn_info = asn_reader.asn(ip)
        geo_location = geo_info.location
        location_data = {
            "lat": geo_location.latitude,
            "lon": geo_location.longitude,
            "radius_km": geo_location.accuracy_radius,
            "timezone": geo_location.time_zone,
        }
        return {
            "location": f"{geo_info.city.name}, {geo_info.country.name}",
            "geo": location_data,
            "asn": asn_info.autonomous_system_number,
            "isp": asn_info.autonomous_system_organization,
        }
    except Exception:
        return {"location": "Unknown", "asn": "Unknown", "isp": "Unknown", "geo": "Unknown"}


def enrich_geo(geo):
    if geo["city"]:
        try:
            url = f"http://ip-api.com/json/{geo['city']}?lang=zh-CN"
            resp = requests.get(url, timeout=3).json()
            geo["lat"] = resp.get("lat")
            geo["lon"] = resp.get("lon")
        except Exception:
            pass
    return geo


def finalize_hop(hop):
    numeric_rtts = [r for r in hop["rtts"] if isinstance(r, float)]
    latency = statistics.mean(numeric_rtts) if numeric_rtts else None
    packet_loss = (
        f"{round(hop['rtts'].count('*') / len(hop['rtts']) * 100, 1)}%" if hop["rtts"] else "100%"
    )
    ip_info = get_ip_info(hop["ip"]) if hop.get("ip") else None
    if not ip_info:
        ip_info = {"location": "Unknown", "asn": "Unknown", "isp": "Unknown", "geo": "Unknown"}

    if ip_info.get("isp") == "DoD Network Information Center":
        ip_info["isp"] = "unknown"
        ip_info["asn"] = "unknown"
        ip_info["location"] = "unknown"
        ip_info["geo"] = "unknown"
    return {
        "hop": hop["hop"],
        "ip": hop["ip"],
        "latency": round(latency, 2) if latency else None,
        "jitter": round(statistics.pstdev(numeric_rtts), 2) if len(numeric_rtts) > 1 else None,
        "packet_loss": packet_loss,
        "bandwidth_mbps": round(100.0 / (latency + 1), 2) if latency else None,
        "location": ip_info.get("location", "Unknown"),
        "asn": ip_info.get("asn", "Unknown"),
        "isp": ip_info.get("isp", "Unknown"),
        "geo": ip_info.get("geo", "Unknown"),
    }


def run_traceroute(target: str, ip_address: str, protocol: str = "icmp", port=None):
    hops = []
    protocol = (protocol or "icmp").lower()
    if protocol not in {"icmp", "tcp"}:
        raise ValueError("Invalid protocol, expected one of: icmp, tcp")

    history_key = ip_address
    if protocol == "tcp":
        if port is None:
            raise ValueError("Missing port when protocol=tcp")
        try:
            port = int(port)
        except (TypeError, ValueError):
            raise ValueError("Invalid port, expected integer in range 1-65535")
        if not 1 <= port <= 65535:
            raise ValueError("Invalid port, expected integer in range 1-65535")
        history_key = f"{ip_address}-tcp-{port}"

    file_path = get_history_file_path(target, history_key)
    if protocol == "icmp":
        nexttrace_cmd = ["nexttrace", ip_address]
    else:
        nexttrace_cmd = ["nexttrace", "--tcp", "-p", str(port), ip_address]
    result = subprocess.Popen(nexttrace_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
    current_hop = None

    for line in result.stdout:
        line = ansi_escape.sub("", line).strip()
        if not line or line.startswith(("traceroute", "NextTrace", "[NextTrace", "IP")) or "->" in line:
            continue

        print(f"Processing line: {line}")
        if (re.match(r"^\d+", line) and "ms" not in line) or "DOD" in line:
            parts = line.split()
            if len(parts) == 3:
                continue
            hop_num = int(parts[0])
            if current_hop and hop_num != current_hop_num:
                hops.append(finalize_hop(current_hop))
                print(f"Saved hop: {hops[-1]}")
                yield json.dumps(hops[-1], ensure_ascii=False) + "\n"
                current_hop = None

            if not current_hop:
                ip = parts[1] if len(parts) >= 2 else None
                asn = parts[2] if len(parts) >= 3 and parts[2].startswith("AS") else None
                current_hop = {"hop": hop_num, "ip": ip, "asn": asn, "rtts": []}
                current_hop_num = hop_num

        elif "ms" in line:
            matches = re.findall(r"(\d+\.\d+)\s*ms|\*", line)
            print(f"Processing RTT line: {matches}")
            for m in matches:
                if m == "*":
                    current_hop["rtts"].append("*")
                else:
                    try:
                        current_hop["rtts"].append(float(m))
                    except Exception:
                        pass

    if current_hop:
        hops.append(finalize_hop(current_hop))
        yield json.dumps(hops[-1], ensure_ascii=False) + "\n"

    with open(file_path, "w") as f:
        json.dump(hops, f, indent=4)


def analyze_anomalies(current_hops, history_hops):
    anomalies = []
    prev_ips = {h["ip"] for hist in history_hops for h in hist}
    for idx, hop in enumerate(current_hops):
        ip = hop.get("ip")
        latency = hop.get("latency", 0)
        if ip not in prev_ips:
            anomalies.append({"type": "PathDeviation", "detail": f"跳点 {idx+1} 出现新IP {ip}"})
        if latency and latency > 200:
            anomalies.append({"type": "HighLatency", "detail": f"跳点 {idx+1} ({ip}) 延迟过高 {latency}ms"})
    return anomalies


def guarder_risk_score(hops):
    score = 0
    alerts = []
    for hop in hops:
        ip = hop.get("ip")
        if ip in RISKY_IPS:
            score += 40
            alerts.append(f"跳点 {ip} 被列为恶意IP: {RISKY_IPS[ip]}")
    return score, alerts


def load_recent_history(ip, limit=5):
    ip_dir = os.path.join(HISTORY_DIR, ip)
    if not os.path.exists(ip_dir):
        return []
    history = []
    for file in sorted(os.listdir(ip_dir), reverse=True)[:limit]:
        with open(os.path.join(ip_dir, file), "r") as f:
            try:
                history.append(json.load(f))
            except Exception:
                pass
    return history
