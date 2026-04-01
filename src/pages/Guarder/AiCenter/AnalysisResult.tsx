import React from 'react';
import { useIntl } from 'react-intl';
import {
  Card,
  Typography,
  Row,
  Col,
  Tag,
  Table,
  Tabs,
  Statistic,
  Badge,
  Empty,
} from 'antd';
import {
  SecurityScanOutlined,
  WarningOutlined,
  BugOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAIStore } from '@/stores/useAIStore';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const { Text } = Typography;
const { TabPane } = Tabs;

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

const AnalysisResult: React.FC = () => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  // 读取 PCAP 分析结果（由 AiAnalyzeModal 分析完成后写入 store）
  const { pcapAnalysisResult } = useAIStore();

  if (!pcapAnalysisResult?.success) return null;

  const { analysis, threats = [], statistics, suggestions = [] } = pcapAnalysisResult;

  const threatColumns = [
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => (
        <Tag color={severityColor[v] ?? 'default'} icon={severityIcon[v]}>
          {v?.toUpperCase()}
        </Tag>
      ),
    },
    { title: '威胁类型', dataIndex: 'type', key: 'type', width: 140 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '源 IP', dataIndex: 'source_ip', key: 'source_ip', width: 140 },
    { title: '目标 IP', dataIndex: 'target_ip', key: 'target_ip', width: 140 },
    {
      title: '目标端口',
      dataIndex: 'target_port',
      key: 'target_port',
      width: 90,
      render: (v: number) => (v === 0 ? '-' : v),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={24}>
        <Card
          title={
            <div className="flex items-center gap-2">
              <SecurityScanOutlined className="text-green-500" />
              <span className={classNames(isDark && 'text-gray-200')}>
                PCAP 网络流量分析结果
              </span>
            </div>
          }
          className={classNames(isDark && 'bg-gray-800 border-gray-700')}
          headStyle={isDark ? { borderBottom: '1px solid #374151', color: '#d1d5db' } : {}}
        >
          <Tabs defaultActiveKey="summary">
            {/* ── 分析摘要 ── */}
            <TabPane tab="📋 分析摘要" key="summary">
              <div
                className={classNames(
                  'p-3 rounded text-sm whitespace-pre-wrap max-h-[480px] overflow-auto',
                  isDark ? 'bg-gray-900 text-green-400' : 'bg-gray-100 text-gray-800'
                )}
              >
                {analysis || '（无摘要）'}
              </div>
            </TabPane>

            {/* ── 威胁列表 ── */}
            <TabPane
              tab={
                <span>
                  🚨 威胁列表{' '}
                  {threats.length > 0 && (
                    <Badge count={threats.length} style={{ backgroundColor: '#f5222d' }} />
                  )}
                </span>
              }
              key="threats"
            >
              {threats.length === 0 ? (
                <Empty description="未检测到威胁" />
              ) : (
                <Table
                  dataSource={threats.map((t: any, i: number) => ({ ...t, key: i }))}
                  columns={threatColumns}
                  size="small"
                  pagination={false}
                  scroll={{ x: true }}
                />
              )}
            </TabPane>

            {/* ── 流量统计 ── */}
            <TabPane tab="📊 流量统计" key="stats">
              {statistics ? (
                <>
                  <Row gutter={[16, 16]}>
                    <Col span={6}>
                      <Statistic title="总数据包" value={statistics.total_packets} />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="总流量"
                        value={(statistics.total_bytes / 1024 / 1024).toFixed(2)}
                        suffix="MB"
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic title="持续时间" value={statistics.duration} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="连接数" value={statistics.connections} />
                    </Col>
                  </Row>

                  <div className="mt-4">
                    <Text strong className={classNames(isDark && 'text-gray-300')}>协议分布</Text>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {Object.entries(statistics.protocols ?? {}).map(([proto, count]) => (
                        <Tag key={proto} color="blue">{proto}: {count as number}</Tag>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <Text strong className={classNames(isDark && 'text-gray-300')}>TCP Flags</Text>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {Object.entries(statistics.tcp_flags ?? {}).map(([flag, count]) => (
                        <Tag key={flag} color="geekblue">{flag.toUpperCase()}: {count as number}</Tag>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <Text strong className={classNames(isDark && 'text-gray-300')}>Top 源 IP</Text>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {(statistics.top_source_ips ?? []).map((item: any) => (
                        <Tag key={item.ip} color="purple">{item.ip}: {item.count}</Tag>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <Text strong className={classNames(isDark && 'text-gray-300')}>Top 端口</Text>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {(statistics.top_ports ?? []).map((item: any) => (
                        <Tag key={`${item.port}-${item.protocol}`} color="cyan">
                          {item.protocol}/{item.port}: {item.count}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <Empty description="暂无统计数据" />
              )}
            </TabPane>

            {/* ── 安全建议 ── */}
            <TabPane tab="💡 安全建议" key="suggestions">
              {suggestions.length === 0 ? (
                <Empty description="暂无建议" />
              ) : (
                <ul className={classNames('space-y-2 pl-4 list-disc', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  {suggestions.map((s: string, i: number) => (
                    <li key={i} className="text-sm">{s}</li>
                  ))}
                </ul>
              )}
            </TabPane>
          </Tabs>
        </Card>
      </Col>
    </Row>
  );
};

export default AnalysisResult;