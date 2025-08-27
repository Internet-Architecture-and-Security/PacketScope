// 获取当前环境
const isDev = process.env.NODE_ENV === "development";

// 协议 + 主机名
const protocol = window?.location?.protocol?.replace(":", "") || "http";
const host = window?.location?.hostname || "0.0.0.0";

// 各服务端口
const PORTS = {
  tracer: 19999,
  analyzer: 5000,   // WebSocket
  locator: 8000,
  guarder: 8080,
};

// URL 生成函数
function makeHttpUrl(port: number, path: string) {
  // const targetHost = isDev ? "127.0.0.1" : host;
  const targetHost = host;
  return `${protocol}://${targetHost}:${port}${path}`;
}

function makeWsUrl(port: number, path: string) {
  // const targetHost = isDev ? "127.0.0.1" : host;
  const targetHost = host;
  return `ws://${targetHost}:${port}${path}`;
}

// 统一 API 管理
export const APIs = {
  // Tracer 服务
  "Tracer.querySockList": makeHttpUrl(PORTS.tracer, "/QuerySockList"),
  "Tracer.clearData": makeHttpUrl(PORTS.tracer, "/ClearData"),
  "Tracer.isAttachFinished": makeHttpUrl(PORTS.tracer, "/IsAttachFinished"),
  "Tracer.getRecentPacket": makeHttpUrl(PORTS.tracer, "/GetRecentPacket"),
  "Tracer.getRecentMap": makeHttpUrl(PORTS.tracer, "/GetRecentMap"),
  "Tracer.getFuncTable": makeHttpUrl(PORTS.tracer, "/GetFuncTable"),

  // Analyzer 服务 (WebSocket)
  "Analyzer.ws": makeWsUrl(PORTS.analyzer, ""),

  // Locator 服务
  "Locator.trace": makeHttpUrl(PORTS.locator, "/api/trace"),
  "Locator.analyze": makeHttpUrl(PORTS.locator, "/api/analyze"),
  "Locator.history": makeHttpUrl(PORTS.locator, "/api/history"),

  // Guarder 服务
  "Guarder.stats": makeHttpUrl(PORTS.guarder, "/api/stats"),
  "Guarder.connections": makeHttpUrl(PORTS.guarder, "/api/connections"),
  "Guarder.status": makeHttpUrl(PORTS.guarder, "/api/ai/status"),
  "Guarder.config": makeHttpUrl(PORTS.guarder, "/api/ai/config"),
  "Guarder.generate": makeHttpUrl(PORTS.guarder, "/api/ai/generate"),
  "Guarder.analyze": makeHttpUrl(PORTS.guarder, "/api/ai/analyze"),
  "Guarder.filters": makeHttpUrl(PORTS.guarder, "/api/filters"),
};
