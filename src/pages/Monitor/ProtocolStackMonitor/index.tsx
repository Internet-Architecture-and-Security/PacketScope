import React from 'react';
import { useIntl } from 'react-intl';
import {
  Activity,
  Network,
  Zap,
  Layers,
} from 'lucide-react';
import { useTheme, useMonitorReadyStore } from '@/stores/useStore';
import classNames from 'classnames';
import useWebSocketData from './useWebSocketData';
import MetricCard from './MetricCard';
import InteractionCard from './InteractionCard';
import DropRateCard from './DropRateCard';


interface ProtocolStackMonitorProps {
  queryParams: {
    srcip: string;
    dstip: string;
    srcport: number;
    dstport: number;
    ipver?: number;
    protocol?: string;
  } | null;
}

// 主组件
const ProtocolStackMonitor: React.FC<ProtocolStackMonitorProps> = ({ queryParams }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  
  // 获取 ready 状态
  const { isReady, error: readyError, maxAttemptsReached } = useMonitorReadyStore();


  // 使用自定义钩子获取各种数据
  const protocolStackData = useWebSocketData('NumLatencyFrequency', queryParams);
  console.log(protocolStackData, 'NumLatencyFrequency');

  // 如果还在检查 ready 状态或未准备好，显示 loading 或错误状态
  if (!isReady) {
    console.log('[PacketDetails] 显示初始化界面');
    return (
      <div className={classNames(
        "h-full w-full flex items-center justify-center min-w-[500px] border-l",
        isDark
          ? "bg-gray-900 border-gray-700"
          : "bg-gray-50 border-gray-200"
      )}>
        {readyError || maxAttemptsReached ? (
          <div className="flex flex-col items-center gap-5 max-w-sm px-6">
            {/* 错误图标 */}
            <div className={classNames(
              "w-14 h-14 rounded-full flex items-center justify-center",
              isDark ? "bg-red-500/10" : "bg-red-50"
            )}>
              <svg
                className={classNames(
                  "w-7 h-7",
                  isDark ? "text-red-400" : "text-red-500"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* 错误信息 */}
            <div className="text-center space-y-1">
              <h3 className={classNames(
                "text-base font-semibold",
                isDark ? "text-gray-100" : "text-gray-900"
              )}>
                服务初始化失败
              </h3>
              <p className={classNames(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                {readyError || '服务没有开启或网络故障'}
              </p>
            </div>

            {/* 重试按钮 */}
            <button
              onClick={() => {
                console.log('[PacketDetails] 用户点击重试');
                useMonitorReadyStore.getState().resetPolling();
              }}
              className={classNames(
                "px-5 py-2 rounded-md font-medium text-sm transition-all duration-200",
                "flex items-center gap-2",
                isDark
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新尝试
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* 加载动画圆点 */}
            <div className="flex gap-1.5">
              <span
                className={classNames(
                  "w-2 h-2 rounded-full animate-pulse",
                  isDark ? "bg-blue-500" : "bg-blue-500"
                )}
                style={{ animationDelay: '0ms' }}
              />
              <span
                className={classNames(
                  "w-2 h-2 rounded-full animate-pulse",
                  isDark ? "bg-blue-500" : "bg-blue-500"
                )}
                style={{ animationDelay: '150ms' }}
              />
              <span
                className={classNames(
                  "w-2 h-2 rounded-full animate-pulse",
                  isDark ? "bg-blue-500" : "bg-blue-500"
                )}
                style={{ animationDelay: '300ms' }}
              />
            </div>

            {/* 加载文本 */}
            <span className={classNames(
              "text-sm font-medium",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              正在连接服务
            </span>
          </div>
        )}
      </div>
    );
  }

  // 没有查询参数时的提示
  if (!queryParams) {
    return (
      <div className={classNames(
        "h-full w-full flex items-center justify-center",
        isDark ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="text-center">
          <Activity className={classNames(
            "w-12 h-12 mx-auto mb-4",
            isDark ? "text-gray-600" : "text-gray-300"
          )} />
          <div className={classNames(
            "text-lg font-semibold mb-2",
            isDark ? "text-gray-300" : "text-slate-500"
          )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.title' })}</div>
          <div className={classNames(
            "text-sm",
            isDark ? "text-gray-500" : "text-slate-400"
          )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.selectConnection' })}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={classNames(
      "h-full w-full flex flex-col min-w-[500px]",
      isDark ? "bg-gray-900" : "bg-gray-50"
    )}>
      {/* 工具栏 */}
      <div className={classNames(
        "border-b px-4 py-3 flex-shrink-0",
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-600" size={20} />
            <div className={classNames(
              "font-semibold text-base",
              isDark ? "text-gray-100" : "text-slate-900"
            )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.title' })}</div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="p-4 space-y-3 h-full overflow-y-auto flex-1">
        {/* 协议栈层级 */}
        <div className="space-y-3">
          {/* 传输层 */}
          <MetricCard
            title={intl.formatMessage({ id: 'ProtocolStackMonitor.transportLayer' })}
            icon={Zap}
            color="text-purple-500"
            queryParams={queryParams}
            data={protocolStackData.data.layers.trans}
            history={protocolStackData.history.layers.trans}
            loading={protocolStackData.loading}
            error={protocolStackData.error}
            isReady={protocolStackData.isReady}
            fields={[
              {
                key: 'num',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.packets' }),
                color: isDark ? 'text-gray-100' : 'text-gray-900',
              },
              {
                key: 'pps',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.pps' }),
                color: isDark ? 'text-purple-400' : 'text-purple-600',
                format: (val) => parseFloat(val).toFixed(3) + '/s',
              },
            ]}
            chartConfigs={[
              {
                key: 'packets',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.packets' }),
                dataKey: 'num',
                sendColor: '#3b82f6',
                receiveColor: '#10b981',
              },
              {
                key: 'pps',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.pps' }),
                dataKey: 'pps',
                sendColor: '#3b82f6',
                receiveColor: '#10b981',
              },
            ]}
          />

          {/* 网络层 */}
          <MetricCard
            title={intl.formatMessage({ id: 'ProtocolStackMonitor.networkLayer' })}
            icon={Network}
            color="text-green-500"
            queryParams={queryParams}
            data={protocolStackData.data.layers.network}
            history={protocolStackData.history.layers.network}
            loading={protocolStackData.loading}
            error={protocolStackData.error}
            isReady={protocolStackData.isReady}
            fields={[
              {
                key: 'num',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.packets' }),
                color: isDark ? 'text-gray-100' : 'text-gray-900',
              },
              {
                key: 'pps',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.pps' }),
                color: 'text-green-600',
                format: (val) => parseFloat(val).toFixed(3) + '/s',
              },
            ]}
            chartConfigs={[
              {
                key: 'packets',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.packets' }),
                dataKey: 'num',
                sendColor: '#3b82f6',
                receiveColor: '#10b981',
              },
              {
                key: 'pps',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.pps' }),
                dataKey: 'pps',
                sendColor: '#3b82f6',
                receiveColor: '#10b981',
              },
            ]}
          />

          {/* 链路层 */}
          <MetricCard
            title={intl.formatMessage({ id: 'ProtocolStackMonitor.linkLayer' })}
            icon={Layers}
            color="text-blue-500"
            queryParams={queryParams}
            data={protocolStackData.data.layers.link}
            history={protocolStackData.history.layers.link}
            loading={protocolStackData.loading}
            error={protocolStackData.error}
            isReady={protocolStackData.isReady}
            fields={[
              {
                key: 'num',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.packets' }),
                color: isDark ? 'text-gray-100' : 'text-gray-900',
              },
              {
                key: 'pps',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.pps' }),
                color: isDark ? 'text-blue-400' : 'text-blue-600',
                format: (val) => parseFloat(val).toFixed(3) + '/s',
              },
            ]}
            chartConfigs={[
              {
                key: 'packets',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.packets' }),
                dataKey: 'num',
                sendColor: '#3b82f6',
                receiveColor: '#10b981',
              },
              {
                key: 'pps',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.pps' }),
                dataKey: 'pps',
                sendColor: '#3b82f6',
                receiveColor: '#10b981',
              },
            ]}
          />
        </div>

        {/* 跨层交互 */}
        <div className={classNames(
          "rounded-lg border p-4",
          isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center mb-4">
            <div className={classNames(
              "text-sm font-medium",
              isDark ? "text-gray-100" : "text-gray-900"
            )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.crossLayerInteraction' })}</div>
          </div>

          <div className="space-y-3">
            {/* 网络层 ← → 链路层 */}
            <InteractionCard
              title={intl.formatMessage({ id: 'ProtocolStackMonitor.networkToLink' })}
              fromIcon={Network}
              toIcon={Layers}
              fromColor="text-green-500"
              toColor="text-blue-500"
              websocketType="LinkNetworkLatencyFrequency"
              queryParams={queryParams}
              data={protocolStackData.data.crosslayers.linknetwork}
              history={protocolStackData.history.crosslayers.linknetwork}
              loading={protocolStackData.loading}
              error={protocolStackData.error}
              isReady={protocolStackData.isReady}
              gradientClass="bg-gradient-to-r from-green-50 to-blue-50"
              borderClass="border-green-100"
              fields={[
                {
                  key: 'freq',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.frequency' }),
                  color: 'text-green-600',
                  format: (val) => `${parseFloat(val).toFixed(3)}/s`,
                },
                {
                  key: 'lat',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.latency' }),
                  color: isDark ? 'text-red-400' : 'text-red-600',
                  format: (val) => `${parseFloat(val).toFixed(3)}ms`,
                },
              ]}
              chartConfigs={[
                {
                  key: 'frequency',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.frequency' }),
                  dataKey: 'freq',
                  sendColor: '#3b82f6',
                  receiveColor: '#10b981',
                },
                {
                  key: 'LAT(ms)',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.latency' }),
                  dataKey: 'lat',
                  sendColor: '#ef4444',
                  receiveColor: '#f59e0b',
                },
              ]}
            />

            {/* 传输层 ← → 网络层 */}
            <InteractionCard
              title={intl.formatMessage({ id: 'ProtocolStackMonitor.transportToNetwork' })}
              fromIcon={Zap}
              toIcon={Network}
              fromColor="text-purple-500"
              toColor="text-green-500"
              websocketType="NetworkTransLatencyFrequency"
              queryParams={queryParams}
              data={protocolStackData.data.crosslayers.networktrans}
              history={protocolStackData.history.crosslayers.networktrans}
              loading={protocolStackData.loading}
              error={protocolStackData.error}
              isReady={protocolStackData.isReady}
              gradientClass="bg-gradient-to-r from-purple-50 to-green-50"
              borderClass="border-purple-100"
              fields={[
                {
                  key: 'freq',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.frequency' }),
                  color: isDark ? 'text-purple-400' : 'text-purple-600',
                  format: (val) => `${parseFloat(val).toFixed(3)}/s`,
                },
                {
                  key: 'lat',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.latency' }),
                  color: isDark ? 'text-red-400' : 'text-red-600',
                  format: (val) => `${parseFloat(val).toFixed(3)}ms`,
                },
              ]}
              chartConfigs={[
                {
                  key: 'frequency',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.frequency' }),
                  dataKey: 'freq',
                  sendColor: '#3b82f6',
                  receiveColor: '#10b981',
                },
                {
                  key: 'LAT(ms)',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.latency' }),
                  dataKey: 'lat',
                  sendColor: '#ef4444',
                  receiveColor: '#f59e0b',
                },
              ]}
            />

            {/* 传输层 ← → 链路层 */}
            <InteractionCard
              title={intl.formatMessage({ id: 'ProtocolStackMonitor.transportToLink' })}
              fromIcon={Zap}
              toIcon={Layers}
              fromColor="text-purple-500"
              toColor="text-blue-500"
              websocketType="LinkTransLatencyFrequency"
              queryParams={queryParams}
              data={protocolStackData.data.crosslayers.linktrans}
              history={protocolStackData.history.crosslayers.linktrans}
              loading={protocolStackData.loading}
              error={protocolStackData.error}
              isReady={protocolStackData.isReady}
              gradientClass="bg-gradient-to-r from-purple-50 to-blue-50"
              borderClass="border-purple-100"
              fields={[
                {
                  key: 'freq',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.frequency' }),
                  color: 'text-amber-600',
                  format: (val) => `${parseFloat(val).toFixed(3)}/s`,
                },
                {
                  key: 'lat',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.latency' }),
                  color: isDark ? 'text-red-400' : 'text-red-600',
                  format: (val) => `${parseFloat(val).toFixed(3)}ms`,
                },
              ]}
              chartConfigs={[
                {
                  key: 'frequency(s)',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.frequency' }),
                  dataKey: 'freq',
                  sendColor: '#3b82f6',
                  receiveColor: '#10b981',
                },
                {
                  key: 'LAT(ms)',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.latency' }),
                  dataKey: 'lat',
                  sendColor: '#ef4444',
                  receiveColor: '#f59e0b',
                },
              ]}
            />
            <DropRateCard
              data={protocolStackData.data.drop}
              history={protocolStackData.history.drop}
              loading={protocolStackData.loading}
              error={protocolStackData.error}
              isReady={protocolStackData.isReady}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtocolStackMonitor;