import React from 'react';
import {
  Form,
  Input,
  Select,
  Row,
  Col,
  Alert,
  InputNumber,
  Tooltip,
  Checkbox,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { useTheme } from '@/stores/useStore';

const { Option } = Select;
const { TextArea } = Input;

interface FilterFormFieldsProps {
  currentRuleType: string;
  onRuleTypeChange: (value: string) => void;
}

const FilterFormFields: React.FC<FilterFormFieldsProps> = ({
  currentRuleType,
  onRuleTypeChange,
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

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
              onChange={onRuleTypeChange}
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
            <Select 
              placeholder={intl.formatMessage({ id: 'FiltersManager.selectAction' })}
            >
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
            <Input 
              placeholder={intl.formatMessage({ id: 'FiltersManager.sourceIpPlaceholder' })}
            />
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
            <Input 
              placeholder={intl.formatMessage({ id: 'FiltersManager.destIpPlaceholder' })}
            />
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
            <Select 
              placeholder={intl.formatMessage({ id: 'FiltersManager.selectProtocol' })}
            >
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
            <Select 
              placeholder={intl.formatMessage({ id: 'FiltersManager.selectTcpFlags' })}
            >
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
            <Select 
              placeholder={intl.formatMessage({ id: 'FiltersManager.selectTcpFlagsMask' })}
            >
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
            <Select 
              placeholder={intl.formatMessage({ id: 'FiltersManager.selectIcmpType' })} 
              allowClear
            >
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
            <Input 
              placeholder={intl.formatMessage({ id: 'FiltersManager.innerSourceIpPlaceholder' })}
            />
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
            <Input 
              placeholder={intl.formatMessage({ id: 'FiltersManager.innerDestIpPlaceholder' })}
            />
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
            <Select 
              placeholder={intl.formatMessage({ id: 'FiltersManager.selectInnerProtocol' })} 
              allowClear
            >
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
    <>
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
        <Checkbox className={classNames(
          isDark ? "text-gray-300" : ""
        )}>
          {intl.formatMessage({ id: 'FiltersManager.enableRule' })}
        </Checkbox>
      </Form.Item>
    </>
  );
};

export default FilterFormFields;