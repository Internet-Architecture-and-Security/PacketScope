import React from 'react';
import { useIntl } from 'react-intl';
import { Alert, Button, Typography } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAIStore } from '@/stores/useAIStore';
import { useModals } from '@/stores/useStore';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const { Text } = Typography;

const AiStatusAlert: React.FC = () => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const { config, isAiConfigValid } = useAIStore();
  const { setAiConfigModalVisible } = useModals();

  const configValid = isAiConfigValid();

  return (
    <Alert
      message={
        <div className="flex items-center space-x-3">
          {configValid ? (
            <CheckCircleOutlined className="text-xl text-green-600/90" />
          ) : (
            <ExclamationCircleOutlined className="text-xl text-red-500/90" />
          )}
          <div>
            <Text strong className={classNames(
              configValid ? 'text-green-600' : 'text-red-500/90',
              isDark && configValid && 'text-green-400/90',
              isDark && !configValid && 'text-red-500/90'
            )}>
              {configValid 
                ? intl.formatMessage({ id: 'AiCenter.aiServiceConfigured' }) 
                : intl.formatMessage({ id: 'AiCenter.aiServiceNotConfigured' })
              }
            </Text>
            <div className={classNames(
              `text-sm`,
              configValid ? 'text-green-600/80' : 'text-red-400/80',
              isDark && configValid && 'text-green-400/80',
              isDark && !configValid && 'text-red-400/80'
            )}>
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
      className={classNames(
        "rounded-xl",
        isDark && configValid && "bg-green-900/20 border-green-700",
        isDark && !configValid && "bg-red-900/20 border-red-400/30"
      )}
      action={
        !configValid && (
          <Button size="small" type="primary" onClick={() => setAiConfigModalVisible(true)}>
            {intl.formatMessage({ id: 'AiCenter.configureNow' })}
          </Button>
        )
      }
    />
  );
};

export default AiStatusAlert;