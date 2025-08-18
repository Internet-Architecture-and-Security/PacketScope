import React from 'react';
import { useIntl } from 'react-intl';
import {
  Modal,
  Form,
  Input,
  Alert,
  Space,
  Button,
  App,
} from 'antd';
import { SecurityScanOutlined } from '@ant-design/icons';
import { useAIStore } from '@/stores/useAIStore';
import { useModals } from '@/stores/useStore';
import { useTheme } from '@/stores/useStore';
import { DataSwitch } from './DataSwitch';
import classNames from 'classnames';

const { TextArea } = Input;

const AiAnalyzeModal: React.FC = () => {
  const intl = useIntl();
  const { notification } = App.useApp();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  
  const { isLoading, analyzeOnly } = useAIStore();
  const { aiAnalyzeModalVisible, setAiAnalyzeModalVisible } = useModals();
  const [aiAnalyzeForm] = Form.useForm();

  // AI网络分析
  const handleAiAnalyze = async (values: any) => {
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

  return (
    <Modal
      title={
        <div className={classNames(isDark && "text-gray-200")}>
          <SecurityScanOutlined className="mr-2" />
          {intl.formatMessage({ id: 'AiCenter.aiNetworkAnalysis' })}
        </div>
      }
      open={aiAnalyzeModalVisible}
      onCancel={() => setAiAnalyzeModalVisible(false)}
      width={600}
      className={classNames(isDark && "dark-modal")}
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
          className={classNames(
            isDark && "bg-blue-900/20 border-blue-700 text-blue-300"
          )}
        />

        <Form.Item label={<span className={classNames(isDark && "text-gray-300")}>{intl.formatMessage({ id: 'AiCenter.analysisScope' })}</span>}>
          <Space direction="vertical">
            <DataSwitch label={intl.formatMessage({ id: 'AiCenter.analyzeTcpConnections' })} name="include_tcp"></DataSwitch>
            <DataSwitch label={intl.formatMessage({ id: 'AiCenter.analyzeUdpConnections' })} name="include_udp"></DataSwitch>
            <DataSwitch label={intl.formatMessage({ id: 'AiCenter.analyzeIcmpTraffic' })} name="include_icmp"></DataSwitch>
            <DataSwitch label={intl.formatMessage({ id: 'AiCenter.includeStatistics' })} name="include_stats"></DataSwitch>
          </Space>
        </Form.Item>

        <Form.Item label={<span className={classNames(isDark && "text-gray-300")}>{intl.formatMessage({ id: 'AiCenter.customAnalysisPrompt' })}</span>} name="custom_prompt">
          <TextArea 
            rows={4} 
            placeholder={intl.formatMessage({ id: 'AiCenter.customAnalysisPlaceholder' })}
            className={classNames(
              "border-0",
              isDark ? "placeholder:text-gray-500 text-gray-300 bg-transparent" : "placeholder:text-gray-400"
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AiAnalyzeModal;