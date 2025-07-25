
const Locator = {
  'Locator.howto': '「如何使用」输入目的地址（ IP 或域名），点击「追踪分析」按钮，便可在地图上显示路由跳转路径。',
  'Locator.source': '源地址',
  'Locator.destination': '目标地址',
  'Locator.sourcePlaceholder': '请输入源地址',
  'Locator.destinationPlaceholder': '请输入目标地址（ IP 或域名）',
  'Locator.startBtn': '开始追踪',
  'Locator.cancelBtn': '终止追踪……',
  'Locator.list': '路由信息列表',
  'Locator.history': '历史记录',
  'Locator.useCache': '启用缓存',
}


const TraceResultsPanel ={
  'TraceResultsPanel.title': '路由追踪信息',
  'TraceResultsPanel.draggable': '可拖拽移动',
  'TraceResultsPanel.expand': '展开',
  'TraceResultsPanel.collapse': '折叠',
  'TraceResultsPanel.ttl': 'TTL',
  'TraceResultsPanel.ipAddress': 'IP地址',
  'TraceResultsPanel.latency': '延迟',
  'TraceResultsPanel.asn': 'ASN',
  'TraceResultsPanel.location': '地理位置',
  'TraceResultsPanel.timeout': '请求超时',
  'TraceResultsPanel.timeoutShort': '超时',
  'TraceResultsPanel.allPacketsLost': '全部丢包',
  'TraceResultsPanel.unknown': '未知',
  'TraceResultsPanel.totalHops': '共 {count} 个跳点',
  'TraceResultsPanel.normal': '正常',
  'TraceResultsPanel.highLatency': '延迟高',
  'TraceResultsPanel.noData': '暂无追踪数据',
  'TraceResultsPanel.inputTarget': '输入目标地址开始追踪',
  'TraceResultsPanel.tracing': '正在追踪路由...',
  'TraceResultsPanel.tracingInProgress': '追踪进行中...',
  'TraceResultsPanel.traceComplete': '追踪完成',
}

const RiskAnalysisPanel = {
    // RiskAnalysisPanel module
    'RiskAnalysisPanel.title': '路由风险分析',
    'RiskAnalysisPanel.analyzing': '正在分析路由风险...',
    'RiskAnalysisPanel.noData': '暂无风险分析数据',
    'RiskAnalysisPanel.comprehensiveRiskScore': '综合风险评分',
    'RiskAnalysisPanel.analysisDescription': '基于路由异常、延迟、安全威胁等多维度分析',
    'RiskAnalysisPanel.detectedAnomalies': '检测到的异常',
    'RiskAnalysisPanel.securityAlerts': '安全警报',
    'RiskAnalysisPanel.routeNormal': '路由状态正常',
    'RiskAnalysisPanel.noThreatsDetected': '未检测到异常或安全威胁',
    
    // Risk levels
    'RiskAnalysisPanel.highRisk': '高风险',
    'RiskAnalysisPanel.mediumRisk': '中风险',
    'RiskAnalysisPanel.lowRisk': '低风险',
    
    // Anomaly types
    'RiskAnalysisPanel.pathDeviation': '路径偏离',
    'RiskAnalysisPanel.highLatency': '高延迟',
    'RiskAnalysisPanel.maliciousIP': '恶意IP',
    'RiskAnalysisPanel.packetLoss': '丢包异常',
}

const HistoryPanel = {
  'HistoryPanel.title': '历史记录',
  'HistoryPanel.refresh': '刷新',
  'HistoryPanel.collapse': '收起',
  'HistoryPanel.expand': '展开',
  'HistoryPanel.noHistoryData': '暂无历史记录',
  'HistoryPanel.visualization': '可视化',
  'HistoryPanel.hops': '跳数',
  'HistoryPanel.avgLatency': '平均延迟',
  'HistoryPanel.targetLocation': '目标位置',
  'HistoryPanel.time': '时间',
  'HistoryPanel.trace': '追踪',
}

export default {
  ...Locator,
  ...TraceResultsPanel,
  ...RiskAnalysisPanel,
  ...HistoryPanel
};
