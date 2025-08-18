import React, { useState, useEffect, useRef } from 'react';
import { Spin } from 'antd';
import { useIntl } from 'react-intl';
import {
  Activity,
  AlertCircle,
  Network,
  Play,
  Pause,
  RotateCcw,
  Layers,
  Zap,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowDownCircle,
} from 'lucide-react';
import * as echarts from 'echarts';

// 自定义WebSocket钩子
const useWebSocketData = (websocketType, queryParams) => {
  const intl = useIntl();
  const [data, setData] = useState({
    layers: {
      link: { send: null, receive: null },
      network: { send: null, receive: null },
      trans: { send: null, receive: null },
    },
    crosslayers: {
      linknetwork: { send: null, receive: null },
      networktrans: { send: null, receive: null },
      linktrans: { send: null, receive: null },
    },
    drop: null,
  });

  const [history, setHistory] = useState({
    layers: {
      link: { send: [], receive: [] },
      network: { send: [], receive: [] },
      trans: { send: [], receive: [] },
    },
    crosslayers: {
      linknetwork: { send: [], receive: [] },
      networktrans: { send: [], receive: [] },
      linktrans: { send: [], receive: [] },
    },
    drop: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const wsRef = useRef(null);

  const MAX_HISTORY = 15;

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket('ws://127.0.0.1:5000');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`${websocketType} WebSocket连接已建立`);
      setLoading(true);
      setError(null);
      setIsReady(false);

      const message = {
        type: websocketType,
        params: {
          ipv4: queryParams?.ipver === 4,
          ipv6: queryParams?.ipver === 6,
          sip: queryParams?.srcip,
          dip: queryParams?.dstip,
          sport: Number(queryParams?.srcport),
          dport: Number(queryParams?.dstport),
          protocol: queryParams?.protocol,
        },
      };
      ws.send(JSON.stringify(message));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.error) {
          setError(response.error);
          setLoading(false);
          return;
        }
        console.log('没有更新了么-v-onmessage', loading, isReady);
        if (response.type === websocketType && response.data) {
          const newData = JSON.parse(response.data);
          const timestamp = new Date().toLocaleTimeString();

          // 层级数据处理
          if (newData.layer && newData.direction) {
            const { layer, direction, num, 'pps(s)': pps } = newData;
            if (['link', 'network', 'trans'].includes(layer) && ['send', 'receive'].includes(direction)) {
              setData((prev) => ({
                ...prev,
                layers: {
                  ...prev.layers,
                  [layer]: {
                    ...prev.layers[layer],
                    [direction]: { num, pps, timestamp },
                  },
                },
              }));
              setHistory((prev) => ({
                ...prev,
                layers: {
                  ...prev.layers,
                  [layer]: {
                    ...prev.layers[layer],
                    [direction]: [...prev.layers[layer][direction], { num, pps, timestamp }].slice(-MAX_HISTORY),
                  },
                },
              }));
            }
          }

          // 夸层数据处理
          if (newData.crosslayer && newData.direction) {
            const { crosslayer, direction, 'LAT(ms)': lat, 'frequency(s)': freq } = newData;
            if (['linknetwork', 'networktrans', 'linktrans'].includes(crosslayer) && ['send', 'receive'].includes(direction)) {
              setData((prev) => ({
                ...prev,
                crosslayers: {
                  ...prev.crosslayers,
                  [crosslayer]: {
                    ...prev.crosslayers[crosslayer],
                    [direction]: { lat, freq, timestamp },
                  },
                },
              }));
              setHistory((prev) => ({
                ...prev,
                crosslayers: {
                  ...prev.crosslayers,
                  [crosslayer]: {
                    ...prev.crosslayers[crosslayer],
                    [direction]: [...prev.crosslayers[crosslayer][direction], { lat, freq, timestamp }].slice(-MAX_HISTORY),
                  },
                },
              }));
            }
          }

          // 丢包率数据处理
          if (Object.prototype.hasOwnProperty.call(newData, 'drop(s)')) {
            const drop = newData['drop(s)'];
            setData((prev) => ({
              ...prev,
              drop: { drop, timestamp },
            }));
            setHistory((prev) => ({
              ...prev,
              drop: [...prev.drop, { drop, timestamp }].slice(-MAX_HISTORY),
            }));
          }
          if (!isReady) {
            setIsReady(true);
            setLoading(false);
          }
          console.log('没有更新了么--onmessage', loading, isReady);
        }
      } catch (err) {
        console.error(`${websocketType} 数据解析错误:`, err);
        setError(intl.formatMessage({ id: 'ProtocolStackMonitor.dataParsingFailed' }));
        setLoading(false);
      }
    };

    ws.onerror = (error) => {
      console.error(`${websocketType} WebSocket错误:`, error);
      setError(intl.formatMessage({ id: 'ProtocolStackMonitor.connectionFailed' }));
      setLoading(false);
    };

    ws.onclose = () => {
      console.log(`${websocketType} WebSocket连接已关闭`);
      setLoading(false);
    };
  };

  useEffect(() => {
    setLoading(false);
  }, [data]);

  useEffect(() => {
    if (queryParams && queryParams.dstip) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        setLoading(false);
        setError(null);
        setIsReady(false);
        wsRef.current = null;
      }
    };
  }, [queryParams, websocketType]);

  return { data, history, loading, error, isReady };
};

// Loading 组件
const LoadingCard = ({ title, icon: Icon, color }) => {
  const intl = useIntl();
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-gray-50 border-b border-gray-100">
        <Icon className={color} size={16} />
        <span className="text-sm font-medium text-gray-900">{title}</span>
      </div>
      <div className="flex items-center justify-center h-48">
        <div className="flex items-center justify-center h-full">
          <Spin />
          <span className="ml-2 text-slate-500">{intl.formatMessage({ id: 'ProtocolStackMonitor.loading' })}</span>
        </div>
      </div>
    </div>
  );
};

// Loading 组件 - 交互卡片版本
const LoadingInteractionCard = ({ title, fromIcon: FromIcon, toIcon: ToIcon, fromColor, toColor, gradientClass, borderClass }) => {
  const intl = useIntl();
  
  return (
    <div className={`${gradientClass} rounded border ${borderClass}`}>
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <FromIcon className={fromColor} size={12} />
        <ArrowRight className="text-gray-400" size={10} />
        <ToIcon className={toColor} size={12} />
        <span className="text-xs font-medium text-gray-700 ml-2">{title}</span>
      </div>
      <div className="flex items-center justify-center h-32">
        <div className="flex items-center justify-center h-full">
          <Spin />
          <span className="ml-2 text-slate-500">{intl.formatMessage({ id: 'ProtocolStackMonitor.loading' })}</span>
        </div>
      </div>
    </div>
  );
};

const DropRateCard = ({ data, history, loading, error, isReady }) => {
  const intl = useIntl();
  
  if (loading) {
    return (
      <div key="loading" className="w-full bg-white rounded-md border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="text-red-500" size={16} />
            <span className="text-sm font-medium text-gray-900">{intl.formatMessage({ id: 'ProtocolStackMonitor.dropRate' })}</span>
          </div>
          <span className="text-base font-semibold text-red-500">--</span>
        </div>
        <div className="flex items-center justify-center h-16 w-full">
          <Spin />
          <span className="ml-2 text-slate-500">{intl.formatMessage({ id: 'ProtocolStackMonitor.loading' })}</span>
        </div>
      </div>
    );
  }

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // 初始化图表
  useEffect(() => {
    if (!chartRef.current || chartInstanceRef.current) return;
    chartInstanceRef.current = echarts.init(chartRef.current);
  }, []);

  // 处理loading状态
  useEffect(() => {
    if (loading) {
      // loading时隐藏图表或清空图表内容
      if (chartInstanceRef.current) {
        chartInstanceRef.current.clear(); // 清空图表内容但保留实例
      }
      return;
    }

    // loading结束后重新初始化图表
    if (!loading && !chartInstanceRef.current && chartRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
    }
  }, [loading, isReady]);

  // 容器大小变化时自适应
  useEffect(() => {
    if (!chartRef.current || !chartInstanceRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.resize();
      }
    });

    resizeObserver.observe(chartRef.current);

    // 清理函数
    return () => {
      resizeObserver.disconnect();
    };
  }, [chartInstanceRef.current]);

  // 更新图表数据
  useEffect(() => {
    if (!chartInstanceRef.current || !history?.length) return;

    const values = history.map((d) => parseFloat(d.drop) || 0);
    const timestamps = history.map((d) => d.timestamp);

    chartInstanceRef.current.setOption({
      grid: { top: 5, bottom: 5, left: 5, right: 5 },
      xAxis: { type: 'category', show: false, data: timestamps },
      yAxis: { type: 'value', show: false, min: 0, max: 1 },
      series: [
        {
          data: values,
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#ef4444', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#ef444480' },
              { offset: 1, color: '#ef444410' },
            ]),
          },
        },
      ],
    });
  }, [history]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  const dropValue = data ? `${(parseFloat(data.drop) * 100).toFixed(2)}%` : data === null ? '--' : data.drop;

  return (
    <div key="container" className="w-full bg-white rounded-md border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ArrowDownCircle className="text-red-500" size={16} />
          <span className="text-sm font-medium text-gray-900">{intl.formatMessage({ id: 'ProtocolStackMonitor.dropRate' })}</span>
        </div>
        <span className="text-base font-semibold text-red-500">{dropValue}</span>
      </div>
      <div ref={chartRef} className={`w-full h-16`} />
    </div>
  );
};

// 单个指标组件
const MetricCard = ({ title, icon: Icon, color, fields, chartConfigs, data, history, loading, error, queryParams, isReady }) => {
  const intl = useIntl();
  
  console.log('MetricCard', data, loading, isReady);
  // 如果正在加载且没有数据，显示loading状态
  if (loading) {
    return <LoadingCard title={title} icon={Icon} color={color} />;
  }
  const chartRefs = useRef({});
  const chartsRef = useRef({});

  // 初始化图表
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

  // 更新图表
  useEffect(() => {
    if (history.send.length > 0) {
      chartConfigs.forEach((config) => {
        const chart = chartsRef.current[`${config.key}_send`];
        if (chart) {
          const chartData = history.send.map((item) => {
            const keys = [config.dataKey];
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

    if (history.receive.length > 0) {
      chartConfigs.forEach((config) => {
        const chart = chartsRef.current[`${config.key}_receive`];
        if (chart) {
          const chartData = history.receive.map((item) => {
            const keys = [config.dataKey];
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

  // 获取字段值
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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-gray-50 border-b border-gray-100">
        <Icon className={color} size={16} />
        <span className="text-sm font-medium text-gray-900">{title}</span>
      </div>

      {/* 发送数据组 */}
      <div className="border-b border-gray-100">
        <div className="flex">
          <div className="flex-1 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUp className="text-blue-500" size={14} />
              <span className="text-xs font-medium text-gray-700 mr-5">{intl.formatMessage({ id: 'ProtocolStackMonitor.send' })}</span>
              {queryParams && (
                <>
                  <span className="text-xs text-gray-500">
                    {queryParams.srcip}:{queryParams.srcport}
                  </span>
                  <ArrowRight className="text-gray-400" size={12} />
                  <span className="text-xs text-gray-500">
                    {queryParams.dstip}:{queryParams.dstport}
                  </span>
                </>
              )}
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
          <div className="flex pt-6 pr-1">
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
              <ArrowDown className="text-green-500" size={14} />
              <span className="text-xs font-medium text-gray-700">{intl.formatMessage({ id: 'ProtocolStackMonitor.receive' })}</span>
              {queryParams && (
                <>
                  <span className="text-xs text-gray-500">
                    {queryParams.dstip}:{queryParams.dstport}
                  </span>
                  <ArrowRight className="text-gray-400" size={12} />
                  <span className="text-xs text-gray-500">
                    {queryParams.srcip}:{queryParams.srcport}
                  </span>
                </>
              )}
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
          <div className="flex pt-6 pr-1">
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
