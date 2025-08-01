const Guarder = {
  'Guarder.connectionMonitor': '连接监控',
  'Guarder.filterManagement': '过滤器管理', 
  'Guarder.aiIntelligenceCenter': 'AI智能中心',
  'Guarder.aiConfigInvalid': 'AI配置无效',
  'Guarder.aiConfigInvalidDesc': '请先在AI中心配置API密钥和模型参数',
  'Guarder.aiAnalysisComplete': 'AI分析完成',
  'Guarder.aiAnalysisCompleteDesc': '已成功生成 {count} 个智能过滤规则',
  'Guarder.aiAnalysisCompleteWithRules': 'AI已完成网络数据分析，生成了 {count} 个智能过滤规则。',
  'Guarder.aiAnalysisCompleteNoRules': 'AI已完成网络数据分析，但未生成任何过滤规则。',
  'Guarder.unknownError': '未知错误',
  'Guarder.checkNetworkAndConfig': '请检查网络连接和AI配置',
  'Guarder.aiAnalysisFailed': 'AI分析失败',
  'Guarder.aiGeneratedRule': 'AI生成规则',
  'Guarder.ruleApplySuccess': '规则应用成功',
  'Guarder.ruleApplySuccessDesc': '已应用 {count} 个AI生成的过滤规则',
  'Guarder.prepareData': '准备数据',
  'Guarder.prepareDataDesc': '收集网络连接和流量数据',
  'Guarder.aiAnalysis': 'AI分析',
  'Guarder.aiAnalysisDesc': '使用大语言模型分析并生成规则',
  'Guarder.complete': '完成',
  'Guarder.completeDesc': '分析完成，规则已生成',
  'Guarder.aiAnalysisReport': 'AI分析报告',
  'Guarder.securitySuggestions': '安全建议',
  'Guarder.tokenUsage': 'Token使用量',
  'Guarder.ruleType': '规则类型',
  'Guarder.protocol': '协议',
  'Guarder.sourceIp': '源IP',
  'Guarder.destinationIp': '目标IP',
  'Guarder.port': '端口',
  'Guarder.tcpFlags': 'TCP标志',
  'Guarder.action': '动作',
  'Guarder.block': '阻断',
  'Guarder.allow': '允许',
  'Guarder.description': '说明',
  'Guarder.aiSmartGenerateFilter': 'AI智能生成过滤器',
  'Guarder.aiAnalysisError': 'AI分析错误',
  'Guarder.aiConfigIncomplete': 'AI配置未完成',
  'Guarder.aiConfigIncompleteDesc': '请先在AI中心配置API密钥和模型参数后再使用此功能',
  'Guarder.aiAnalyzingNetwork': 'AI 正在分析网络数据...',
  'Guarder.aiAnalysisConfig': 'AI分析配置',
  'Guarder.aiAnalysisConfigDesc': '选择分析类型和数据范围，AI将基于当前网络状态生成智能过滤规则。',
  'Guarder.analysisStrategy': '分析策略',
  'Guarder.pleaseSelectAnalysisStrategy': '请选择分析策略',
  'Guarder.securityOriented': '安全导向',
  'Guarder.performanceOriented': '性能导向',
  'Guarder.custom': '自定义',
  'Guarder.customAnalysisPrompt': '自定义分析提示',
  'Guarder.pleaseEnterCustomPrompt': '请输入自定义分析提示',
  'Guarder.customPromptPlaceholder': '例: 重点关注SSH和HTTP服务安全，识别暴力破解攻击...',
  'Guarder.includeDataTypes': '包含数据类型',
  'Guarder.tcpConnectionData': 'TCP连接数据',
  'Guarder.udpConnectionData': 'UDP连接数据',
  'Guarder.icmpTrafficData': 'ICMP流量数据',
  'Guarder.performanceStatsData': '性能统计数据',
  'Guarder.startAiAnalysis': '开始AI分析',
  'Guarder.analysisResults': '分析结果',
  'Guarder.generatedRules': '生成的规则 ({count})',
  'Guarder.aiGeneratedRulesDesc': 'AI已生成 {count} 个智能过滤规则，请选择要应用的规则：',
  'Guarder.cancel': '取消',
  'Guarder.applySelectedRules': '应用选中规则 ({count})',
}

const ConnectionsMonitor = {
  "ConnectionsMonitor.title": "网络连接监控",
  "ConnectionsMonitor.subtitle": "实时监控网络连接状态和流量数据",
  "ConnectionsMonitor.totalPackets": "总数据包",
  "ConnectionsMonitor.totalBytes": "总字节数",
  "ConnectionsMonitor.droppedPackets": "丢弃的数据包",
  "ConnectionsMonitor.malformedPackets": "格式错误的数据包",
  "ConnectionsMonitor.connectionInfo": "连接信息",
  "ConnectionsMonitor.detailInfo": "详细信息",
  "ConnectionsMonitor.searchPlaceholder": "搜索 IP 地址或协议...",
  "ConnectionsMonitor.startMonitoring": "开始监控",
  "ConnectionsMonitor.stopMonitoring": "停止监控",
  "ConnectionsMonitor.refreshNow": "立即刷新",
  "ConnectionsMonitor.exportData": "导出数据",
  "ConnectionsMonitor.connectionDetails": "连接详情",
  "ConnectionsMonitor.totalConnections": "共 {count} 条连接记录",
  "ConnectionsMonitor.noMatchingConnections": "未找到匹配的连接",
  "ConnectionsMonitor.adjustSearchCriteria": "尝试调整搜索条件",
  "ConnectionsMonitor.dataFetchError": "数据获取失败",
  "ConnectionsMonitor.dataFetchErrorDescription": "无法获取数据：{error}{retry}",
  "ConnectionsMonitor.retryInfo": " (重试 {current}/{total})",
  "ConnectionsMonitor.monitoringStarted": "监控已开启",
  "ConnectionsMonitor.monitoringStartedDescription": "开始实时监控网络连接",
  "ConnectionsMonitor.monitoringStopped": "监控已停止",
  "ConnectionsMonitor.monitoringStoppedDescription": "已停止实时监控",
  "ConnectionsMonitor.refreshSuccess": "刷新成功",
  "ConnectionsMonitor.refreshSuccessDescription": "数据已更新",
  "ConnectionsMonitor.exportSuccess": "导出成功",
  "ConnectionsMonitor.exportSuccessDescription": "数据已保存到本地文件"
}

const FiltersManager = {
  "FiltersManager.title": "网络过滤器管理",
  "FiltersManager.subtitle": "管理和配置网络流量过滤规则，保护网络安全",
  "FiltersManager.totalRules": "总规则数",
  "FiltersManager.enabledRules": "启用规则",
  "FiltersManager.disabledRules": "禁用规则",
  "FiltersManager.aiGeneratedRules": "AI生成规则",
  "FiltersManager.ruleType": "规则类型",
  "FiltersManager.sourceIp": "源IP",
  "FiltersManager.protocol": "协议",
  "FiltersManager.action": "动作",
  "FiltersManager.status": "状态",
  "FiltersManager.comment": "备注",
  "FiltersManager.operations": "操作",
  "FiltersManager.actionDrop": "阻断",
  "FiltersManager.actionAllow": "允许",
  "FiltersManager.aiConfidence": "AI置信度: {confidence}%",
  "FiltersManager.edit": "编辑",
  "FiltersManager.delete": "删除",
  "FiltersManager.confirmDelete": "确定要删除这个过滤器吗？",
  "FiltersManager.confirm": "确定",
  "FiltersManager.cancel": "取消",
  "FiltersManager.searchPlaceholder": "搜索IP地址或备注...",
  "FiltersManager.allTypes": "所有类型",
  "FiltersManager.basicRule": "基础规则",
  "FiltersManager.tcpRule": "TCP规则",
  "FiltersManager.udpRule": "UDP规则",
  "FiltersManager.icmpRule": "ICMP规则",
  "FiltersManager.ruleStatus": "规则状态",
  "FiltersManager.allStatus": "所有状态",
  "FiltersManager.enabled": "已启用",
  "FiltersManager.disabled": "已禁用",
  "FiltersManager.allActions": "所有动作",
  "FiltersManager.addFilter": "添加过滤器",
  "FiltersManager.aiGenerate": "AI智能生成",
  "FiltersManager.totalRulesCount": "共 {total} 条规则",
  "FiltersManager.noFiltersFound": "没有找到过滤器",
  "FiltersManager.adjustSearchOrCreate": "尝试调整搜索条件或创建新的过滤器",
  "FiltersManager.editFilter": "编辑过滤器",
  "FiltersManager.selectRuleType": "请选择规则类型",
  "FiltersManager.selectAction": "请选择动作",
  "FiltersManager.sourceIpAddress": "源IP地址",
  "FiltersManager.sourceIpTooltip": "留空表示任意IP (0.0.0.0)",
  "FiltersManager.sourceIpPlaceholder": "例: 192.168.1.100 (留空=任意)",
  "FiltersManager.destIpAddress": "目标IP地址",
  "FiltersManager.destIpTooltip": "留空表示任意IP (0.0.0.0)",
  "FiltersManager.destIpPlaceholder": "例: 8.8.8.8 (留空=任意)",
  "FiltersManager.sourcePort": "源端口",
  "FiltersManager.destPort": "目标端口",
  "FiltersManager.portTooltip": "0表示任意端口",
  "FiltersManager.portPlaceholder": "0=任意",
  "FiltersManager.selectProtocol": "请选择协议",
  "FiltersManager.tcpSpecificFields": "TCP规则特定字段",
  "FiltersManager.tcpSpecificDescription": "配置TCP标志位匹配条件",
  "FiltersManager.tcpFlags": "TCP标志位",
  "FiltersManager.tcpFlagsTooltip": "要匹配的TCP标志位，0表示不检查",
  "FiltersManager.selectTcpFlags": "选择要匹配的TCP标志位",
  "FiltersManager.tcpFlagsMask": "标志位掩码",
  "FiltersManager.tcpFlagsMaskTooltip": "指定哪些标志位需要检查，0表示忽略所有标志位",
  "FiltersManager.selectTcpFlagsMask": "选择要检查的标志位",
  "FiltersManager.tcpFlagFin": "FIN (连接终止)",
  "FiltersManager.tcpFlagSyn": "SYN (建立连接)",
  "FiltersManager.tcpFlagRst": "RST (重置连接)",
  "FiltersManager.tcpFlagPsh": "PSH (推送数据)",
  "FiltersManager.tcpFlagAck": "ACK (确认)",
  "FiltersManager.tcpFlagUrg": "URG (紧急数据)",
  "FiltersManager.icmpSpecificFields": "ICMP规则特定字段",
  "FiltersManager.icmpSpecificDescription": "配置ICMP类型、代码和内部包过滤条件",
  "FiltersManager.icmpType": "ICMP类型",
  "FiltersManager.icmpTypeTooltip": "255表示任意类型",
  "FiltersManager.selectIcmpType": "选择ICMP类型",
  "FiltersManager.icmpCode": "ICMP代码",
  "FiltersManager.icmpCodeTooltip": "255表示任意代码",
  "FiltersManager.icmpCodePlaceholder": "255=任意",
  "FiltersManager.icmpEchoReply": "Echo Reply (0)",
  "FiltersManager.icmpDestUnreachable": "Destination Unreachable (3)",
  "FiltersManager.icmpRedirect": "Redirect (5)",
  "FiltersManager.icmpEchoRequest": "Echo Request (8)",
  "FiltersManager.icmpRouterAdv": "Router Advertisement (9)",
  "FiltersManager.icmpRouterSelect": "Router Selection (10)",
  "FiltersManager.icmpTimeExceeded": "Time Exceeded (11)",
  "FiltersManager.icmpParamProblem": "Parameter Problem (12)",
  "FiltersManager.icmpTimestamp": "Timestamp (13)",
  "FiltersManager.icmpTimestampReply": "Timestamp Reply (14)",
  "FiltersManager.innerPacketFilter": "内部包过滤 (用于ICMP错误消息)",
  "FiltersManager.innerPacketDescription": "过滤ICMP错误消息中包含的原始包信息",
  "FiltersManager.innerSourceIp": "内部源IP",
  "FiltersManager.innerSourceIpTooltip": "ICMP错误消息中原始包的源IP，0.0.0.0表示任意",
  "FiltersManager.innerSourceIpPlaceholder": "例: 192.168.1.100 (留空=任意)",
  "FiltersManager.innerDestIp": "内部目标IP",
  "FiltersManager.innerDestIpTooltip": "ICMP错误消息中原始包的目标IP，0.0.0.0表示任意",
  "FiltersManager.innerDestIpPlaceholder": "例: 8.8.8.8 (留空=任意)",
  "FiltersManager.innerProtocol": "内部协议",
  "FiltersManager.innerProtocolTooltip": "ICMP错误消息中原始包的协议，0表示任意",
  "FiltersManager.selectInnerProtocol": "选择内部协议",
  "FiltersManager.udpRuleDescription": "UDP规则主要使用源端口和目标端口进行过滤，无需额外的特定字段配置。",
  "FiltersManager.ruleDescription": "规则说明",
  "FiltersManager.ruleDescriptionPlaceholder": "输入规则说明，建议详细描述规则的用途和生效条件",
  "FiltersManager.enableRule": "启用规则"
}


const AiCenter =  {
  // 页面标题和描述
  'AiCenter.title': 'AI智能过滤器生成',
  'AiCenter.description': '利用人工智能技术自动分析网络流量并生成eBPF过滤规则',
  
  // 加载状态
  'AiCenter.loading': '处理中...',
  
  // AI服务状态
  'AiCenter.aiServiceConfigured': 'AI服务已配置',
  'AiCenter.aiServiceNotConfigured': 'AI服务配置不完整',
  'AiCenter.aiServiceConfiguredDesc': '使用模型: {model} | 端点: {endpoint}',
  'AiCenter.aiServiceNotConfiguredDesc': '请完善API密钥、端点和模型配置后才能使用AI功能',
  'AiCenter.configureNow': '立即配置',
  'AiCenter.unknown': '未知',
  
  // 功能卡片
  'AiCenter.aiConfig': 'AI配置',
  'AiCenter.aiConfigDesc': '配置OpenAI API密钥、模型参数和请求设置',
  'AiCenter.configured': '已配置',
  'AiCenter.notConfigured': '未配置',
  'AiCenter.notSet': '未设置',
  
  'AiCenter.intelligentGeneration': '智能生成',
  'AiCenter.intelligentGenerationDesc': '基于当前网络数据自动生成过滤规则',
  'AiCenter.securityOriented': '安全导向',
  'AiCenter.performanceOriented': '性能导向',
  'AiCenter.custom': '自定义',
  'AiCenter.requiresAiService': '需要配置AI服务',
  
  'AiCenter.networkAnalysis': '网络分析',
  'AiCenter.networkAnalysisDesc': '分析网络流量模式，识别潜在威胁',
  'AiCenter.threatDetection': '威胁检测',
  'AiCenter.trafficAnalysis': '流量分析',
  
  // 核心特性
  'AiCenter.coreFeatures': '核心特性',
  'AiCenter.feature1': '智能分析TCP/UDP连接和ICMP流量',
  'AiCenter.feature2': '支持多种分析策略和自定义提示',
  'AiCenter.feature3': '生成详细注释和安全建议',
  'AiCenter.feature4': '灵活的OpenAI端点和模型配置',
  
  // 结果展示
  'AiCenter.intelligentGenerationResult': 'AI智能生成结果',
  'AiCenter.threatAnalysis': '威胁分析：',
  'AiCenter.securityRecommendations': '安全建议：',
  'AiCenter.generatedRules': '生成的规则：',
  'AiCenter.tokenUsage': 'Token 使用量：',
  'AiCenter.generationFailed': 'AI过滤器生成失败',
  
  'AiCenter.networkAnalysisResult': 'AI网络分析结果',
  'AiCenter.networkTrafficSummary': '网络流量摘要：',
  
  // 模态框标题
  'AiCenter.aiConfigSettings': 'AI配置设置',
  'AiCenter.aiNetworkAnalysis': 'AI网络分析',
  
  // 表单标签和提示
  'AiCenter.configDescription': '配置说明',
  'AiCenter.configDescriptionText': '请配置您的OpenAI API密钥和相关参数。这些信息将用于AI分析和规则生成。',
  'AiCenter.openaiEndpoint': 'OpenAI端点',
  'AiCenter.apiKey': 'API密钥',
  'AiCenter.model': '模型',
  'AiCenter.temperature': 'Temperature',
  'AiCenter.timeout': '超时时间(秒)',
  'AiCenter.enableDebugMode': '启用调试模式',
  
  // 表单验证消息
  'AiCenter.pleaseEnterOpenaiEndpoint': '请输入OpenAI端点',
  'AiCenter.pleaseEnterApiKey': '请输入API密钥',
  'AiCenter.pleaseSelectOrEnterModel': '请选择或输入模型名称',
  'AiCenter.pleaseEnterTemperature': '请输入Temperature值',
  'AiCenter.pleaseEnterTimeout': '请输入超时时间',
  'AiCenter.modelPlaceholder': '请输入或选择模型名称',
  'AiCenter.apiKeyPlaceholder': 'AI API 密钥',
  
  // 网络分析表单
  'AiCenter.analysisDescription': '网络分析说明',
  'AiCenter.analysisDescriptionText': '此功能仅分析当前网络流量模式和威胁情况，不会生成过滤规则。适用于了解网络安全状况。',
  'AiCenter.analysisScope': '分析范围',
  'AiCenter.analyzeTcpConnections': '分析TCP连接',
  'AiCenter.analyzeUdpConnections': '分析UDP连接',
  'AiCenter.analyzeIcmpTraffic': '分析ICMP流量',
  'AiCenter.includeStatistics': '包含统计数据',
  'AiCenter.customAnalysisPrompt': '自定义分析提示',
  'AiCenter.customAnalysisPlaceholder': '可选：提供特定的分析指令，如\'分析流量模式中的异常行为\'...',
  
  // 按钮文本
  'AiCenter.cancel': '取消',
  'AiCenter.startAnalysis': '开始分析',
  
  // 通知消息
  'AiCenter.aiServiceNotConfiguredTitle': 'AI服务未配置',
  'AiCenter.aiServiceNotConfiguredContent': '请先配置AI服务参数才能使用智能分析功能。是否现在配置？',
  'AiCenter.configureImmediately': '立即配置',
  'AiCenter.configureLater': '稍后配置',
  
  'AiCenter.aiConfigSaved': 'AI配置已保存',
  'AiCenter.configUpdatedSuccessfully': '配置已成功更新',
  'AiCenter.saveAiConfigFailed': '保存AI配置失败',
  'AiCenter.checkConfigAndRetry': '请检查配置信息后重试',
  
  'AiCenter.aiNetworkAnalysisComplete': 'AI网络分析完成',
  'AiCenter.analysisResultGenerated': '分析结果已生成',
  'AiCenter.aiNetworkAnalysisFailed': 'AI网络分析失败',
  'AiCenter.pleaseRetry': '请重试',
  
  'AiCenter.aiFilterGenerationComplete': 'AI过滤器生成完成',
  'AiCenter.filterRulesGenerated': '过滤规则已生成',
  'AiCenter.aiFilterGenerationFailed': 'AI过滤器生成失败'
};

const useFilters =  {
  // 错误消息
  'useFilters.fetchFiltersFailed': '获取过滤器失败',
  'useFilters.addFilterFailed': '添加过滤器失败',
  'useFilters.updateFilterFailed': '更新过滤器失败',
  'useFilters.deleteFilterFailed': '删除过滤器失败',
  'useFilters.toggleFilterFailed': '切换过滤器状态失败',
  
  // 成功消息
  'useFilters.addSuccess': '添加成功',
  'useFilters.updateSuccess': '更新成功',
  'useFilters.deleteSuccess': '删除成功',
  'useFilters.enableSuccess': '启用成功',
  'useFilters.disableSuccess': '禁用成功',
  
  // 默认过滤器注释
  'useFilters.blockIcmpPing': 'Block all ICMP ping requests (Echo Request)',
  'useFilters.blockIcmpDestUnreachable': 'Block ICMP Destination Unreachable with inner UDP packets',
  'useFilters.blockUdpTraceroute': 'Block UDP traceroute attempts (ICMP Time Exceeded)',
  'useFilters.blockTelnet': 'Block Telnet (insecure remote access)',
  'useFilters.blockRpcEndpoint': 'Block RPC Endpoint Mapper (Windows vulnerability)',
  'useFilters.blockSmbCifs': 'Block SMB/CIFS (ransomware vector)',
  'useFilters.blockNetbios': 'Block NetBIOS Session Service',
  'useFilters.blockMsSqlServer': 'Block MS SQL Server (external access)',
  'useFilters.blockRdp': 'Block RDP (brute force target)',
  'useFilters.blockVnc': 'Block VNC (insecure remote access)'
};

export default {
  ...Guarder,
  ...ConnectionsMonitor,
  ...FiltersManager,
  ...AiCenter,
  ...useFilters
};
