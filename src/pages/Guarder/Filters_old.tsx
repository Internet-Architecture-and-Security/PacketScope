import React, { useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Tooltip,
  Popconfirm,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Alert,
  Statistic,
  Typography,
  InputNumber,
  Checkbox,
  App,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  RobotOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CheckOutlined,
  CloseOutlined,
  GlobalOutlined,
  ApiOutlined,
  AlertOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useIntl } from 'react-intl';
import { useFilters } from '@/hooks/useFilters';
import { useModals } from '@/stores/useStore';
import { useEdit } from '@/stores/useStore';
import { Funnel } from 'lucide-react';
import type { Filter } from '@/stores/useFiltersStore';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const Filters: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const { filters, fetchFilters, addFilter, updateFilter, deleteFilter, toggleFilter } = useFilters();
  const { filterModalVisible, setFilterModalVisible, setAiGenerateModalVisible } = useModals();
  const { editingFilter, setEditingFilter } = useEdit();
  const [formRef] = Form.useForm();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterType, setFilterType] = React.useState('all');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterAction, setFilterAction] = React.useState('all');
  const [currentRuleType, setCurrentRuleType] = React.useState('basic');

  // TCP标志位选项
  const tcpFlags = [
    { label: intl.formatMessage({ id: 'FiltersManager.tcpFlagFin' }), value: 1 },
    { label: intl.formatMessage({ id: 'FiltersManager.tcpFlagSyn' }), value: 2 },
    { label: intl.formatMessage({ id: 'FiltersManager.tcpFlagRst' }), value: 4 },
    { label: intl.formatMessage({ id: 'FiltersManager.tcpFlagPsh' }), value: 8 },
    { label: intl.formatMessage({ id: 'FiltersManager.tcpFlagAck' }), value: 16 },
    { label: intl.formatMessage({ id: 'FiltersManager.tcpFlagUrg' }), value: 32 },
  ];

  // ICMP类型选项
  const icmpTypes = [
    { label: intl.formatMessage({ id: 'FiltersManager.icmpEchoReply' }), value: 0 },
    { label: intl.formatMessage({ id: 'FiltersManager.icmpDestUnreachable' }), value: 3 },
    { label: intl.formatMessage({ id: 'FiltersManager.icmpRedirect' }), value: 5 },
    { label: intl.formatMessage({ id: 'FiltersManager.icmpEchoRequest' }), value: 8 },
    { label: intl.formatMessage({ id: 'FiltersManager.icmpRouterAdv' }), value: 9 },
    { label: intl.formatMessage({ id: 'FiltersManager.icmpRouterSelect' }), value: 10 },
    { label: intl.formatMessage({ id: 'FiltersManager.icmpTimeExceeded' }), value: 11 },
    { label: intl.formatMessage({ id: 'FiltersManager.icmpParamProblem' }), value: 12 },
    { label: intl.formatMessage({ id: 'FiltersManager.icmpTimestamp' }), value: 13 },
    { label: intl.formatMessage({ id: 'FiltersManager.icmpTimestampReply' }), value: 14 },
  ];

  // 过滤和搜索逻辑
  const filteredFilters = React.useMemo(() => {
    return filters.filter((filter) => {
      // 搜索条件匹配
      const matchesSearch =
        searchTerm === '' ||
        (filter.src_ip && filter.src_ip.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (filter.dst_ip && filter.dst_ip.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (filter.comment && filter.comment.toLowerCase().includes(searchTerm.toLowerCase()));

      // 类型过滤
      const matchesType = filterType === 'all' || (filterType === 'ai' ? filter.ai_generated : filter.rule_type === filterType);

      // 状态过滤
      const matchesStatus =
        filterStatus === 'all' || (filterStatus === 'enabled' && filter.enabled) || (filterStatus === 'disabled' && !filter.enabled);

      // 动作过滤
      const matchesAction = filterAction === 'all' || filter.action === filterAction;

      return matchesSearch && matchesType && matchesStatus && matchesAction;
    });
  }, [filters, searchTerm, filterType, filterStatus, filterAction]);

  useEffect(() => {
    fetchFilters();
  }, []);

  const filterColumns: TableProps<Filter>['columns'] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      sorter: (a, b) => b.id - a.id,
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.ruleType' }),
      dataIndex: 'rule_type',
      key: 'rule_type',
      render: (type: string, record: Filter) => (
        <Space>
          <Tag color={type === 'basic' ? 'blue' : type === 'tcp' ? 'green' : type === 'udp' ? 'orange' : 'purple'}>
            {type.toUpperCase()}
          </Tag>
          {record.ai_generated && (
            <Tag color="gold" icon={<RobotOutlined />}>
              AI
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.sourceIp' }),
      dataIndex: 'src_ip',
      key: 'src_ip',
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.protocol' }),
      dataIndex: 'protocol',
      key: 'protocol',
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.action' }),
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => (
        <Tag color={action === 'drop' ? 'red' : 'green'}>
          {action === 'drop' 
            ? intl.formatMessage({ id: 'FiltersManager.actionDrop' })
            : intl.formatMessage({ id: 'FiltersManager.actionAllow' })
          }
        </Tag>
      ),
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.status' }),
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: Filter) => (
        <Switch checked={enabled} onChange={() => toggleFilter(record.id)} size="small" />
      ),
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.comment' }),
      dataIndex: 'comment',
      key: 'comment',
      render: (comment: string, record: Filter) => (
        <div>
          <div>{comment}</div>
          {record.ai_generated && record.ai_confidence && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {intl.formatMessage(
                { id: 'FiltersManager.aiConfidence' },
                { confidence: (record.ai_confidence * 100).toFixed(1) }
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.operations' }),
      key: 'actions',
      render: (_, record: Filter) => (
        <Space>
          <Tooltip title={intl.formatMessage({ id: 'FiltersManager.edit' })}>
            <Button type="text" icon={<EditOutlined className="w-4 h-4" />} onClick={() => editFilter(record)} />
          </Tooltip>
          <Popconfirm 
            title={intl.formatMessage({ id: 'FiltersManager.confirmDelete' })} 
            onConfirm={() => deleteFilter(record.id)} 
            okText={intl.formatMessage({ id: 'FiltersManager.confirm' })} 
            cancelText={intl.formatMessage({ id: 'FiltersManager.cancel' })}
          >
            <Tooltip title={intl.formatMessage({ id: 'FiltersManager.delete' })}>
              <Button type="text" danger icon={<DeleteOutlined className="w-4 h-4" />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const editFilter = (filter: any) => {
    setEditingFilter(filter);
    setCurrentRuleType(filter.rule_type);
    formRef.setFieldsValue(filter);
    setFilterModalVisible(true);
  };

  const addNewFilter = () => {
    setEditingFilter(null);
    setCurrentRuleType('basic');
    formRef.resetFields();
    formRef.setFieldsValue({
      rule_type: 'basic',
      action: 'allow',
      enabled: true,
      protocol: 'tcp',
    });
    setFilterModalVisible(true);
  };

  const handleModalOk = () => {
    formRef.validateFields().then((values) => {
      // 处理特殊字段
      const processedValues = {
        ...values,
        src_ip: values.src_ip || '0.0.0.0',
        dst_ip: values.dst_ip || '0.0.0.0',
        src_port: values.src_port || 0,
        dst_port: values.dst_port || 0,
        icmp_type: values.icmp_type || 255,
        icmp_code: values.icmp_code || 255,
        tcp_flags: values.tcp_flags || 0,
        tcp_flags_mask: values.tcp_flags_mask || 0,
        inner_src_ip: values.inner_src_ip || '0.0.0.0',
        inner_dst_ip: values.inner_dst_ip || '0.0.0.0',
        inner_protocol: values.inner_protocol || 0,
      };
      if (editingFilter) {
        updateFilter(editingFilter.id, values);
      } else {
        const newFilter = {
          id: Math.max(...filters.map((f) => f.id), 0) + 1,
          ...values,
          ai_generated: false,
        };
        addFilter(newFilter);
      }
      setFilterModalVisible(false);
    });
  };

  const handleRuleTypeChange = (value: string) => {
    setCurrentRuleType(value);
    if (value === 'basic') {
      formRef.setFieldsValue({
        tcp_flags: undefined,
        tcp_flags_mask: undefined,
        icmp_type: undefined,
        icmp_code: undefined,
        inner_src_ip: undefined,
        inner_dst_ip: undefined,
        inner_protocol: undefined,
      });
    }
  };

  // 渲染基础字段
  const renderBasicFields = () => (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item 
            label={intl.formatMessage({ id: 'FiltersManager.ruleType' })} 
            name="rule_type" 
            rules={[{ required: true, message: intl.formatMessage({ id: 'FiltersManager.selectRuleType' }) }]}
          >
            <Select 
              placeholder={intl.formatMessage({ id: 'FiltersManager.selectRuleType' })} 
              onChange={handleRuleTypeChange}
            >
              <Option value="basic">{intl.formatMessage({ id: 'FiltersManager.basicRule' })}</Option>
              <Option value="tcp">{intl.formatMessage({ id: 'FiltersManager.tcpRule' })}</Option>
              <Option value="udp">{intl.formatMessage({ id: 'FiltersManager.udpRule' })}</Option>
              <Option value="icmp">{intl.formatMessage({ id: 'FiltersManager.icmpRule' })}</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item 
            label={intl.formatMessage({ id: 'FiltersManager.action' })} 
            name="action" 
            rules={[{ required: true, message: intl.formatMessage({ id: 'FiltersManager.selectAction' }) }]}
          >
            <Select placeholder={intl.formatMessage({ id: 'FiltersManager.selectAction' })}>
              <Option value="allow">{intl.formatMessage({ id: 'FiltersManager.actionAllow' })}</Option>
              <Option value="drop">{intl.formatMessage({ id: 'FiltersManager.actionDrop' })}</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.sourceIpAddress' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.sourceIpTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="src_ip"
          >
            <Input placeholder={intl.formatMessage({ id: 'FiltersManager.sourceIpPlaceholder' })} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.destIpAddress' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.destIpTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="dst_ip"
          >
            <Input placeholder={intl.formatMessage({ id: 'FiltersManager.destIpPlaceholder' })} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.sourcePort' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.portTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="src_port"
          >
            <InputNumber 
              min={0} 
              max={65535} 
              placeholder={intl.formatMessage({ id: 'FiltersManager.portPlaceholder' })} 
              style={{ width: '100%' }} 
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.destPort' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.portTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="dst_port"
          >
            <InputNumber 
              min={0} 
              max={65535} 
              placeholder={intl.formatMessage({ id: 'FiltersManager.portPlaceholder' })} 
              style={{ width: '100%' }} 
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item 
            label={intl.formatMessage({ id: 'FiltersManager.protocol' })} 
            name="protocol" 
            rules={[{ required: true, message: intl.formatMessage({ id: 'FiltersManager.selectProtocol' }) }]}
          >
            <Select placeholder={intl.formatMessage({ id: 'FiltersManager.selectProtocol' })}>
              <Option value="tcp">TCP (6)</Option>
              <Option value="udp">UDP (17)</Option>
              <Option value="icmp">ICMP (1)</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  // 渲染TCP特定字段
  const renderTcpFields = () => (
    <>
      <Alert 
        message={intl.formatMessage({ id: 'FiltersManager.tcpSpecificFields' })} 
        description={intl.formatMessage({ id: 'FiltersManager.tcpSpecificDescription' })} 
        type="info" 
        showIcon 
        style={{ marginBottom: 16 }} 
      />
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.tcpFlags' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.tcpFlagsTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="tcp_flags"
          >
            <Select placeholder={intl.formatMessage({ id: 'FiltersManager.selectTcpFlags' })}>
              {tcpFlags.map((flag) => (
                <Option key={flag.value} value={flag.value}>
                  {flag.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.tcpFlagsMask' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.tcpFlagsMaskTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="tcp_flags_mask"
          >
            <Select placeholder={intl.formatMessage({ id: 'FiltersManager.selectTcpFlagsMask' })}>
              {tcpFlags.map((flag) => (
                <Option key={flag.value} value={flag.value}>
                  {flag.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  // 渲染ICMP特定字段
  const renderIcmpFields = () => (
    <>
      <Alert
        message={intl.formatMessage({ id: 'FiltersManager.icmpSpecificFields' })}
        description={intl.formatMessage({ id: 'FiltersManager.icmpSpecificDescription' })}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.icmpType' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.icmpTypeTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="icmp_type"
          >
            <Select placeholder={intl.formatMessage({ id: 'FiltersManager.selectIcmpType' })} allowClear>
              {icmpTypes.map((type) => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.icmpCode' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.icmpCodeTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="icmp_code"
          >
            <InputNumber 
              min={0} 
              max={255} 
              placeholder={intl.formatMessage({ id: 'FiltersManager.icmpCodePlaceholder' })} 
              style={{ width: '100%' }} 
            />
          </Form.Item>
        </Col>
      </Row>

      <Alert
        message={intl.formatMessage({ id: 'FiltersManager.innerPacketFilter' })}
        description={intl.formatMessage({ id: 'FiltersManager.innerPacketDescription' })}
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.innerSourceIp' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.innerSourceIpTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="inner_src_ip"
          >
            <Input placeholder={intl.formatMessage({ id: 'FiltersManager.innerSourceIpPlaceholder' })} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.innerDestIp' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.innerDestIpTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="inner_dst_ip"
          >
            <Input placeholder={intl.formatMessage({ id: 'FiltersManager.innerDestIpPlaceholder' })} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label={
              <span>
                {intl.formatMessage({ id: 'FiltersManager.innerProtocol' })}
                <Tooltip title={intl.formatMessage({ id: 'FiltersManager.innerProtocolTooltip' })}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                </Tooltip>
              </span>
            }
            name="inner_protocol"
          >
            <Select placeholder={intl.formatMessage({ id: 'FiltersManager.selectInnerProtocol' })} allowClear>
              <Option value={'ICMP'}>ICMP (1)</Option>
              <Option value={'TCP'}>TCP (6)</Option>
              <Option value={'UDP'}>UDP (17)</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  return (
    <div>
      <div className="mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Funnel className="text-white text-3xl" color="#fff" size={30} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {intl.formatMessage({ id: 'FiltersManager.title' })}
              </h1>
              <p className="text-gray-600">
                {intl.formatMessage({ id: 'FiltersManager.subtitle' })}
              </p>
            </div>
          </div>
        </header>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} className="mb-8">
          <Col xs={24} sm={12} md={6}>
            <Card className="transition-all duration-300 bg-gradient-to-br from-blue-50 via-white to-blue-50 relative overflow-hidden group shadow-sm">
              <div className="absolute -right-8 -bottom-8 opacity-10">
                <SafetyOutlined className="text-8xl text-blue-600 transform rotate-12" />
              </div>
              <div className="relative z-10">
                <Statistic
                  title={
                    <Text strong className="text-gray-700/50">
                      {intl.formatMessage({ id: 'FiltersManager.totalRules' })}
                    </Text>
                  }
                  value={filters.length}
                  valueStyle={{ color: '#1e40af', fontSize: '30px', fontWeight: 'bold' }}
                />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="transition-all duration-300 bg-gradient-to-br from-green-50 via-white to-green-50 relative overflow-hidden group shadow-sm">
              <div className="absolute -right-8 -bottom-8 opacity-10">
                <EyeOutlined className="text-8xl text-green-600 transform rotate-12" />
              </div>
              <div className="relative z-10">
                <Statistic
                  title={
                    <Text strong className="text-gray-700/50">
                      {intl.formatMessage({ id: 'FiltersManager.enabledRules' })}
                    </Text>
                  }
                  value={filters.filter((f) => f.enabled).length}
                  valueStyle={{ color: '#16a34a', fontSize: '30px', fontWeight: 'bold' }}
                />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="transition-all duration-300 bg-gradient-to-br from-gray-50 via-white to-gray-50 relative overflow-hidden group shadow-sm">
              <div className="absolute -right-8 -bottom-8 opacity-10">
                <EyeInvisibleOutlined className="text-8xl text-gray-600 transform rotate-12" />
              </div>
              <div className="relative z-10">
                <Statistic
                  title={
                    <Text strong className="text-gray-700/50">
                      {intl.formatMessage({ id: 'FiltersManager.disabledRules' })}
                    </Text>
                  }
                  value={filters.filter((f) => !f.enabled).length}
                  valueStyle={{ color: '#4b5563', fontSize: '30px', fontWeight: 'bold' }}
                />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="transition-all duration-300 bg-gradient-to-br from-purple-50 via-white to-purple-50 relative overflow-hidden group shadow-sm">
              <div className="absolute -right-8 -bottom-8 opacity-10">
                <AlertOutlined className="text-8xl text-purple-600 transform rotate-12" />
              </div>
              <div className="relative z-10">
                <Statistic
                  title={
                    <Text strong className="text-gray-700/50">
                      {intl.formatMessage({ id: 'FiltersManager.aiGeneratedRules' })}
                    </Text>
                  }
                  value={filters.filter((f) => f.ai_generated).length}
                  valueStyle={{ color: 'purple', fontSize: '30px', fontWeight: 'bold' }}
                />
              </div>
            </Card>
          </Col>
        </Row>

        {/* 工具栏 */}
        <Card className="mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <Input
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder={intl.formatMessage({ id: 'FiltersManager.searchPlaceholder' })}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
                allowClear
              />
              <Space>
                <Select 
                  value={filterType} 
                  onChange={setFilterType} 
                  style={{ width: 120 }} 
                  placeholder={intl.formatMessage({ id: 'FiltersManager.ruleType' })}
                >
                  <Option value="all">{intl.formatMessage({ id: 'FiltersManager.allTypes' })}</Option>
                  <Option value="ai">{intl.formatMessage({ id: 'FiltersManager.aiGeneratedRules' })}</Option>
                  <Option value="basic">{intl.formatMessage({ id: 'FiltersManager.basicRule' })}</Option>
                  <Option value="tcp">{intl.formatMessage({ id: 'FiltersManager.tcpRule' })}</Option>
                  <Option value="udp">{intl.formatMessage({ id: 'FiltersManager.udpRule' })}</Option>
                  <Option value="icmp">{intl.formatMessage({ id: 'FiltersManager.icmpRule' })}</Option>
                </Select>
                <Select 
                  value={filterStatus} 
                  onChange={setFilterStatus} 
                  style={{ width: 120 }} 
                  placeholder={intl.formatMessage({ id: 'FiltersManager.ruleStatus' })}
                >
                  <Option value="all">{intl.formatMessage({ id: 'FiltersManager.allStatus' })}</Option>
                  <Option value="enabled">{intl.formatMessage({ id: 'FiltersManager.enabled' })}</Option>
                  <Option value="disabled">{intl.formatMessage({ id: 'FiltersManager.disabled' })}</Option>
                </Select>
                <Select 
                  value={filterAction} 
                  onChange={setFilterAction} 
                  style={{ width: 120 }} 
                  placeholder={intl.formatMessage({ id: 'FiltersManager.action' })}
                >
                  <Option value="all">{intl.formatMessage({ id: 'FiltersManager.allActions' })}</Option>
                  <Option value="drop">{intl.formatMessage({ id: 'FiltersManager.actionDrop' })}</Option>
                  <Option value="allow">{intl.formatMessage({ id: 'FiltersManager.actionAllow' })}</Option>
                </Select>
              </Space>
            </div>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={addNewFilter}>
                {intl.formatMessage({ id: 'FiltersManager.addFilter' })}
              </Button>
              <Button
                type="primary"
                icon={<RobotOutlined />}
                onClick={() => setAiGenerateModalVisible(true)}
                style={{ background: '#722ed1', borderColor: '#722ed1' }}
              >
                {intl.formatMessage({ id: 'FiltersManager.aiGenerate' })}
              </Button>
            </Space>
          </div>
        </Card>

        {/* 过滤器列表 */}
        <Card className="shadow-sm">
          <Table
            columns={filterColumns}
            dataSource={filteredFilters}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => intl.formatMessage({ id: 'FiltersManager.totalRulesCount' }, { total }),
            }}
            size="small"
            onChange={(pagination, filters, sorter) => {
              console.log('Table parameters:', { pagination, filters, sorter });
            }}
            locale={{
              emptyText: (
                <div className="text-center py-12">
                  <FilterOutlined className="text-5xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {intl.formatMessage({ id: 'FiltersManager.noFiltersFound' })}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {intl.formatMessage({ id: 'FiltersManager.adjustSearchOrCreate' })}
                  </p>
                  <Button type="primary" icon={<PlusOutlined />} onClick={addNewFilter}>
                    {intl.formatMessage({ id: 'FiltersManager.addFilter' })}
                  </Button>
                </div>
              ),
            }}
          />
        </Card>

        {/* 添加/编辑模态框 */}
        <Modal
          title={editingFilter 
            ? intl.formatMessage({ id: 'FiltersManager.editFilter' }) 
            : intl.formatMessage({ id: 'FiltersManager.addFilter' })
          }
          open={filterModalVisible}
          onOk={handleModalOk}
          onCancel={() => setFilterModalVisible(false)}
          width={900}
          forceRender
          destroyOnHidden
        >
          <Form form={formRef} layout="vertical">
            {/* 基础字段 */}
            {renderBasicFields()}

            {/* TCP特定字段 */}
            {currentRuleType === 'tcp' && renderTcpFields()}

            {/* ICMP特定字段 */}
            {currentRuleType === 'icmp' && renderIcmpFields()}

            {/* UDP规则说明 */}
            {currentRuleType === 'udp' && (
              <Alert
                message={intl.formatMessage({ id: 'FiltersManager.udpRule' })}
                description={intl.formatMessage({ id: 'FiltersManager.udpRuleDescription' })}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form.Item label={intl.formatMessage({ id: 'FiltersManager.ruleDescription' })} name="comment">
              <TextArea 
                rows={3} 
                placeholder={intl.formatMessage({ id: 'FiltersManager.ruleDescriptionPlaceholder' })} 
                showCount 
                maxLength={200} 
              />
            </Form.Item>

            <Form.Item name="enabled" valuePropName="checked">
              <Checkbox>{intl.formatMessage({ id: 'FiltersManager.enableRule' })}</Checkbox>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default Filters;