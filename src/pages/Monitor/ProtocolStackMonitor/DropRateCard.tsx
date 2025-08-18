import React, { useRef, useEffect } from 'react';
import { Spin } from 'antd';
import { useIntl } from 'react-intl';
import { ArrowDownCircle } from 'lucide-react';
import * as echarts from 'echarts';

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

export default DropRateCard;