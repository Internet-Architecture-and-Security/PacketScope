import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Alert, Flex, Checkbox, ConfigProvider } from 'antd';
import { useSearchParams } from 'react-router';
import * as echarts from 'echarts';
import { SendOutlined, StopOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons';
import worldGeoJson from '@/assets/worldGeo.json';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import RiskAnalysisPanel from './RiskAnalysisPanel';
import TraceResultsPanel from './TraceResultsPanel';
import HistoryPanel from './HistoryPanel';

const OFFSET_CENTER = 136;
const DEFAULT_CENTER = [18 - OFFSET_CENTER, 0];

// Utility function
function getMapViewOptions(coords) {
  const defaultCenter = DEFAULT_CENTER;
  const defaultZoom = 1.2;

  if (!coords || coords.length === 0) {
    return { center: defaultCenter, zoom: defaultZoom };
  }

  let minLon = Infinity,
    maxLon = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const spanLon = maxLon - minLon;
  const spanLat = maxLat - minLat;
  const center = [(minLon + maxLon) / 2 - OFFSET_CENTER, (minLat + maxLat) / 2 - 40];

  const maxSpan = Math.max(spanLon, spanLat);
  let zoom = defaultZoom;
  if (maxSpan > 100) zoom = defaultZoom;
  else if (maxSpan > 60) zoom = 1.1;
  else if (maxSpan > 30) zoom = 1.4;
  else if (maxSpan > 15) zoom = 1.8;
  else zoom = 2.4;

  return { center, zoom };
}

function fetchTraceWithCancel(target, useCache = false, onHop) {
  let shouldStop = false;
  let reader = null;

  const promise = (async () => {
    if (!target) return [];

    const url = `http://127.0.0.1:8000/api/trace?target=${target}&cache=${useCache}`;
    const response = await fetch(url);
    const isStream = response.headers.get('Transfer-Encoding') === 'chunked';
    const results = [];

    if (!isStream) {
      const data = await response.json();
      if (onHop) {
        for (const hop of data) {
          onHop(hop);
        }
      }
      return data;
    }

    reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    if (!reader) return results;

    while (true) {
      if (shouldStop) {
        await reader.cancel('User aborted stream');
        break;
      }

      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const hop = JSON.parse(line);
          results.push(hop);
          if (onHop) onHop(hop);
        } catch (e) {
          console.warn('Failed to parse line:', line);
        }
      }

      buffer = lines[lines.length - 1];
    }

    return results;
  })();

  const cancel = () => {
    shouldStop = true;
    if (reader) {
      reader.cancel('Manually cancelled');
    }
  };

  return { promise, cancel };
}

function extractMapData(data, intl) {
  const hopsWithGeo = [];
  const allHops = [];
  // 处理所有跳点，包括无地理位置的
  data.forEach((hop, index) => {
    const processedHop = {
      ...hop,
      hopIndex: index + 1,
      hasGeo: hop.geo &&
        hop.geo !== 'Unknown' &&
        typeof hop.geo === 'object' &&
        typeof hop.geo.lat === 'number' &&
        typeof hop.geo.lon === 'number'
    };

    allHops.push(processedHop);

    if (processedHop.hasGeo) {
      hopsWithGeo.push(processedHop);
    }
  });

  // 生成连线数据，考虑中间的未知节点
  const linesData = [];
  const polylineCoords = [];

  if (hopsWithGeo.length > 1) {
    for (let i = 0; i < hopsWithGeo.length - 1; i++) {
      const startHop = hopsWithGeo[i];
      const endHop = hopsWithGeo[i + 1];

      // 检查两个有地理位置的节点之间是否存在未知节点
      const startIndex = allHops.findIndex(hop => hop === startHop);
      const endIndex = allHops.findIndex(hop => hop === endHop);
      const hasUnknownBetween = endIndex - startIndex > 1;

      const lineData = {
        coords: [
          [startHop.geo.lon, startHop.geo.lat],
          [endHop.geo.lon, endHop.geo.lat]
        ],
        lineStyle: {
          width: 2,
          color: '#FF9800',
          opacity: 0.8,
          curveness: 0.2,
          type: hasUnknownBetween ? 'dashed' : 'solid' // 如果中间有未知节点，使用虚线
        },
        // 添加标签显示中间跳过的节点数
        label: hasUnknownBetween ? {
          show: true,
          position: 'middle',
          offset: [0, -4],
          formatter: intl.formatMessage({ id: 'TraceResultsPanel.map.skippedHops' }, { count: endIndex - startIndex - 1 }),
          fontSize: 10,
          color: '#fff',
          backgroundColor: 'rgba(229, 140, 13, 1)',
          // borderColor: 'rgba(229, 140, 13, 1)',
          // borderWidth: 1,
          shadowColor: 'rgba(0,0,0,.2)',
          shadowBlur: 2,
          shadowOffsetX: 1,
          shadowOffsetY: 1,
          borderRadius: 3,
          padding: [3, 6]
        } : { show: false }
      };

      linesData.push(lineData);
      polylineCoords.push([startHop.geo.lon, startHop.geo.lat]);
    }

    // 添加最后一个点
    if (hopsWithGeo.length > 0) {
      const lastHop = hopsWithGeo[hopsWithGeo.length - 1];
      polylineCoords.push([lastHop.geo.lon, lastHop.geo.lat]);
    }
  }

  // 生成国家/城市数据点
  const coordSet = new Set();
  const countriesData = [];

  hopsWithGeo.forEach((hop, index) => {
    const coordKey = `${hop.geo.lon},${hop.geo.lat}`;
    if (!coordSet.has(coordKey)) {
      coordSet.add(coordKey);

      let rippleEffectNumber = 0;
      let labelPosition = 'top';
      let color = '#13256b';

      if (index === 0) {
        color = '#91CC75'; // 起始点 - 绿色
        rippleEffectNumber = 2;
        labelPosition = 'bottom';
      } else if (index === hopsWithGeo.length - 1) {
        color = '#EE6666'; // 终点 - 红色
        rippleEffectNumber = 2;
        labelPosition = 'bottom';
      }

      // 格式化hover信息
      const formatHoverInfo = (hop) => {
        console.log(hop, 'formatHoverInfo');
        const lines = [
          intl.formatMessage({ id: 'TraceResultsPanel.map.hop' }, { index: hop.hopIndex, ip: hop.ip }),
          intl.formatMessage({ id: 'TraceResultsPanel.map.location' }, { location: hop.location || intl.formatMessage({ id: 'TraceResultsPanel.map.unknown' }) }),
          intl.formatMessage({ id: 'TraceResultsPanel.map.latency' }, { latency: hop.latency ? hop.latency.toFixed(2) : 'N/A' }),
          intl.formatMessage({ id: 'TraceResultsPanel.map.jitter' }, { jitter: hop.jitter !== 'None' ? hop.jitter : 'N/A' }),
          intl.formatMessage({ id: 'TraceResultsPanel.map.packetLoss' }, { loss: hop.packet_loss || 'N/A' }),
          intl.formatMessage({ id: 'TraceResultsPanel.map.bandwidth' }, { bandwidth: hop.bandwidth_mbps !== 'None' ? hop.bandwidth_mbps.toFixed(2) : 'N/A' }),
          intl.formatMessage({ id: 'TraceResultsPanel.map.isp' }, { isp: hop.isp || intl.formatMessage({ id: 'TraceResultsPanel.map.unknown' }) }),
          intl.formatMessage({ id: 'TraceResultsPanel.map.asn' }, { asn: hop.asn || intl.formatMessage({ id: 'TraceResultsPanel.map.unknown' }) })
        ];
        return lines.join('<br/>');
      };

      countriesData.push({
        value: [hop.geo.lon, hop.geo.lat, hop.hopIndex],
        label: {
          show: true,
          position: labelPosition,
          formatter: () => {
            return '';
            // const [city, country] = hop.location.split(',');
            // return city === "None" ? country : city;
            // const locationName = hop.location && hop.location !== 'None' ? 
            //   hop.location.split(',')[0] : `跳点${hop.hopIndex}`;
            //   console.log('locationName:', locationName, hop)
            // return locationName;
          },
          fontSize: 11,
          fontWeight: 'bold',
          color: '#333'
        },
        itemStyle: {
          color,
          borderWidth: 2,
          borderColor: '#fff',
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          shadowOffsetX: 1,
          shadowOffsetY: 1,
          shadowBlur: 3,
        },
        rippleEffect: {
          number: rippleEffectNumber,
          color,
          scale: 4,
          brushType: 'stroke',
        },
        // 添加详细的tooltip信息
        tooltip: {
          formatter: formatHoverInfo(hop),
          backgroundColor: 'rgba(0,0,0,0.8)',
          borderColor: color,
          borderWidth: 1,
          textStyle: {
            color: '#fff',
            fontSize: 12
          }
        },
        // 存储原始数据供其他地方使用
        rawData: hop
      });
    }
  });

  // 计算地图视图的坐标范围
  const countries = hopsWithGeo.map(hop => [hop.geo.lon, hop.geo.lat]);

  return {
    polylineCoords,
    countries,
    countriesData,
    linesData,
    allHops,
    hopsWithGeo,
    hasUnknownNodes: allHops.some(hop => !hop.hasGeo)
  };
};

async function fetchRiskAnalysis(target, useCache = true) {
  const url = `http://127.0.0.1:8000/api/analyze?target=${target}&cache=${useCache}`;
  const response = (await fetch(url)).json();
  return response;
}

const Locator = () => {
  const [destinationAddress, setDestinationAddress] = useState('');
  const [traceResults, setTraceResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [useCache, setUseCache] = useState(true);
  const [riskData, setRiskData] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [historyData, setHistoryData] = useState({});
  const [isDdisabledzoomInBtn, setIsDdisabledzoomInBtn] = useState(false);
  const [isDdisabledzoomOutBtn, setIsDdisabledzoomOutBtn] = useState(true);

  const cancelRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('target')) {
      setDestinationAddress(searchParams.get('target'));
      handleTraceRoute(searchParams.get('target'));
    }
  }, [searchParams]);

  // 获取历史记录
  const fetchHistoryData = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/history');
      const data = await response.json();
      setHistoryData(data);
    } catch (error) {
      console.error('Failed to fetch history data:', error);
    }
  };

  // 处理历史记录项点击
  const handleHistoryItemClick = async (target) => {
    setDestinationAddress(target);
    if (!loading) {
      await handleTraceRoute(target);
    }
  };

  // 执行路由追踪
  const handleTraceRoute = async (targetOverride = null) => {
    const target = targetOverride || destinationAddress;

    if (loading) {
      if (cancelRef.current) {
        cancelRef.current();
        cancelRef.current = null;
      }
      setLoading(false);
      return;
    }

    const { promise, cancel } = fetchTraceWithCancel(target, useCache, (hop) => {
      setTraceResults((prev) => [...prev, hop]);
    });

    setTraceResults([]);
    setRiskData(null);
    setLoading(true);
    cancelRef.current = cancel;

    try {
      const results = await promise;

      if (results.length > 0) {
        setRiskLoading(true);
        try {
          const riskAnalysis = await fetchRiskAnalysis(target, true);
          setRiskData(riskAnalysis);
        } catch (error) {
          console.error('Risk analysis failed:', error);
        } finally {
          setRiskLoading(false);
        }
      }

      fetchHistoryData();
    } catch (error) {
      console.error('Trace route failed:', error);
    } finally {
      setLoading(false);
      cancelRef.current = null;
    }
  };

  // 地图缩放控制
  const setZoomBtns = (type = 'init') => {
    if (!mapRef.current) return;

    const option = mapRef.current?.getOption();
    const geo = option.geo[0];
    const scaleLimit = geo.scaleLimit;
    let zoom = geo.zoom;
    let center = geo.center;

    switch (type) {
      case 'in':
        zoom = Math.min(scaleLimit.max, geo.zoom + 0.5);
        break;
      case 'out':
        zoom = Math.max(scaleLimit.min, geo.zoom - 0.5);
        break;
      case 'restore':
        const { center: defaultCenter, zoom: defaultZoom } = getMapViewOptions(extractMapData(traceResults, intl).countries);
        zoom = defaultZoom;
        center = defaultCenter;
        break;
    }

    setIsDdisabledzoomInBtn(zoom === scaleLimit.max);
    setIsDdisabledzoomOutBtn(zoom === scaleLimit.min);

    if (type !== 'init') {
      mapRef.current?.setOption({
        geo: { id: 'world', zoom, center },
      });
    }
  };

  // 初始化地图
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const { polylineCoords, countries, countriesData, linesData, hasUnknownNodes } = extractMapData(traceResults, intl);

    if (!mapRef.current) {
      echarts.registerMap('world', worldGeoJson);
      mapRef.current = echarts.init(mapContainerRef.current);
    }

    let currentCenter = DEFAULT_CENTER;
    let currentZoom = 1.2;

    if (countries.length > 0) {
      const { center, zoom } = getMapViewOptions(countries);
      currentCenter = center;
      currentZoom = zoom;
    } else if (mapRef.current) {
      const option = mapRef.current.getOption();
      if (option && option.geo && option.geo[0]) {
        currentCenter = option.geo[0].center || currentCenter;
        currentZoom = option.geo[0].zoom || currentZoom;
      }
    }

    const mapOption = {
      // 启用tooltip
      tooltip: {
        trigger: 'item',
        showDelay: 0,
        transitionDuration: 0.2,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: '#ccc',
        borderWidth: 1,
        textStyle: {
          color: '#fff'
        }
      },
      geo: {
        id: 'world',
        top: '20%',
        type: 'map',
        map: 'world',
        roam: 'move',
        center: currentCenter,
        scaleLimit: { min: 0.5, max: 4 },
        zoom: currentZoom,
        label: { show: false },
        tooltip: {
          show: false
        },
        itemStyle: {
          normal: {
            borderColor: '#d6e4ff',
            borderWidth: 0.3,
            areaColor: {
              type: 'linear-gradient',
              x: 0,
              y: 1200,
              x2: 1000,
              y2: 0,
              colorStops: [
                { offset: 0.3, color: '#6b8bf4' },
                { offset: 1, color: '#85a5ff' },
              ],
              global: true,
            },
          },
        },
        emphasis: {
          disabled: true,
          itemStyle: {
            areaColor: 'rgba(35 ,152, 244, .6)',
            borderWidth: 1,
          },
        },
      },
      series: [
        // 路径连线系列
        {
          type: 'lines',
          tooltip: {
            show: false
          },
          coordinateSystem: 'geo',
          data: linesData,
          // 移除了polyline: true，因为我们现在使用单独的线段
          effect: {
            show: linesData.length > 0,
            period: 4,
            trailLength: 0,
            color: '#ff6b6b',
            symbolSize: 10,
            symbol: 'arrow',
          },
          z: 3,
        },
        // 节点散点系列
        {
          type: 'effectScatter',
          coordinateSystem: 'geo',
          tooltip: {
            show: true
          },
          symbolSize: function (val, params) {
            // 起始点和终点稍大一些
            const data = params.data;
            if (data.rippleEffect && data.rippleEffect.number > 0) {
              return 12;
            }
            return 8;
          },
          labelLayout: { moveOverlap: 'shiftY' },
          data: countriesData,
          z: 4,
          // 启用hover效果
          emphasis: {
            scale: 1.2,
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        },

      ],
    };

    // 如果存在未知节点，在地图上添加提示
    if (hasUnknownNodes && traceResults.length > 0) {
      mapOption.graphic = [{
        type: 'text',
        right: 20,
        top: 30,
        style: {
          // text: '注意：路径中包含无法定位的节点（显示为虚线）',
          text: intl.formatMessage({ id: 'TraceResultsPanel.map.unknownHops' }),
          fontSize: 12,
          fill: '#ff6b00',
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderRadius: 4,
          padding: [4, 8]
        }
      }];
    }

    mapRef.current.setOption(mapOption, { notMerge: false });

    // 添加点击事件处理
    mapRef.current.off('click');
    mapRef.current.on('click', function (params) {
      if (params.componentType === 'series' && params.seriesType === 'effectScatter') {
        const hopData = params.data.rawData;
        if (hopData) {
          console.log('点击的跳点详情:', hopData);
          // 这里可以添加更多的点击处理逻辑，比如显示详细面板等
        }
      }
    });

    // 处理窗口大小变化
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapRef.current) {
        mapRef.current.off('click');
      }
    };
  }, [traceResults, intl]);

  useEffect(() => {
    fetchHistoryData();
  }, []);

  return (
    <ConfigProvider
      theme={{
        components: {
        }
      }}
    >
      <Flex vertical gap={0} className={classNames(
        "relative w-full min-h-full pt-6 px-10 pb-40",
        isDark ? "bg-gradient-to-br from-gray-900 to-gray-800" : "bg-gradient-to-br from-slate-50 to-blue-50"
      )}>
        <Alert 
          // className={classNames(
          //   "mb-5 border-0",
          //   isDark ? "bg-gray-800" : ""
          // )}
          className="mb-5"
          description={<p>{intl.formatMessage({ id: 'Locator.howto' })}</p>} 
          type="info" 
          showIcon 
        />

        <Flex gap={30} className="mb-2.5">
          <div className="flex-1">
            <h2 className={classNames(
              "text-lg font-medium mb-2",
              isDark ? "text-gray-200" : ""
            )}>
              {intl.formatMessage({ id: 'Locator.destination' })}
            </h2>
            <Input
              placeholder={intl.formatMessage({ id: 'Locator.destinationPlaceholder' })}
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              onPressEnter={() => { handleTraceRoute() }}
              className={classNames(
                "w-full",
                // isDark ? "placeholder:text-gray-500 text-gray-300 bg-gray-800" : "placeholder:text-gray-400"
              )}
            />
          </div>
          <Flex gap={20} align="end">
            <Button
              type={loading ? 'default' : 'primary'}
              danger={loading}
              icon={loading ? <StopOutlined /> : <SendOutlined />}
              onClick={() => handleTraceRoute()}
              className={classNames(
                isDark ? (loading ? "bg-[#374151] text-red-400 border-red-400" : "") : ""
              )}
            >
              {intl.formatMessage({ id: loading ? 'Locator.cancelBtn' : 'Locator.startBtn' })}
            </Button>
            <Checkbox 
              checked={useCache} 
              onChange={(e) => setUseCache(e.target.checked)} 
              disabled={loading}
            >
              {intl.formatMessage({ id: 'Locator.useCache' })}
            </Checkbox>
          </Flex>
        </Flex>

        {/* Map and Overlay Container */}
        <div className="w-full h-[500px] relative">
          {/* ECharts Map will render here */}
          <div className="w-full h-full" ref={mapContainerRef}></div>

          {/* Zoom buttons - 保持原有的缩放按钮 */}
          <div className="absolute top-1/2 right-0.5 flex flex-col z-10 overflow-hidden rounded-md backdrop-blur-md opacity-50 transition-opacity duration-300 hover:opacity-100">
            <Button
              className="text-[12px] rounded-none border-none bg-[rgba(57,135,230,0.4)] hover:bg-[rgba(57,135,230,0.8)] p-0 mb-[1px] text-blue-50"
              size="small"
              onClick={() => setZoomBtns('in')}
              type="text"
              disabled={isDdisabledzoomInBtn}
              icon={<PlusOutlined />}
            />
            <Button
              className="text-[10px] rounded-none border-none bg-[rgba(57,135,230,0.4)] hover:bg-[rgba(57,135,230,0.8)] p-0 mb-[1px] [&>span]:scale-80 text-blue-50"
              size="small"
              onClick={() => setZoomBtns('restore')}
              type="text"
            >
              1 : 1
            </Button>
            <Button
              className="text-[12px] rounded-none border-none bg-[rgba(57,135,230,0.4)] hover:bg-[rgba(57,135,230,0.8)] text-blue-50"
              size="small"
              disabled={isDdisabledzoomOutBtn}
              onClick={() => setZoomBtns('out')}
              type="text"
              icon={<MinusOutlined />}
            />
          </div>
        </div>

        {/* Risk Analysis Panel (remains below the map) */}
        <RiskAnalysisPanel riskData={riskData} loading={riskLoading} />

        {/* History Panel (remains at the bottom) */}
        <HistoryPanel
          historyData={historyData}
          onHistoryItemClick={handleHistoryItemClick}
          onRefresh={fetchHistoryData}
          loading={loading}
          intl={intl}
        />

        {/* MODIFICATION: 现在 TraceResultsPanel 自带拖拽功能，直接使用 */}
        <TraceResultsPanel traceResults={traceResults} loading={loading} />
      </Flex>
    </ConfigProvider>
  );
};

export default Locator;