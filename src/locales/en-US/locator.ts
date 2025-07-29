

const Locator = {
  'Locator.howto': 'How to use: Enter the destination address (IP or domain name), click the "Start Tracking" button, and the routing path will be displayed on the map.',
  'Locator.source': 'Source Address',
  'Locator.destination': 'Destination Address',
  'Locator.sourcePlaceholder': 'Please enter source address',
  'Locator.destinationPlaceholder': 'Please enter destination address (IP or domain name)',
  'Locator.startBtn': 'Start Tracking',
  'Locator.cancelBtn': 'Stop Tracking...',
  'Locator.list': 'Route Information List',
  'Locator.history': 'History',
  'Locator.useCache': 'Enable Cache',
}

const TraceResultsPanel ={
  'TraceResultsPanel.title': 'Route Trace Information',
  'TraceResultsPanel.draggable': 'Draggable',
  'TraceResultsPanel.expand': 'Expand',
  'TraceResultsPanel.collapse': 'Collapse',
  'TraceResultsPanel.ttl': 'TTL',
  'TraceResultsPanel.ipAddress': 'IP Address',
  'TraceResultsPanel.latency': 'Latency',
  'TraceResultsPanel.asn': 'ASN',
  'TraceResultsPanel.location': 'Location',
  'TraceResultsPanel.timeout': 'Request Timeout',
  'TraceResultsPanel.timeoutShort': 'Timeout',
  'TraceResultsPanel.allPacketsLost': 'All Packets Lost',
  'TraceResultsPanel.unknown': 'Unknown',
  'TraceResultsPanel.totalHops': 'Total {count} hops',
  'TraceResultsPanel.normal': 'Normal',
  'TraceResultsPanel.highLatency': 'High Latency',
  'TraceResultsPanel.noData': 'No trace data',
  'TraceResultsPanel.inputTarget': 'Enter target address to start tracing',
  'TraceResultsPanel.tracing': 'Tracing route...',
  'TraceResultsPanel.tracingInProgress': 'Tracing in progress...',
  'TraceResultsPanel.traceComplete': 'Trace completed',
  "TraceResultsPanel.map.hop": "Hop {index}: {ip}",
  "TraceResultsPanel.map.location": "Location: {location}",
  "TraceResultsPanel.map.latency": "Latency: {latency} ms",
  "TraceResultsPanel.map.jitter": "Jitter: {jitter} ms",
  "TraceResultsPanel.map.packetLoss": "Packet Loss: {loss}",
  "TraceResultsPanel.map.bandwidth": "Bandwidth: {bandwidth} Mbps",
  "TraceResultsPanel.map.isp": "ISP: {isp}",
  "TraceResultsPanel.map.asn": "ASN: {asn}",
  "TraceResultsPanel.map.sourcePoint": "Source",
  "TraceResultsPanel.map.destinationPoint": "Destination",
  "TraceResultsPanel.map.skippedHops": "Skipped {count} hops",
  "TraceResultsPanel.map.unknownHops": "Note: The path contains undetectable hops (shown as dashed lines)",
  "TraceResultsPanel.map.unknown": "Unknown"
}

const RiskAnalysisPanel = {
  // RiskAnalysisPanel module
  'RiskAnalysisPanel.title': 'Route Risk Analysis',
  'RiskAnalysisPanel.analyzing': 'Analyzing route risks...',
  'RiskAnalysisPanel.noData': 'No risk analysis data available',
  'RiskAnalysisPanel.comprehensiveRiskScore': 'Comprehensive Risk Score',
  'RiskAnalysisPanel.analysisDescription': 'Multi-dimensional analysis based on route anomalies, latency, security threats, etc.',
  'RiskAnalysisPanel.detectedAnomalies': 'Detected Anomalies',
  'RiskAnalysisPanel.securityAlerts': 'Security Alerts',
  'RiskAnalysisPanel.routeNormal': 'Route Status Normal',
  'RiskAnalysisPanel.noThreatsDetected': 'No anomalies or security threats detected',
  
  // Risk levels
  'RiskAnalysisPanel.highRisk': 'High Risk',
  'RiskAnalysisPanel.mediumRisk': 'Medium Risk',
  'RiskAnalysisPanel.lowRisk': 'Low Risk',
  
  // Anomaly types
  'RiskAnalysisPanel.pathDeviation': 'Path Deviation',
  'RiskAnalysisPanel.highLatency': 'High Latency',
  'RiskAnalysisPanel.maliciousIP': 'Malicious IP',
  'RiskAnalysisPanel.packetLoss': 'Packet Loss',
}

const HistoryPanel = {
  'HistoryPanel.title': 'History Records',
  'HistoryPanel.refresh': 'Refresh',
  'HistoryPanel.collapse': 'Collapse',
  'HistoryPanel.expand': 'Expand',
  'HistoryPanel.noHistoryData': 'No history records',
  'HistoryPanel.visualization': 'Visualization',
  'HistoryPanel.hops': 'Hops',
  'HistoryPanel.avgLatency': 'Avg Latency',
  'HistoryPanel.targetLocation': 'Target Location',
  'HistoryPanel.time': 'Time',
  'HistoryPanel.trace': 'Trace',
}
export default {
  ...Locator,
  ...TraceResultsPanel,
  ...RiskAnalysisPanel,
  ...HistoryPanel
};
