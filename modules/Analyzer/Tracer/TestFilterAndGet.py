import requests
import time

# Test 1: Get Socket List
# url = "http://127.0.0.1:19999/QueryFuncRecv"
# url = "http://127.0.0.1:19999/QueryFuncSend"
# url = "http://127.0.0.1:19999/QueryPacket"
# url = "http://127.0.0.1:19999/ClearData"
# url = "http://127.0.0.1:19999/GetFuncTable"
url = "http://127.0.0.1:19999/QuerySockList"
response = requests.get(url, timeout=10)
# 打印响应结果（httpbin会返回请求数据）
print(f"状态码: {response.status_code}")
print(f"响应内容: {response.json()}")  # 解析JSON响应
# time.sleep(3)

# Test 2: Get Func Table
# url = "http://127.0.0.1:19999/QueryFuncRecv"
# url = "http://127.0.0.1:19999/QueryFuncSend"
# url = "http://127.0.0.1:19999/QueryPacket"
# url = "http://127.0.0.1:19999/ClearData"
url = "http://127.0.0.1:19999/GetFuncTable"
response = requests.get(url, timeout=10)
# 打印响应结果（httpbin会返回请求数据）
print(f"状态码: {response.status_code}")
# print(f"响应内容: {response.json()}")  # 解析JSON响应
# time.sleep(3)

# Test 2.5: Clear Data
# url = "http://127.0.0.1:19999/ClearData"
# response = requests.get(url, timeout=10)
# # 打印响应结果（httpbin会返回请求数据）
# print(f"状态码: {response.status_code}")
# print(f"响应内容: {response.json()}")  # 解析JSON响应
# time.sleep(3)

url = "http://127.0.0.1:19999/SetFilter"
# url = "http://127.0.0.1:19999/ClearData"
# time.sleep(3)
data = {
    "srcip": "127.0.0.1",
    "dstip": "127.0.0.1",
    "srcport": 45290,
    "dstport":43483,
}
response = requests.post(url,data=data, timeout=10)
# 打印响应结果（httpbin会返回请求数据）
print(f"状态码: {response.status_code}")
# print(f"响应内容: {response.json()}")  # 解析JSON响应
# Test 3: Get Packet
# url = "http://127.0.0.1:19999/QueryFuncRecv"
# url = "http://127.0.0.1:19999/QueryFuncSend"
url = "http://127.0.0.1:19999/QueryPacket"
# url = "http://127.0.0.1:19999/ClearData"
# time.sleep(3)
data = {
    "srcip": "127.0.0.1",
    "dstip": "127.0.0.1",
    "srcport": 45290,
    "dstport":43483,
    "ipver":"4"
}
response = requests.post(url,data=data, timeout=10)
# 打印响应结果（httpbin会返回请求数据）
print(f"状态码: {response.status_code}")
print(f"响应内容: {response.json()}")  # 解析JSON响应

# Test 4: Get Send
# url = "http://127.0.0.1:19999/QueryFuncRecv"
url = "http://127.0.0.1:19999/QueryFuncSend"
# url = "http://127.0.0.1:19999/ClearData"
# time.sleep(3)
data = {
    "srcip": "127.0.0.1",
    "dstip": "127.0.0.1",
    "srcport": 45290,
    "dstport":43483,
}
response = requests.post(url,data=data, timeout=1000)
# 打印响应结果（httpbin会返回请求数据）
print(f"状态码: {response.status_code}")
print(f"响应内容: {response.json()}")  # 解析JSON响应
