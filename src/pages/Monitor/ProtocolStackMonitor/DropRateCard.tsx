import React, { useRef, useEffect } from 'react';
import { Spin } from 'antd';
import { useIntl } from 'react-intl';
import { ArrowDownCircle } from 'lucide-react';
import * as echarts from 'echarts';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface DropData {
  drop: number;
  timestamp: string;
}

interface DropRateCardProps {
  data: DropData | null;
  history: Array<{ drop: number; timestamp: string }>;
  loading: boolean;
  error: string | null;
  isReady: boolean;
}

export const DropRateCard: React.FC<DropRateCardProps> = ({ data, history, loading, error, isReady }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  console.log('Chart with data:', data, history, loading, error, isReady);

  // 初始化图表
  useEffect(() => {
    if (loading || !chartRef.current) return;

    // 如果图表实例已存在，先销毁
    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose();
      chartInstanceRef.current = null;
    }

    // 创建新的图表实例
    chartInstanceRef.current = echarts.init(chartRef.current);
    console.log('Chart initialized', chartInstanceRef.current, chartRef.current);

    // 容器大小变化时自适应
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.resize();
      }
    });

    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    // 清理函数
    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, [loading]); // 只依赖 loading 状态

  // 更新图表数据
  useEffect(() => {
    if (loading || !chartInstanceRef.current || !history || history.length === 0) {
      console.log('Skipping chart update:', { loading, hasChart: !!chartInstanceRef.current, historyLength: history?.length });
      return;
    }

    console.log('Chart Updating chart with data:', history);
    
    const values = history.map((d) => parseFloat(String(d.drop)) || 0);
    const timestamps = history.map((d) => d.timestamp);

    // 确保数据有效
    if (values.length === 0) {
      console.log('No valid data for chart');
      return;
    }

    try {
      chartInstanceRef.current.setOption({
        grid: { 
          top: 10, 
          bottom: 10, 
          left: 10, 
          right: 10, 
          backgroundColor: 'transparent' 
        },
        xAxis: { 
          type: 'category', 
          show: false, 
          data: timestamps 
        },
        yAxis: { 
          type: 'value', 
          show: false, 
          min: 0, 
          max: Math.max(1, Math.max(...values) * 1.1) // 动态设置最大值
        },
        series: [
          {
            data: values,
            type: 'line',
            smooth: true,
            symbol: 'none',
            lineStyle: { 
              color: isDark ? '#f87171' : '#ef4444', 
              width: 2 
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: isDark ? '#f8717180' : '#ef444480' },
                { offset: 1, color: isDark ? '#f8717110' : '#ef444410' },
              ]),
            },
          },
        ],
        animation: true,
        animationDuration: 300,
      }, true); // 使用 notMerge: true 确保完全替换配置

      console.log('Chart updated with data:', values, timestamps);
    } catch (error) {
      console.error('Error updating chart:', error);
    }
  }, [loading, history, data, isDark]); // 添加 isDark 依赖以支持主题切换

  // 计算显示值
  const dropValue = data ? `${(parseFloat(String(data.drop)) * 100).toFixed(2)}%` : data === null ? '--' : String(data?.drop);

  // 加载状态
  if (!isReady || loading) {
    return (
      <div key="loading" className={classNames(
        "w-full rounded-md border p-3",
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className={classNames(
              isDark ? "text-red-400" : "text-red-500"
            )} size={16} />
            <span className={classNames(
              "text-sm font-medium",
              isDark ? "text-gray-100" : "text-gray-900"
            )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.dropRate' })}</span>
          </div>
          <span className={classNames(
            "text-base font-semibold",
            isDark ? "text-red-400" : "text-red-500"
          )}>--</span>
        </div>
        <div className="flex items-center justify-center h-16 w-full">
          <Spin />
          <span className={classNames(
            "ml-2",
            isDark ? "text-gray-400" : "text-slate-500"
          )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.loading' })}</span>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div key="error" className={classNames(
        "w-full rounded-md border p-3",
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className={classNames(
              isDark ? "text-red-400" : "text-red-500"
            )} size={16} />
            <span className={classNames(
              "text-sm font-medium",
              isDark ? "text-gray-100" : "text-gray-900"
            )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.dropRate' })}</span>
          </div>
          <span className={classNames(
            "text-base font-semibold",
            isDark ? "text-red-400" : "text-red-500"
          )}>--</span>
        </div>
        <div className="flex items-center justify-center h-16 w-full">
          <span className={classNames(
            "text-sm",
            isDark ? "text-red-400" : "text-red-500"
          )}>Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div key="container" className={classNames(
      "w-full rounded-md border p-3",
      isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ArrowDownCircle className={classNames(
            isDark ? "text-red-400" : "text-red-500"
          )} size={16} />
          <span className={classNames(
            "text-sm font-medium",
            isDark ? "text-gray-100" : "text-gray-900"
          )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.dropRate' })}</span>
        </div>
        <span className={classNames(
          "text-base font-semibold",
          isDark ? "text-red-400" : "text-red-500"
        )}>{dropValue}</span>
      </div>
      <div 
        ref={chartRef} 
        className="w-full h-16" 
        style={{ minHeight: '64px' }} // 确保容器有最小高度
      />
    </div>
  );
};

export default DropRateCard;