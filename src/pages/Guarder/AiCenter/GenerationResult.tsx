import React from 'react';
import { useIntl } from 'react-intl';
import { Card, Typography, Alert, Row, Col } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useAIStore } from '@/stores/useAIStore';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const { Text } = Typography;

const GenerationResult: React.FC = () => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const { lastGenerationResult } = useAIStore();

  if (!lastGenerationResult) return null;

  return (
    <Row gutter={16}>
      <Col span={24}>
        <Card
          title={
            <div className="flex items-center gap-2">
              <ThunderboltOutlined className="text-purple-500" />
              <span className={classNames(isDark && "text-gray-200")}>
                {intl.formatMessage({ id: 'AiCenter.intelligentGenerationResult' })}
              </span>
            </div>
          }
          className={classNames(
            isDark && "bg-gray-800 border-gray-700"
          )}
          headStyle={isDark ? { borderBottom: '1px solid #374151', color: '#d1d5db' } : {}}
        >
          {lastGenerationResult.success ? (
            <div className="space-y-4">
              <div>
                <Text strong className={classNames(isDark && "text-gray-200")}>
                  {intl.formatMessage({ id: 'AiCenter.threatAnalysis' })}
                </Text>
                <div className={classNames(
                  "mt-2 p-3 rounded",
                  isDark ? "bg-gray-700" : "bg-gray-50"
                )}>
                  <pre className={classNames(
                    "text-wrap text-justify",
                    isDark ? "text-green-400" : "text-green-600"
                  )}>
                    {lastGenerationResult.analysis}
                  </pre>
                </div>
              </div>

              <div>
                <Text strong className={classNames(isDark && "text-gray-200")}>
                  {intl.formatMessage({ id: 'AiCenter.securityRecommendations' })}
                </Text>
                <ul className={classNames(
                  "mt-2 p-3 rounded list-disc pl-5",
                  isDark ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-800"
                )}>
                  {lastGenerationResult.suggestions?.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>

              <div>
                <Text strong className={classNames(isDark && "text-gray-200")}>
                  {intl.formatMessage({ id: 'AiCenter.generatedRules' })}
                </Text>
                <div className={classNames(
                  "mt-2 p-3 rounded",
                  isDark ? "bg-gray-700" : "bg-gray-50"
                )}>
                  <pre className={classNames(
                    "whitespace-pre-wrap",
                    isDark ? "text-gray-300" : "text-gray-900"
                  )}>
                    <code>{JSON.stringify(lastGenerationResult.filters, null, 2)}</code>
                  </pre>
                </div>
              </div>

              <div className={classNames(
                "text-right text-xs",
                isDark ? "text-gray-500" : "text-gray-400"
              )}>
                {intl.formatMessage({ id: 'AiCenter.tokenUsage' })}{lastGenerationResult.tokens_used}
              </div>
            </div>
          ) : (
            <Alert 
              message={intl.formatMessage({ id: 'AiCenter.generationFailed' })} 
              description={lastGenerationResult.error} 
              type="error" 
              showIcon 
            />
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default GenerationResult;