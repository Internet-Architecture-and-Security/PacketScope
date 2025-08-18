import React from 'react';
import { useIntl } from 'react-intl';
import {
  Activity,
  Network,
  Zap,
  Layers,
} from 'lucide-react';
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
  // 使用自定义钩子获取各种数据
  // const packetFlowData = useWebSocketData('PacketFlowCount', queryParams);
  // const linkNetworkData = useWebSocketData('LinkNetworkLatencyFrequency', queryParams);
  // const networkTransData = useWebSocketData('NetworkTransLatencyFrequency', queryParams);
  // const linkTransData = useWebSocketData('LinkTransLatencyFrequency', queryParams);
  const protocolStackData = useWebSocketData('NumLatencyFrequency', queryParams);
  console.log(protocolStackData, 'NumLatencyFrequency');

  // 没有查询参数时的提示
  if (!queryParams) {
    return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-500 mb-2">{intl.formatMessage({ id: 'ProtocolStackMonitor.title' })}</div>
          <div className="text-sm text-slate-400">{intl.formatMessage({ id: 'ProtocolStackMonitor.selectConnection' })}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-50 flex flex-col min-w-[500px]">
      {/* 工具栏 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-600" size={20} />
            <div className="font-semibold text-base text-slate-900">{intl.formatMessage({ id: 'ProtocolStackMonitor.title' })}</div>
          </div>
          {/* 右侧丢包率展示 */}
          {/* <div className="flex text-[12px] items-center gap-2 px-3 py-1 rounded-md bg-red-50 border border-red-100">
            <div className="font-medium text-red-600">丢包率</div>
            <span className="font-semibold text-red-700">
              {protocolStackData?.data?.drop?.drop
                ? `${(parseFloat(protocolStackData.data.drop.drop) * 100).toFixed(2)}%`
                : protocolStackData?.data?.drop === null ? '--' : protocolStackData?.data?.drop?.drop}
            </span>
          </div> */}
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
                color: 'text-gray-900',
              },
              {
                key: 'pps',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.pps' }),
                color: 'text-purple-600',
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
                color: 'text-gray-900',
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
                color: 'text-gray-900',
              },
              {
                key: 'pps',
                label: intl.formatMessage({ id: 'ProtocolStackMonitor.pps' }),
                color: 'text-blue-600',
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
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-4">
            <div className="text-sm font-medium text-gray-900">{intl.formatMessage({ id: 'ProtocolStackMonitor.crossLayerInteraction' })}</div>
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
                  color: 'text-red-600',
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
                  color: 'text-purple-600',
                  format: (val) => `${parseFloat(val).toFixed(3)}/s`,
                },
                {
                  key: 'lat',
                  label: intl.formatMessage({ id: 'ProtocolStackMonitor.latency' }),
                  color: 'text-red-600',
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
                  color: 'text-red-600',
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