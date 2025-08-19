import React, { useState, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';

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

  const [loading, setLoading] = useState(true);
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
        setIsReady(true);
        setLoading(false);
      }
    };

    ws.onerror = (error) => {
      console.error(`${websocketType} WebSocket错误:`, error);
      setError(intl.formatMessage({ id: 'ProtocolStackMonitor.connectionFailed' }));
      setIsReady(true);
      setLoading(false);
    };

    ws.onclose = () => {
      console.log(`${websocketType} WebSocket连接已关闭`);
      setIsReady(true);
      setLoading(false);
    };
  };

  useEffect(() => {
    setIsReady(true);
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

export default useWebSocketData;