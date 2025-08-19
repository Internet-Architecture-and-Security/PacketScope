import React from 'react';
import { AlertCircle, Cpu } from 'lucide-react';
import { Spin, Button } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface LoadingStateProps {
  currentChainType: string;
}

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

interface EmptyStateProps {
  currentChainType: string;
}

interface NoQueryParamsStateProps {}

export const LoadingState: React.FC<LoadingStateProps> = ({ currentChainType }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className="flex items-center justify-center h-full">
      <Spin />
      <span className={classNames(
        "ml-2",
        isDark ? "text-gray-400" : "text-slate-500"
      )}>
        {intl.formatMessage({ id: 'FunctionCallChainViewer.loadingData' }, { chainType: currentChainType })}
      </span>
    </div>
  );
};

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className={classNames(
      "h-full w-full flex items-center justify-center",
      isDark ? "bg-gray-900" : "bg-gray-50"
    )}>
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <div className={classNames(
          "text-lg font-semibold mb-2",
          isDark ? "text-gray-200" : "text-slate-700"
        )}>
          {intl.formatMessage({ id: 'FunctionCallChainViewer.loadFailed' })}
        </div>
        <div className={classNames(
          "text-sm mb-4",
          isDark ? "text-gray-400" : "text-slate-500"
        )}>
          {error}
        </div>
        <Button onClick={onRetry}>
          {intl.formatMessage({ id: 'FunctionCallChainViewer.retry' })}
        </Button>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<EmptyStateProps> = ({ currentChainType }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className={classNames(
      "flex items-center justify-center h-full",
      isDark ? "text-gray-400" : "text-slate-500"
    )}>
      {intl.formatMessage({ id: 'FunctionCallChainViewer.noData' }, { chainType: currentChainType })}
    </div>
  );
};

export const NoQueryParamsState: React.FC<NoQueryParamsStateProps> = () => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className={classNames(
      "h-full w-full flex items-center justify-center",
      isDark ? "bg-gray-900" : "bg-gray-50"
    )}>
      <div className="text-center">
        <Cpu className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <div className={classNames(
          "text-lg font-semibold mb-2",
          isDark ? "text-gray-300" : "text-slate-500"
        )}>
          {intl.formatMessage({ id: 'FunctionCallChainViewer.analyzerTitle' })}
        </div>
        <div className={classNames(
          "text-sm",
          isDark ? "text-gray-500" : "text-slate-400"
        )}>
          {intl.formatMessage({ id: 'FunctionCallChainViewer.selectConnectionPrompt' })}
        </div>
      </div>
    </div>
  );
};