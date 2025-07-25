from flask import Flask, Response, request, jsonify
import subprocess
import json
import os
import socket
from datetime import datetime
import geoip2.database
from flask_cors import CORS, cross_origin
import requests

# 历史记录存储路径
HISTORY_DIR = "history"
# 创建存储目录（如果不存在）
os.makedirs(HISTORY_DIR, exist_ok=True)

# =========================
# 恶意 IP 黑名单加载模块
# =========================
RISKY_IPS_FILE = "risky_ips.json"
RISKY_IPS = {}

def load_risky_ips():
    global RISKY_IPS
    try:
        with open(RISKY_IPS_FILE, "r") as f:
            RISKY_IPS = json.load(f)
        print(f"[✓] Loaded {len(RISKY_IPS)} risky IPs.")
    except Exception as e:
        print(f"[!] Failed to load risky IPs: {e}")

# 启动时加载
load_risky_ips()

# =========================
# 工具函数
# =========================

app = Flask(__name__)
CORS(app)  # 默认允许所有跨域


geoip_reader = geoip2.database.Reader("GeoLite2-City.mmdb")
asn_reader = geoip2.database.Reader("GeoLite2-ASN.mmdb")


def get_timestamp():
    """获取当前时间戳"""
    return datetime.now().strftime("%Y%m%d-%H%M%S")

def get_history_file_path(target):
    """生成历史记录的存储路径"""
    ip_dir = os.path.join(HISTORY_DIR, target)  # 每个 IP 一个目录
    os.makedirs(ip_dir, exist_ok=True)  # 确保目录存在
    return os.path.join(ip_dir, f"{get_timestamp()}-{target}.json")

def get_ip_from_url(target):
    """解析 URL 获取对应的 IP 地址"""
    try:
        return socket.gethostbyname(target)
    except socket.gaierror:
        return None
    
def list_history():
    """获取所有历史记录"""
    history_records = {}
    
    if not os.path.exists(HISTORY_DIR):
        return history_records

    for ip in os.listdir(HISTORY_DIR):
        ip_path = os.path.join(HISTORY_DIR, ip)
        if os.path.isdir(ip_path):
            history_records[ip] = sorted(os.listdir(ip_path), reverse=True)  # 按时间排序

    return history_records

def get_ip_info(ip):
    """ 获取 IP 地址的地理位置、ASN 和 ISP 信息 """
    
    # 优先使用 ip-api.com 接口
    try:
        api_url = f"http://ip-api.com/json/{ip}"
        response = requests.get(api_url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            
            if data.get('status') == 'success':
                # 解析 ASN 信息
                as_info = data.get('as', '')
                asn_number = None
                if as_info.startswith('AS'):
                    asn_number = as_info.split(' ')[0][2:]  # 提取 AS 后面的数字
                
                location_data = {
                    "lat": data.get('lat'),
                    "lon": data.get('lon'),
                    "radius_km": None,  # ip-api.com 不提供精度半径
                    "timezone": data.get('timezone')
                }
                
                return {
                    "location": f"{data.get('city', 'Unknown')}, {data.get('country', 'Unknown')}",
                    "geo": location_data,
                    "asn": asn_number,
                    "isp": data.get('isp', 'Unknown')
                }
    except Exception as e:
        print(f"API 请求失败: {e}")
    
    # 如果 API 请求失败，使用默认的 GeoIP 数据库方法
    try:
        geo_info = geoip_reader.city(ip)
        asn_info = asn_reader.asn(ip)
        geo_location = geo_info.location
        
        location_data = {
            "lat": geo_location.latitude,
            "lon": geo_location.longitude,
            "radius_km": geo_location.accuracy_radius,
            "timezone": geo_location.time_zone
        }
        
        # print(f"使用本地数据库: {geo_info}")
        
        return {
            "location": f"{geo_info.city.name}, {geo_info.country.name}",
            "geo": location_data,
            "asn": asn_info.autonomous_system_number,
            "isp": asn_info.autonomous_system_organization
        }
    except Exception as e:
        # print(f"本地数据库查询失败: {e}")
        return {
            "location": "Unknown", 
            "asn": "Unknown", 
            "isp": "Unknown", 
            "geo": "Unknown"
        }

def run_traceroute(target: str):
    """ 逐行执行 traceroute 并流式返回 JSON 数据 """

    hops = []
    file_path = get_history_file_path(target)
    # 运行 traceroute，逐行读取输出
    traceroute_cmd = ["traceroute", "-I", target]  # ICMP 模式
    result = subprocess.Popen(traceroute_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    for line in result.stdout:
        line = line.strip()
        if not line or line.startswith("traceroute"):  # 跳过标题行
            continue
        parts = line.split()
        ip = parts[1]  # IP 地址
        print("parts", parts)
        if len(parts) < 2:
            continue

        
        latency = float(parts[-2]) if parts[-2].replace('.', '', 1).isdigit() else None
        ip_info = get_ip_info(ip)
        # 组装数据
        hop_data = {
            "ip": ip,
            "latency": latency,
            "jitter": round(latency * 0.1, 2) if latency else "None",  # 模拟 jitter
            "packet_loss": "0%" if latency else "100%",
            "bandwidth_mbps": round(100.0 / (latency + 1), 2) if latency else "None",  # 模拟带宽
            "location": ip_info["location"],
            "asn": ip_info["asn"],
            "isp": ip_info["isp"],
            "geo": ip_info["geo"]
        }
        
        # 存入列表
        hops.append(hop_data)

        # 实时返回 JSON
        yield json.dumps(hop_data) + "\n"

    # 保存完整结果到本地 JSON 文件
    with open(file_path, "w") as f:
        json.dump(hops, f, indent=4)
    # return hops



@app.route("/api/trace", methods=["GET"])
@cross_origin(expose_headers=["Transfer-Encoding"])  # 显式暴露
def trace_route():
    target = request.args.get("target")
    use_cache = request.args.get("cache", "true").lower() == "true"  # 默认使用缓存

    if not target:
        return jsonify({"error": "Missing 'target' parameter"}), 400

    # 解析 URL，如果输入是 URL，则转换为 IP
    ip_address = get_ip_from_url(target) if not target.replace(".", "").isdigit() else target
    if not ip_address:
        return jsonify({"error": f"Invalid target: {target}"}), 400


    # 检查是否有历史数据
    ip_dir = os.path.join(HISTORY_DIR, target)
    if use_cache and os.path.exists(ip_dir):
        files = sorted(os.listdir(ip_dir), reverse=True)  # 按时间倒序
        if files:
            latest_file = os.path.join(ip_dir, files[0])
            with open(latest_file, "r") as f:
                return Response(f.read(), mimetype="application/json")

    # 如果没有历史数据或用户强制刷新，执行新的 traceroute
    return Response(run_traceroute(target), mimetype="application/json")


# 
@app.route("/api/history", methods=["GET"])
def get_history():
    """返回特定目标的历史记录（支持指定 target 查询）"""
    target = request.args.get("target")  # 获取目标 IP 或 URL

    if target:
        # 如果是 URL，则解析为 IP
        ip_address = get_ip_from_url(target) if not target.replace(".", "").isdigit() else target
        if not ip_address:
            return jsonify({"error": f"Invalid target: {target}"}), 400

        # 查询指定目标的历史记录
        ip_dir = os.path.join(HISTORY_DIR, ip_address)
        if not os.path.exists(ip_dir):
            return jsonify({"error": f"No history found for {target} ({ip_address})"}), 404

        history = []
        for file_name in sorted(os.listdir(ip_dir), reverse=True):  # 按时间倒序
            file_path = os.path.join(ip_dir, file_name)
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                    timestamp = file_name.split("-")[0]  # 提取时间戳
                    history.append({"timestamp": timestamp, "result": data})
            except Exception as e:
                print(f"Error reading {file_path}: {e}")

        return jsonify({target: history})

    # 如果没有指定 target，则返回所有历史记录
    history_records = {}

    if not os.path.exists(HISTORY_DIR):
        return jsonify(history_records)

    for ip in os.listdir(HISTORY_DIR):
        ip_path = os.path.join(HISTORY_DIR, ip)
        if os.path.isdir(ip_path):
            history_records[ip] = []
            for file_name in sorted(os.listdir(ip_path), reverse=True):  # 按时间倒序
                file_path = os.path.join(ip_path, file_name)
                try:
                    with open(file_path, "r") as f:
                        data = json.load(f)
                        timestamp = file_name.split("-")[0]  # 提取时间戳
                        history_records[ip].append({"timestamp": timestamp, "result": data})
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

    return jsonify(history_records)


# =========================
# 风险分析模块
# =========================

def analyze_anomalies(current_hops, history_hops):
    anomalies = []
    prev_ips = {h["ip"] for hist in history_hops for h in hist}
    for idx, hop in enumerate(current_hops):
        ip = hop.get("ip")
        latency = hop.get("latency", 0)
        if ip not in prev_ips:
            anomalies.append({
                "type": "PathDeviation",
                "detail": f"跳点 {idx+1} 出现新IP {ip}"
            })
        if latency and latency > 200:
            anomalies.append({
                "type": "HighLatency",
                "detail": f"跳点 {idx+1} ({ip}) 延迟过高 {latency}ms"
            })
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
            except:
                pass
    return history

@app.route("/api/analyze", methods=["GET"])
def analyze_route():
    target = request.args.get("target")
    use_cache = request.args.get("cache", "true").lower() == "true"
    if not target:
        return jsonify({"error": "Missing target"}), 400

    ip = get_ip_from_url(target) if not target.replace(".", "").isdigit() else target
    ip_dir = os.path.join(HISTORY_DIR, ip)
    os.makedirs(ip_dir, exist_ok=True)

    # 获取当前 hops
    if use_cache and os.path.exists(ip_dir):
        files = sorted(os.listdir(ip_dir), reverse=True)
        if files:
            with open(os.path.join(ip_dir, files[0]), "r") as f:
                current_hops = json.load(f)
        else:
            current_hops = []
    else:
        current_hops = []
        for line in run_traceroute(ip):
            current_hops.append(json.loads(line.strip()))

    # 历史对比分析
    history = load_recent_history(ip)
    anomalies = analyze_anomalies(current_hops, history)

    # 风险分析
    risk_score, alerts = guarder_risk_score(current_hops)
    alerts += [a["detail"] for a in anomalies]
    total_score = min(risk_score + len(anomalies) * 10, 100)

    return jsonify({
        "anomalies": anomalies,
        "alerts": alerts,
        "riskScore": total_score
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
