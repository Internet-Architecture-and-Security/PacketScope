import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Modal,
  Form,
  Input,
  Alert,
  Button,
  App,
  Upload,
  Radio,
  Progress,
  Steps,
  Spin,
  Tabs,
  Space,
  Tag,
  Table,
  Statistic,
  Row,
  Col,
  Badge,
  Empty,
  Typography,
} from 'antd';
import {
  SecurityScanOutlined,
  FileSearchOutlined,
  InboxOutlined,
  LoadingOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  BugOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAIStore } from '@/stores/useAIStore';
import { useModals, useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import type { UploadFile, UploadProps } from 'antd';

const { TextArea } = Input;
const { TabPane } = Tabs;
const { Text } = Typography;

const severityColor: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const severityIcon: Record<string, React.ReactNode> = {
  high: <WarningOutlined />,
  medium: <BugOutlined />,
  low: <CheckCircleOutlined />,
};

const AiAnalyzeModal: React.FC = () => {
  const intl = useIntl();
  const { notification } = App.useApp();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const { isLoading, setPcapAnalysisResult, pcapAnalysisResult, error, clearError } = useAIStore();
  const { aiAnalyzeModalVisible, setAiAnalyzeModalVisible } = useModals();
  const [form] = Form.useForm();

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);

  const hasResult = !!pcapAnalysisResult?.success;
  const threats = pcapAnalysisResult?.threats ?? [];
  const statistics = pcapAnalysisResult?.statistics;
  const suggestions = pcapAnalysisResult?.suggestions ?? [];

  // Steps 数据用 intl
  const STEPS = [
    {
      title: intl.formatMessage({ id: 'AiCenter.pcap.step1Title' }),
      description: intl.formatMessage({ id: 'AiCenter.pcap.step1Desc' }),
    },
    {
      title: intl.formatMessage({ id: 'AiCenter.pcap.step2Title' }),
      description: intl.formatMessage({ id: 'AiCenter.pcap.step2Desc' }),
    },
    {
      title: intl.formatMessage({ id: 'AiCenter.pcap.step3Title' }),
      description: intl.formatMessage({ id: 'AiCenter.pcap.step3Desc' }),
    },
  ];

  // ── Upload handlers ──────────────────────────────────────────────
  const beforeUpload = (file: File) => {
    const valid = file.name.endsWith('.pcap') || file.name.endsWith('.pcapng');
    if (!valid) {
      notification.error({ message: intl.formatMessage({ id: 'AiCenter.pcap.invalidFileType' }) });
      return Upload.LIST_IGNORE;
    }
    if (file.size / 1024 / 1024 >= 32) {
      notification.error({ message: intl.formatMessage({ id: 'AiCenter.pcap.fileTooLarge' }) });
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const handleUploadChange: UploadProps['onChange'] = ({ fileList: next }) => {
    setFileList(next.slice(-1));
  };

  // ── Analyze ──────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!fileList[0]?.originFileObj) {
      notification.warning({ message: intl.formatMessage({ id: 'AiCenter.pcap.noFile' }) });
      return;
    }

    const values = await form.validateFields();
    const formData = new FormData();
    formData.append('file', fileList[0].originFileObj as Blob);
    formData.append('analyze_type', values.analyze_type || 'security');
    if (values.custom_prompt) formData.append('custom_prompt', values.custom_prompt);

    setUploading(true);
    setUploadProgress(0);
    setAnalysisStep(0);

    const stepTimer = setInterval(() => {
      setAnalysisStep((s) => (s < 2 ? s + 1 : s));
    }, 1200);

    const progressTimer = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 85) { clearInterval(progressTimer); return p; }
        return p + 8;
      });
    }, 400);

    try {
      const guarderBase = import.meta.env.DEV
      ? 'http://localhost:8080'
      : `${window.location.protocol}//${window.location.host}/api/guarder`;
    const response = await fetch(`${guarderBase}/api/pcap/analyze`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(stepTimer);
      clearInterval(progressTimer);
      setUploadProgress(100);
      setAnalysisStep(2);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setPcapAnalysisResult(data);
      notification.success({ message: intl.formatMessage({ id: 'AiCenter.pcap.analysisComplete' }) });
    } catch (err) {
      clearInterval(stepTimer);
      clearInterval(progressTimer);
      notification.error({
        message: intl.formatMessage({ id: 'AiCenter.pcap.analysisFailed' }),
        description: err instanceof Error ? err.message : intl.formatMessage({ id: 'AiCenter.pleaseRetry' }),
      });
    } finally {
      setUploading(false);
    }
  };

  // ── Reset / Close ─────────────────────────────────────────────────
  const handleReset = () => {
    form.resetFields();
    setFileList([]);
    setUploadProgress(0);
    setAnalysisStep(0);
    setPcapAnalysisResult(null as any);
  };

  const handleClose = () => {
    setAiAnalyzeModalVisible(false);
    handleReset();
  };

  // ── Threat table columns ──────────────────────────────────────────
  const threatColumns = [
    {
      title: intl.formatMessage({ id: 'Guarder.action' }), // 级别 复用
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      fixed: 'left' as const,
      render: (v: string) => (
        <Tag color={severityColor[v] ?? 'default'} icon={severityIcon[v]} style={{ marginInlineEnd: 0 }}>
          {v?.toUpperCase()}
        </Tag>
      ),
    },
    { title: intl.formatMessage({ id: 'Guarder.ruleType' }), dataIndex: 'type', key: 'type', width: 150 },
    {
      title: intl.formatMessage({ id: 'Guarder.description' }),
      dataIndex: 'description',
      key: 'description',
      width: 260,
      ellipsis: { showTitle: true },
    },
    { title: intl.formatMessage({ id: 'Guarder.sourceIp' }), dataIndex: 'source_ip', key: 'source_ip', width: 140 },
    { title: intl.formatMessage({ id: 'Guarder.destinationIp' }), dataIndex: 'target_ip', key: 'target_ip', width: 140 },
    {
      title: intl.formatMessage({ id: 'Guarder.port' }),
      dataIndex: 'target_port',
      key: 'target_port',
      width: 70,
      align: 'center' as const,
      render: (v: number) => (v === 0 ? <span className="text-gray-400">-</span> : <Tag>{v}</Tag>),
    },
  ];

  // ── Render: Steps + Loading ───────────────────────────────────────
  const renderLoading = () => (
    <div>
      <Steps current={analysisStep} items={STEPS} style={{ marginBottom: 32 }} />
      <div
        className={classNames(
          'flex flex-col items-center justify-center rounded-lg py-12',
          isDark ? 'bg-gray-800/50' : 'bg-gray-50'
        )}
      >
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 52, color: '#722ed1' }} spin />} />
        <div className={classNames('mt-5 text-base font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
          {STEPS[analysisStep]?.title}
        </div>
        <div className={classNames('mt-1 text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {STEPS[analysisStep]?.description}…
        </div>
        <Progress
          percent={Math.round(uploadProgress)}
          status="active"
          strokeColor="#722ed1"
          style={{ marginTop: 20, width: 360 }}
        />
      </div>
    </div>
  );

  // ── Render: Upload Form ───────────────────────────────────────────
  const renderForm = () => (
    <div>
      <Steps current={0} items={STEPS} style={{ marginBottom: 24 }} />

      {error && (
        <Alert
          message={intl.formatMessage({ id: 'AiCenter.pcap.errorTitle' })}
          description={error}
          type="error"
          showIcon
          closable
          onClose={clearError}
          style={{ marginBottom: 12 }}
        />
      )}

      <Alert
        message={intl.formatMessage({ id: 'AiCenter.pcap.alertTitle' })}
        description={intl.formatMessage({ id: 'AiCenter.pcap.alertDesc' })}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        className={classNames(isDark && 'bg-blue-900/20 border-blue-700')}
      />

      <Form form={form} layout="vertical" initialValues={{ analyze_type: 'security' }}>
        {/* 文件上传 */}
        <Form.Item
          label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.pcap.uploadLabel' })}</span>}
          required
        >
          <Upload.Dragger
            fileList={fileList}
            beforeUpload={beforeUpload}
            onChange={handleUploadChange}
            accept=".pcap,.pcapng"
            maxCount={1}
            height={130}
            className={classNames(isDark && 'bg-gray-800 border-gray-600')}
          >
            <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
              <InboxOutlined style={{ fontSize: 32 }} />
            </p>
            <p className={classNames('ant-upload-text', isDark && 'text-gray-300')} style={{ fontSize: 13 }}>
              {intl.formatMessage({ id: 'AiCenter.pcap.uploadDragText' })}
            </p>
            <p className={classNames('ant-upload-hint', isDark && 'text-gray-500')} style={{ fontSize: 12 }}>
              {intl.formatMessage({ id: 'AiCenter.pcap.uploadHint' })}
            </p>
          </Upload.Dragger>
          {fileList[0]?.size && (
            <div className={classNames('mt-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
              {intl.formatMessage({ id: 'AiCenter.pcap.fileSize' }, { size: (fileList[0].size / 1024 / 1024).toFixed(2) })}
            </div>
          )}
        </Form.Item>

        {/* 分析策略 */}
        <Form.Item
          label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.pcap.analyzeTypeLabel' })}</span>}
          name="analyze_type"
          rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pcap.analyzeTypeRequired' }) }]}
        >
          <Radio.Group style={{ display: 'flex', gap: 12 }}>
            <Radio.Button value="security" style={{ flex: 1, textAlign: 'center' }}>
              <SecurityScanOutlined className="mr-1" />
              {intl.formatMessage({ id: 'AiCenter.pcap.typeSecurity' })}
            </Radio.Button>
            <Radio.Button value="performance" style={{ flex: 1, textAlign: 'center' }}>
              <ThunderboltOutlined className="mr-1" />
              {intl.formatMessage({ id: 'AiCenter.pcap.typePerformance' })}
            </Radio.Button>
            <Radio.Button value="custom" style={{ flex: 1, textAlign: 'center' }}>
              <BulbOutlined className="mr-1" />
              {intl.formatMessage({ id: 'AiCenter.pcap.typeCustom' })}
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* 自定义 Prompt */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.analyze_type !== cur.analyze_type}>
          {({ getFieldValue }) =>
            getFieldValue('analyze_type') === 'custom' ? (
              <Form.Item
                label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.customAnalysisPrompt' })}</span>}
                name="custom_prompt"
                rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pcap.customPromptRequired' }) }]}
              >
                <TextArea
                  rows={3}
                  placeholder={intl.formatMessage({ id: 'AiCenter.pcap.customPromptPlaceholder' })}
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <div className="text-center mt-2">
          <Button
            type="primary"
            icon={<FileSearchOutlined />}
            size="large"
            onClick={handleAnalyze}
            disabled={fileList.length === 0}
            style={{ background: '#722ed1', borderColor: '#722ed1', color: (fileList.length === 0) ? '#ffffff70' : '#ffffffff' }}
          >
            {intl.formatMessage({ id: 'AiCenter.pcap.startAnalysis' })}
          </Button>
        </div>
      </Form>
    </div>
  );

  // ── Render: Analysis Result Tabs ──────────────────────────────────
  const renderResult = () => (
    <div>
      <Alert
        message={intl.formatMessage({ id: 'AiCenter.pcap.resultAlertTitle' })}
        description={intl.formatMessage({ id: 'AiCenter.pcap.resultAlertDesc' }, { count: threats.length })}
        type="success"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Tabs defaultActiveKey="summary">
        {/* 分析摘要 */}
        <TabPane tab={intl.formatMessage({ id: 'AiCenter.pcap.tabSummary' })} key="summary">
          <div
            className={classNames(
              'p-3 rounded text-sm whitespace-pre-wrap overflow-auto',
              isDark ? 'bg-gray-900 text-green-400' : 'bg-gray-100 text-gray-800'
            )}
            style={{ maxHeight: 300 }}
          >
            {pcapAnalysisResult?.analysis || intl.formatMessage({ id: 'AiCenter.pcap.noSummary' })}
          </div>
        </TabPane>

        {/* 威胁列表 */}
        <TabPane
          tab={
            <span>
              {intl.formatMessage({ id: 'AiCenter.pcap.tabThreats' })}{' '}
              {threats.length > 0 && (
                <Badge count={threats.length} style={{ backgroundColor: '#f5222d' }} />
              )}
            </span>
          }
          key="threats"
        >
          {threats.length === 0 ? (
            <Empty description={intl.formatMessage({ id: 'AiCenter.pcap.noThreats' })} />
          ) : (
            <Table
              dataSource={threats.map((t: any, i: number) => ({ ...t, key: i }))}
              columns={threatColumns}
              size="small"
              pagination={{ pageSize: 5, size: 'small' }}
              scroll={{ x: 850 }}
              style={{ width: '100%' }}
            />
          )}
        </TabPane>

        {/* 流量统计 */}
        <TabPane tab={intl.formatMessage({ id: 'AiCenter.pcap.tabStats' })} key="stats">
          {statistics ? (
            <div className="space-y-3">
              {/* ── 概览四卡片 ── */}
              <Row gutter={[10, 10]}>
                {([
                  { label: intl.formatMessage({ id: 'ConnectionsMonitor.totalPackets' }), value: statistics.total_packets.toLocaleString(), unit: 'pkts', accent: '#6366f1' },
                  { label: intl.formatMessage({ id: 'ConnectionsMonitor.totalBytes' }),   value: (statistics.total_bytes / 1024 / 1024).toFixed(2), unit: 'MB', accent: '#0ea5e9' },
                  { label: intl.formatMessage({ id: 'AiCenter.pcap.step2Title' }),        value: statistics.duration, unit: '', accent: '#14b8a6' },
                  { label: intl.formatMessage({ id: 'FiltersManager.totalRules' }),       value: statistics.connections.toLocaleString(), unit: 'conn', accent: '#22c55e' },
                ] as const).map((card) => (
                  <Col span={6} key={card.label}>
                    <div
                      style={{
                        background: isDark ? '#1f2937' : '#fff',
                        border: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: 3, background: card.accent, borderRadius: '10px 0 0 10px',
                      }} />
                      <div style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: 6 }}>
                        {card.label}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: card.accent, lineHeight: 1 }}>
                          {card.value}
                        </span>
                        {card.unit && (
                          <span style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af' }}>{card.unit}</span>
                        )}
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>

              {/* ── 协议分布 + TCP Flags ── */}
              <Row gutter={[10, 10]}>
                <Col span={12}>
                  <div style={{
                    background: isDark ? '#1f2937' : '#fff',
                    border: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`,
                    borderRadius: 10, padding: '12px 14px', minHeight: 80,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {intl.formatMessage({ id: 'Guarder.protocol' })}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {Object.entries(statistics.protocols ?? {}).map(([proto, cnt]) => (
                        <Tag key={proto} color="blue" style={{ fontSize: 12, padding: '2px 10px', margin: 0, borderRadius: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{proto}</span>
                          <span style={{ marginLeft: 6, opacity: 0.85 }}>{(cnt as number).toLocaleString()}</span>
                        </Tag>
                      ))}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{
                    background: isDark ? '#1f2937' : '#fff',
                    border: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`,
                    borderRadius: 10, padding: '12px 14px', minHeight: 80,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {intl.formatMessage({ id: 'Guarder.tcpFlags' })}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {Object.entries(statistics.tcp_flags ?? {}).map(([flag, cnt]) => {
                        const flagMeta: Record<string, { antColor: string }> = {
                          syn: { antColor: 'gold' },
                          ack: { antColor: 'green' },
                          fin: { antColor: 'geekblue' },
                          rst: { antColor: 'red' },
                          psh: { antColor: 'cyan' },
                          urg: { antColor: 'magenta' },
                        };
                        const meta = flagMeta[flag.toLowerCase()] ?? { antColor: 'purple' };
                        return (
                          <Tag key={flag} color={meta.antColor} style={{ fontSize: 12, padding: '2px 10px', margin: 0, borderRadius: 6 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{flag.toUpperCase()}</span>
                            <span style={{ marginLeft: 6, opacity: 0.85 }}>{(cnt as number).toLocaleString()}</span>
                          </Tag>
                        );
                      })}
                    </div>
                  </div>
                </Col>
              </Row>

              {/* ── Top 源IP + Top 端口 ── */}
              <Row gutter={[10, 10]}>
                <Col span={12}>
                  <div style={{
                    background: isDark ? '#1f2937' : '#fff',
                    border: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`,
                    borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {intl.formatMessage({ id: 'Guarder.sourceIp' })} TOP
                    </div>
                    <div className="space-y-2">
                      {(statistics.top_source_ips ?? []).slice(0, 5).map((item: any, i: number) => {
                        const maxCnt = statistics.top_source_ips?.[0]?.count ?? 1;
                        const pct = Math.round((item.count / maxCnt) * 100);
                        const rankColor = ['#ef4444', '#f97316', '#f59e0b', '#6b7280', '#6b7280'][i];
                        return (
                          <div key={item.ip} className="flex items-center gap-2">
                            <span style={{ fontSize: 11, fontWeight: 700, width: 16, textAlign: 'center', color: rankColor }}>{i + 1}</span>
                            <span style={{ fontSize: 11, fontFamily: 'monospace', flex: 1, color: isDark ? '#e5e7eb' : '#374151' }}>{item.ip}</span>
                            <div style={{ width: 60, height: 5, borderRadius: 3, background: isDark ? '#374151' : '#f3f4f6', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: rankColor, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, width: 36, textAlign: 'right', fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280' }}>{item.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{
                    background: isDark ? '#1f2937' : '#fff',
                    border: `1px solid ${isDark ? '#374151' : '#f0f0f0'}`,
                    borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {intl.formatMessage({ id: 'Guarder.port' })} TOP
                    </div>
                    <div className="space-y-2">
                      {(statistics.top_ports ?? []).slice(0, 5).map((item: any, i: number) => {
                        const maxCnt = statistics.top_ports?.[0]?.count ?? 1;
                        const pct = Math.round((item.count / maxCnt) * 100);
                        return (
                          <div key={`${item.protocol}-${item.port}`} className="flex items-center gap-2">
                            <span style={{ fontSize: 11, fontWeight: 700, width: 16, textAlign: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>{i + 1}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 90 }}>
                              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#0ea5e9', color: '#fff', fontWeight: 600 }}>{item.protocol}</span>
                              <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: isDark ? '#e5e7eb' : '#374151' }}>{item.port}</span>
                            </div>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, background: isDark ? '#374151' : '#f3f4f6', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: '#0ea5e9', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, width: 36, textAlign: 'right', fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280' }}>{item.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          ) : (
            <Empty description={intl.formatMessage({ id: 'AiCenter.pcap.noStats' })} />
          )}
        </TabPane>

        {/* 安全建议 */}
        <TabPane tab={intl.formatMessage({ id: 'AiCenter.pcap.tabSuggestions' })} key="suggestions">
          {suggestions.length === 0 ? (
            <Empty description={intl.formatMessage({ id: 'AiCenter.pcap.noSuggestions' })} />
          ) : (
            <ul className={classNames('space-y-2 pl-4 list-disc', isDark ? 'text-gray-300' : 'text-gray-700')}>
              {suggestions.map((s: string, i: number) => (
                <li key={i} className="text-sm leading-relaxed">{s}</li>
              ))}
            </ul>
          )}
        </TabPane>
      </Tabs>

      {/* 底部操作 */}
      <div className="text-center mt-4 pt-3" style={{ borderTop: '1px solid var(--ant-color-split)' }}>
        <Space>
          <Button onClick={handleReset}>{intl.formatMessage({ id: 'AiCenter.pcap.reAnalyze' })}</Button>
          <Button type="primary" onClick={handleClose} style={{ background: '#722ed1', borderColor: '#722ed1' }}>
            {intl.formatMessage({ id: 'AiCenter.pcap.done' })}
          </Button>
        </Space>
      </div>
    </div>
  );

  // ── Modal ─────────────────────────────────────────────────────────
  return (
    <Modal
      title={
        <div className={classNames('flex items-center gap-2', isDark && 'text-gray-200')}>
          <FileSearchOutlined />
          {intl.formatMessage({ id: 'AiCenter.pcap.modalTitle' })}
        </div>
      }
      open={aiAnalyzeModalVisible}
      onCancel={handleClose}
      width={900}
      className={classNames(isDark && 'dark-modal')}
      footer={null}
      forceRender
    >
      {uploading
        ? renderLoading()
        : hasResult
        ? renderResult()
        : renderForm()}
    </Modal>
  );
};

export default AiAnalyzeModal;