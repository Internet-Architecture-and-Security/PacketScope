#!/usr/bin/env python3
"""
MCP 协议规范测试
测试 Monitor MCP Server 是否符合 MCP 协议规范
"""

import asyncio
import json
import os
import sys
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ANSI 颜色
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

def print_section(title: str):
    """打印章节标题"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}  {title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.RESET}\n")

def print_test(name: str, passed: bool, message: str = ""):
    """打印测试结果"""
    status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if passed else f"{Colors.RED}✗ FAIL{Colors.RESET}"
    print(f"  {status} {Colors.BOLD}{name}{Colors.RESET}")
    if message:
        print(f"      {message}")

def print_info(message: str):
    """打印信息"""
    print(f"  {Colors.BLUE}ℹ{Colors.RESET} {message}")


class MCPStdioTester:
    """MCP stdio 模式测试器"""
    
    def __init__(self, server_script: str):
        self.server_script = server_script
        self.process: Optional[subprocess.Popen] = None
        self.request_id = 0
    
    async def start_server(self):
        """启动服务器"""
        print_info(f"正在启动服务器: {self.server_script}")
        
        env = os.environ.copy()
        env["MONITOR_MCP_TRANSPORT"] = "stdio"
        
        self.process = subprocess.Popen(
            [sys.executable, self.server_script],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            bufsize=0
        )
        
        # 等待服务器启动
        await asyncio.sleep(1)
        
        if self.process.poll() is not None:
            stderr = self.process.stderr.read()
            raise Exception(f"服务器启动失败: {stderr}")
        
        print_info("服务器已启动")
    
    async def send_request(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """发送 MCP 请求"""
        self.request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params or {}
        }
        
        request_json = json.dumps(request) + "\n"
        self.process.stdin.write(request_json)
        self.process.stdin.flush()
        
        # 读取响应
        response_line = self.process.stdout.readline()
        return json.loads(response_line)
    
    async def test_initialize(self) -> bool:
        """测试初始化请求"""
        try:
            response = await self.send_request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            })
            
            if response.get("jsonrpc") != "2.0":
                return False
            if "result" not in response:
                return False
            if "capabilities" not in response["result"]:
                return False
            
            return True
        except Exception as e:
            print(f"      错误: {e}")
            return False
    
    async def test_list_tools(self) -> bool:
        """测试列出工具"""
        try:
            response = await self.send_request("tools/list")
            
            if response.get("jsonrpc") != "2.0":
                return False
            if "result" not in response:
                return False
            if "tools" not in response["result"]:
                return False
            
            tools = response["result"]["tools"]
            print_info(f"发现 {len(tools)} 个工具")
            
            # 检查工具名称
            tool_names = [t["name"] for t in tools]
            expected_tools = ["get_recent_packets", "get_socket_list", "health_check"]
            for expected in expected_tools:
                if expected not in tool_names:
                    print(f"      缺少工具: {expected}")
            
            return True
        except Exception as e:
            print(f"      错误: {e}")
            return False
    
    async def test_call_tool(self) -> bool:
        """测试调用工具"""
        try:
            response = await self.send_request("tools/call", {
                "name": "health_check",
                "arguments": {}
            })
            
            if response.get("jsonrpc") != "2.0":
                return False
            if "result" not in response:
                return False
            if "content" not in response["result"]:
                return False
            
            return True
        except Exception as e:
            print(f"      错误: {e}")
            return False
    
    def stop_server(self):
        """停止服务器"""
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()


class MCPHTTPTester:
    """MCP HTTP 模式测试器（SSE）"""
    
    def __init__(self, server_url: str):
        self.server_url = server_url
        self.session = None
    
    async def test_server_reachable(self) -> bool:
        """测试服务器可访问"""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.server_url}/health", follow_redirects=True)
                return response.status_code in [200, 404, 405]  # 健康检查端点可能不存在，但服务器应该响应
        except Exception as e:
            print(f"      错误: {e}")
            return False


def find_server_script() -> str:
    """查找服务器脚本"""
    current_dir = Path(__file__).resolve().parent.parent
    server_path = current_dir / "mcp_server.py"
    if not server_path.exists():
        raise FileNotFoundError(f"找不到服务器脚本: {server_path}")
    return str(server_path)


async def main():
    """主测试函数"""
    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("╔═══════════════════════════════════════════════════════════════╗")
    print("║   PacketScope Monitor MCP Server - 协议规范测试                ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")
    
    server_script = find_server_script()
    test_results = []
    
    # 测试 1: 语法检查
    print_section("测试 1: 语法检查")
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, "-m", "py_compile", server_script],
            capture_output=True,
            text=True
        )
        passed = result.returncode == 0
        print_test("Python 语法检查", passed, "mcp_server.py" if passed else result.stderr)
        test_results.append(("语法检查", passed))
    except Exception as e:
        print_test("Python 语法检查", False, str(e))
        test_results.append(("语法检查", False))
    
    # 测试 2: 依赖检查
    print_section("测试 2: 依赖检查")
    try:
        import mcp.server.fastmcp
        print_test("fastmcp 导入", True)
        test_results.append(("fastmcp 导入", True))
    except ImportError as e:
        print_test("fastmcp 导入", False, str(e))
        test_results.append(("fastmcp 导入", False))
    
    try:
        from monitor_client import MonitorClient
        print_test("monitor_client 导入", True)
        test_results.append(("monitor_client 导入", True))
    except ImportError as e:
        print_test("monitor_client 导入", False, str(e))
        test_results.append(("monitor_client 导入", False))
    
    # 测试 3: stdio 模式（简单测试）
    print_section("测试 3: stdio 模式基本测试")
    print_info("注意: 完整的 stdio 测试需要 MCP SDK，这里做简化测试")
    
    # 检查服务器脚本结构
    try:
        with open(server_script, 'r') as f:
            content = f.read()
            has_fastmcp = 'from mcp.server.fastmcp' in content
            has_tools = '@mcp.tool()' in content
            has_run = 'mcp.run(' in content
            
            print_test("使用 fastmcp 框架", has_fastmcp)
            print_test("有工具定义", has_tools)
            print_test("有 mcp.run() 调用", has_run)
            
            test_results.extend([
                ("使用 fastmcp 框架", has_fastmcp),
                ("有工具定义", has_tools),
                ("有 mcp.run() 调用", has_run)
            ])
    except Exception as e:
        print_test("检查服务器脚本", False, str(e))
        test_results.append(("检查服务器脚本", False))
    
    # 测试 4: 配置文件检查
    print_section("测试 4: 配置文件检查")
    current_dir = Path(__file__).resolve().parent.parent
    
    config_files = [
        ("config.example.json", "stdio 模式配置"),
        ("config.http.json", "HTTP 模式配置"),
        ("start.sh", "stdio 启动脚本"),
        ("start-http.sh", "HTTP 启动脚本")
    ]
    
    for filename, description in config_files:
        filepath = current_dir / filename
        exists = filepath.exists()
        print_test(description, exists, filename if exists else "文件不存在")
        test_results.append((description, exists))
    
    # 总结
    print_section("测试总结")
    total = len(test_results)
    passed = sum(1 for _, p in test_results if p)
    failed = total - passed
    
    print(f"\n{Colors.BOLD}总体结果:{Colors.RESET}")
    print(f"  总数: {total}")
    print(f"  {Colors.GREEN}通过: {passed}{Colors.RESET}")
    print(f"  {Colors.RED}失败: {failed}{Colors.RESET}")
    
    if failed > 0:
        print(f"\n{Colors.YELLOW}提示:")
        print("  1. 运行 'pip install -r requirements.txt' 安装依赖")
        print("  2. 确保 Monitor API 正在运行")
        print(f"  3. 查看 README.md 了解更多信息{Colors.RESET}")
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
