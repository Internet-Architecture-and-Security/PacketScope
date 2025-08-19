import React from 'react';
import { useIntl } from 'react-intl';
import { Card, Tag, Row, Col, Typography, App } from 'antd';
import {
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { PackageSearch } from 'lucide-react';
import { useAIStore } from '@/stores/useAIStore';
import { useModals } from '@/stores/useStore';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const { Title, Paragraph } = Typography;

const FeatureCards: React.FC = () => {
  const intl = useIntl();
  const { modal } = App.useApp();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const { config, isAiConfigValid } = useAIStore();
  const { 
    setAiConfigModalVisible, 
    setAiAnalyzeModalVisible, 
    setAiGenerateModalVisible 
  } = useModals();

  const configValid = isAiConfigValid();

  // 显示配置提醒弹窗
  const showConfigRequired = () => {
    modal.warning({
      title: intl.formatMessage({ id: 'AiCenter.aiServiceNotConfiguredTitle' }),
      content: intl.formatMessage({ id: 'AiCenter.aiServiceNotConfiguredContent' }),
      okText: intl.formatMessage({ id: 'AiCenter.configureImmediately' }),
      cancelText: intl.formatMessage({ id: 'AiCenter.configureLater' }),
      onOk: () => {
        setAiConfigModalVisible(true);
      },
    });
  };

  // 处理智能生成按钮点击
  const handleGenerateClick = () => {
    if (!configValid) {
      showConfigRequired();
      return;
    }
    setAiGenerateModalVisible(true);
  };

  // 处理网络分析按钮点击
  const handleAnalyzeClick = () => {
    if (!configValid) {
      showConfigRequired();
      return;
    }
    setAiAnalyzeModalVisible(true);
  };

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card
          className={classNames(
            "min-h-[240px] hover:shadow-lg transition-shadow cursor-pointer",
            isDark && "bg-gray-800 border-gray-700 hover:shadow-2xl"
          )}
          onClick={() => setAiConfigModalVisible(true)}
        >
          <div className="text-center">
            <SettingOutlined className="text-3xl text-blue-500 mb-3" />
            <Title level={4} className={classNames(isDark && "text-gray-200")}>
              {intl.formatMessage({ id: 'AiCenter.aiConfig' })}
            </Title>
            <Paragraph className={classNames(isDark && "text-gray-400")}>
              {intl.formatMessage({ id: 'AiCenter.aiConfigDesc' })}
            </Paragraph>
            <div className="mt-4">
              <Tag color={configValid ? isDark ? 'lime' : 'green' : isDark ? 'volcano' : 'red'}>
                {configValid 
                  ? intl.formatMessage({ id: 'AiCenter.configured' }) 
                  : intl.formatMessage({ id: 'AiCenter.notConfigured' })
                }
              </Tag>
              <Tag color="blue">
                {config?.model || intl.formatMessage({ id: 'AiCenter.notSet' })}
              </Tag>
            </div>
          </div>
        </Card>
      </Col>

      <Col span={8}>
        <Card
          className={classNames(
            `min-h-[240px] hover:shadow-lg transition-shadow cursor-pointer ${!configValid ? 'opacity-50' : ''}`,
            isDark && "bg-gray-800 border-gray-700 hover:shadow-2xl"
          )}
          onClick={handleGenerateClick}
        >
          <div className="text-center">
            <ThunderboltOutlined className="text-3xl text-purple-500 mb-3" />
            <Title level={4} className={classNames(isDark && "text-gray-200")}>
              {intl.formatMessage({ id: 'AiCenter.intelligentGeneration' })}
            </Title>
            <Paragraph className={classNames(isDark && "text-gray-400")}>
              {intl.formatMessage({ id: 'AiCenter.intelligentGenerationDesc' })}
            </Paragraph>
            <div className="mt-4">
              <Tag color="purple">{intl.formatMessage({ id: 'AiCenter.securityOriented' })}</Tag>
              <Tag color="orange">{intl.formatMessage({ id: 'AiCenter.performanceOriented' })}</Tag>
              <Tag color="cyan">{intl.formatMessage({ id: 'AiCenter.custom' })}</Tag>
            </div>
            {!configValid && (
              <div className="mt-2">
                <Tag color={isDark ? 'volcano' : 'red'}>{intl.formatMessage({ id: 'AiCenter.requiresAiService' })}</Tag>
              </div>
            )}
          </div>
        </Card>
      </Col>

      <Col span={8}>
        <Card
          className={classNames(
            `min-h-[240px] hover:shadow-lg transition-shadow cursor-pointer ${!configValid ? 'opacity-50' : ''}`,
            isDark && "bg-gray-800 border-gray-700 hover:shadow-2xl"
          )}
          onClick={handleAnalyzeClick}
        >
          <div className="text-center">
            <PackageSearch size={30} className="text-green-500 mb-3 inline-block" strokeWidth={1.75} />
            <Title level={4} className={classNames(isDark && "text-gray-200")}>
              {intl.formatMessage({ id: 'AiCenter.networkAnalysis' })}
            </Title>
            <Paragraph className={classNames(isDark && "text-gray-400")}>
              {intl.formatMessage({ id: 'AiCenter.networkAnalysisDesc' })}
            </Paragraph>
            <div className="mt-4">
              <Tag color="green">{intl.formatMessage({ id: 'AiCenter.threatDetection' })}</Tag>
              <Tag color="blue">{intl.formatMessage({ id: 'AiCenter.trafficAnalysis' })}</Tag>
            </div>
            {!configValid && (
              <div className="mt-2">
                <Tag color={isDark ? 'volcano' : 'red'}>{intl.formatMessage({ id: 'AiCenter.requiresAiService' })}</Tag>
              </div>
            )}
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default FeatureCards;