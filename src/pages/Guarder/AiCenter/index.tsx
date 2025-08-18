import React, { useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Spin, Flex, Row, Col } from 'antd';
import { Bot } from 'lucide-react';
import { useAIStore } from '@/stores/useAIStore';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import AiStatusAlert from './AiStatusAlert';
import FeatureCards from './FeatureCards';
import CoreFeatures from './CoreFeatures';
import GenerationResult from './GenerationResult';
import AnalysisResult from './AnalysisResult';
import AiConfigModal from './AiConfigModal';
import AiAnalyzeModal from './AiAnalyzeModal';

const AiCenter: React.FC = () => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  // 使用 useAIStore 替换原有状态管理
  const {
    isLoading,
    getConfig,
    isAiConfigValid,
  } = useAIStore();

  // 组件加载时自动加载配置
  useEffect(() => {
    getConfig();
  }, [getConfig]);

  return (
    <div className={classNames(isDark ? "text-gray-300" : "text-gray-900")}>
      <Spin spinning={isLoading} tip={intl.formatMessage({ id: 'AiCenter.loading' })}>
        <Flex vertical gap={20}>
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg">
                <Bot className="text-white" size={30} />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {intl.formatMessage({ id: 'AiCenter.title' })}
                </h1>
                <p className={classNames(isDark ? "text-gray-400" : "text-gray-600")}>
                  {intl.formatMessage({ id: 'AiCenter.description' })}
                </p>
              </div>
            </div>
          </header>

          <AiStatusAlert />

          <FeatureCards />

          <CoreFeatures />

          <GenerationResult />

          <AnalysisResult />
        </Flex>
      </Spin>

      <AiConfigModal />
      <AiAnalyzeModal />
    </div>
  );
};

export default AiCenter;