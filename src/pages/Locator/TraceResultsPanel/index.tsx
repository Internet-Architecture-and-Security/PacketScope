import React from 'react';
import { useIntl } from 'react-intl';
import { DeploymentUnitOutlined } from '@ant-design/icons';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import DraggableWrapper from './DraggableWrapper';
import TraceTable from './TraceTable';

interface TraceResult {
  ip: string;
  latency: string;
  packet_loss?: string;
  asn?: string;
  location?: string;
}

interface TraceResultsPanelProps {
  traceResults?: TraceResult[];
  loading?: boolean;
}

const TraceResultsPanel: React.FC<TraceResultsPanelProps> = ({
  traceResults = [],
  loading = false
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  return (
    <DraggableWrapper>
      <div className={classNames(
        'h-full flex flex-col',
        isDark ? 'text-gray-300' : 'text-gray-200'
      )}>
        {/* 头部信息栏 */}
        {traceResults.length > 0 && (
          <div className={classNames(
            'px-3 py-1.5 border-b',
            isDark ? 'bg-gray-700/50 border-gray-600/40' : 'bg-blue-800/50 border-white/10'
          )}>
            <div className="flex items-center justify-between text-xs">
              <span className={classNames(
                isDark ? 'text-gray-400' : 'text-gray-300'
              )}>
                {intl.formatMessage({ id: 'TraceResultsPanel.totalHops' }, { count: traceResults.length })}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-green-400 text-xs">● {intl.formatMessage({ id: 'TraceResultsPanel.normal' })}</span>
                <span className="text-yellow-400 text-xs">● {intl.formatMessage({ id: 'TraceResultsPanel.highLatency' })}</span>
                <span className="text-red-400 text-xs">● {intl.formatMessage({ id: 'TraceResultsPanel.timeoutShort' })}</span>
              </div>
            </div>
          </div>
        )}

        {/* 表格内容区域 */}
        {traceResults.length === 0 && !loading ? (
          <div className={classNames(
            'text-center py-12',
            isDark ? 'text-gray-400' : 'text-gray-300'
          )}>
            <DeploymentUnitOutlined className="text-3xl mb-3 opacity-30" />
            <p className="text-sm">{intl.formatMessage({ id: 'TraceResultsPanel.noData' })}</p>
            <p className={classNames(
              'text-xs mt-1',
              isDark ? 'text-gray-500' : 'text-gray-400'
            )}>{intl.formatMessage({ id: 'TraceResultsPanel.inputTarget' })}</p>
          </div>
        ) : (
          <TraceTable traceResults={traceResults} loading={loading} />
        )}

        {/* 底部状态栏 */}
        {(traceResults.length > 0 || loading) && (
          <div className={classNames(
            'px-3 py-1.5 border-t flex items-center justify-between',
            isDark ? 'bg-gray-700/50 border-gray-600/40' : 'bg-blue-800/50 border-white/10'
          )}>
            <div className={classNames(
              'text-xs',
              isDark ? 'text-gray-400' : 'text-gray-300'
            )}>
              {loading ? intl.formatMessage({ id: 'TraceResultsPanel.tracingInProgress' }) : intl.formatMessage({ id: 'TraceResultsPanel.traceComplete' })}
            </div>
          </div>
        )}
      </div>
    </DraggableWrapper>
  );
};

export default TraceResultsPanel;