import React from 'react';
import { useIntl } from 'react-intl';
import { Card, Typography, Row, Col } from 'antd';
import { SecurityScanOutlined } from '@ant-design/icons';
import { useAIStore } from '@/stores/useAIStore';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const { Text } = Typography;

const AnalysisResult: React.FC = () => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const { lastAnalysisResult } = useAIStore();

  if (!lastAnalysisResult?.success) return null;

  return (
    <Row gutter={16}>
      <Col span={24}>
        <Card
          title={
            <div className="flex items-center gap-2">
              <SecurityScanOutlined className="text-green-500" />
              <span className={classNames(isDark && "text-gray-200")}>
                {intl.formatMessage({ id: 'AiCenter.networkAnalysisResult' })}
              </span>
            </div>
          }
          className={classNames(
            isDark && "bg-gray-800 border-gray-700"
          )}
          headStyle={isDark ? { borderBottom: '1px solid #374151', color: '#d1d5db' } : {}}
        >
          <div className="space-y-4">
            <div>
              <Text strong className={classNames(isDark && "text-gray-200")}>
                {intl.formatMessage({ id: 'AiCenter.networkTrafficSummary' })}
              </Text>
              <div className={classNames(
                "mt-2 p-3 rounded h-[500px] overflow-scroll",
                isDark ? "bg-gray-900" : "bg-gray-800"
              )}>
                <pre className={classNames(
                  isDark ? "text-green-400" : "text-green-600"
                )}>
                  {lastAnalysisResult.summary}
                </pre>
              </div>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default AnalysisResult;