import asyncio
import websockets
import json

from NumLatencyFrequency import enter  # 假设是一个同步生成器

# 处理函数和参数定义
HANDLERS = {
    "NumLatencyFrequency": {
        "func": enter,
        "required_keys": ['ipv4', 'ipv6', 'sip', 'dip', 'sport', 'dport', 'protocol']
    }
}

PARAM_ALIASES = {'ipv4': 'ipv4_flag', 'ipv6': 'ipv6_flag'}

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
                params[key] = str(value).lower() == 'true'
            elif key in ['sport', 'dport']:
                ivalue = int(value)
                if not (0 <= ivalue <= 65535):
                    raise ValueError()
                params[key] = ivalue
            else:
                params[key] = value
        except Exception:
            errors.append(f"Invalid value for {key}: {value}")
    return errors, params


async def handle_client(websocket):
    active_task = None

    try:
        async for message in websocket:
            try:
                msg = json.loads(message)
                stream_type = msg.get("type")
                param_data = msg.get("params", {})

                if stream_type not in HANDLERS:
                    await websocket.send(json.dumps({
                        "type": stream_type,
                        "error": "Unknown stream type"
                    }))
                    continue

                handler_info = HANDLERS[stream_type]
                errors, params = validate_params(param_data, handler_info["required_keys"])

                if errors:
                    await websocket.send(json.dumps({
                        "type": stream_type,
                        "error": "Validation failed",
                        "details": errors
                    }))
                    continue

                # 参数别名处理
                for old, new in PARAM_ALIASES.items():
                    if old in params:
                        params[new] = params.pop(old)

                # 添加间隔参数（如有需要）
                if stream_type == "PacketFlowCount":
                    params["interval"] = 1

                # 取消旧任务
                if active_task and not active_task.done():
                    active_task.cancel()
                    try:
                        await active_task
                    except asyncio.CancelledError:
                        print("旧任务已取消")

                # 获取生成器（假设是同步生成器）
                generator = handler_info["func"](**params)

                async def send_loop():
                    try:
                        for item in generator:
                            await websocket.send(json.dumps({
                                "type": stream_type,
                                "data": item
                            }))
                            await asyncio.sleep(0.1)  # 控制速率
                    except asyncio.CancelledError:
                        print(f"任务 {stream_type} 被取消")
                        return
                    except Exception as e:
                        await websocket.send(json.dumps({
                            "type": stream_type,
                            "error": f"内部处理错误: {str(e)}"
                        }))

                active_task = asyncio.create_task(send_loop())

            except Exception as e:
                await websocket.send(json.dumps({
                    "type": "unknown",
                    "error": f"消息处理异常: {str(e)}"
                }))
    except websockets.ConnectionClosed:
        print("✅ 客户端断开连接")
    finally:
        if active_task and not active_task.done():
            active_task.cancel()
            try:
                await active_task
            except asyncio.CancelledError:
                pass


async def main():
    print("✅ WebSocket server running at ws://0.0.0.0:5000")
    async with websockets.serve(handle_client, "0.0.0.0", 5000):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
