import React, { useRef, useEffect } from 'react';
import { Modal } from 'antd';
import * as echarts from 'echarts';
import { useIntl } from 'react-intl';
import { FuncTable } from './types';

interface FunctionCallGraphProps {
  isGraphVisible: boolean;
  onCancel: () => void;
  chainData: any;
  funcTable: FuncTable;
  graphChainIndex: 'all' | number;
  durationFilter: [number, number];
  currentChainType: string;
  queryParams: any;
  fetchChainData: (params: any) => Promise<any>;
}

const FunctionCallGraph: React.FC<FunctionCallGraphProps> = ({
  isGraphVisible,
  onCancel,
  chainData,
  funcTable,
  graphChainIndex,
  durationFilter,
  currentChainType,
  queryParams,
  fetchChainData
}) => {
  const intl = useIntl();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const receiveChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.receiveFunctionChain' });
  const sendChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.sendFunctionChain' });
  
  // The entire getGraphOption function is moved here.
  const getGraphOption = (data, targetChainIndex: 'all' | number = 'all') => {
    const rawData = data || chainData;
    if (!rawData) return { series: [] };

    const nodes = new Map<string, any>();
    const links: { source: string; target: string; weight: number }[] = [];
    const functionStats = new Map<string, { callCount: number; totalDuration: number; durations: number[] }>();

    const receiveName = intl.formatMessage({ id: 'FunctionCallChainViewer.receive' });
    const sendName = intl.formatMessage({ id: 'FunctionCallChainViewer.send' });

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

    function getFunctionNameFromItem(item: [number, number, number, number]) {
      const [, , addr] = item;
      const funcName = funcTable?.[addr]?.name || `0x${addr.toString(16)}`;
      return funcName.length > 20 ? funcName.substring(0, 17) + '...' : funcName;
    }

    function getFunctionKey(item: [number, number, number, number], category: string) {
      const [, , addr] = item;
      return `${category}_${addr}`;
    }

    function processChain(chain: number[][][], category: string) {
      if (!Array.isArray(chain)) return;

      const chainsToProcess = targetChainIndex === 'all' ? chain : [chain[targetChainIndex]].filter(Boolean);

      for (const singleChain of chainsToProcess) {
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
    }

    processChain(rawData[receiveChainName], receiveName);
    processChain(rawData[sendChainName], sendName);

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

    function getColorByDuration(avgDuration: number, category: string) {
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
    }

    const filteredFunctionStats = new Map();
    functionStats.forEach((stats, functionKey) => {
      const avgDuration = stats.durations.length > 0 ? stats.totalDuration / stats.durations.length : 0;
      if (avgDuration >= durationFilter[0] && avgDuration <= durationFilter[1]) {
        filteredFunctionStats.set(functionKey, stats);
      }
    });

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
        id: functionKey, name: funcName, category: category, value: [avgDuration, stats.callCount, stats.totalDuration], avgDuration: avgDuration,
        symbol: 'rect', symbolSize: nodeSize,
        itemStyle: { color: colorConfig.color, borderColor: colorConfig.borderColor, borderWidth: 2, shadowBlur: 8, shadowColor: colorConfig.shadowColor, shadowOffsetY: 2 },
        label: {
          show: true,
          formatter: (params) => intl.formatMessage({ id: 'FunctionCallChainViewer.nodeLabel' }, { name: params.data.name, count: params.data.value[1], avgDuration: params.data.value[0].toFixed(1) }),
          fontSize: 10, fontWeight: '500', color: '#FFFFFF', textBorderColor: 'transparent', position: 'inside', lineHeight: 14,
        },
        emphasis: { focus: 'adjacency', itemStyle: { shadowBlur: 15, shadowColor: colorConfig.shadowColor, borderWidth: 3, scale: 1.1, color: colorConfig.borderColor }, label: { fontSize: 11, fontWeight: 'bold' } },
      });
    });

    const filteredNodeKeys = new Set(filteredFunctionStats.keys());
    const filteredLinks = links.filter((link) => filteredNodeKeys.has(link.source) && filteredNodeKeys.has(link.target));
    const maxWeight = Math.max(...filteredLinks.map((link) => link.weight));
    const minWeight = Math.min(...filteredLinks.map((link) => link.weight));

    const processedLinks = filteredLinks.map((link) => {
      const weightRatio = maxWeight > minWeight ? (link.weight - minWeight) / (maxWeight - minWeight) : 0.5;
      const sourceCategory = link.source.startsWith(receiveName) ? receiveName : sendName;
      const baseColor = CATEGORY_BASE_COLORS[sourceCategory];
      const lightness = 65 - weightRatio * 25;
      const lineColor = `hsl(${baseColor.hue}, ${baseColor.saturation}%, ${lightness}%)`;
      return {
        source: link.source, target: link.target, value: link.weight,
        lineStyle: { color: lineColor, width: Math.min(1 + Math.log(link.weight + 1) * 1.5, 6), opacity: 0.8, curveness: 0.2 },
        emphasis: { lineStyle: { width: Math.min(2 + Math.log(link.weight + 1) * 2, 8), opacity: 1, shadowBlur: 10, shadowColor: lineColor, color: `hsl(${baseColor.hue}, ${baseColor.saturation}%, ${lightness - 15}%)` } },
        label: { show: link.weight > 1, formatter: intl.formatMessage({ id: 'FunctionCallChainViewer.edgeLabel' }, { count: link.weight }), fontSize: 8, color: '#666', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2, padding: [1, 3] },
      };
    });

    const legendData = Object.keys(CATEGORY_BASE_COLORS).map((category) => ({
      name: category,
      itemStyle: { color: `hsl(${CATEGORY_BASE_COLORS[category].hue}, ${CATEGORY_BASE_COLORS[category].saturation}%, 55%)`, borderColor: `hsl(${CATEGORY_BASE_COLORS[category].hue}, ${CATEGORY_BASE_COLORS[category].saturation}%, 40%)`, borderWidth: 2 },
    }));

    const chartTitle = targetChainIndex === 'all'
      ? intl.formatMessage({ id: 'FunctionCallChainViewer.aggregatedGraphTitle' })
      : intl.formatMessage({ id: 'FunctionCallChainViewer.singleGraphTitle' }, { chainIndex: targetChainIndex + 1 });

    const chartSubtext = targetChainIndex === 'all'
      ? intl.formatMessage({ id: 'FunctionCallChainViewer.aggregatedGraphSubtext' }, { durationFilterStart: durationFilter[0], durationFilterEnd: durationFilter[1], nodesCount: nodes.size, linksCount: processedLinks.length })
      : intl.formatMessage({ id: 'FunctionCallChainViewer.singleGraphSubtext' }, { threadId: rawData[currentChainType]?.[targetChainIndex]?.[0]?.[3], nodesCount: nodes.size, linksCount: processedLinks.length });

    return {
      backgroundColor: '#f8fafc',
      title: {
        text: chartTitle, subtext: chartSubtext, left: 'center', top: 20,
        textStyle: { fontSize: 24, fontWeight: 'bold', color: '#1a202c' },
        subtextStyle: { fontSize: 14, color: '#718096' },
      },
      tooltip: {
        trigger: 'item', backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 8,
        textStyle: { color: '#2d3748', fontSize: 12 }, padding: [12, 16],
        formatter: (params) => {
          if (params.dataType === 'node') {
            const [avgDur, callCount, totalDur] = params.data.value;
            const stats = filteredFunctionStats.get(params.data.id);
            const maxDuration = stats.durations.length > 0 ? Math.max(...stats.durations).toFixed(1) : '0';
            const minDuration = stats.durations.length > 0 ? Math.min(...stats.durations).toFixed(1) : '0';
            return `
              <div style="line-height: 1.6;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #2b6cb0;">
                  ${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.functionTitle' }, { category: params.data.category, name: params.data.name })}
                </div>
                <div><strong>${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.callCount' })}</strong> ${callCount}</div>
                <div><strong>${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.totalDuration' })}</strong> ${totalDur.toFixed(1)}μs</div>
                <div><strong>${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.avgDuration' })}</strong> ${avgDur.toFixed(1)}μs</div>
                <div><strong>${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.maxDuration' })}</strong> ${maxDuration}μs</div>
                <div><strong>${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.minDuration' })}</strong> ${minDuration}μs</div>
                <div style="font-size: 11px; color: #666; margin-top: 4px;">
                  ${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.durationTip' })}
                </div>
              </div>`;
          } else if (params.dataType === 'edge') {
            return `
              <div style="line-height: 1.6;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #2b6cb0;">
                  ${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.relationshipTitle' })}
                </div>
                <div><strong>${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.callFrequency' })}</strong> ${params.data.value}</div>
                <div><strong>${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.callDirection' })}</strong> ${params.data.source.split('_')[1]} → ${params.data.target.split('_')[1]}</div>
                <div style="font-size: 11px; color: #666; margin-top: 4px;">
                  ${intl.formatMessage({ id: 'FunctionCallChainViewer.tooltip.frequencyTip' })}
                </div>
              </div>`;
          }
          return '';
        },
      },
      legend: {
        data: legendData, top: 80, left: 'center', orient: 'horizontal', itemGap: 30,
        textStyle: { fontSize: 14, color: '#4a5568' }, icon: 'rect', itemWidth: 20, itemHeight: 12,
      },
      toolbox: {
        show: true, itemGap: 10, right: 20, top: 20,
        feature: {
          saveAsImage: { title: intl.formatMessage({ id: 'FunctionCallChainViewer.saveAsImage' }), pixelRatio: 2 },
          myrefresh: {
            show: true, title: intl.formatMessage({ id: 'FunctionCallChainViewer.refresh' }), icon: 'path://M951.296 153.6H801.792C909.312 240.64 972.8 372.736 972.8 512c0 246.784-194.56 448.512-438.272 459.776-12.288 1.024-22.528-8.192-22.528-20.48 0-10.24 8.192-19.456 19.456-20.48C753.664 921.6 931.84 737.28 931.84 512c0-131.072-60.416-253.952-163.84-332.8V337.92c0 12.288-11.264 22.528-23.552 20.48-10.24-2.048-17.408-11.264-17.408-21.504V133.12c0-11.264 9.216-20.48 20.48-20.48h204.8c12.288 0 22.528 11.264 20.48 23.552-2.048 10.24-11.264 17.408-21.504 17.408zM492.544 51.2C244.736 51.2 51.2 253.952 51.2 512c0 139.264 63.488 271.36 171.008 358.4H73.728c-10.24 0-19.456 7.168-21.504 17.408-2.048 12.288 7.168 23.552 19.456 23.552h204.8c11.264 0 20.48-9.216 20.48-20.48V687.104c0-10.24-7.168-19.456-17.408-21.504-12.288-2.048-23.552 8.192-23.552 20.48v158.72C152.576 765.952 92.16 643.072 92.16 512 92.16 276.48 268.288 92.16 492.544 92.16c11.264 0 20.48-9.216 20.48-20.48s-9.216-20.48-20.48-20.48z', type: 'myrefresh',
            onclick: async () => {
              const chart = chartInstanceRef.current;
              if (!chart) return;
              chart.showLoading('default', { text: intl.formatMessage({ id: 'FunctionCallChainViewer.loading' }), color: '#3182ce', textColor: '#2d3748', maskColor: 'rgba(255,255,255,0.7)', zlevel: 0 });
              try {
                const updatedData = await fetchChainData({ ...queryParams, count: 20000 });
                chart.hideLoading();
                chart.setOption(getGraphOption(updatedData, graphChainIndex), true);
              } catch (err) {
                chart.hideLoading();
                console.error(intl.formatMessage({ id: 'FunctionCallChainViewer.refreshFailed' }), err);
              }
            },
          },
        },
      },
      visualMap: [
        {
          type: 'continuous', seriesIndex: 0, dimension: 0, min: minReceiveDuration, max: maxReceiveDuration,
          text: [intl.formatMessage({ id: 'FunctionCallChainViewer.high' }), intl.formatMessage({ id: 'FunctionCallChainViewer.low' }), intl.formatMessage({ id: 'FunctionCallChainViewer.receiveDuration' })],
          textGap: 10, left: 'left', top: 'middle', calculable: true, realtime: false,
          inRange: { opacity: [0.8, 1], color: ['#2b6cb000', '#2b6cb0'] }, outOfRange: { opacity: 0 },
          controller: { inRange: { opacity: [0.3, 1] }, outOfRange: { opacity: 0 } },
          textStyle: { color: '#2b6cb0', fontSize: 12 },
          pieces: receiveStats.length > 0 ? undefined : [{ min: minReceiveDuration, max: maxReceiveDuration, opacity: 1 }],
        },
        {
          type: 'continuous', seriesIndex: 1, dimension: 0, min: minSendDuration, max: maxSendDuration,
          text: [intl.formatMessage({ id: 'FunctionCallChainViewer.high' }), intl.formatMessage({ id: 'FunctionCallChainViewer.low' })],
          textGap: 10, right: 'right', top: 'middle', calculable: true, realtime: false,
          inRange: { opacity: [0.9, 1], color: ['#d69e2e00', '#d69e2e'] }, outOfRange: { opacity: 0 },
          controller: { inRange: { opacity: [0.3, 1] }, outOfRange: { opacity: 0 } },
          textStyle: { color: '#d69e2e', fontSize: 12 },
          pieces: sendStats.length > 0 ? undefined : [{ min: minSendDuration, max: maxSendDuration, opacity: 1 }],
        },
      ],
      series: [
        {
          name: intl.formatMessage({ id: 'FunctionCallChainViewer.receiveFunction' }), type: 'graph', layout: 'force', roam: true, focusNodeAdjacency: true, legendHoverLink: false,
          categories: [legendData[0]],
          force: { repulsion: [300, 500], gravity: 0.1, edgeLength: [120, 300], friction: 0.3 },
          edgeSymbol: ['', 'arrow'], edgeSymbolSize: [0, 12],
          data: Array.from(nodes.values()).filter((node) => node.category === receiveName),
          links: processedLinks.filter((link) => link.source.startsWith(receiveName) && link.target.startsWith(receiveName)),
          lineStyle: { opacity: 0.8, curveness: 0.3 }, emphasis: { focus: 'series', blurScope: 'coordinateSystem' }, scaleLimit: { min: 0.4, max: 3 },
        },
        {
          name: intl.formatMessage({ id: 'FunctionCallChainViewer.sendFunction' }), type: 'graph', layout: 'force', roam: true, focusNodeAdjacency: true, legendHoverLink: false,
          categories: [legendData[1]],
          force: { repulsion: [300, 500], gravity: 0.1, edgeLength: [120, 300], friction: 0.3 },
          edgeSymbol: ['', 'arrow'], edgeSymbolSize: [0, 12],
          data: Array.from(nodes.values()).filter((node) => node.category === sendName),
          links: processedLinks.filter((link) => link.source.startsWith(sendName) && link.target.startsWith(sendName)),
          lineStyle: { opacity: 0.8, curveness: 0.3 }, emphasis: { focus: 'series', blurScope: 'coordinateSystem' }, scaleLimit: { min: 0.4, max: 3 },
        },
        {
          name: intl.formatMessage({ id: 'FunctionCallChainViewer.mixedConnection' }), type: 'graph', layout: 'force', roam: true, focusNodeAdjacency: true, legendHoverLink: false,
          force: { repulsion: [300, 500], gravity: 0.1, edgeLength: [120, 300], friction: 0.3 },
          edgeSymbol: ['', 'arrow'], edgeSymbolSize: [0, 12], data: [],
          links: processedLinks.filter((link) => (link.source.startsWith(receiveName) && link.target.startsWith(sendName)) || (link.source.startsWith(sendName) && link.target.startsWith(receiveName))),
          lineStyle: { opacity: 0.8, curveness: 0.3 }, emphasis: { focus: 'series', blurScope: 'coordinateSystem' }, scaleLimit: { min: 0.4, max: 3 },
        },
      ],
      dataZoom: [{ type: 'inside', disabled: false, zoomOnMouseWheel: 'ctrl' }],
    };
  };

  useEffect(() => {
    if (isGraphVisible && chartRef.current) {
      const initializeChart = () => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.dispose();
        }
        chartInstanceRef.current = echarts.init(chartRef.current);
        const options = getGraphOption(chainData, graphChainIndex);
        chartInstanceRef.current.setOption(options);
      };

      // Use a short timeout to ensure the modal is fully rendered
      const timer = setTimeout(initializeChart, 100);

      const resizeChart = () => chartInstanceRef.current?.resize();
      window.addEventListener('resize', resizeChart);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', resizeChart);
        chartInstanceRef.current?.dispose();
        chartInstanceRef.current = null;
      };
    }
  }, [isGraphVisible, chainData, funcTable, graphChainIndex, durationFilter]);

  const modalTitle = graphChainIndex === 'all' 
    ? intl.formatMessage({ id: 'FunctionCallChainViewer.aggregatedGraphTitle' }) 
    : intl.formatMessage({ id: 'FunctionCallChainViewer.singleGraphTitle' }, { chainIndex: graphChainIndex + 1 });

  return (
    <Modal
      title={modalTitle}
      open={isGraphVisible}
      onCancel={onCancel}
      footer={null}
      width="95vw"
      style={{ top: 20 }}
      destroyOnClose
    >
      <div ref={chartRef} style={{ width: '100%', height: '85vh', minHeight: '600px' }} />
    </Modal>
  );
};

export default FunctionCallGraph;