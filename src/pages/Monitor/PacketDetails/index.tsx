import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import PacketHeader from './PacketHeader';
import PacketItem from './PacketItem';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

interface IPv4PacketData {
  timestamp: string;
  interface: number;
  direction: number;
  length: number;
  content: string;
  srcAddress: string;
  dstAddress: string;
  srcPort: number;
  dstPort: number;
  protocol: string;
  ipId: number;
  ttl: number;
  fragInfo: string;
  options: string;
}

interface IPv6PacketData {
  timestamp: string;
  interface: number;
  direction: number;
  length: number;
  content: string;
  srcAddress: string;
  dstAddress: string;
  headerType: string;
  srcPort: number;
  dstPort: number;
}

interface PacketDetailsProps {
  queryParams: {
    srcip: string;
    dstip: string;
    srcport: number;
    dstport: number;
    ipver?: number;
  } | null;
}

const PacketDetails: React.FC<PacketDetailsProps> = ({ queryParams }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  
  console.log(JSON.stringify(queryParams), 'queryParams');
  const [loading, setLoading] = useState(false);
  const [packetData, setPacketData] = useState<(IPv4PacketData | IPv6PacketData)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedPackets, setExpandedPackets] = useState<Set<number>>(new Set([0])); // 默认展开第一个

  const fetchData = async (params) => {
    try {
      // 构造表单数据
      const formData = new URLSearchParams();
      formData.append('srcip', params.srcip);
      formData.append('dstip', params.dstip);
      formData.append('srcport', params.srcport);
      formData.append('dstport', params.dstport);
      formData.append('ipver', params.ipver);
      formData.append('count', params.count ?? 40);

      // 发起POST请求
      // const res = await fetch('http://127.0.0.1:19999/QueryPacket', {
      const res = await fetch('http://127.0.0.1:19999/GetRecentPacket', {
        method: 'POST',
        body: formData,
      });
      // 判断请求是否成功
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      // 解析返回的JSON数据
      return res.json();
    } catch (err) {
      console.error('请求失败：', err);
    }
  };

  const togglePacketExpansion = (index: number) => {
    const newExpanded = new Set(expandedPackets);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedPackets(newExpanded);
  };

  // 合并展开/收起功能
  const toggleAllPackets = () => {
    const allExpanded = expandedPackets.size === packetData.length;
    if (allExpanded) {
      setExpandedPackets(new Set());
    } else {
      setExpandedPackets(new Set(Array.from({ length: packetData.length }, (_, i) => i)));
    }
  };

  // 刷新数据
  const handleRefresh = async (params) => {
    if (!queryParams) return;
    console.log('params', params);
    setLoading(true);
    setError(null);

    try {
      const packetDataArray = (await fetchData(params || queryParams)) || [];
      console.log(packetDataArray, 'refreshed packetDataArray');

      const parsedPackets = packetDataArray.map((packetData) => {
        if (queryParams.ipver === 4) {
          return {
            timestamp: packetData[0],
            interface: packetData[1],
            direction: packetData[2],
            length: packetData[3],
            content: packetData[4],
            srcAddress: packetData[5],
            dstAddress: packetData[6],
            srcPort: packetData[7],
            dstPort: packetData[8],
            protocol: packetData[9],
            ipId: packetData[10],
            ttl: packetData[11],
            fragInfo: packetData[12],
            options: packetData[13],
          } as IPv4PacketData;
        } else {
          return {
            timestamp: packetData[0],
            interface: packetData[1],
            direction: packetData[2],
            length: packetData[3],
            content: packetData[4],
            srcAddress: packetData[5],
            dstAddress: packetData[6],
            headerType: packetData[7],
            srcPort: packetData[8],
            dstPort: packetData[9],
          } as IPv6PacketData;
        }
      });

      setPacketData(parsedPackets);
      setExpandedPackets(new Set([0])); // 默认展开第一个
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error refreshing packet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAllPackets = () => {
    handleRefresh({ ...queryParams, count: 20000 });
  };

  useEffect(() => {
    if (!queryParams) {
      return;
    }

    const fetchPacketData = async () => {
      setLoading(true);
      setError(null);
      setPacketData([]);

      try {
        const packetDataArray = (await fetchData(queryParams)) || [];
        console.log(packetDataArray, 'packetDataArray');

        const parsedPackets = packetDataArray.map((packetData) => {
          if (queryParams.ipver === 4) {
            return {
              timestamp: packetData[0],
              interface: packetData[1],
              direction: packetData[2],
              length: packetData[3],
              content: packetData[4],
              srcAddress: packetData[5],
              dstAddress: packetData[6],
              srcPort: packetData[7],
              dstPort: packetData[8],
              protocol: packetData[9],
              ipId: packetData[10],
              ttl: packetData[11],
              fragInfo: packetData[12],
              options: packetData[13],
            } as IPv4PacketData;
          } else {
            return {
              timestamp: packetData[0],
              interface: packetData[1],
              direction: packetData[2],
              length: packetData[3],
              content: packetData[4],
              srcAddress: packetData[5],
              dstAddress: packetData[6],
              headerType: packetData[7],
              srcPort: packetData[8],
              dstPort: packetData[9],
            } as IPv6PacketData;
          }
        });

        setPacketData(parsedPackets);
        setExpandedPackets(new Set([0])); // 默认展开第一个
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error fetching packet data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPacketData();
  }, [queryParams]);

  if (!queryParams) {
    return <EmptyState type="no-selection" />;
  }

  // 判断是否全部展开
  const allExpanded = packetData.length > 0 && expandedPackets.size === packetData.length;

  return (
    <div className={classNames(
      "h-full w-full flex flex-col min-w-[500px] border-l",
      isDark 
        ? "bg-gray-900 border-gray-700" 
        : "bg-gray-50 border-gray-200"
    )}>
      {/* 头部摘要 */}
      <PacketHeader
        queryParams={queryParams}
        packetData={packetData}
        loading={loading}
        allExpanded={allExpanded}
        onToggleAll={toggleAllPackets}
        onRefresh={() => handleRefresh()}
        onViewAllPackets={handleViewAllPackets}
      />

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto p-4">
        {loading && <LoadingState />}

        {error && <ErrorState error={error} />}

        {!loading && !error && packetData.length === 0 && (
          <EmptyState type="no-packets" />
        )}

        {!loading && !error && packetData.length > 0 && (
          <div className="space-y-4">
            {packetData.map((packet, index) => (
              <PacketItem
                key={index}
                packet={packet}
                index={index}
                isExpanded={expandedPackets.has(index)}
                onToggle={() => togglePacketExpansion(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PacketDetails;