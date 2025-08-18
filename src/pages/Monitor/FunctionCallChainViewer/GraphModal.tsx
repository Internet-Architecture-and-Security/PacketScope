// components/GraphModal.tsx
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Modal, Slider, Button } from 'antd';
import { useIntl } from 'react-intl';
import * as echarts from 'echarts';
import { QueryParams, ChainData, FunctionInfo } from './types';

interface GraphModalProps {
  visible: boolean;
  onClose: () => void;
  chainData: ChainData;
  funcTable: Record<number, FunctionInfo>;
  chainIndex: 'all' | number;
  currentChainType: string;
  receiveChainName: string;
  sendChainName: string;
  queryParams: QueryParams | null;
  fetchChainData?: (params: QueryParams & { count?: number }) => Promise<ChainData | undefined>;
}

export const GraphModal: React.FC<GraphModalProps> = ({
  visible,
  onClose,
  chainData,
  funcTable,
  chainIndex,
  currentChainType,
  receiveChainName,
  sendChainName,
  queryParams,
  fetchChainData
}) => {
  const intl = useIntl();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [durationFilter, setDurationFilter] = useState([0, 10000]);
  const [showDurationFilter, setShowDurationFilter] = useState(false);

  // 计算持续时间范围
  const durationRange = useMemo(() => {
    if (!chainData || (!chainData[receiveChainName] && !chainData[sendChainName])) {
      return [0, 10000];
    }
    
    const functionStats = new Map();
    
    const processChain = (chain: number[][][]) => {
      if (!Array.isArray(chain)) return;
      for (const singleChain of chain) {
        const callStack: Array<{ addr: number; startTime: number }> = [];
        for (let i = 0; i < singleChain.length; i++) {
          const item = singleChain[i] as [number, number, number, number];
          const [timestamp, isReturn, addr] = item;
          const functionKey = `${addr}`;
          if (!isReturn) {
            callStack.push({ addr, startTime: timestamp });
            if (!functionStats.has(functionKey)) {
              functionStats.set(functionKey, { durations: [], totalDuration: 0 });
            }
          } else {
            if (callStack.length > 0) {
              const callInfo = callStack.pop();
              if (callInfo && callInfo.addr === addr) {
                const duration = (timestamp - callInfo.startTime) * 1000000;
                const stats = functionStats.get(functionKey);
                if (stats) {
                  stats.durations.push(duration);
                  stats.totalDuration += duration;
                }
              }
            }
          }
        }
      }
    };
    
    if (chainData[receiveChainName]) {
      processChain(chainData[receiveChainName]);
    }
    if (chainData[sendChainName]) {
      processChain(chainData[sendChainName]);
    }
    
    const avgDurations = Array.from(functionStats.values())
      .map((stats: any) => (stats.durations.length > 0 ? stats.totalDuration / stats.durations.length : 0))
      .filter((duration) => duration > 0);
      
    if (avgDurations.length === 0) return [0, 10000];
    return [Math.floor(Math.min(...avgDurations)), Math.ceil(Math.max(...avgDurations))];
  }, [chainData, receiveChainName, sendChainName]);

  // 初始化持续时间过滤器
  useEffect(() => {
    if (durationRange[0] !== durationRange[1]) {
      setDurationFilter(durationRange);
    }
  }, [durationRange]);

  // 获取函数名
  const getFunctionNameFromItem = useCallback((item: [number, number, number, number]) => {
    const [, , addr] = item;
    const funcName = funcTable?.[addr]?.name || `0x${addr.toString(16)}`;
    return funcName.length > 20 ? funcName.substring(0, 17) + '...' : funcName;
  }, [funcTable]);

  // 获取函数键
  const getFunctionKey = useCallback((item: [number, number, number, number], category: string) => {
    const [, , addr] = item;
    return `${category}_${addr}`;
  }, []);

  // 获取图表配置
  const getGraphOption = useCallback((data?: ChainData, targetChainIndex: 'all' | number = 'all') => {
    const rawData = data || chainData;
    if (!rawData) {
      console.log('No raw data available');
      return { 
        title: { text: 'No Data Available', left: 'center' },
        series: [] 
      };
    }

    const nodes = new Map<string, any>();
    const links: { source: string; target: string; weight: number }[] = [];
    const functionStats = new Map<string, { callCount: number; totalDuration: number; durations: number[] }>();

    const receiveName = intl.formatMessage({ id: 'FunctionCallChainViewer.receive' }) || 'Receive';
    const sendName = intl.formatMessage({ id: 'FunctionCallChainViewer.send' }) || 'Send';

    const CATEGORY_BASE_COLORS = {
      [receiveName]: {
        name: receiveName,
        hue: 210,
        saturation: 70,
      },
      [sendName]: {
        name: sendName,
        hue: 35,
        saturation: 85,
      },
    };

    const processChain = (chain: number[][][], category: string) => {
      if (!Array.isArray(chain)) return;

      const chainsToProcess = targetChainIndex === 'all' ? chain : [chain[targetChainIndex]].filter(Boolean);

      for (const singleChain of chainsToProcess) {
        if (!Array.isArray(singleChain)) continue;
        
        const callStack: Array<{ item: [number, number, number, number]; startTime: number; key: string }> = [];

        for (let i = 0; i < singleChain.length; i++) {
          const item = singleChain[i] as [number, number, number, number];
          const [timestamp, isReturn, addr, threadId] = item;
          const functionKey = getFunctionKey(item, category);

          if (!isReturn) {
            callStack.push({ item, startTime: timestamp, key: functionKey });
            if (!functionStats.has(functionKey)) {
              functionStats.set(functionKey, { callCount: 0, totalDuration: 0, durations: [] });
            }
            const stats = functionStats.get(functionKey)!;
            stats.callCount++;

            if (callStack.length > 1) {
              const callerKey = callStack[callStack.length - 2].key;
              const existingLink = links.find((link) => link.source === callerKey && link.target === functionKey);
              if (existingLink) {
                existingLink.weight++;
              } else {
                links.push({ source: callerKey, target: functionKey, weight: 1 });
              }
            }
          } else {
            if (callStack.length > 0) {
              const callInfo = callStack.pop();
              if (callInfo && callInfo.key === functionKey) {
                const duration = (timestamp - callInfo.startTime) * 1000000;
                const stats = functionStats.get(functionKey)!;
                stats.totalDuration += duration;
                stats.durations.push(duration);
              }
            }
          }
        }
      }
    };

    // 处理链数据
    if (rawData[receiveChainName]) {
      processChain(rawData[receiveChainName], receiveName);
    }
    if (rawData[sendChainName]) {
      processChain(rawData[sendChainName], sendName);
    }

    console.log('Function stats size:', functionStats.size);
    console.log('Links count:', links.length);

    if (functionStats.size === 0) {
      return { 
        title: { text: 'No Function Data Available', left: 'center' },
        series: [] 
      };
    }

    const receiveStats = Array.from(functionStats.entries())
      .filter(([key]) => key.startsWith(receiveName))
      .map(([key, stats]) => ({ key, avgDuration: stats.durations.length > 0 ? stats.totalDuration / stats.durations.length : 0 }));

    const sendStats = Array.from(functionStats.entries())
      .filter(([key]) => key.startsWith(sendName))
      .map(([key, stats]) => ({ key, avgDuration: stats.durations.length > 0 ? stats.totalDuration / stats.durations.length : 0 }));

    const receiveAvgDurations = receiveStats.map((item) => item.avgDuration).filter((d) => d > 0);
    const sendAvgDurations = sendStats.map((item) => item.avgDuration).filter((d) => d > 0);

    const maxReceiveDuration = receiveAvgDurations.length > 0 ? Math.max(...receiveAvgDurations) : 0.001;
    const minReceiveDuration = receiveAvgDurations.length > 0 ? Math.min(...receiveAvgDurations) : 0;
    const maxSendDuration = sendAvgDurations.length > 0 ? Math.max(...sendAvgDurations) : 0.001;
    const minSendDuration = sendAvgDurations.length > 0 ? Math.min(...sendAvgDurations) : 0;

    const getColorByDuration = (avgDuration: number, category: string) => {
      const baseColor = CATEGORY_BASE_COLORS[category];
      const maxDuration = category === receiveName ? maxReceiveDuration : maxSendDuration;
      const minDuration = category === receiveName ? minReceiveDuration : minSendDuration;
      const durationRatio = maxDuration > minDuration ? (avgDuration - minDuration) / (maxDuration - minDuration) : 0.5;
      const lightness = 75 - durationRatio * 40;
      return {
        color: `hsl(${baseColor.hue}, ${baseColor.saturation}%, ${lightness}%)`,
        borderColor: `hsl(${baseColor.hue}, ${baseColor.saturation}%, ${lightness - 15}%)`,
        shadowColor: `hsla(${baseColor.hue}, ${baseColor.saturation}%, ${lightness}%, 0.4)`,
      };
    };

    // 过滤函数统计
    const filteredFunctionStats = new Map();
    functionStats.forEach((stats, functionKey) => {
      const avgDuration = stats.durations.length > 0 ? stats.totalDuration / stats.durations.length : 0;
      if (avgDuration >= durationFilter[0] && avgDuration <= durationFilter[1]) {
        filteredFunctionStats.set(functionKey, stats);
      }
    });

    console.log('Filtered function stats size:', filteredFunctionStats.size);

    // 构建节点
    filteredFunctionStats.forEach((stats, functionKey) => {
      const [category, addr] = functionKey.split('_');
      const item = [0, 0, parseInt(addr), 0] as [number, number, number, number];
      const funcName = getFunctionNameFromItem(item);
      const avgDuration = stats.durations.length > 0 ? stats.totalDuration / stats.durations.length : 0;
      const baseSize = 60;
      const sizeMultiplier = Math.min(Math.log(stats.callCount + 1) * 15, 80);
      const nodeSize = [Math.max(baseSize + sizeMultiplier, funcName.length * 8 + 20), 35 + Math.min(sizeMultiplier / 4, 15)];
      const colorConfig = getColorByDuration(avgDuration, category);
      
      nodes.set(functionKey, {
        id: functionKey,
        name: funcName,
        category: category,
        value: [avgDuration, stats.callCount, stats.totalDuration],
        avgDuration: avgDuration,
        symbol: 'rect',
        symbolSize: nodeSize,
        itemStyle: {
          color: colorConfig.color,
          borderColor: colorConfig.borderColor,
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: colorConfig.shadowColor,
          shadowOffsetY: 2
        },
        label: {
          show: true,
          formatter: (params: any) => {
            const name = params.data.name;
            const count = params.data.value[1];
            const avgDur = params.data.value[0].toFixed(1);
            return `${name}\n${count} calls\n${avgDur}μs`;
          },
          fontSize: 10,
          fontWeight: '500',
          color: '#FFFFFF',
          textBorderColor: 'transparent',
          position: 'inside',
          lineHeight: 14,
        },
        emphasis: {
          focus: 'adjacency',
          itemStyle: {
            shadowBlur: 15,
            shadowColor: colorConfig.shadowColor,
            borderWidth: 3,
            scale: 1.1,
            color: colorConfig.borderColor
          },
          label: {
            fontSize: 11,
            fontWeight: 'bold'
          }
        },
      });
    });

    // 过滤链接
    const filteredNodeKeys = new Set(filteredFunctionStats.keys());
    const filteredLinks = links.filter((link) => filteredNodeKeys.has(link.source) && filteredNodeKeys.has(link.target));
    const maxWeight = filteredLinks.length > 0 ? Math.max(...filteredLinks.map((link) => link.weight)) : 1;
    const minWeight = filteredLinks.length > 0 ? Math.min(...filteredLinks.map((link) => link.weight)) : 1;

    const processedLinks = filteredLinks.map((link) => {
      const weightRatio = maxWeight > minWeight ? (link.weight - minWeight) / (maxWeight - minWeight) : 0.5;
      const sourceCategory = link.source.startsWith(receiveName) ? receiveName : sendName;
      const baseColor = CATEGORY_BASE_COLORS[sourceCategory];
      const lightness = 65 - weightRatio * 25;
      const lineColor = `hsl(${baseColor.hue}, ${baseColor.saturation}%, ${lightness}%)`;
      
      return {
        source: link.source,
        target: link.target,
        value: link.weight,
        lineStyle: {
          color: lineColor,
          width: Math.min(1 + Math.log(link.weight + 1) * 1.5, 6),
          opacity: 0.8,
          curveness: 0.2
        },
        emphasis: {
          lineStyle: {
            width: Math.min(2 + Math.log(link.weight + 1) * 2, 8),
            opacity: 1,
            shadowBlur: 10,
            shadowColor: lineColor,
            color: `hsl(${baseColor.hue}, ${baseColor.saturation}%, ${lightness - 15}%)`
          }
        },
        label: {
          show: link.weight > 1,
          formatter: `${link.weight} calls`,
          fontSize: 8,
          color: '#666',
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderRadius: 2,
          padding: [1, 3]
        },
      };
    });

    // 图例数据
    const legendData = Object.keys(CATEGORY_BASE_COLORS).map((category) => ({
      name: category,
      itemStyle: {
        color: `hsl(${CATEGORY_BASE_COLORS[category].hue}, ${CATEGORY_BASE_COLORS[category].saturation}%, 55%)`,
        borderColor: `hsl(${CATEGORY_BASE_COLORS[category].hue}, ${CATEGORY_BASE_COLORS[category].saturation}%, 40%)`,
        borderWidth: 2
      },
    }));

    // 图表标题
    const chartTitle = targetChainIndex === 'all'
      ? 'Aggregated Function Call Graph'
      : `Chain ${(targetChainIndex as number) + 1} Function Call Graph`;

    const chartSubtext = targetChainIndex === 'all'
      ? `Duration: ${durationFilter[0]}-${durationFilter[1]}μs | Nodes: ${nodes.size} | Links: ${processedLinks.length}`
      : `Thread: ${rawData[currentChainType]?.[targetChainIndex]?.[0]?.[3]} | Nodes: ${nodes.size} | Links: ${processedLinks.length}`;

    console.log('Nodes created:', nodes.size);
    console.log('Processed links:', processedLinks.length);

    const option = {
      backgroundColor: '#f8fafc',
      title: {
        text: chartTitle,
        subtext: chartSubtext,
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#1a202c'
        },
        subtextStyle: {
          fontSize: 14,
          color: '#718096'
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 8,
        textStyle: {
          color: '#2d3748',
          fontSize: 12
        },
        padding: [12, 16],
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const [avgDur, callCount, totalDur] = params.data.value;
            const stats = filteredFunctionStats.get(params.data.id);
            const maxDuration = stats && stats.durations.length > 0 ? Math.max(...stats.durations).toFixed(1) : '0';
            const minDuration = stats && stats.durations.length > 0 ? Math.min(...stats.durations).toFixed(1) : '0';
            return `
              <div style="line-height: 1.6;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #2b6cb0;">
                  ${params.data.category} - ${params.data.name}
                </div>
                <div><strong>Call Count:</strong> ${callCount}</div>
                <div><strong>Total Duration:</strong> ${totalDur.toFixed(1)}μs</div>
                <div><strong>Avg Duration:</strong> ${avgDur.toFixed(1)}μs</div>
                <div><strong>Max Duration:</strong> ${maxDuration}μs</div>
                <div><strong>Min Duration:</strong> ${minDuration}μs</div>
              </div>`;
          } else if (params.dataType === 'edge') {
            return `
              <div style="line-height: 1.6;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #2b6cb0;">
                  Function Call Relationship
                </div>
                <div><strong>Call Frequency:</strong> ${params.data.value}</div>
                <div><strong>Direction:</strong> ${params.data.source.split('_')[1]} → ${params.data.target.split('_')[1]}</div>
              </div>`;
          }
          return '';
        },
      },
      legend: {
        data: legendData,
        top: 80,
        left: 'center',
        orient: 'horizontal',
        itemGap: 30,
        textStyle: {
          fontSize: 14,
          color: '#4a5568'
        },
        icon: 'rect',
        itemWidth: 20,
        itemHeight: 12,
      },
      toolbox: {
        show: true,
        itemGap: 10,
        right: 20,
        top: 20,
        feature: {
          saveAsImage: {
            title: 'Save as Image',
            pixelRatio: 2
          },
        },
      },
      series: [
        {
          name: receiveName,
          type: 'graph',
          layout: 'force',
          roam: true,
          focusNodeAdjacency: true,
          legendHoverLink: false,
          categories: [legendData[0]],
          force: {
            repulsion: [300, 500],
            gravity: 0.1,
            edgeLength: [120, 300],
            friction: 0.3
          },
          edgeSymbol: ['', 'arrow'],
          edgeSymbolSize: [0, 12],
          data: Array.from(nodes.values()).filter((node) => node.category === receiveName),
          links: processedLinks.filter((link) => link.source.startsWith(receiveName) && link.target.startsWith(receiveName)),
          lineStyle: {
            opacity: 0.8,
            curveness: 0.3
          },
          emphasis: {
            focus: 'series',
            blurScope: 'coordinateSystem'
          },
          scaleLimit: {
            min: 0.4,
            max: 3
          },
        },
        {
          name: sendName,
          type: 'graph',
          layout: 'force',
          roam: true,
          focusNodeAdjacency: true,
          legendHoverLink: false,
          categories: [legendData[1]],
          force: {
            repulsion: [300, 500],
            gravity: 0.1,
            edgeLength: [120, 300],
            friction: 0.3
          },
          edgeSymbol: ['', 'arrow'],
          edgeSymbolSize: [0, 12],
          data: Array.from(nodes.values()).filter((node) => node.category === sendName),
          links: processedLinks.filter((link) => link.source.startsWith(sendName) && link.target.startsWith(sendName)),
          lineStyle: {
            opacity: 0.8,
            curveness: 0.3
          },
          emphasis: {
            focus: 'series',
            blurScope: 'coordinateSystem'
          },
          scaleLimit: {
            min: 0.4,
            max: 3
          },
        },
        {
          name: 'Mixed Connection',
          type: 'graph',
          layout: 'force',
          roam: true,
          focusNodeAdjacency: true,
          legendHoverLink: false,
          force: {
            repulsion: [300, 500],
            gravity: 0.1,
            edgeLength: [120, 300],
            friction: 0.3
          },
          edgeSymbol: ['', 'arrow'],
          edgeSymbolSize: [0, 12],
          data: [],
          links: processedLinks.filter((link) => 
            (link.source.startsWith(receiveName) && link.target.startsWith(sendName)) || 
            (link.source.startsWith(sendName) && link.target.startsWith(receiveName))
          ),
          lineStyle: {
            opacity: 0.8,
            curveness: 0.3
          },
          emphasis: {
            focus: 'series',
            blurScope: 'coordinateSystem'
          },
          scaleLimit: {
            min: 0.4,
            max: 3
          },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          disabled: false,
          zoomOnMouseWheel: 'ctrl'
        }
      ],
    };

    console.log('Generated option with series:', option.series.map(s => ({ name: s.name, dataCount: s.data?.length, linkCount: s.links?.length })));
    return option;
  }, [chainData, chainIndex, durationFilter, currentChainType, receiveChainName, sendChainName, getFunctionNameFromItem, getFunctionKey, intl]);

  // 初始化和更新图表
  useEffect(() => {
    if (!visible || !chartRef.current) {
      console.log('Chart not visible or ref not ready');
      return;
    }

    console.log('Initializing chart...', { visible, chainData, chainIndex });

    const timer = setTimeout(() => {
      if (chartInstanceRef.current) {
        console.log('Disposing existing chart');
        chartInstanceRef.current.dispose();
      }
      
      if (chartRef.current) {
        console.log('Creating new chart instance');
        chartInstanceRef.current = echarts.init(chartRef.current);
        const option = getGraphOption(chainData, chainIndex);
        console.log('Setting chart option:', option);
        chartInstanceRef.current.setOption(option);
        
        // 添加调试信息
        const series = option.series;
        console.log('Chart series data:', series.map(s => ({ 
          name: s.name, 
          dataLength: s.data?.length || 0,
          linksLength: s.links?.length || 0 
        })));
        
        const resizeChart = () => {
          console.log('Resizing chart');
          chartInstanceRef.current?.resize();
        };
        window.addEventListener('resize', resizeChart);
        
        return () => {
          window.removeEventListener('resize', resizeChart);
          if (chartInstanceRef.current) {
            chartInstanceRef.current.dispose();
            chartInstanceRef.current = null;
          }
        };
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [visible, chainData, chainIndex, getGraphOption]);

  // 更新图表配置 - 当 durationFilter 改变时
  useEffect(() => {
    if (chartInstanceRef.current && visible) {
      console.log('Updating chart with new duration filter:', durationFilter);
      const option = getGraphOption(chainData, chainIndex);
      chartInstanceRef.current.setOption(option, true);
    }
  }, [durationFilter, getGraphOption, chainData, chainIndex, visible]);

  // 重置持续时间过滤器
  const resetDurationFilter = () => {
    setDurationFilter(durationRange);
  };

  // 应用持续时间过滤器
  const applyDurationFilter = (value: number[]) => {
    setDurationFilter(value);
  };

  // 刷新图表数据
  const refreshChart = async () => {
    const chart = chartInstanceRef.current;
    if (!chart || !queryParams || !fetchChainData) return;
    
    chart.showLoading('default', {
      text: 'Loading...',
      color: '#3182ce',
      textColor: '#2d3748',
      maskColor: 'rgba(255,255,255,0.7)',
      zlevel: 0
    });
    
    try {
      const updatedData = await fetchChainData({ ...queryParams, count: 20000 });
      chart.hideLoading();
      if (updatedData) {
        const option = getGraphOption(updatedData, chainIndex);
        chart.setOption(option, true);
      }
    } catch (err) {
      chart.hideLoading();
      console.error('Refresh failed:', err);
    }
  };

  const modalTitle = chainIndex === 'all' 
    ? 'Aggregated Function Call Graph'
    : `Chain ${(chainIndex as number) + 1} Function Call Graph`;

  console.log('Rendering GraphModal', { visible, chainData: !!chainData, chainIndex });

  return (
    <Modal
      title={
        <div className="flex items-center justify-between">
          <span>{modalTitle}</span>
          <div className="flex items-center gap-4">
            <Button
              size="small"
              type={showDurationFilter ? 'primary' : 'default'}
              onClick={() => setShowDurationFilter(!showDurationFilter)}
            >
              Duration Filter
            </Button>
            
            {fetchChainData && (
              <Button
                size="small"
                onClick={refreshChart}
                icon={<span>⟳</span>}
              >
                Refresh
              </Button>
            )}
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width="95vw"
      style={{ top: 50, padding: 0 }}
      destroyOnClose
    >
      <div className="flex flex-col h-full">
        {showDurationFilter && (
          <div className="bg-gray-50 border-b p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">
                Duration Filter
              </h4>
              <Button size="small" onClick={resetDurationFilter}>
                Reset
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{durationRange[0]}μs</span>
                <span>{durationRange[1]}μs</span>
              </div>
              
              <Slider
                range
                min={durationRange[0]}
                max={durationRange[1]}
                value={durationFilter}
                onChange={applyDurationFilter}
                tooltip={{
                  formatter: (value) => `${value}μs`
                }}
              />
              
              <div className="flex items-center justify-center text-xs text-gray-600">
                Current filter: {durationFilter[0]}μs - {durationFilter[1]}μs
              </div>
            </div>
            
            <div className="text-xs text-gray-500">
              Adjust the slider to filter functions by their average execution duration.
            </div>
          </div>
        )}
        
        <div 
          ref={chartRef} 
          style={{ 
            width: '100%', 
            height: showDurationFilter ? '75vh' : '85vh', 
            minHeight: '600px' 
          }} 
        />
      </div>
    </Modal>
  );
};

export default GraphModal;