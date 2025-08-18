import React, { useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { AlertCircle, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import * as echarts from 'echarts';
import LoadingInteractionCard from './LoadingInteractionCard';

// 交互指标组件 - 现在类似于MetricCard
const InteractionCard = ({
  title,
  fromIcon: FromIcon,
  toIcon: ToIcon,
  fromColor,
  toColor,
  websocketType,
  fields,
  chartConfigs,
  gradientClass,
  borderClass,
  queryParams,
  data,
  history,
  loading,
  error,
  isReady,
}) => {
  const intl = useIntl();
  
  // 如果正在加载且没有数据，显示loading状态
  if (loading) {
    return (
      <LoadingInteractionCard
        title={title}
        fromIcon={FromIcon}
        toIcon={ToIcon}
        fromColor={fromColor}
        toColor={toColor}
        gradientClass={gradientClass}
        borderClass={borderClass}
      />
    );
  }
  const chartRefs = useRef({});
  const chartsRef = useRef({});

  // 初始化和更新图表逻辑
  useEffect(() => {
    chartConfigs.forEach((config) => {
      ['send', 'receive'].forEach((direction) => {
        const key = `${config.key}_${direction}`;
        if (chartRefs.current[key] && !chartsRef.current[key]) {
          chartsRef.current[key] = echarts.init(chartRefs.current[key]);
        }
      });
    });
  }, []);

  useEffect(() => {
    // 更新发送数据图表
    if (history.send.length > 0) {
      chartConfigs.forEach((config) => {
        const chart = chartsRef.current[`${config.key}_send`];
        if (chart) {
          const chartData = history.send.map((item) => {
            const keys = config.dataKey.split('.');
            let value = item;
            for (const key of keys) {
              value = value?.[key];
            }
            return parseFloat(value) || 0;
          });

          const option = {
            grid: { top: 5, bottom: 5, left: 5, right: 5 },
            xAxis: {
              type: 'category',
              show: false,
              data: history.send.map((d) => d.timestamp),
            },
            yAxis: { type: 'value', show: false },
            series: [
              {
                data: chartData,
                type: 'line',
                smooth: true,
                symbol: 'none',
                lineStyle: { color: config.sendColor, width: 2 },
                areaStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: config.sendColor + '40' },
                    { offset: 1, color: config.sendColor + '10' },
                  ]),
                },
              },
            ],
          };
          chart.setOption(option);
        }
      });
    }

    // 更新接收数据图表
    if (history.receive.length > 0) {
      chartConfigs.forEach((config) => {
        const chart = chartsRef.current[`${config.key}_receive`];
        if (chart) {
          const chartData = history.receive.map((item) => {
            const keys = config.dataKey.split('.');
            let value = item;
            for (const key of keys) {
              value = value?.[key];
            }
            return parseFloat(value) || 0;
          });

          const option = {
            grid: { top: 5, bottom: 5, left: 5, right: 5 },
            xAxis: {
              type: 'category',
              show: false,
              data: history.receive.map((d) => d.timestamp),
            },
            yAxis: { type: 'value', show: false },
            series: [
              {
                data: chartData,
                type: 'line',
                smooth: true,
                symbol: 'none',
                lineStyle: { color: config.receiveColor, width: 2 },
                areaStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: config.receiveColor + '40' },
                    { offset: 1, color: config.receiveColor + '10' },
                  ]),
                },
              },
            ],
          };
          chart.setOption(option);
        }
      });
    }
  }, [history, chartConfigs]);

  const getFieldValue = (data, fieldKey) => {
    if (!data) return 0;
    const keys = fieldKey.split('.');
    let value = data;
    for (const key of keys) {
      value = value?.[key];
    }
    return parseFloat(value) || 0;
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="text-red-500" size={16} />
          <span className="text-sm font-medium text-red-700">{title} - {intl.formatMessage({ id: 'ProtocolStackMonitor.connectionFailed' })}</span>
        </div>
        <div className="text-xs text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className={`${gradientClass} rounded border ${borderClass}`}>
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <FromIcon className={fromColor} size={12} />
        <ArrowRight className="text-gray-400" size={10} />
        <ToIcon className={toColor} size={12} />
        <span className="text-xs font-medium text-gray-700 ml-2">{title}</span>
      </div>

      {/* 发送数据组 */}
      <div className="border-b border-gray-100">
        <div className="flex">
          <div className="flex-1 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUp className="text-blue-500" size={12} />
              <span className="text-xs font-medium text-gray-700">{intl.formatMessage({ id: 'ProtocolStackMonitor.send' })}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <div className="text-xs text-gray-500">{field.label}</div>
                  <div className={`text-lg font-bold ${field.color || 'text-gray-900'}`}>
                    {field.format ? field.format(getFieldValue(data.send, field.key)) : getFieldValue(data.send, field.key)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex pt-5 pr-1">
            {chartConfigs.map((config, index) => (
              <div
                key={`${config.key}_send`}
                className={`w-24 h-20 p-1 ${index < chartConfigs.length - 1 ? 'border-r border-gray-100' : ''}`}
              >
                <div className="text-xs text-gray-400 mb-1">{config.label}</div>
                <div
                  ref={(el) => (chartRefs.current[`${config.key}_send`] = el)}
                  style={{ width: '100%', height: 'calc(100% - 16px)' }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 接收数据组 */}
      <div>
        <div className="flex">
          <div className="flex-1 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowDown className="text-green-500" size={12} />
              <span className="text-xs font-medium text-gray-700">{intl.formatMessage({ id: 'ProtocolStackMonitor.receive' })}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <div className="text-xs text-gray-500">{field.label}</div>
                  <div className={`text-lg font-bold ${field.color || 'text-gray-900'}`}>
                    {field.format ? field.format(getFieldValue(data.receive, field.key)) : getFieldValue(data.receive, field.key)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex pt-5 pr-1">
            {chartConfigs.map((config, index) => (
              <div
                key={`${config.key}_receive`}
                className={`w-24 h-20 p-1 ${index < chartConfigs.length - 1 ? 'border-r border-gray-100' : ''}`}
              >
                <div className="text-xs text-gray-400 mb-1">{config.label}</div>
                <div
                  ref={(el) => (chartRefs.current[`${config.key}_receive`] = el)}
                  style={{ width: '100%', height: 'calc(100% - 16px)' }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractionCard;