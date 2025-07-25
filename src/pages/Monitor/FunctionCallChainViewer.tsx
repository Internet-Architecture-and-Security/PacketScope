import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play, ArrowLeft, Clock, Hash, Cpu, X, Search, Filter, RotateCcw, AlertCircle, BarChart2 } from 'lucide-react';
import { Input, Select, Button, Tree, ConfigProvider, Segmented, Spin, Modal, App, Slider } from 'antd';
import * as echarts from 'echarts';
import { DownOutlined, CaretRightOutlined, CaretDownOutlined, ReloadOutlined } from '@ant-design/icons';
import { useIntl } from 'react-intl';

const { Option } = Select;

interface FunctionCallChainViewerProps {
  queryParams: {
    srcip: string;
    dstip: string;
    srcport: number;
    dstport: number;
  } | null;
}

const FunctionCallChainViewer: React.FC<FunctionCallChainViewerProps> = ({ queryParams }) => {
  const intl = useIntl();
  const receiveChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.receiveFunctionChain' });
  const sendChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.sendFunctionChain' });

  const [currentChainType, setCurrentChainType] = useState(receiveChainName);
  const [chainData, setChainData] = useState({
    [receiveChainName]: null,
    [sendChainName]: null,
  });
  const [funcTable, setFuncTable] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { message } = App.useApp();
  const isCheckedRef = useRef<boolean>(false);
  const [isClickedAllChains, setIsClickedAllChains] = useState<boolean>(false);

  const [selectedCall, setSelectedCall] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(['chain-0']);
  const [filterText, setFilterText] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState('all');
  const [threadFilter, setThreadFilter] = useState('all');

  const [isGraphVisible, setIsGraphVisible] = useState(false);
  const [graphChainIndex, setGraphChainIndex] = useState<'all' | number>('all');

  const [durationFilter, setDurationFilter] = useState([0, 10000]);
  const [showDurationFilter, setShowDurationFilter] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  let chartInstance: echarts.ECharts | null = null;

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

  const durationRange = useMemo(() => {
    if (!chainData || (!chainData[receiveChainName] && !chainData[sendChainName])) return [0, 10000];
    const functionStats = new Map();
    const processChain = (chain: number[][][]) => {
      if (!Array.isArray(chain)) return;
      for (const singleChain of chain) {
        const callStack = [];
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
    processChain(chainData[receiveChainName]);
    processChain(chainData[sendChainName]);
    const avgDurations = Array.from(functionStats.values()).map((stats) => (stats.durations.length > 0 ? stats.totalDuration / stats.durations.length : 0)).filter((duration) => duration > 0);
    if (avgDurations.length === 0) return [0, 10000];
    return [Math.floor(Math.min(...avgDurations)), Math.ceil(Math.max(...avgDurations))];
  }, [chainData, receiveChainName, sendChainName]);

  useEffect(() => {
    if (durationRange[0] !== durationRange[1]) {
      setDurationFilter(durationRange);
    }
  }, [durationRange]);

  const fetchFuncTable = async () => {
    try {
      const res = await fetch('http://127.0.0.1:19999/GetFuncTable', { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setFuncTable(data);
    } catch (err) {
      console.error(intl.formatMessage({ id: 'FunctionCallChainViewer.fetchFuncTableFailed' }), err);
      message.error(intl.formatMessage({ id: 'FunctionCallChainViewer.fetchFuncTableFailed' }));
    }
  };

  const fetchChainData = async (params) => {
    if (!params.srcip) {
      message.warning(intl.formatMessage({ id: 'FunctionCallChainViewer.missingParams' }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const endpoint = 'http://127.0.0.1:19999/GetRecentMap';
      const formData = new URLSearchParams();
      formData.append('srcip', params.srcip);
      formData.append('dstip', params.dstip);
      formData.append('srcport', params.srcport);
      formData.append('dstport', params.dstport);
      formData.append('count', params.count ?? 1);
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const newData = {
        [receiveChainName]: data[0],
        [sendChainName]: data[1],
      };
      setChainData(newData);
      if (params.count) isCheckedRef.current = true;
      setIsClickedAllChains(false);
      setSelectedCall(null);
      setExpandedKeys(['chain-0']);
      return newData;
    } catch (err) {
      const errorMsg = intl.formatMessage({ id: 'FunctionCallChainViewer.fetchChainDataFailed' });
      const errorDetails = intl.formatMessage({ id: 'FunctionCallChainViewer.fetchChainTypeDataFailed' }, { chainType: currentChainType });
      console.error(errorMsg, err);
      setError(`${errorDetails}: ${err.message}`);
      message.error(errorDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleChainTypeChange = (value) => {
    setCurrentChainType(value);
  };

  useEffect(() => {
    if (queryParams) {
      isCheckedRef.current = false;
      setIsClickedAllChains(false);
      fetchFuncTable();
      fetchChainData(queryParams);
    }
  }, [queryParams]);

  const resetFilters = () => {
    setFilterText('');
    setCallTypeFilter('all');
    setThreadFilter('all');
    setDurationFilter(durationRange);
    setShowDurationFilter(false);
  };

  const openGraphModal = (index: 'all' | number) => {
    setGraphChainIndex(index);
    setIsGraphVisible(true);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
  };

  const getFunctionName = (id) => funcTable[id]?.name || `Unknown_${id}`;
  const getCallType = (isReturn) => (isReturn ? 'RETURN' : 'CALL');

  const currentData = chainData[currentChainType];

  const processedData = useMemo(() => {
    if (!currentData || !currentData.length) return [];
    return currentData.map((chain, chainIndex) => {
      let depth = 0;
      return chain.map((call, callIndex) => {
        const [timestamp, isReturn, funcId, threadId] = call;
        if (isReturn) depth = Math.max(0, depth - 1);
        const currentDepth = depth;
        if (!isReturn) depth++;
        return {
          timestamp, isReturn, funcId, threadId,
          funcName: getFunctionName(funcId),
          callType: getCallType(isReturn),
          depth: currentDepth, callIndex, chainIndex,
        };
      });
    });
  }, [currentData, funcTable]);

  const filteredData = useMemo(() => {
    return processedData
      .map((chain, chainIndex) => {
        const filteredCalls = chain.filter((call) => {
          if (filterText && !call.funcName.toLowerCase().includes(filterText.toLowerCase()) && !call.funcId.toString().includes(filterText)) return false;
          if (callTypeFilter !== 'all' && call.callType.toLowerCase() !== callTypeFilter) return false;
          if (threadFilter !== 'all' && call.threadId.toString() !== threadFilter) return false;
          return true;
        });
        return { chainIndex, calls: filteredCalls, originalLength: chain.length };
      })
      .filter((chain) => chain.calls.length > 0);
  }, [processedData, filterText, callTypeFilter, threadFilter]);

  const allThreadIds = useMemo(() => {
    const threads = new Set();
    processedData.forEach((chain) => chain.forEach((call) => threads.add(call.threadId)));
    return Array.from(threads).sort();
  }, [processedData]);

  const treeData = useMemo(() => {
    return filteredData.map(({ chainIndex, calls, originalLength }) => {
      const stack = [];
      const treeNodes = [];
      let nodeId = 0;
      calls.forEach((call) => {
        const currentNodeId = `${chainIndex}-${nodeId++}`;
        const nodeData = {
          key: currentNodeId,
          title: (
            <div onClick={() => setSelectedCall({ chainIndex: call.chainIndex, callIndex: call.callIndex })} className={`flex items-center gap-3 py-0 px-2 rounded cursor-pointer transition-colors w-full ${selectedCall?.chainIndex === call.chainIndex && selectedCall?.callIndex === call.callIndex ? 'bg-blue-100 border-l-2 border-blue-500' : 'hover:bg-gray-100 border-l-2 border-transparent'}`}>
              <div className="flex items-center gap-3">
                {call.isReturn ? <ArrowLeft size={16} className="text-red-500" /> : <Play size={16} className="text-green-500" />}
                <span className={`text-xs font-medium ${call.isReturn ? 'text-red-600' : 'text-green-600'}`}>{call.callType}</span>
                <code className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-sm font-medium">{call.funcName}</code>
              </div>
              <div className="ml-auto flex items-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Clock size={12} />{formatTime(call.timestamp)}</span>
                <span className="flex items-center gap-1"><Hash size={12} />{call.funcId}</span>
              </div>
            </div>
          ),
          children: [], callData: call,
        };
        if (!call.isReturn) {
          if (stack.length === 0) treeNodes.push(nodeData);
          else stack[stack.length - 1].children.push(nodeData);
          stack.push(nodeData);
        } else {
          if (stack.length > 0) {
            stack[stack.length - 1].children.push(nodeData);
            stack.pop();
          } else {
            treeNodes.push(nodeData);
          }
        }
      });
      return {
        key: `chain-${chainIndex}`,
        title: (
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-blue-700 font-semibold mr-4">
              <span className="text-sm">{intl.formatMessage({ id: 'FunctionCallChainViewer.chainTitle' }, { chainIndex: chainIndex + 1 })}</span>
              <span className="text-amber-700 text-xs font-normal">{intl.formatMessage({ id: 'FunctionCallChainViewer.threadId' }, { threadId: calls[0]?.threadId })}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500 bg-blue-50 px-2 py-0.5 rounded">
                {intl.formatMessage({ id: 'FunctionCallChainViewer.callCountInChain' }, { callCount: calls.length, originalLength: originalLength })}
              </div>
              <Button
                className="text-xs" size="small" type="text" icon={<BarChart2 size={14} />}
                onClick={(e) => { e.stopPropagation(); openGraphModal(chainIndex); }}
                title={intl.formatMessage({ id: 'FunctionCallChainViewer.viewChainGraphTooltip' }, { chainIndex: chainIndex + 1 })}
              >
                {intl.formatMessage({ id: 'FunctionCallChainViewer.viewGraph' })}
              </Button>
            </div>
          </div>
        ),
        children: treeNodes, selectable: false,
      };
    });
  }, [filteredData, selectedCall, intl]);

  if (error) {
    return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-700 mb-2">{intl.formatMessage({ id: 'FunctionCallChainViewer.loadFailed' })}</div>
          <div className="text-sm text-slate-500 mb-4">{error}</div>
          <Button onClick={() => fetchChainData(queryParams)}>{intl.formatMessage({ id: 'FunctionCallChainViewer.retry' })}</Button>
        </div>
      </div>
    );
  }

  if (!queryParams) {
    return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Cpu className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-500 mb-2">{intl.formatMessage({ id: 'FunctionCallChainViewer.analyzerTitle' })}</div>
          <div className="text-sm text-slate-400">{intl.formatMessage({ id: 'FunctionCallChainViewer.selectConnectionPrompt' })}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-50 text-slate-800 flex flex-col font-mono text-sm min-w-[800px]">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Cpu className=" text-blue-600" size={20} />
        <span className="font-semibold text-base text-slate-900">{intl.formatMessage({ id: 'FunctionCallChainViewer.analyzerTitle' })}</span>
        <Segmented size="small" options={[receiveChainName, sendChainName]} value={currentChainType} onChange={handleChainTypeChange} />
        {currentData && processedData && (
          <div className="text-xs text-slate-500 ml-2 flex items-center">
            {intl.formatMessage({ id: 'FunctionCallChainViewer.chainStats' }, { chainCount: currentData.length, callCount: currentData.reduce((acc, chain) => acc + chain.length, 0) })}
            <Button disabled={isClickedAllChains} size="small" className="ml-2" onClick={() => { setIsClickedAllChains(true); fetchChainData({ ...queryParams, count: 20000 }); }}>
              {intl.formatMessage({ id: 'FunctionCallChainViewer.viewAllChains' })}
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white w-full border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-3 flex-wrap scale-90 origin-left">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-medium text-slate-700">{intl.formatMessage({ id: 'FunctionCallChainViewer.filter' })}</span>
          </div>
          <Input placeholder={intl.formatMessage({ id: 'FunctionCallChainViewer.searchPlaceholder' })} value={filterText} onChange={(e) => setFilterText(e.target.value)} prefix={<Search className="w-3.5 h-3.5 text-slate-400" />} size="small" style={{ width: 160, fontSize: '12px' }} />
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-600">{intl.formatMessage({ id: 'FunctionCallChainViewer.type' })}</label>
            <Select value={callTypeFilter} onChange={setCallTypeFilter} size="small" style={{ width: 90, fontSize: '12px' }}>
              <Option value="all">{intl.formatMessage({ id: 'FunctionCallChainViewer.all' })}</Option>
              <Option value="call">{intl.formatMessage({ id: 'FunctionCallChainViewer.call' })}</Option>
              <Option value="return">{intl.formatMessage({ id: 'FunctionCallChainViewer.return' })}</Option>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-600">{intl.formatMessage({ id: 'FunctionCallChainViewer.thread' })}</label>
            <Select value={threadFilter} onChange={setThreadFilter} size="small" style={{ width: 80, fontSize: '12px' }}>
              <Option value="all">{intl.formatMessage({ id: 'FunctionCallChainViewer.all' })}</Option>
              {allThreadIds.map((threadId) => (<Option key={threadId} value={threadId.toString()}>{threadId}</Option>))}
            </Select>
          </div>
          <Button onClick={resetFilters} size="small" icon={<RotateCcw className="w-3 h-3" />} className="flex items-center gap-1 text-xs">
            {intl.formatMessage({ id: 'FunctionCallChainViewer.reset' })}
          </Button>
          <Button size="small" onClick={() => openGraphModal('all')}>
            {intl.formatMessage({ id: 'FunctionCallChainViewer.viewAggregatedGraph' })}
          </Button>
          {(filterText || callTypeFilter !== 'all' || threadFilter !== 'all') && (
            <div className="text-xs text-slate-500 bg-blue-50 px-1.5 py-0.5 rounded ml-auto">
              {intl.formatMessage({ id: 'FunctionCallChainViewer.filterResult' }, { filteredCount: filteredData.reduce((acc, chain) => acc + chain.calls.length, 0), totalCount: currentData.reduce((acc, chain) => acc + chain.length, 0) })}
            </div>
          )}
        </div>
      </div>

      <div className="flex h-full overflow-hidden min-w-0">
        <div className={`flex-1 flex flex-col min-w-[500px] ${selectedCall ? 'w-3/4' : 'w-full'}`}>
          <div className="flex-1 overflow-auto px-4 py-4 min-w-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Spin />
                <span className="ml-2 text-slate-500">{intl.formatMessage({ id: 'FunctionCallChainViewer.loadingData' }, { chainType: currentChainType })}</span>
              </div>
            ) : !currentData || currentData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">{intl.formatMessage({ id: 'FunctionCallChainViewer.noData' }, { chainType: currentChainType })}</div>
            ) : (
              <div className="min-w-[600px]">
                <ConfigProvider theme={{ components: { Tree: { nodeHoverBg: 'transparent', nodeSelectedBg: 'transparent' } } }}>
                  <Tree treeData={treeData} expandedKeys={expandedKeys} onExpand={setExpandedKeys} onSelect={(keys, info) => { if (info.node.callData) setSelectedCall({ chainIndex: info.node.callData.chainIndex, callIndex: info.node.callData.callIndex }); }} showLine={{ showLeafIcon: false }} className="bg-white border border-gray-200 rounded-md p-4" />
                </ConfigProvider>
              </div>
            )}
          </div>
        </div>

        {selectedCall && processedData.length > 0 && (() => {
          const call = processedData[selectedCall.chainIndex][selectedCall.callIndex];
          const funcInfo = funcTable[call.funcId];
          return (
            <div className="w-1/4 min-w-[280px] bg-white border-l border-gray-200 flex flex-col">
              <div className="px-2 py-1 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">{intl.formatMessage({ id: 'FunctionCallChainViewer.functionDetails' })}</div>
                <Button type="text" size="small" icon={<X className="w-4 h-4 text-slate-500" />} onClick={() => setSelectedCall(null)} />
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100"><div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div><div className="text-sm font-bold text-slate-800 uppercase tracking-wide">{intl.formatMessage({ id: 'FunctionCallChainViewer.basicInfo' })}</div></div>
                    <div className="space-y-3">
                      <div><div className="text-xs text-slate-500 mb-1">{intl.formatMessage({ id: 'FunctionCallChainViewer.functionName' })}</div><code className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-sm font-medium block break-all">{call.funcName}</code></div>
                      <div><div className="text-xs text-slate-500 mb-1">{intl.formatMessage({ id: 'FunctionCallChainViewer.callType' })}</div><span className={`text-sm font-medium px-2 py-1 rounded ${call.isReturn ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>{call.callType}</span></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100"><div className="w-1 h-4 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div><div className="text-sm font-bold text-slate-800 uppercase tracking-wide">{intl.formatMessage({ id: 'FunctionCallChainViewer.executionInfo' })}</div></div>
                    <div className="space-y-3">
                      <div><div className="text-xs text-slate-500 mb-1">{intl.formatMessage({ id: 'FunctionCallChainViewer.timestamp' })}</div><div className="text-sm text-slate-700 font-mono break-all">{formatTime(call.timestamp)}</div></div>
                      <div><div className="text-xs text-slate-500 mb-1">{intl.formatMessage({ id: 'FunctionCallChainViewer.functionId' })}</div><div className="text-sm text-slate-700 font-mono">{call.funcId}</div></div>
                      <div><div className="text-xs text-slate-500 mb-1">{intl.formatMessage({ id: 'FunctionCallChainViewer.threadIdLabel' })}</div><div className="text-sm text-slate-700 font-mono">{call.threadId}</div></div>
                      <div><div className="text-xs text-slate-500 mb-1">{intl.formatMessage({ id: 'FunctionCallChainViewer.callDepth' })}</div><div className="text-sm text-slate-700">{call.depth}</div></div>
                    </div>
                  </div>
                  {funcInfo && (
                    <div>
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100"><div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div><div className="text-sm font-bold text-slate-800 uppercase tracking-wide">{intl.formatMessage({ id: 'FunctionCallChainViewer.metadata' })}</div></div>
                      <div className="bg-gray-50 rounded p-3 space-y-2">
                        <div className="flex justify-between"><span className="text-xs text-slate-500">Kind:</span><span className="text-xs text-slate-700 font-mono">{funcInfo.kind}</span></div>
                        <div className="flex justify-between"><span className="text-xs text-slate-500">Type ID:</span><span className="text-xs text-slate-700 font-mono">{funcInfo.type_id}</span></div>
                        <div className="flex justify-between"><span className="text-xs text-slate-500">Linkage:</span><span className="text-xs text-slate-700 font-mono">{funcInfo.linkage}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      <Modal
        title={graphChainIndex === 'all' ? intl.formatMessage({ id: 'FunctionCallChainViewer.aggregatedGraphTitle' }) : intl.formatMessage({ id: 'FunctionCallChainViewer.singleGraphTitle' }, { chainIndex: graphChainIndex + 1 })}
        open={isGraphVisible} onCancel={() => setIsGraphVisible(false)} footer={null} width="95vw" style={{ top: 50, padding: 0 }}
        destroyOnClose afterOpenChange={(open) => {
          if (open && chartRef.current) {
            setTimeout(() => {
              if (chartInstanceRef.current) chartInstanceRef.current.dispose();
              chartInstanceRef.current = echarts.init(chartRef.current);
              chartInstanceRef.current.setOption(getGraphOption(chainData, graphChainIndex));
              const resizeChart = () => chartInstanceRef.current?.resize();
              window.addEventListener('resize', resizeChart);
              return () => {
                window.removeEventListener('resize', resizeChart);
                chartInstanceRef.current?.dispose();
                chartInstanceRef.current = null;
              };
            }, 100);
          }
        }}
      >
        <div ref={chartRef} style={{ width: '100%', height: '85vh', minHeight: '600px' }} />
      </Modal>
    </div>
  );
};

export default FunctionCallChainViewer;