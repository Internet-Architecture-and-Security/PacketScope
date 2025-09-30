import requests
import time


url = "http://127.0.0.1:19999/QuerySockList"
response = requests.get(url, timeout=10)
# 打印响应结果（httpbin会返回请求数据）
print(f"状态码: {response.status_code}")
print(f"响应内容: {response.json()}")  # 解析JSON响应
# time.sleep(3)

url = "http://127.0.0.1:19999/QueryPacket"

data = {
    "srcip": "127.0.0.1",
    "dstip": "127.0.0.1",
    "srcport": 45249,
    "dstport":34134,
    "ipver":"4"
}
response = requests.post(url,data=data, timeout=10)
# 打印响应结果（httpbin会返回请求数据）
print(f"状态码: {response.status_code}")
print(f"响应内容: {response.json()}")  # 解析JSON响应

