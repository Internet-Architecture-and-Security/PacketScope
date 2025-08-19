import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import {
  Layout,
  Menu,
  Button,
  Space,
  Steps,
  Progress,
  Spin,
  Radio,
  Alert,
  Table,
  Tabs,
  Modal,
  Card,
  Row,
  Col,
  Tag,
  Typography,
  Form,
  Input,
  Switch,
  List,
  App,
  ConfigProvider,
} from 'antd';
import {
  GlobalOutlined,
  FilterOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  SecurityScanOutlined,
  ApiOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import Connections from './Connections';
import Filters from './Filters';
import AiCenter from './AiCenter';
import { useModals } from '@/stores/useStore';
import { useAIStore } from '@/stores/useAIStore';
import { useFilters } from '@/hooks/useFilters';

const { Header, Sider, Content } = Layout;
const { Step } = Steps;
const { TabPane } = Tabs;
const { Paragraph, Text } = Typography;
const { TextArea } = Input;

const DataSwitch = ({ name, label }: { name: string; label: string }) => (
  <Form.Item name={name} valuePropName="checked" noStyle>
    <label className="inline-flex items-center cursor-pointer gap-3 py-1">
      <Switch defaultChecked size="small" />
      <span>{label}</span>
    </label>
  </Form.Item>
);

const Guarder: React.FC = () => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const [selectedMenu, setSelectedMenu] = useState('filters');
  const [selectedFilters, setSelectedFilters] = useState<number[]>([]);
  const { notification } = App.useApp();

  const { filters, addFilter, initFilters } = useFilters();
  const { aiGenerateModalVisible, setAiGenerateModalVisible } = useModals();

  useEffect(() => {
    initFilters();
  }, []);

  const {
    config,
    isLoading,
    error,
    lastAnalysisResult,
    lastGenerationResult,
    getConfig,
    generateFilters,
    analyzeOnly,
    clearError,
    isAiConfigValid,
    reset,
  } = useAIStore();

  const [form] = Form.useForm();
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    getConfig();
  }, [getConfig]);

  const menuItems = [
    {
      key: 'connections',
      icon: <GlobalOutlined />,
      label: intl.formatMessage({ id: 'Guarder.connectionMonitor' }),
    },
    {
      key: 'filters',
      icon: <FilterOutlined />,
      label: intl.formatMessage({ id: 'Guarder.filterManagement' }),
    },
    {
      key: 'ai-center',
      icon: <RobotOutlined />,
      label: intl.formatMessage({ id: 'Guarder.aiIntelligenceCenter' }),
    },
  ];

  const handleGenerateAiFilters = async (values: any) => {
    if (!isAiConfigValid()) {
      notification.error({
        message: intl.formatMessage({ id: 'Guarder.aiConfigInvalid' }),
        description: intl.formatMessage({ id: 'Guarder.aiConfigInvalidDesc' }),
      });
      return;
    }

    try {
      setAnalysisStep(0);
      clearError();

      const analysisParams = {
        analysis_type: values.analyze_type,
        custom_prompt: values.custom_prompt,
        include_data: {
          tcp: values.include_tcp,
          udp: values.include_udp,
          icmp: values.include_icmp,
          stats: values.include_stats,
        },
      };

      setAnalysisStep(1);
      const result = await generateFilters(analysisParams);

      setAnalysisStep(2);

      if (result && result.success) {
        if (result.filters && result.filters.length > 0) {
          const filtersWithIds = result.filters.map((f: any, index: number) => ({
            ...f,
            id: index + 1,
          }));
          setSelectedFilters(filtersWithIds.map((f: any) => f.id));
        }

        notification.success({
          message: intl.formatMessage({ id: 'Guarder.aiAnalysisComplete' }),
          description: intl.formatMessage(
            { id: 'Guarder.aiAnalysisCompleteDesc' },
            { count: result.filters?.length || 0 }
          ),
        });
      } else {
        const errorMessage = result?.error || intl.formatMessage({ id: 'Guarder.unknownError' });
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      const errorMsg = err.message || error || intl.formatMessage({ id: 'Guarder.checkNetworkAndConfig' });

      notification.error({
        message: intl.formatMessage({ id: 'Guarder.aiAnalysisFailed' }),
        description: errorMsg.length > 100 ? `${errorMsg.substring(0, 100)}...` : errorMsg,
      });
      setAnalysisStep(0);
    }
  };

  const applyAiFilters = () => {
    if (!lastGenerationResult?.success || !lastGenerationResult?.filters) return;

    const filtersWithIds = lastGenerationResult.filters.map((f: any, index: number) => ({
      ...f,
      id: index + 1,
    }));

    const selectedFilterObjects = filtersWithIds.filter((f: any) => selectedFilters.includes(f.id));

    selectedFilterObjects.forEach((filterData: any) => {
      const filter: Filter = {
        rule_type: filterData.rule_type,
        protocol: filterData.protocol,
        src_ip: filterData.src_ip,
        dst_ip: filterData.dst_ip,
        src_port: filterData.src_port,
        dst_port: filterData.dst_port,
        tcp_flags: filterData.tcp_flags,
        tcp_flags_mask: filterData.tcp_flags_mask,
        action: 'allow',
        enabled: false,
        comment: `[${intl.formatMessage({ id: 'Guarder.aiGeneratedRule' })}] ${filterData.comment}`,
        ai_generated: true,
      };
      addFilter(filter);
    });

    notification.success({
      message: intl.formatMessage({ id: 'Guarder.ruleApplySuccess' }),
      description: intl.formatMessage(
        { id: 'Guarder.ruleApplySuccessDesc' },
        { count: selectedFilterObjects.length }
      ),
    });

    setAiGenerateModalVisible(false);
    setAnalysisStep(0);
    setSelectedFilters([]);
  };

  const handleModalClose = () => {
    setAiGenerateModalVisible(false);
    setAnalysisStep(0);
    setSelectedFilters([]);
    clearError();
    reset();
  };

  const renderAnalysisSteps = () => (
    <Steps current={analysisStep} style={{ marginBottom: 24 }}>
      <Step
        title={intl.formatMessage({ id: 'Guarder.prepareData' })}
        description={intl.formatMessage({ id: 'Guarder.prepareDataDesc' })}
      />
      <Step
        title={intl.formatMessage({ id: 'Guarder.aiAnalysis' })}
        description={intl.formatMessage({ id: 'Guarder.aiAnalysisDesc' })}
      />
      <Step
        title={intl.formatMessage({ id: 'Guarder.complete' })}
        description={intl.formatMessage({ id: 'Guarder.completeDesc' })}
      />
    </Steps>
  );

  const renderAnalysisResults = () => {
    if (!lastGenerationResult?.success || !lastGenerationResult.analysis) return null;

    return (
      <Card
        title={
          <>
            <InfoCircleOutlined className="mr-2" />
            {intl.formatMessage({ id: 'Guarder.aiAnalysisReport' })}
          </>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph>{lastGenerationResult.analysis}</Paragraph>

        {lastGenerationResult.suggestions && lastGenerationResult.suggestions.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>{intl.formatMessage({ id: 'Guarder.securitySuggestions' })}：</Text>
            <List
              size="small"
              dataSource={lastGenerationResult.suggestions}
              renderItem={(item: string) => (
                <List.Item>
                  <Text>• {item}</Text>
                </List.Item>
              )}
              style={{ marginTop: 8 }}
            />
          </div>
        )}

        {lastGenerationResult.tokens_used && (
          <div style={{ marginTop: 16, color: '#666' }}>
            <Text type="secondary">
              {intl.formatMessage({ id: 'Guarder.tokenUsage' })}: {lastGenerationResult.tokens_used}
            </Text>
          </div>
        )}
      </Card>
    );
  };

  const renderFilterTable = () => {
    if (!lastGenerationResult?.success || !lastGenerationResult?.filters) return null;

    const filtersWithIds = lastGenerationResult.filters.map((f: any, index: number) => ({
      ...f,
      id: index + 1,
    }));

    return (
      <Table
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedFilters,
          onChange: (selectedRowKeys) => {
            setSelectedFilters(selectedRowKeys as number[]);
          },
        }}
        columns={[
          {
            title: intl.formatMessage({ id: 'Guarder.ruleType' }),
            dataIndex: 'rule_type',
            render: (type: string) => <Tag color="purple">{type?.toUpperCase()}</Tag>,
          },
          {
            title: intl.formatMessage({ id: 'Guarder.protocol' }),
            dataIndex: 'protocol',
            render: (protocol: string) => protocol?.toUpperCase() || '-',
          },
          {
            title: intl.formatMessage({ id: 'Guarder.sourceIp' }),
            dataIndex: 'src_ip',
            width: 140,
            render: (ip: string) => ip || '-',
          },
          {
            title: intl.formatMessage({ id: 'Guarder.destinationIp' }),
            dataIndex: 'dst_ip',
            width: 140,
            render: (ip: string) => ip || '-',
          },
          {
            title: intl.formatMessage({ id: 'Guarder.port' }),
            dataIndex: 'dst_port',
            width: 70,
            render: (port: number) => port || '-',
          },
          {
            title: intl.formatMessage({ id: 'Guarder.tcpFlags' }),
            dataIndex: 'tcp_flags',
            render: (flags: number) => (flags ? `0x${flags.toString(16)}` : '-'),
          },
          {
            title: intl.formatMessage({ id: 'Guarder.action' }),
            dataIndex: 'action',
            render: (action: string) => (
              <Tag color={action === 'drop' ? 'red' : 'green'}>
                {action === 'drop'
                  ? intl.formatMessage({ id: 'Guarder.block' })
                  : intl.formatMessage({ id: 'Guarder.allow' })
                }
              </Tag>
            ),
          },
          {
            title: intl.formatMessage({ id: 'Guarder.description' }),
            dataIndex: 'comment',
            ellipsis: true,
          },
        ]}
        dataSource={filtersWithIds}
        pagination={false}
        size="small"
        rowKey="id"
      />
    );
  };

  const renderContent = () => {
    switch (selectedMenu) {
      case 'connections':
        return <Connections />;
      case 'filters':
        return <Filters />;
      case 'ai-center':
        return <AiCenter />;
      default:
        return <Connections />;
    }
  };

  const hasValidResult = lastGenerationResult && lastGenerationResult.success;
  const hasFilters = hasValidResult && lastGenerationResult.filters && lastGenerationResult.filters.length > 0;

  return (
    <ConfigProvider
      theme={{
        components: {
        }
      }}
    >
      <Layout className={classNames(
        "min-h-screen",
        isDark ? "bg-gray-900" : ""
      )}>
        <Layout>
          <Sider width={250} className={classNames(
            "shadow-sm",
            isDark ? "bg-gray-800" : "bg-white"
          )}>
            <Menu
              mode="inline"
              selectedKeys={[selectedMenu]}
              onClick={({ key }) => setSelectedMenu(key)}
              items={menuItems}
              className="border-r-0 pt-4"
            />
          </Sider>

          <Content className={classNames(
            "p-12 pt-8",
            isDark ? "bg-gradient-to-br from-gray-900 to-gray-800" : "bg-gradient-to-br from-slate-50 to-blue-50"
          )}>
            {renderContent()}
          </Content>
        </Layout>

        <Modal
          title={
            <div>
              <RobotOutlined className="mr-2" />
              {intl.formatMessage({ id: 'Guarder.aiSmartGenerateFilter' })}
            </div>
          }
          open={aiGenerateModalVisible}
          onCancel={handleModalClose}
          width={900}
          footer={null}
          forceRender
        >
          {error && (
            <Alert
              message={intl.formatMessage({ id: 'Guarder.aiAnalysisError' })}
              description={error}
              type="error"
              showIcon
              closable
              onClose={clearError}
              style={{ marginBottom: 16 }}
            />
          )}

          {!isAiConfigValid() && (
            <Alert
              message={intl.formatMessage({ id: 'Guarder.aiConfigIncomplete' })}
              description={intl.formatMessage({ id: 'Guarder.aiConfigIncompleteDesc' })}
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              style={{ marginBottom: 16 }}
            />
          )}

          {!hasValidResult ? (
            <div>
              {renderAnalysisSteps()}

              {isLoading ? (
                <div className="text-center py-8">
                  <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
                  <div className={classNames(
                    "mt-4 text-lg",
                    isDark ? "text-gray-300" : ""
                  )}>
                    {intl.formatMessage({ id: 'Guarder.aiAnalyzingNetwork' })}
                  </div>
                  <Progress
                    percent={(analysisStep + 1) * 33.33}
                    status="active"
                    strokeColor="#722ed1"
                    style={{ marginTop: 16 }}
                  />
                </div>
              ) : (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleGenerateAiFilters}
                  initialValues={{
                    analyze_type: 'security',
                    include_tcp: true,
                    include_udp: true,
                    include_icmp: false,
                    include_stats: true,
                  }}
                >
                  <Alert
                    message={intl.formatMessage({ id: 'Guarder.aiAnalysisConfig' })}
                    description={intl.formatMessage({ id: 'Guarder.aiAnalysisConfigDesc' })}
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />

                  <Form.Item
                    label={intl.formatMessage({ id: 'Guarder.analysisStrategy' })}
                    name="analyze_type"
                    rules={[{ required: true, message: intl.formatMessage({ id: 'Guarder.pleaseSelectAnalysisStrategy' }) }]}
                  >
                    <Radio.Group>
                      <Radio.Button value="security">
                        <SecurityScanOutlined className="mr-2" />
                        {intl.formatMessage({ id: 'Guarder.securityOriented' })}
                      </Radio.Button>
                      <Radio.Button value="performance">
                        <ThunderboltOutlined className="mr-2" />
                        {intl.formatMessage({ id: 'Guarder.performanceOriented' })}
                      </Radio.Button>
                      <Radio.Button value="custom">
                        <BulbOutlined className="mr-2" />
                        {intl.formatMessage({ id: 'Guarder.custom' })}
                      </Radio.Button>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.analyze_type !== currentValues.analyze_type}>
                    {({ getFieldValue }) =>
                      getFieldValue('analyze_type') === 'custom' ? (
                        <Form.Item
                          label={intl.formatMessage({ id: 'Guarder.customAnalysisPrompt' })}
                          name="custom_prompt"
                          rules={[{ required: true, message: intl.formatMessage({ id: 'Guarder.pleaseEnterCustomPrompt' }) }]}
                        >
                          <TextArea
                            rows={4}
                            placeholder={intl.formatMessage({ id: 'Guarder.customPromptPlaceholder' })}
                          />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>

                  <Form.Item label={intl.formatMessage({ id: 'Guarder.includeDataTypes' })}>
                    <Space direction="vertical">
                      <DataSwitch name="include_tcp" label={intl.formatMessage({ id: 'Guarder.tcpConnectionData' })} />
                      <DataSwitch name="include_udp" label={intl.formatMessage({ id: 'Guarder.udpConnectionData' })} />
                      <DataSwitch name="include_icmp" label={intl.formatMessage({ id: 'Guarder.icmpTrafficData' })} />
                      <DataSwitch name="include_stats" label={intl.formatMessage({ id: 'Guarder.performanceStatsData' })} />
                    </Space>
                  </Form.Item>

                  <div className="text-center">
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<RobotOutlined />}
                      size="large"
                      disabled={!isAiConfigValid()}
                      style={{ background: '#722ed1', borderColor: '#722ed1', color: !isAiConfigValid() ? '#ffffff70' : '#ffffffff' }}
                    >
                      {intl.formatMessage({ id: 'Guarder.startAiAnalysis' })}
                    </Button>
                  </div>
                </Form>
              )}
            </div>
          ) : (
            <div>
              <Alert
                message={intl.formatMessage({ id: 'Guarder.aiAnalysisComplete' })}
                description={intl.formatMessage(
                  { id: hasFilters ? 'Guarder.aiAnalysisCompleteWithRules' : 'Guarder.aiAnalysisCompleteNoRules' },
                  { count: lastGenerationResult.filters?.length || 0 }
                )}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Tabs defaultActiveKey="analysis">
                <TabPane tab={intl.formatMessage({ id: 'Guarder.analysisResults' })} key="analysis">
                  {renderAnalysisResults()}
                </TabPane>

                {hasFilters && (
                  <TabPane
                    tab={intl.formatMessage(
                      { id: 'Guarder.generatedRules' },
                      { count: lastGenerationResult.filters.length }
                    )}
                    key="rules"
                  >
                    <div style={{ marginBottom: 16 }}>
                      <Text>
                        {intl.formatMessage(
                          { id: 'Guarder.aiGeneratedRulesDesc' },
                          { count: lastGenerationResult.filters.length }
                        )}
                      </Text>
                    </div>

                    {renderFilterTable()}

                    <div className="text-center mt-4">
                      <Space>
                        <Button onClick={handleModalClose}>
                          {intl.formatMessage({ id: 'Guarder.cancel' })}
                        </Button>
                        <Button
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          onClick={applyAiFilters}
                          disabled={selectedFilters.length === 0}
                        >
                          {intl.formatMessage(
                            { id: 'Guarder.applySelectedRules' },
                            { count: selectedFilters.length }
                          )}
                        </Button>
                      </Space>
                    </div>
                  </TabPane>
                )}
              </Tabs>
            </div>
          )}
        </Modal>
      </Layout>
    </ConfigProvider>
  );
};

export default Guarder;