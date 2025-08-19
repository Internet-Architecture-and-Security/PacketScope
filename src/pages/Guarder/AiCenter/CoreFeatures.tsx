import React from 'react';
import { useIntl } from 'react-intl';
import { Card, Space, Typography, Row, Col } from 'antd';
import {
  BulbOutlined,
  ApiOutlined,
  SecurityScanOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const { Text } = Typography;

const CoreFeatures: React.FC = () => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <Row gutter={16}>
      <Col span={24}>
        <Card 
          title={intl.formatMessage({ id: 'AiCenter.coreFeatures' })} 
          className={classNames(
            "shadow-sm",
            isDark ? "bg-gray-800 border-gray-700" : "border-white"
          )}
          headStyle={isDark ? { color: '#d1d5db' } : {}}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <BulbOutlined className="text-yellow-500 mr-2" />
              <Text className={classNames(isDark && "text-gray-300")}>
                {intl.formatMessage({ id: 'AiCenter.feature1' })}
              </Text>
            </div>
            <div>
              <ApiOutlined className="text-blue-500 mr-2" />
              <Text className={classNames(isDark && "text-gray-300")}>
                {intl.formatMessage({ id: 'AiCenter.feature2' })}
              </Text>
            </div>
            <div>
              <SecurityScanOutlined className="text-green-500 mr-2" />
              <Text className={classNames(isDark && "text-gray-300")}>
                {intl.formatMessage({ id: 'AiCenter.feature3' })}
              </Text>
            </div>
            <div>
              <SettingOutlined className="text-purple-500 mr-2" />
              <Text className={classNames(isDark && "text-gray-300")}>
                {intl.formatMessage({ id: 'AiCenter.feature4' })}
              </Text>
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

export default CoreFeatures;