import React from 'react';
import { useIntl } from 'react-intl';
import {
  Modal,
  Form,
  Input,
  Alert,
  Row,
  Col,
  AutoComplete,
  InputNumber,
  App,
} from 'antd';
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

  return (
    <Modal
      title={
        <div className={classNames(isDark && "text-gray-200")}>
          <SettingOutlined className="mr-2" />
          {intl.formatMessage({ id: 'AiCenter.aiConfigSettings' })}
        </div>
      }
      open={aiConfigModalVisible}
      onOk={() => aiConfigForm.validateFields().then(saveAiConfig)}
      onCancel={() => setAiConfigModalVisible(false)}
      width={700}
      confirmLoading={isLoading}
      className={classNames(isDark && "dark-modal")}
    >
      <Form form={aiConfigForm} layout="vertical" initialValues={config}>
        <Alert
          message={intl.formatMessage({ id: 'AiCenter.configDescription' })}
          description={intl.formatMessage({ id: 'AiCenter.configDescriptionText' })}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          className={classNames(
            isDark && "bg-blue-900/20 border-blue-700 text-blue-300"
          )}
        />

        <Form.Item 
          label={<span className={classNames(isDark && "text-gray-300")}>{intl.formatMessage({ id: 'AiCenter.openaiEndpoint' })}</span>} 
          name="openai_endpoint" 
          rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterOpenaiEndpoint' }) }]}
        >
          <Input 
            placeholder="https://api.openai.com/v1/chat/completions"
          />
        </Form.Item>

        <Form.Item 
          label={<span className={classNames(isDark && "text-gray-300")}>{intl.formatMessage({ id: 'AiCenter.apiKey' })}</span>} 
          name="api_key" 
          rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterApiKey' }) }]}
        >
          <Input.Password 
            placeholder={intl.formatMessage({ id: 'AiCenter.apiKeyPlaceholder' })}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              label={<span className={classNames(isDark && "text-gray-300")}>{intl.formatMessage({ id: 'AiCenter.model' })}</span>} 
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
                className={classNames(
                  isDark && "auto-complete-dark"
                )}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item 
              label={<span className={classNames(isDark && "text-gray-300")}>{intl.formatMessage({ id: 'AiCenter.temperature' })}</span>} 
              name="temperature" 
              rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterTemperature' }) }]}
            >
              <Input 
                type="number" 
                min={0} 
                max={2} 
                step={0.1} 
                placeholder="0.7"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              label={<span className={classNames(isDark && "text-gray-300")}>{intl.formatMessage({ id: 'AiCenter.timeout' })}</span>} 
              name="timeout" 
              rules={[{ required: true, message: intl.formatMessage({ id: 'AiCenter.pleaseEnterTimeout' }) }]}
            >
              <InputNumber 
                placeholder="120" 
              />
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