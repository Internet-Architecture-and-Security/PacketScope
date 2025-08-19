import React, { useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { AlertCircle, ArrowUp, ArrowDown, ArrowRight, LucideIcon } from 'lucide-react';
import * as echarts from 'echarts';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import { LoadingInteractionCard } from './LoadingInteractionCard';

interface QueryParams {
  srcip: string;
  dstip: string;
  srcport: number;
  dstport: number;
  ipver?: number;
  protocol?: string;
}

interface CrossLayerData {
  send: { lat: number; freq: number; timestamp: string } | null;
  receive: { lat: number; freq: number; timestamp: string } | null;
}

interface CrossLayerHistory {
  send: Array<{ lat: number; freq: number; timestamp: string }>;
  receive: Array<{ lat: number; freq: number; timestamp: string }>;
}

interface Field {
  key: string;
  label: string;
  color?: string;
  format?: (val: any) => string;
}

interface ChartConfig {
  key: string;
  label: string;
  dataKey: string;
  sendColor: string;
  receiveColor: string;
}

interface InteractionCardProps {
  title: string;
  fromIcon: LucideIcon;
  toIcon: LucideIcon;
  fromColor: string;
  toColor: string;
  websocketType: string;
  fields: Field[];
  chartConfigs: ChartConfig[];
  gradientClass: string;
  borderClass: string;
  queryParams: QueryParams | null;
  data: CrossLayerData;
  history: CrossLayerHistory;
  loading: boolean;
  error: string | null;
  isReady: boolean;
}

// 交互指标组件 - 完全按照原始逻辑
export const InteractionCard: React.FC<InteractionCardProps> = ({
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

  
  // 如果正在加载且没有数据，显示loading状态 - 原始逻辑
  if (!isReady || loading) {
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
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chartsRef = useRef<Record<string, echarts.ECharts>>({});

  // 初始化和更新图表逻辑 - 原始逻辑
  useEffect(() => {
    chartConfigs.forEach((config) => {
      ['send', 'receive'].forEach((direction) => {
        const key = `${config.key}_${direction}`;
        if (chartRefs.current[key] && !chartsRef.current[key]) {
          chartsRef.current[key] = echarts.init(chartRefs.current[key]!);
        }
      });
    });
  }, [chartConfigs]);

  useEffect(() => {
    // 更新发送数据图表
    if (history.send.length > 0) {
      chartConfigs.forEach((config) => {
        const chart = chartsRef.current[`${config.key}_send`];
        if (chart) {
          const chartData = history.send.map((item: any) => {
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
          const chartData = history.receive.map((item: any) => {
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
  }, [history, chartConfigs, isDark]);

  const getFieldValue = (data: any, fieldKey: string) => {
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
      <div className={classNames(
        "rounded-lg border p-4",
        isDark ? "bg-gray-800 border-red-400/50" : "bg-white border-red-200"
      )}>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className={classNames(
                isDark ? "text-red-400" : "text-red-500"
              )}  size={16} />
          <span className={classNames(
            "text-sm font-medium",
            isDark ? "text-red-400" : "text-red-700"
          )}>{title} - {intl.formatMessage({ id: 'ProtocolStackMonitor.connectionFailed' })}</span>
        </div>
        <div className={classNames(
          "text-xs",
          isDark ? "text-red-400/80" : "text-red-600"
        )}>{error}</div>
      </div>
    );
  }

  return (
    <div className={classNames(
      "rounded border",
      isDark ? "bg-gray-800 border-gray-600" : gradientClass,
      isDark ? "" : borderClass
    )}>
      <div className={classNames(
        "flex items-center gap-2 p-3 border-b border-gray-100",
        isDark ? "border-gray-600" : ""
      )}>
        <FromIcon className={fromColor} size={12} />
        <ArrowRight className={classNames(
          isDark ? "text-gray-500" : "text-gray-400"
        )} size={10} />
        <ToIcon className={toColor} size={12} />
        <span className={classNames(
          "text-xs font-medium ml-2",
          isDark ? "text-gray-300" : "text-gray-700"
        )}>{title}</span>
      </div>

      {/* 发送数据组 */}
      <div className={classNames(
        "border-b border-gray-100",
        isDark ? "border-gray-600" : ""
      )}>
        <div className="flex">
          <div className="flex-1 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUp className="text-blue-500" size={12} />
              <span className={classNames(
                "text-xs font-medium",
                isDark ? "text-gray-300" : "text-gray-700"
              )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.send' })}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <div className={classNames(
                    "text-xs",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}>{field.label}</div>
                  <div className={classNames(
                    "text-lg font-bold",
                    field.color || (isDark ? "text-gray-200" : "text-gray-900")
                  )}>
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
                className={classNames(
                  "w-24 h-20 p-1",
                  index < chartConfigs.length - 1 ? (isDark ? "border-r border-gray-600" : "border-r border-gray-100") : ""
                )}
              >
                <div className={classNames(
                  "text-xs mb-1",
                  isDark ? "text-gray-500" : "text-gray-400"
                )}>{config.label}</div>
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
              <span className={classNames(
                "text-xs font-medium",
                isDark ? "text-gray-300" : "text-gray-700"
              )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.receive' })}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <div className={classNames(
                    "text-xs",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}>{field.label}</div>
                  <div className={classNames(
                    "text-lg font-bold",
                    field.color || (isDark ? "text-gray-200" : "text-gray-900")
                  )}>
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
                className={classNames(
                  "w-24 h-20 p-1",
                  index < chartConfigs.length - 1 ? (isDark ? "border-r border-gray-600" : "border-r border-gray-100") : ""
                )}
              >
                <div className={classNames(
                  "text-xs mb-1",
                  isDark ? "text-gray-500" : "text-gray-400"
                )}>{config.label}</div>
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