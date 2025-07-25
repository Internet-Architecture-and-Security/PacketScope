import React from 'react';
import { Alert, Typography, Progress, Badge } from 'antd';
import { useIntl } from 'react-intl';
import {
  SyncOutlined,
  SecurityScanOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

// 风险评分颜色
const getRiskColor = (score) => {
  if (score >= 70) return '#ff4d4f';
  if (score >= 40) return '#faad14';
  return '#52c41a';
};

// 风险状态文字 + Badge 状态
const getRiskStatus = (score, intl) => {
  if (score >= 70) return { text: intl.formatMessage({ id: 'RiskAnalysisPanel.highRisk' }), status: 'error' };
  if (score >= 40) return { text: intl.formatMessage({ id: 'RiskAnalysisPanel.mediumRisk' }), status: 'warning' };
  return { text: intl.formatMessage({ id: 'RiskAnalysisPanel.lowRisk' }), status: 'success' };
};

// 异常类型图标
const getAnomalyIcon = (type) => {
  switch (type) {
    case 'PathDeviation':
      return <ExclamationCircleOutlined className="text-orange-500 mt-1" />;
    case 'HighLatency':
      return <WarningOutlined className="text-yellow-500 mt-1" />;
    case 'MaliciousIP':
      return <SecurityScanOutlined className="text-red-500 mt-1" />;
    case 'PacketLoss':
      return <InfoCircleOutlined className="text-blue-500 mt-1" />;
    default:
      return <InfoCircleOutlined className="text-gray-400 mt-1" />;
  }
};

// 获取异常类型的本地化文本
const getAnomalyTypeText = (type, intl) => {
  const typeMap = {
    'PathDeviation': intl.formatMessage({ id: 'RiskAnalysisPanel.pathDeviation' }),
    'HighLatency': intl.formatMessage({ id: 'RiskAnalysisPanel.highLatency' }),
    'MaliciousIP': intl.formatMessage({ id: 'RiskAnalysisPanel.maliciousIP' }),
    'PacketLoss': intl.formatMessage({ id: 'RiskAnalysisPanel.packetLoss' }),
  };
  return typeMap[type] || type;
};

const RiskAnalysisPanel = ({ riskData, loading }) => {
  const intl = useIntl();
  const isEmpty = !riskData;
  const { riskScore = 0, anomalies = [], alerts = [] } = riskData || {};
  const riskStatus = getRiskStatus(riskScore, intl);
  const riskColor = getRiskColor(riskScore);

  return (
    <div className="mb-6 mt-10">
      <div className="mb-4">
        {/* 标题始终展示 */}
        <Title level={4} className="mb-4">
          <SecurityScanOutlined className="mr-2" />
          {intl.formatMessage({ id: 'RiskAnalysisPanel.title' })}
        </Title>

        {/* 内容区统一样式容器 */}
        <div className="bg-white rounded-lg shadow px-7 py-6">
          {/* 加载中状态 */}
          {loading ? (
            <div className="text-center">
              <SyncOutlined spin className="mr-2" />
              <Text>{intl.formatMessage({ id: 'RiskAnalysisPanel.analyzing' })}</Text>
            </div>
          ) : isEmpty ? (
            // 无数据状态
            <div className="text-center text-gray-500">
              <SecurityScanOutlined className="text-2xl mb-2" />
              <div>{intl.formatMessage({ id: 'RiskAnalysisPanel.noData' })}</div>
            </div>
          ) : (
            <>
              {/* 风险评分 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <Text strong>{intl.formatMessage({ id: 'RiskAnalysisPanel.comprehensiveRiskScore' })}</Text>
                  <Badge status={riskStatus.status} text={riskStatus.text} className="font-medium" />
                </div>
                <Progress
                  percent={riskScore}
                  strokeColor={riskColor}
                  trailColor="#f0f0f0"
                  format={(percent) => `${percent}/100`}
                />
                <div className="mt-2 text-sm text-gray-600">
                  {intl.formatMessage({ id: 'RiskAnalysisPanel.analysisDescription' })}
                </div>
              </div>

              {/* 异常检测 */}
              {anomalies.length > 0 && (
                <div className="mb-6">
                  <Text strong className="block mb-2">
                    {intl.formatMessage({ id: 'RiskAnalysisPanel.detectedAnomalies' })}
                  </Text>
                  <div className="space-y-2">
                    {anomalies.map((anomaly, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        {getAnomalyIcon(anomaly.type)}
                        <div className="flex-1">
                          <div className="font-medium text-orange-800">
                            {getAnomalyTypeText(anomaly.type, intl)}
                          </div>
                          <div className="text-orange-700 text-sm mt-1">{anomaly.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 安全警报 */}
              {alerts.length > 0 && (
                <div className="mb-6">
                  <Text strong className="block mb-2">
                    {intl.formatMessage({ id: 'RiskAnalysisPanel.securityAlerts' })}
                  </Text>
                  <div className="space-y-2">
                    {alerts.map((alert, index) => (
                      <Alert key={index} type="warning" showIcon message={alert} className="text-sm" />
                    ))}
                  </div>
                </div>
              )}

              {/* 正常状态 */}
              {anomalies.length === 0 && alerts.length === 0 && riskScore < 40 && (
                <div className="text-center">
                  <CheckCircleOutlined className="text-green-500 text-3xl mb-2" />
                  <div className="text-green-600 font-medium">
                    {intl.formatMessage({ id: 'RiskAnalysisPanel.routeNormal' })}
                  </div>
                  <div className="text-gray-500 text-sm mt-1">
                    {intl.formatMessage({ id: 'RiskAnalysisPanel.noThreatsDetected' })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiskAnalysisPanel;