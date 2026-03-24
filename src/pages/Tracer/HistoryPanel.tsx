import React, { useState } from 'react';
import { Button } from 'antd';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import { GlobalOutlined, SyncOutlined, PlusOutlined, MinusOutlined, SendOutlined, FieldTimeOutlined } from '@ant-design/icons';

const HistoryPanel = ({ historyData, onHistoryItemClick, onRefresh, loading, intl }) => {
  const [showHistory, setShowHistory] = useState(true);
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const formatHistoryData = () => {
    return Object.entries(historyData)
      .map(([key, records]) => {
        if (records.length === 0) return;
        const latestRecord = records[0];
        const result = latestRecord.result;

        // 解析 key，格式可能是 "ip-tcp-port" 或 "ip"
        const tcpMatch = key.match(/^(.+)-tcp-(\d+)$/);
        const target = tcpMatch ? tcpMatch[1] : key;
        const protocol = tcpMatch ? 'tcp' : (latestRecord.protocol ?? 'icmp');
        const port = tcpMatch ? tcpMatch[2] : (latestRecord.port ?? null);

        const totalHops = result.length;
        const successfulHops = result.filter((hop) => hop.packet_loss !== '100%').length;
        const avgLatency = result
          .filter((hop) => hop.latency !== null && hop.packet_loss !== '100%')
          .reduce((sum, hop, _, arr) => sum + hop.latency / arr.length, 0);
        const lastValidHop = result
          .slice()
          .reverse()
          .find((hop) => hop.geo !== 'Unknown' && hop.geo !== null && typeof hop.geo === 'object');

        return {
          key,
          target,
          protocol,
          port,
          totalHops,
          successfulHops,
          avgLatency: avgLatency ? avgLatency.toFixed(2) : 0,
          targetLocation: lastValidHop ? lastValidHop.location : 'Unknown',
          timestamp: latestRecord.timestamp,
          hasGeoData: result?.some((hop) => hop.geo !== 'Unknown' && hop.geo !== null && typeof hop.geo === 'object'),
        };
      })
      .filter(Boolean);
  };

  const HistoryList = () => {
    const historyItems = formatHistoryData();

    if (historyItems.length === 0) {
      return (
        <div className={classNames(
          "rounded-lg shadow p-6 text-center border",
          isDark ? "bg-gray-800 border-gray-700 text-gray-400" : "bg-white border-white text-gray-500"
        )}>
          <GlobalOutlined className="text-2xl mb-2" />
          <div>{intl.formatMessage({ id: 'HistoryPanel.noHistoryData' })}</div>
        </div>
      );
    }

    return (
      <div className={classNames(
        "rounded-lg shadow overflow-hidden border",
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-white"
      )}>
        {historyItems.map((item, index) => (
          <div
            key={item.key}
            className={classNames(
              "px-5 py-3.5 border-b cursor-pointer transition-colors duration-200 group",
              isDark ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-blue-50/50",
              index === historyItems.length - 1 ? 'border-b-0' : ''
            )}
            onClick={() => onHistoryItemClick(item.target, item.protocol, item.port)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">

                {/* 第一行：target + badges */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={classNames(
                    "text-sm font-semibold truncate",
                    isDark ? "text-gray-100" : "text-gray-800"
                  )}>
                    {item.target}
                  </span>

                  {/* 协议 badge */}
                  <span className={classNames(
                    "shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border",
                    item.protocol === 'tcp'
                      ? isDark
                        ? "bg-blue-900/30 text-blue-400 border-blue-700/50"
                        : "bg-blue-50 text-blue-600 border-blue-200"
                      : isDark
                        ? "bg-gray-700/50 text-gray-400 border-gray-600"
                        : "bg-gray-100 text-gray-500 border-gray-200"
                  )}>
                    {item.protocol.toUpperCase()}
                    {item.protocol === 'tcp' && item.port ? `:${item.port}` : ''}
                  </span>

                  {/* 可视化 badge */}
                  {item.hasGeoData && (
                    <span className={classNames(
                      "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium",
                      isDark ? "bg-green-900/30 text-green-400" : "bg-green-50 text-green-600"
                    )}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {intl.formatMessage({ id: 'HistoryPanel.visualization' })}
                    </span>
                  )}
                </div>

                {/* 第二行：统计信息 */}
                <div className="flex items-center gap-6 text-xs">
                  <span className={classNames(isDark ? "text-gray-500" : "text-gray-400")}>
                    {intl.formatMessage({ id: 'HistoryPanel.hops' })}
                    <span className={classNames("ml-1 font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
                      {item.successfulHops}/{item.totalHops}
                    </span>
                  </span>

                  <span className={classNames(isDark ? "text-gray-500" : "text-gray-400")}>
                    {intl.formatMessage({ id: 'HistoryPanel.avgLatency' })}
                    <span className={classNames("ml-1 font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
                      {item.avgLatency}ms
                    </span>
                  </span>

                  <span className={classNames(isDark ? "text-gray-500" : "text-gray-400")}>
                    {intl.formatMessage({ id: 'HistoryPanel.targetLocation' })}
                    <span
                      className={classNames(
                        "ml-1 font-medium max-w-32 truncate inline-block align-bottom",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}
                      title={item.targetLocation}
                    >
                      {item.targetLocation}
                    </span>
                  </span>

                  <span className={classNames(isDark ? "text-gray-500" : "text-gray-400")}>
                    {intl.formatMessage({ id: 'HistoryPanel.time' })}
                    <span className={classNames("ml-1 font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
                      {item.timestamp}
                    </span>
                  </span>
                </div>
              </div>

              {/* hover 时显示的追踪按钮 */}
              <Button
                type="text"
                size="small"
                icon={<SendOutlined />}
                className="ml-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onHistoryItemClick(item.target, item.protocol, item.port);
                }}
              >
                {intl.formatMessage({ id: 'HistoryPanel.trace' })}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className={classNames(
          "text-lg font-medium",
          isDark ? "text-gray-200" : "text-gray-900"
        )}>
          <FieldTimeOutlined className="mr-2" />
          {intl.formatMessage({ id: 'HistoryPanel.title' })}
        </h2>
        <div className="flex gap-2">
          <Button
            type="text"
            icon={<SyncOutlined />}
            onClick={onRefresh}
            size="small"
            loading={loading}
          >
            {intl.formatMessage({ id: 'HistoryPanel.refresh' })}
          </Button>
          <Button
            type="text"
            icon={showHistory ? <MinusOutlined /> : <PlusOutlined />}
            onClick={() => setShowHistory(!showHistory)}
            size="small"
          >
            {showHistory
              ? intl.formatMessage({ id: 'HistoryPanel.collapse' })
              : intl.formatMessage({ id: 'HistoryPanel.expand' })}
          </Button>
        </div>
      </div>

      {showHistory && <HistoryList />}
    </div>
  );
};

export default HistoryPanel;