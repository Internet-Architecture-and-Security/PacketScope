from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import subprocess
import threading
import time
import json
import os
import sqlite3
import bcc

# 导入原有功能模块
from NumLatencyFrequency import enter  # WebSocket专用生成器
from ListSockets import ListAll
from ReadBTFandGetItsMember import ReadBTFandGetItsMember
from translateJSON import translateJSON
import TcxProber
from TcxQuery import TcxQuery
import AttachAndRunProbers
from QueryAndGetFuncMapRecv import QueryAndGetFuncMapRecv
from QueryAndGetFuncMapSend import QueryAndGetFuncMapSend
from GetRecentMaps import GetRecentMaps
from GetRecentPackets import GetRecentPackets

# ======================== 初始化Flask应用 ========================
mainApp = Flask(__name__)
CORS(mainApp)  # 处理HTTP跨域请求

# ======================== WebSocket配置 (新增) ========================
# 初始化SocketIO，与现有Flask应用共享端口
socketio = SocketIO(
    mainApp,
    cors_allowed_origins="*",  # 允许所有域名的WebSocket连接（生产环境需限制）
    async_mode="gevent"       # 使用gevent处理异步任务
)

# WebSocket消息处理器配置 (原WebSocket逻辑)
HANDLERS = {
    "NumLatencyFrequency": {
        "func": enter,
        "required_keys": ['ipv4', 'ipv6', 'sip', 'dip', 'sport', 'dport', 'protocol']
    }
}
PARAM_ALIASES = {'ipv4': 'ipv4_flag', 'ipv6': 'ipv6_flag'}

# WebSocket客户端任务管理 (线程安全)
active_tasks = {}  # 格式: {客户端sid: {"thread": 线程对象, "stop_event": 停止标志}}
thread_lock = threading.Lock()


# ======================== WebSocket参数验证 (原逻辑复用) ========================
def validate_params(data, required_keys):
    errors = []
    params = {}
    for key in required_keys:
        value = data.get(key)
        if value is None:
            errors.append(f"Missing parameter: {key}")
            continue
        try:
            if key in ['ipv4', 'ipv6']:
                params[key] = str(value).lower() == 'true'  # 转换为布尔值
            elif key in ['sport', 'dport']:
                ivalue = int(value)
                if not (0 <= ivalue <= 65535):
                    raise ValueError()
                params[key] = ivalue
            else:
                params[key] = value  # 其他参数保持原样
        except Exception:
            errors.append(f"Invalid value for {key}: {value}")
    return errors, params


# ======================== WebSocket后台任务处理 (原异步逻辑转线程) ========================
def handle_generator(sid, stream_type, generator, stop_event):
    """在后台线程迭代生成器并推送数据到客户端"""
    try:
        for item in generator:
            if stop_event.is_set():  # 检查是否需要停止任务
                break
            # 推送数据到客户端
            socketio.emit(
                "message",  # 固定事件名，客户端需对应接收
                {"type": stream_type, "data": item},
                room=sid  # 指定客户端会话ID
            )
            time.sleep(0.1)  # 控制数据推送速率
    except Exception as e:
        # 推送错误信息
        socketio.emit(
            "message",
            {"type": stream_type, "error": f"处理失败: {str(e)}"},
            room=sid
        )
    finally:
        # 清理任务状态
        with thread_lock:
            if active_tasks.get(sid):
                del active_tasks[sid]


# ======================== WebSocket事件处理 (新增) ========================
@socketio.on("connect")
def on_connect():
    """客户端连接时初始化任务状态"""
    sid = request.sid  # 获取客户端唯一会话ID
    with thread_lock:
        active_tasks[sid] = None
    print(f"✅ WebSocket客户端连接: {sid}")


@socketio.on("disconnect")
def on_disconnect():
    """客户端断开时清理任务"""
    sid = request.sid
    with thread_lock:
        task_info = active_tasks.get(sid)
        if task_info:
            task_info["stop_event"].set()  # 停止后台线程
            task_info["thread"].join(timeout=1)  # 等待线程退出
            del active_tasks[sid]
    print(f"❌ WebSocket客户端断开: {sid}")


@socketio.on("message")
def handle_websocket_message(message):
    """处理客户端发送的WebSocket消息"""
    sid = request.sid
    try:
        msg = json.loads(message)
        stream_type = msg.get("type")
        param_data = msg.get("params", {})

        # 1. 验证请求类型
        if stream_type not in HANDLERS:
            emit("message", {
                "type": stream_type,
                "error": "不支持的请求类型"
            })
            return

        # 2. 验证请求参数
        handler_info = HANDLERS[stream_type]
        errors, params = validate_params(param_data, handler_info["required_keys"])
        if errors:
            emit("message", {
                "type": stream_type,
                "error": "参数验证失败",
                "details": errors
            })
            return

        # 3. 参数别名转换 (原逻辑复用)
        for old_key, new_key in PARAM_ALIASES.items():
            if old_key in params:
                params[new_key] = params.pop(old_key)

        # 4. 取消旧任务 (若存在)
        with thread_lock:
            task_info = active_tasks.get(sid)
        if task_info:
            task_info["stop_event"].set()
            task_info["thread"].join(timeout=1)

        # 5. 启动新任务 (生成器在后台线程运行)
        generator = handler_info["func"](**params)  # 调用同步生成器
        stop_event = threading.Event()
        thread = threading.Thread(
            target=handle_generator,
            args=(sid, stream_type, generator, stop_event),
            daemon=True  # 守护线程，随主线程退出
        )
        thread.start()

        # 更新任务状态
        with thread_lock:
            active_tasks[sid] = {
                "thread": thread,
                "stop_event": stop_event
            }

    except json.JSONDecodeError:
        emit("message", {"type": "unknown", "error": "无效的JSON格式"})
    except Exception as e:
        emit("message", {"type": "unknown", "error": f"处理异常: {str(e)}"})


# ======================== 原有HTTP路由 (保持不变) ========================
@mainApp.route("/IsAttachFinished", methods=["GET"])
def IsAttachFinished():
    try:
        return json.dumps([AttachAndRunProbers.is_attach_finished])
    except:
        return json.dumps([False])


@mainApp.route("/GetRecentPacket", methods=["GET", "POST"])
def GetRecentPacket():
    if request.method == "GET":
        return "QueryFuncSend, Please Use POST", 400
    src_ip = request.form["srcip"]
    dst_ip = request.form["dstip"]
    src_port = request.form["srcport"]
    dst_port = request.form["dstport"]
    ipver = request.form["ipver"]
    limit = int(request.form["count"])
    try:
        result = GetRecentPackets(src_port, dst_port, src_ip, dst_ip, ipver, limit)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result


@mainApp.route("/GetRecentMap", methods=["GET", "POST"])
def GetRecentMap():
    if request.method == "GET":
        return "QueryFuncSend, Please Use POST", 400
    src_ip = request.form["srcip"]
    dst_ip = request.form["dstip"]
    src_port = request.form["srcport"]
    dst_port = request.form["dstport"]
    limit = int(request.form["count"])
    try:
        tlimit = float(request.form["timeDownLimit"])
    except:
        tlimit = -1
    try:
        result = GetRecentMaps(src_port, dst_port, src_ip, dst_ip, limit, tlimit)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result


@mainApp.route("/SetFilter", methods=["GET", "POST"])
def SetFilter():
    if request.method == "GET":
        return "QueryFuncSend, Please Use POST", 400
    src_ip = request.form["srcip"]
    dst_ip = request.form["dstip"]
    src_port = request.form["srcport"]
    dst_port = request.form["dstport"]
    TcxProber.g_srcip = src_ip
    TcxProber.g_dstip = dst_ip
    TcxProber.g_dstport = int(dst_port)
    TcxProber.g_srcport = int(src_port)
    AttachAndRunProbers.g_srcip = src_ip
    AttachAndRunProbers.g_dstip = dst_ip
    AttachAndRunProbers.g_dstport = int(dst_port)
    AttachAndRunProbers.g_srcport = int(src_port)
    AttachAndRunProbers.g_status = 0
    return "Filter Set!"


@mainApp.route("/UnsetFilter", methods=["GET"])
def UnsetFilter():
    TcxProber.g_srcip = ""
    TcxProber.g_dstip = ""
    TcxProber.g_dstport = -1
    TcxProber.g_srcport = -1
    AttachAndRunProbers.g_srcip = ""
    AttachAndRunProbers.g_dstip = ""
    AttachAndRunProbers.g_dstport = -1
    AttachAndRunProbers.g_srcport = -1
    AttachAndRunProbers.g_status = 0
    return "Filter Unset!"


@mainApp.route("/ClearData", methods=["GET"])
def DeleteHistData():
    TcxProber.clear_flag_tcx = True
    AttachAndRunProbers.clear_flag_func = True
    return "Flag Set!"


@mainApp.route("/GetFuncTable", methods=["GET"])
def QueryFuncTable():
    with open("./.cache/FuncIDMap.json", "r") as fo:
        return fo.readline()


@mainApp.route("/QueryFuncSend", methods=["GET", "POST"])
def QueryFuncSend():
    if request.method == "GET":
        return "QueryFuncSend, Please Use POST", 400
    src_ip = request.form["srcip"]
    dst_ip = request.form["dstip"]
    src_port = request.form["srcport"]
    dst_port = request.form["dstport"]
    try:
        result = QueryAndGetFuncMapSend(src_port, dst_port, src_ip, dst_ip)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result


@mainApp.route("/QueryFuncRecv", methods=["GET", "POST"])
def QueryFuncRecv():
    if request.method == "GET":
        return "QueryFuncSend, Please Use POST", 400
    src_ip = request.form["srcip"]
    dst_ip = request.form["dstip"]
    src_port = request.form["srcport"]
    dst_port = request.form["dstport"]
    try:
        result = QueryAndGetFuncMapRecv(src_port, dst_port, src_ip, dst_ip)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result


@mainApp.route("/QueryPacket", methods=["GET", "POST"])
def QueryPacket():
    if request.method == "GET":
        return "QueryFuncSend, Please Use POST", 400
    src_ip = request.form["srcip"]
    dst_ip = request.form["dstip"]
    src_port = request.form["srcport"]
    dst_port = request.form["dstport"]
    ipver = request.form["ipver"]
    try:
        result = TcxQuery(src_port, dst_port, src_ip, dst_ip, ipver)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result


@mainApp.route("/QuerySockList", methods=["GET"])
def QuerySockList():
    return ListAll()


# ======================== 应用初始化与启动 ========================
if __name__ == "__main__":
    # 1. 初始化缓存目录与数据库
    if not os.path.exists("./.cache"):
        os.makedirs("./.cache")
    for db_file in ["./.cache/FunctionInfo.db", "./.cache/PacketInfo.db"]:
        if os.path.exists(db_file):
            os.remove(db_file)

    # 2. 配置BCC与BTF
    bcc._probe_limit = 20000
    bcc._default_probe_limit = 20000
    subprocess.run(["rm", "-f", "./.cache/btf.json"])
    with open("./.cache/btf.json", "x") as fo:
        subprocess.run(["bpftool", "-j", "btf", "dump", "file", "/sys/kernel/btf/vmlinux"], stdout=fo)
    ReadBTFandGetItsMember()
    translateJSON()

    # 3. 启动原有后台线程
    contEvent = threading.Event()
    TcxThread = threading.Thread(target=TcxProber.TcxProber, args=(contEvent,), daemon=True)
    TcxThread.start()
    FuncThread = threading.Thread(target=AttachAndRunProbers.AttachAndRunProbers, args=(contEvent,), daemon=True)
    FuncThread.start()

    # 4. 启动整合WebSocket的Flask应用 (替代原mainApp.run)
    socketio.run(
        mainApp,
        host="0.0.0.0",
        port=19999,
        debug=True,
        allow_unsafe_werkzeug=True,
        use_reloader=False
        # 仅开发环境使用，生产环境需移除
    )