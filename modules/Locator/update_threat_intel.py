import requests
import json

# Spamhaus DROP/EDROP列表
DROP_URL = "https://www.spamhaus.org/drop/drop.txt"
EDROP_URL = "https://www.spamhaus.org/drop/edrop.txt"

# 本地存储的风险IP文件
RISKY_IPS_FILE = "risky_ips.json"

def fetch_spamhaus_list(url):
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.text
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
    return ""

def parse_spamhaus(text):
    result = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(";"):
            continue
        parts = line.split(";")
        ip_block = parts[0].strip()
        description = parts[1].strip() if len(parts) > 1 else "Spamhaus DROP listed"
        result[ip_block] = description
    return result

def update_risky_ips():
    print("Fetching Spamhaus DROP and EDROP...")
    drop_text = fetch_spamhaus_list(DROP_URL)
    edrop_text = fetch_spamhaus_list(EDROP_URL)

    risky_ips = {}
    if drop_text:
        risky_ips.update(parse_spamhaus(drop_text))
    if edrop_text:
        risky_ips.update(parse_spamhaus(edrop_text))

    if risky_ips:
        with open(RISKY_IPS_FILE, "w") as f:
            json.dump(risky_ips, f, indent=2)
        print(f"Updated {len(risky_ips)} entries into {RISKY_IPS_FILE}")
    else:
        print("No IPs updated.")

# if __name__ == "__main__":
#     update_risky_ips()
