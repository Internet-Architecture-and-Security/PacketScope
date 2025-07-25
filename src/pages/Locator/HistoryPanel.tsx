import React, { useState } from 'react';
import { Button } from 'antd';
import { GlobalOutlined, SyncOutlined, PlusOutlined, MinusOutlined, SendOutlined, FieldTimeOutlined } from '@ant-design/icons';

const HistoryPanel = ({ historyData, onHistoryItemClick, onRefresh, loading, intl }) => {
  const [showHistory, setShowHistory] = useState(true);
  
  // 格式化历史记录数据
  const formatHistoryData = () => {
    return Object.entries(historyData)
      .map(([target, records]) => {
        if (records.length === 0) {
          return;
        }
        const latestRecord = records[0];
        const result = latestRecord.result;
        const totalHops = result.length;
        const successfulHops = result.filter((hop) => hop.packet_loss !== '100%').length;
        const avgLatency = result
          .filter((hop) => hop.latency !== null && hop.packet_loss !== '100%')
          .reduce((sum, hop, _, arr) => sum + hop.latency / arr.length, 0);

        const lastValidHop = result
          .slice()
          .reverse()
          .find((hop) => hop.geo !== 'Unknown' && hop.geo !== null && typeof hop.geo === 'object');

        const targetLocation = lastValidHop ? lastValidHop.location : 'Unknown';

        return {
          target,
          totalHops,
          successfulHops,
          avgLatency: avgLatency ? avgLatency.toFixed(2) : 0,
          targetLocation,
          timestamp: latestRecord.timestamp,
          hasGeoData: result?.some((hop) => hop.geo !== 'Unknown' && hop.geo !== null && typeof hop.geo === 'object'),
        };
      })
      .filter(Boolean);
  };

  // 历史记录列表组件
  const HistoryList = () => {
    const historyItems = formatHistoryData();
    if (historyItems.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <GlobalOutlined className="text-2xl mb-2" />
          <div>{intl.formatMessage({ id: 'HistoryPanel.noHistoryData' })}</div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {historyItems.map((item, index) => (
          <div
            key={item.target}
            className={`p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors duration-200 group ${
              index === historyItems.length - 1 ? 'border-b-0' : ''
            }`}
            onClick={() => onHistoryItemClick(item.target)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-lg font-semibold text-gray-900">{item.target}</div>
                  {item.hasGeoData && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <GlobalOutlined className="w-3 h-3 mr-1" />
                      {intl.formatMessage({ id: 'HistoryPanel.visualization' })}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">{intl.formatMessage({ id: 'HistoryPanel.hops' })}:</span>
                    <span className="font-medium">
                      {item.successfulHops}/{item.totalHops}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">{intl.formatMessage({ id: 'HistoryPanel.avgLatency' })}:</span>
                    <span className="font-medium">{item.avgLatency}ms</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">{intl.formatMessage({ id: 'HistoryPanel.targetLocation' })}:</span>
                    <span className="font-medium text-ellipsis overflow-hidden whitespace-nowrap max-w-32" title={item.targetLocation}>
                      {item.targetLocation}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">{intl.formatMessage({ id: 'HistoryPanel.time' })}:</span>
                    <span className="font-medium">{item.timestamp}</span>
                  </div>
                </div>
              </div>

              <Button
                type="text"
                icon={<SendOutlined />}
                className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onHistoryItemClick(item.target);
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
        <h2 className="text-lg font-medium">
          <FieldTimeOutlined className="mr-2" />
          {intl.formatMessage({ id: 'HistoryPanel.title' })}
        </h2>
        <div className="flex gap-2">
          <Button type="text" icon={<SyncOutlined />} onClick={onRefresh} size="small" loading={loading}>
            {intl.formatMessage({ id: 'HistoryPanel.refresh' })}
          </Button>
          <Button
            type="text"
            icon={showHistory ? <MinusOutlined /> : <PlusOutlined />}
            onClick={() => setShowHistory(!showHistory)}
            size="small"
          >
            {showHistory ? intl.formatMessage({ id: 'HistoryPanel.collapse' }) : intl.formatMessage({ id: 'HistoryPanel.expand' })}
          </Button>
        </div>
      </div>

      {showHistory && <HistoryList />}
    </div>
  );
};

export default HistoryPanel;