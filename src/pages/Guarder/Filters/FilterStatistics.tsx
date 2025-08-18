import React from 'react';
import { Card, Row, Col, Statistic, Typography, ConfigProvider } from 'antd';
import {
  SafetyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { useTheme } from '@/stores/useStore';
import type { Filter } from '@/stores/useFiltersStore';

const { Text } = Typography;

interface FilterStatisticsProps {
  filters: Filter[];
}

const FilterStatistics: React.FC<FilterStatisticsProps> = ({ filters }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
        <ConfigProvider theme={{
            components: {
              Card: {
                colorBorderSecondary: isDark ? '#374151' : undefined,
                colorBorder: isDark ? '#374151' : undefined,
              },
            }
          }}>
    <Row gutter={[16, 16]} className="mb-8">
      <Col xs={24} sm={12} md={6}>
        <Card
        className={classNames(
          "transition-all duration-300 bg-gradient-to-br relative overflow-hidden group shadow-sm",
          isDark 
            ? "from-blue-900/50 via-gray-900 to-blue-900/50" 
            : "from-blue-50 via-white to-blue-50"
        )}>
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <SafetyOutlined className="text-8xl text-blue-600 transform rotate-12" />
          </div>
          <div className="relative z-10">
            <Statistic
              title={
                <Text strong className={classNames(
                  isDark ? "text-gray-300/70" : "text-gray-700/50"
                )}>
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
        <Card className={classNames(
          "transition-all duration-300 bg-gradient-to-br relative overflow-hidden group shadow-sm",
          isDark 
            ? "from-green-900/50 via-gray-900 to-green-900/50" 
            : "from-green-50 via-white to-green-50"
        )}>
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <EyeOutlined className="text-8xl text-green-600 transform rotate-12" />
          </div>
          <div className="relative z-10">
            <Statistic
              title={
                <Text strong className={classNames(
                  isDark ? "text-gray-300/70" : "text-gray-700/50"
                )}>
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
        <Card className={classNames(
          "transition-all duration-300 bg-gradient-to-br relative overflow-hidden group shadow-sm",
          isDark 
            ? "from-gray-700/50 via-gray-900 to-gray-700/50" 
            : "from-gray-50 via-white to-gray-50"
        )}>
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <EyeInvisibleOutlined className="text-8xl text-gray-600 transform rotate-12" />
          </div>
          <div className="relative z-10">
            <Statistic
              title={
                <Text strong className={classNames(
                  isDark ? "text-gray-300/70" : "text-gray-700/50"
                )}>
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
        <Card className={classNames(
          "transition-all duration-300 bg-gradient-to-br relative overflow-hidden group shadow-sm",
          isDark 
            ? "from-purple-900/50 via-gray-900 to-purple-900/50" 
            : "from-purple-50 via-white to-purple-50"
        )}>
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <AlertOutlined className="text-8xl text-purple-600 transform rotate-12" />
          </div>
          <div className="relative z-10">
            <Statistic
              title={
                <Text strong className={classNames(
                  isDark ? "text-gray-300/70" : "text-gray-700/50"
                )}>
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
    </ConfigProvider>
  );
};

export default FilterStatistics;