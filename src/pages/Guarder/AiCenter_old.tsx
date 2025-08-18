import React, { useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Card,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Typography,
  Modal,
  Form,
  Input,
  Switch,
  Alert,
  Flex,
  AutoComplete,
  App,
  Radio,
  Spin,
  InputNumber,
} from 'antd';
import {
  SettingOutlined,
  SecurityScanOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { PackageSearch, X, Bot } from 'lucide-react';
import { useAIStore } from '@/stores/useAIStore';
import { useModals } from '@/stores/useStore';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

export const DataSwitch = ({ name, label }: { name: string; label: string }) => (
  <Form.Item name={name} valuePropName="checked" noStyle>
    <label className="inline-flex items-center cursor-pointer gap-3 py-1">
      <Switch size="small" />
      <span>{label}</span>
    </label>
  </Form.Item>
);

const AiCenter: React.FC = () => {
  const { notification, modal } = App.useApp();
  const intl = useIntl();

  // 使用 useAIStore 替换原有状态管理
  const {
    config,
    isLoading,
    error,
    lastAnalysisResult,
    lastGenerationResult,
    getConfig,
    updateConfig,
    generateFilters,
    analyzeOnly,
    clearError,
    isAiConfigValid,
  } = useAIStore();

  const {
    aiConfigModalVisible,
    setAiConfigModalVisible,
    aiAnalyzeModalVisible,
    setAiAnalyzeModalVisible,
    aiGenerateModalVisible,
    setAiGenerateModalVisible,
  } = useModals();

  const [aiConfigForm] = Form.useForm();
  const [aiAnalyzeForm] = Form.useForm();
  const [aiGenerateForm] = Form.useForm();

  // 获取当前结果（优先显示最新的）
  const currentResult = lastGenerationResult || lastAnalysisResult;

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

  // 保存AI配置
  const saveAiConfig = async (values: any) => {
    values.timeout = parseInt(values.timeout, 10);
    try {
      await updateConfig(values);
      notification.success({
        message: intl.formatMessage({ id: 'AiCenter.aiConfigSaved' }),
        description: intl.formatMessage({ id: 'AiCenter.configUpdatedSuccessfully' }),
      });
      setAiConfigModalVisible(false);
    } catch (error) {
      notification.error({
        message: intl.formatMessage({ id: 'AiCenter.saveAiConfigFailed' }),
        description: error instanceof Error ? error.message : intl.formatMessage({ id: 'AiCenter.checkConfigAndRetry' }),
      });
    }
  };

  // AI网络分析
  const handleAiAnalyze = async (values: any) => {
    if (!isAiConfigValid()) {
      showConfigRequired();
      return;
    }

    try {
      await analyzeOnly(values);
      notification.success({
        message: intl.formatMessage({ id: 'AiCenter.aiNetworkAnalysisComplete' }),
        description: intl.formatMessage({ id: 'AiCenter.analysisResultGenerated' }),
      });
      setAiAnalyzeModalVisible(false);
    } catch (error) {
      notification.error({
        message: intl.formatMessage({ id: 'AiCenter.aiNetworkAnalysisFailed' }),
        description: error instanceof Error ? error.message : intl.formatMessage({ id: 'AiCenter.pleaseRetry' }),
      });
    }
  };

  // AI过滤器生成
  const handleAiGenerate = async (values: any) => {
    if (!isAiConfigValid()) {
      showConfigRequired();
      return;
    }

    try {
      await generateFilters(values);
      notification.success({
        message: intl.formatMessage({ id: 'AiCenter.aiFilterGenerationComplete' }),
        description: intl.formatMessage({ id: 'AiCenter.filterRulesGenerated' }),
      });
      setAiGenerateModalVisible(false);
    } catch (error) {
      notification.error({
        message: intl.formatMessage({ id: 'AiCenter.aiFilterGenerationFailed' }),
        description: error instanceof Error ? error.message : intl.formatMessage({ id: 'AiCenter.pleaseRetry' }),
      });
    }
  };

  // 处理智能生成按钮点击
  const handleGenerateClick = () => {
    if (!isAiConfigValid()) {
      showConfigRequired();
      return;
    }
    setAiGenerateModalVisible(true);
  };

  // 处理网络分析按钮点击
  const handleAnalyzeClick = () => {
    if (!isAiConfigValid()) {
      showConfigRequired();
      return;
    }
    setAiAnalyzeModalVisible(true);
  };

  // 清除结果
  const clearResults = () => {
    // 这里可以添加清除结果的逻辑，或者在 store 中添加相应方法
    clearError();
  };

  // 组件加载时自动加载配置
  useEffect(() => {
    getConfig();
  }, [getConfig]);

  const configValid = isAiConfigValid();

  return (
    <div>
      <Spin spinning={isLoading} tip={intl.formatMessage({ id: 'AiCenter.loading' })}>
        <Flex vertical gap={20}>
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg">
                <Bot className="text-white" size={30} />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {intl.formatMessage({ id: 'AiCenter.title' })}
                </h1>
                <p className="text-gray-600">{intl.formatMessage({ id: 'AiCenter.description' })}</p>
              </div>
            </div>
          </header>

          {/* AI Status Alert */}
          <Alert
            message={
              <div className="flex items-center space-x-3">
                {configValid ? (
                  <CheckCircleOutlined className="text-xl text-green-600" />
                ) : (
                  <ExclamationCircleOutlined className="text-xl text-red-600" />
                )}
                <div>
                  <Text strong className={configValid ? 'text-green-800' : 'text-red-800'}>
                    {configValid 
                      ? intl.formatMessage({ id: 'AiCenter.aiServiceConfigured' }) 
                      : intl.formatMessage({ id: 'AiCenter.aiServiceNotConfigured' })
                    }
                  </Text>
                  <div className={`text-sm ${configValid ? 'text-green-600' : 'text-red-600'}`}>
                    {configValid
                      ? intl.formatMessage(
                          { id: 'AiCenter.aiServiceConfiguredDesc' },
                          { 
                            model: config?.model, 
                            endpoint: config?.openai_endpoint?.split('/')[2] || intl.formatMessage({ id: 'AiCenter.unknown' })
                          }
                        )
                      : intl.formatMessage({ id: 'AiCenter.aiServiceNotConfiguredDesc' })
                    }
                  </div>
                </div>
              </div>
            }
            type={configValid ? 'success' : 'error'}
            className="rounded-xl"
            action={
              !configValid && (
                <Button size="small" type="primary" onClick={() => setAiConfigModalVisible(true)}>
                  {intl.formatMessage({ id: 'AiCenter.configureNow' })}
                </Button>
              )
            }
          />

          <Row gutter={16}>
            <Col span={8}>
              <Card
                className="min-h-[240px] hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setAiConfigModalVisible(true)}
              >
                <div className="text-center">
                  <SettingOutlined className="text-3xl text-blue-500 mb-3" />
                  <Title level={4}>{intl.formatMessage({ id: 'AiCenter.aiConfig' })}</Title>
                  <Paragraph>{intl.formatMessage({ id: 'AiCenter.aiConfigDesc' })}</Paragraph>
                  <div className="mt-4">
                    <Tag color={configValid ? 'green' : 'red'}>
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
                className={`min-h-[240px] hover:shadow-lg transition-shadow cursor-pointer ${!configValid ? 'opacity-50' : ''}`}
                onClick={handleGenerateClick}
              >
                <div className="text-center">
                  <ThunderboltOutlined className="text-3xl text-purple-500 mb-3" />
                  <Title level={4}>{intl.formatMessage({ id: 'AiCenter.intelligentGeneration' })}</Title>
                  <Paragraph>{intl.formatMessage({ id: 'AiCenter.intelligentGenerationDesc' })}</Paragraph>
                  <div className="mt-4">
                    <Tag color="purple">{intl.formatMessage({ id: 'AiCenter.securityOriented' })}</Tag>
                    <Tag color="orange">{intl.formatMessage({ id: 'AiCenter.performanceOriented' })}</Tag>
                    <Tag color="cyan">{intl.formatMessage({ id: 'AiCenter.custom' })}</Tag>
                  </div>
                  {!configValid && (
                    <div className="mt-2">
                      <Tag color="red">{intl.formatMessage({ id: 'AiCenter.requiresAiService' })}</Tag>
                    </div>
                  )}
                </div>
              </Card>
            </Col>

            <Col span={8}>
              <Card
                className={`min-h-[240px] hover:shadow-lg transition-shadow cursor-pointer ${!configValid ? 'opacity-50' : ''}`}
                onClick={handleAnalyzeClick}
              >
                <div className="text-center">
                  <PackageSearch size={30} className="text-green-500 mb-3 inline-block" strokeWidth={1.75} />
                  <Title level={4}>{intl.formatMessage({ id: 'AiCenter.networkAnalysis' })}</Title>
                  <Paragraph>{intl.formatMessage({ id: 'AiCenter.networkAnalysisDesc' })}</Paragraph>
                  <div className="mt-4">
                    <Tag color="green">{intl.formatMessage({ id: 'AiCenter.threatDetection' })}</Tag>
                    <Tag color="blue">{intl.formatMessage({ id: 'AiCenter.trafficAnalysis' })}</Tag>
                  </div>
                  {!configValid && (
                    <div className="mt-2">
                      <Tag color="red">{intl.formatMessage({ id: 'AiCenter.requiresAiService' })}</Tag>
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Card title={intl.formatMessage({ id: 'AiCenter.coreFeatures' })} className="shadow-sm">
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <BulbOutlined className="text-yellow-500 mr-2" />
                    <Text>{intl.formatMessage({ id: 'AiCenter.feature1' })}</Text>
                  </div>
                  <div>
                    <ApiOutlined className="text-blue-500 mr-2" />
                    <Text>{intl.formatMessage({ id: 'AiCenter.feature2' })}</Text>
                  </div>
                  <div>
                    <SecurityScanOutlined className="text-green-500 mr-2" />
                    <Text>{intl.formatMessage({ id: 'AiCenter.feature3' })}</Text>
                  </div>
                  <div>
                    <SettingOutlined className="text-purple-500 mr-2" />
                    <Text>{intl.formatMessage({ id: 'AiCenter.feature4' })}</Text>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* 智能生成结果展示 */}
          {lastGenerationResult && (
            <Row gutter={16}>
              <Col span={24}>
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <ThunderboltOutlined className="text-purple-500" />
                      <span>{intl.formatMessage({ id: 'AiCenter.intelligentGenerationResult' })}</span>
                    </div>
                  }
                >
                  {lastGenerationResult.success ? (
                    <div className="space-y-4">
                      <div>
                        <Text strong>{intl.formatMessage({ id: 'AiCenter.threatAnalysis' })}</Text>
                        <div className="mt-2 p-3 bg-gray-50 rounded">
                          <pre className="text-green-600 text-wrap text-justify">{lastGenerationResult.analysis}</pre>
                        </div>
                      </div>

                      <div>
                        <Text strong>{intl.formatMessage({ id: 'AiCenter.securityRecommendations' })}</Text>
                        <ul className="mt-2 p-3 bg-blue-50 rounded list-disc pl-5 text-blue-800">
                          {lastGenerationResult.suggestions?.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>

                      <div>
                        <Text strong>{intl.formatMessage({ id: 'AiCenter.generatedRules' })}</Text>
                        <div className="mt-2 p-3 bg-gray-50 rounded">
                          <pre className="whitespace-pre-wrap">
                            <code>{JSON.stringify(lastGenerationResult.filters, null, 2)}</code>
                          </pre>
                        </div>
                      </div>

                      <div className="text-right text-xs text-gray-400">
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
          )}

          {/* 网络分析结果展示 */}
          {lastAnalysisResult?.success && (
            <Row gutter={16}>
              <Col span={24}>
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <SecurityScanOutlined className="text-green-500" />
                      <span>{intl.formatMessage({ id: 'AiCenter.networkAnalysisResult' })}</span>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <div>
                      <Text strong>{intl.formatMessage({ id: 'AiCenter.networkTrafficSummary' })}</Text>
                      <div className="mt-2 p-3 bg-gray-50 rounded h-[500px] bg-gray-800 overflow-scroll">
                        <pre className="text-green-600">{lastAnalysisResult.summary}</pre>
                      </div>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          )}
        </Flex>
      </Spin>

      {/* AI配置模态框 */}
      <Modal
        title={
          <div>
            <SettingOutlined className="mr-2" />
            {intl.formatMessage({ id: 'AiCenter.aiConfigSettings' })}
          </div>
        }
        open={aiConfigModalVisible}
        onOk={() => aiConfigForm.validateFields().then(saveAiConfig)}
        onCancel={() => setAiConfigModalVisible(false)}
        width={700}
        confirmLoading={isLoading}
      >
        <Form form={aiConfigForm} layout="vertical" initialValues={config}>
          <Alert
            message={intl.formatMessage({ id: 'AiCenter.configDescription' })}
            description={intl.formatMessage({ id: 'AiCenter.configDescriptionText' })}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item 
            label={intl.formatMessage({ id: 'AiCenter.openaiEndpoint' })} 
            name="openai_endpoint" 
            rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterOpenaiEndpoint' }) }]}
          >
            <Input placeholder="https://api.openai.com/v1/chat/completions" />
          </Form.Item>

          <Form.Item 
            label={intl.formatMessage({ id: 'AiCenter.apiKey' })} 
            name="api_key" 
            rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterApiKey' }) }]}
          >
            <Input.Password placeholder={intl.formatMessage({ id: 'AiCenter.apiKeyPlaceholder' })} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label={intl.formatMessage({ id: 'AiCenter.model' })} 
                name="model" 
                rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseSelectOrEnterModel' }) }]}
              >
                <AutoComplete
                  options={[
                    { value: 'gpt-4' },
                    { value: 'gpt-4-turbo' },
                    { value: 'gpt-3.5-turbo' },
                    { value: 'deepseek-chat' },
                    { value: 'deepseek-reasoner' },
                  ]}
                  placeholder={intl.formatMessage({ id: 'AiCenter.modelPlaceholder' })}
                  filterOption={(inputValue, option) => option!.value.toLowerCase().includes(inputValue.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                label={intl.formatMessage({ id: 'AiCenter.temperature' })} 
                name="temperature" 
                rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterTemperature' }) }]}
              >
                <Input type="number" min={0} max={2} step={0.1} placeholder="0.7" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label={intl.formatMessage({ id: 'AiCenter.timeout' })} 
                name="timeout" 
                rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterTimeout' }) }]}
              >
                <InputNumber placeholder="120" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="debug" valuePropName="checked" className="pt-7 pb-0">
                <DataSwitch label={intl.formatMessage({ id: 'AiCenter.enableDebugMode' })} name="debug"></DataSwitch>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* AI网络分析模态框 */}
      <Modal
        title={
          <div>
            <SecurityScanOutlined className="mr-2" />
            {intl.formatMessage({ id: 'AiCenter.aiNetworkAnalysis' })}
          </div>
        }
        open={aiAnalyzeModalVisible}
        onCancel={() => setAiAnalyzeModalVisible(false)}
        width={600}
        footer={[
          <Button key="cancel" onClick={() => setAiAnalyzeModalVisible(false)}>
            {intl.formatMessage({ id: 'AiCenter.cancel' })}
          </Button>,
          <Button
            key="analyze"
            type="primary"
            icon={<SecurityScanOutlined />}
            onClick={() => aiAnalyzeForm.validateFields().then(handleAiAnalyze)}
            loading={isLoading}
          >
            {intl.formatMessage({ id: 'AiCenter.startAnalysis' })}
          </Button>,
        ]}
      >
        <Form
          form={aiAnalyzeForm}
          layout="vertical"
          initialValues={{
            include_tcp: true,
            include_udp: true,
            include_icmp: true,
            include_stats: true,
          }}
        >
          <Alert
            message={intl.formatMessage({ id: 'AiCenter.analysisDescription' })}
            description={intl.formatMessage({ id: 'AiCenter.analysisDescriptionText' })}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label={intl.formatMessage({ id: 'AiCenter.analysisScope' })}>
            <Space direction="vertical">
              <DataSwitch label={intl.formatMessage({ id: 'AiCenter.analyzeTcpConnections' })} name="include_tcp"></DataSwitch>
              <DataSwitch label={intl.formatMessage({ id: 'AiCenter.analyzeUdpConnections' })} name="include_udp"></DataSwitch>
              <DataSwitch label={intl.formatMessage({ id: 'AiCenter.analyzeIcmpTraffic' })} name="include_icmp"></DataSwitch>
              <DataSwitch label={intl.formatMessage({ id: 'AiCenter.includeStatistics' })} name="include_stats"></DataSwitch>
            </Space>
          </Form.Item>

          <Form.Item label={intl.formatMessage({ id: 'AiCenter.customAnalysisPrompt' })} name="custom_prompt">
            <TextArea 
              rows={4} 
              placeholder={intl.formatMessage({ id: 'AiCenter.customAnalysisPlaceholder' })} 
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AiCenter;