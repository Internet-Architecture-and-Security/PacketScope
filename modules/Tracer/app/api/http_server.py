import json
import os
import sys
from datetime import datetime
from pathlib import Path

from flask import Flask, Response, jsonify, request
from flask_cors import CORS, cross_origin

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services import tracer_service as service

app = Flask(__name__)
CORS(app)


@app.route("/api/trace", methods=["GET"])
@cross_origin(expose_headers=["Transfer-Encoding"])
def trace_route():
    target = request.args.get("target")
    use_cache = request.args.get("cache", "true").lower() == "true"

    if not target:
        return jsonify({"error": "Missing 'target' parameter"}), 400

    ip_address = service.get_ip_from_url(target) if not target.replace(".", "").isdigit() else target
    if not ip_address:
        return jsonify({"error": f"Invalid target: {target}"}), 400

    ip_dir = os.path.join(service.HISTORY_DIR, target)
    print(f"Checking history in {ip_dir}, use_cache={use_cache}")
    if use_cache and os.path.exists(ip_dir):
        print(f"Found history directory: {ip_dir}")
        files = sorted(os.listdir(ip_dir), reverse=True)
        if files:
            latest_file = os.path.join(ip_dir, files[0])
            with open(latest_file, "r") as f:
                return Response(f.read(), mimetype="application/json")

    return Response(service.run_traceroute(target, ip_address), mimetype="application/json")


@app.route("/api/history", methods=["GET"])
def get_history():
    target = request.args.get("target")

    if target:
        ip_address = service.get_ip_from_url(target) if not target.replace(".", "").isdigit() else target
        if not ip_address:
            return jsonify({"error": f"Invalid target: {target}"}), 400

        ip_dir = os.path.join(service.HISTORY_DIR, ip_address)
        if not os.path.exists(ip_dir):
            return jsonify({"error": f"No history found for {target} ({ip_address})"}), 404

        history = []
        for file_name in sorted(os.listdir(ip_dir), reverse=True):
            file_path = os.path.join(ip_dir, file_name)
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                    timestamp = file_name.split("-")[0]
                    history.append({"timestamp": timestamp, "result": data})
            except Exception as e:
                print(f"Error reading {file_path}: {e}")

        return jsonify({target: history})

    history_records = {}

    if not os.path.exists(service.HISTORY_DIR):
        return jsonify(history_records)

    for ip in os.listdir(service.HISTORY_DIR):
        ip_path = os.path.join(service.HISTORY_DIR, ip)
        if os.path.isdir(ip_path):
            history_records[ip] = []
            for file_name in sorted(os.listdir(ip_path), reverse=True):
                file_path = os.path.join(ip_path, file_name)
                try:
                    with open(file_path, "r") as f:
                        data = json.load(f)
                        timestamp = file_name.split("-")[0]
                        history_records[ip].append({"timestamp": timestamp, "result": data})
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

    return jsonify(history_records)


@app.route("/api/analyze", methods=["GET"])
def analyze_route():
    target = request.args.get("target")
    use_cache = request.args.get("cache", "true").lower() == "true"
    if not target:
        return jsonify({"error": "Missing target"}), 400

    ip = service.get_ip_from_url(target) if not target.replace(".", "").isdigit() else target
    ip_dir = os.path.join(service.HISTORY_DIR, ip)
    os.makedirs(ip_dir, exist_ok=True)

    if use_cache and os.path.exists(ip_dir):
        files = sorted(os.listdir(ip_dir), reverse=True)
        if files:
            with open(os.path.join(ip_dir, files[0]), "r") as f:
                current_hops = json.load(f)
        else:
            current_hops = []
    else:
        current_hops = []
        for line in service.run_traceroute(target, ip):
            current_hops.append(json.loads(line.strip()))

    history = service.load_recent_history(ip)
    anomalies = service.analyze_anomalies(current_hops, history)

    risk_score, alerts = service.guarder_risk_score(current_hops)
    alerts += [a["detail"] for a in anomalies]
    total_score = min(risk_score + len(anomalies) * 10, 100)

    return jsonify({"anomalies": anomalies, "alerts": alerts, "riskScore": total_score})


@app.route("/api/ready", methods=["GET"])
def readiness_check():
    try:
        return jsonify({"ready": True, "timestamp": datetime.now().isoformat()}), 200
    except Exception as e:
        return jsonify({"ready": False, "error": str(e), "timestamp": datetime.now().isoformat()}), 503


def run():
    app.run(host="0.0.0.0", port=8000, debug=True)


if __name__ == "__main__":
    run()
