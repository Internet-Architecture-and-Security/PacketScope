// 获取当前环境
const isDev = process.env.NODE_ENV === "development";

// 协议 + 主机名（所有服务通过 nginx 统一端口代理）
const protocol = window?.location?.protocol?.replace(":", "") || "http";
const host = window?.location?.hostname || "0.0.0.0";
const port = window?.location?.port || (protocol === "https" ? "443" : "80");
const base = isDev
  ? "" // 开发模式走 Vite proxy
  : `${protocol}://${host}:${port}`;

// 生产环境通过 nginx 路径前缀路由（无需多端口）
const API_PREFIX = {
  guarder:  isDev ? "http://localhost:8080"  : `${base}/api/guarder`,
  tracer:   isDev ? "http://localhost:8000"  : `${base}/api/tracer`,
  monitor:  isDev ? "http://localhost:8010"  : `${base}/api/monitor`,
  analyzer: isDev ? "http://localhost:8020"  : `${base}/api/analyzer`,
};

function api(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

// 统一 API 管理
export const APIs = {
  // Tracer 服务 → analyzer-monitor (端口 8010)
  "Tracer.querySockList":    api(API_PREFIX.monitor, "/QuerySockList"),
  "Tracer.clearData":        api(API_PREFIX.monitor, "/ClearData"),
  "Tracer.isAttachFinished": api(API_PREFIX.monitor, "/IsAttachFinished"),
  "Tracer.getRecentPacket":  api(API_PREFIX.monitor, "/GetRecentPacket"),
  "Tracer.getRecentMap":     api(API_PREFIX.monitor, "/GetRecentMap"),
  "Tracer.getFuncTable":     api(API_PREFIX.monitor, "/GetFuncTable"),

  // Analyzer 服务 → analyzer-calculator (WebSocket，端口 8020)
  "Analyzer.ws": isDev
    ? "ws://localhost:8020"
    : `${protocol === "https" ? "wss" : "ws"}://${host}:${port}/api/analyzer/ws`,

  // Locator 服务 → tracer (端口 8000)
  "Locator.trace":   api(API_PREFIX.tracer, "/api/trace"),
  "Locator.analyze": api(API_PREFIX.tracer, "/api/analyze"),
  "Locator.history": api(API_PREFIX.tracer, "/api/history"),
  "Locator.ready":   api(API_PREFIX.tracer, "/api/ready"),

  // Guarder 服务 (端口 8080)
  "Guarder.stats":       api(API_PREFIX.guarder, "/api/stats"),
  "Guarder.connections": api(API_PREFIX.guarder, "/api/connections"),
  "Guarder.status":      api(API_PREFIX.guarder, "/api/ai/status"),
  "Guarder.config":      api(API_PREFIX.guarder, "/api/ai/config"),
  "Guarder.generate":    api(API_PREFIX.guarder, "/api/ai/generate"),
  "Guarder.analyze":     api(API_PREFIX.guarder, "/api/ai/analyze"),
  "Guarder.filters":     api(API_PREFIX.guarder, "/api/filters"),
};
