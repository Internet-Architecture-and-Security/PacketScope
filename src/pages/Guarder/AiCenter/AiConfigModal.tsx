import React from 'react';
import { useIntl } from 'react-intl';
import { Modal, Form, Input, Alert, Row, Col, AutoComplete, InputNumber, App, Select } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useAIStore } from '@/stores/useAIStore';
import { useModals } from '@/stores/useStore';
import { useTheme } from '@/stores/useStore';
import { DataSwitch } from './DataSwitch';
import classNames from 'classnames';

const AiConfigModal: React.FC = () => {
  const intl = useIntl();
  const { notification } = App.useApp();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const { config, isLoading, updateConfig } = useAIStore();
  const { aiConfigModalVisible, setAiConfigModalVisible } = useModals();
  const [aiConfigForm] = Form.useForm();
  const provider = Form.useWatch('provider', aiConfigForm) || config?.provider || 'openai';

  const providerOptions = [
    {
      value: 'openai',
      label: intl.formatMessage({ id: 'AiCenter.providerOpenAI' }),
    },
    {
      value: 'anthropic',
      label: intl.formatMessage({ id: 'AiCenter.providerAnthropic' }),
    },
  ];

  const modelOptions =
    provider === 'anthropic'
      ? [
          { value: 'claude-3-5-sonnet-latest' },
          { value: 'claude-3-7-sonnet-latest' },
          { value: 'kimi-for-coding' },
          { value: 'kimi-k2-thinking' },
        ]
      : [
          { value: 'gpt-4' },
          { value: 'gpt-4-turbo' },
          { value: 'gpt-3.5-turbo' },
          { value: 'deepseek-chat' },
          { value: 'deepseek-reasoner' },
        ];

  const endpointPlaceholder =
    provider === 'anthropic' ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions';

  // 保存AI配置
  const saveAiConfig = async (values: any) => {
    values.timeout = parseInt(values.timeout, 10);
    if (values.provider !== 'anthropic') {
      delete values.anthropic_version;
    }
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

  return (
    <Modal
      title={
        <div className={classNames(isDark && 'text-gray-200')}>
          <SettingOutlined className="mr-2" />
          {intl.formatMessage({ id: 'AiCenter.aiConfigSettings' })}
        </div>
      }
      open={aiConfigModalVisible}
      onOk={() => aiConfigForm.validateFields().then(saveAiConfig)}
      onCancel={() => setAiConfigModalVisible(false)}
      width={700}
      confirmLoading={isLoading}
      className={classNames(isDark && 'dark-modal')}
    >
      <Form
        form={aiConfigForm}
        layout="vertical"
        initialValues={
          config || {
            provider: 'openai',
            openai_endpoint: 'https://api.openai.com/v1/chat/completions',
            temperature: 0.7,
            timeout: 120,
            debug: false,
          }
        }
      >
        <Alert
          message={intl.formatMessage({ id: 'AiCenter.configDescription' })}
          description={intl.formatMessage({ id: 'AiCenter.configDescriptionText' })}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          className={classNames(isDark && 'bg-blue-900/20 border-blue-700 text-blue-300')}
        />

        <Form.Item
          label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.provider' })}</span>}
          name="provider"
          rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseSelectProvider' }) }]}
        >
          <Select options={providerOptions} />
        </Form.Item>

        <Form.Item
          label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.endpoint' })}</span>}
          name="openai_endpoint"
          rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterEndpoint' }) }]}
        >
          <Input placeholder={endpointPlaceholder} />
        </Form.Item>

        <Form.Item
          label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.apiKey' })}</span>}
          name="api_key"
          rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterApiKey' }) }]}
        >
          <Input.Password placeholder={intl.formatMessage({ id: 'AiCenter.apiKeyPlaceholder' })} />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.model' })}</span>}
              name="model"
              rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseSelectOrEnterModel' }) }]}
            >
              <AutoComplete
                options={modelOptions}
                placeholder={intl.formatMessage({ id: 'AiCenter.modelPlaceholder' })}
                filterOption={(inputValue, option) => option!.value.toLowerCase().includes(inputValue.toLowerCase())}
                className={classNames(isDark && 'auto-complete-dark')}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.temperature' })}</span>}
              name="temperature"
              rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterTemperature' }) }]}
            >
              <Input type="number" min={0} max={2} step={0.1} placeholder="0.7" />
            </Form.Item>
          </Col>
        </Row>

        {provider === 'anthropic' && (
          <Form.Item
            label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.anthropicVersion' })}</span>}
            name="anthropic_version"
            rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterAnthropicVersion' }) }]}
          >
            <Input placeholder="2023-06-01" />
          </Form.Item>
        )}

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={<span className={classNames(isDark && 'text-gray-300')}>{intl.formatMessage({ id: 'AiCenter.timeout' })}</span>}
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
  );
};

export default AiConfigModal;
