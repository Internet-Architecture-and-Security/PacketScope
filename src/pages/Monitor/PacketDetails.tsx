import React, { useState, useEffect } from 'react';
import { Spin, Button } from 'antd';
import {
  GlobalOutlined,
  ExportOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  GatewayOutlined,
  CodeOutlined,
  ApartmentOutlined,
  FlagOutlined,
  NodeIndexOutlined,
  FieldTimeOutlined,
  ToolOutlined,
  CaretRightOutlined,
  CaretDownOutlined,
  NumberOutlined,
  ReloadOutlined,
  ExpandOutlined,
  CompressOutlined,
} from '@ant-design/icons';
import { Play, ArrowLeft, Clock, Hash, Boxes, X, Search, Filter, RotateCcw, PackageSearch } from 'lucide-react';
import { Link } from 'react-router';
import { useIntl } from 'react-intl';

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

// 辅助组件：详情行 - IDE风格
const DetailRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div className="flex items-center px-4 py-1.5 hover:bg-gray-50/30 transition-colors duration-100">
    <div className="flex items-center text-xs text-gray-500 w-32 flex-shrink-0">
      <span className="w-4 text-center mr-2 text-gray-400">{icon}</span>
      <span>{label}</span>
    </div>
    <div className="text-xs text-gray-700 flex items-center">{children}</div>
  </div>
);

// 辅助组件：可折叠详情区块 - IDE风格
const DetailCard: React.FC<{ title: string; children: React.ReactNode; defaultCollapsed?: boolean }> = ({
  title,
  children,
  defaultCollapsed = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <div
        className="flex items-center px-4 py-2 text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-100/50 transition-colors duration-100 select-none"
        onClick={toggleExpand}
      >
        {isExpanded ? <CaretDownOutlined className="mr-2 text-gray-400" /> : <CaretRightOutlined className="mr-2 text-gray-400" />}
        <span className="uppercase tracking-wide">{title}</span>
      </div>
      {isExpanded && <div>{children}</div>}
    </div>
  );
};

// 新增：单个数据包组件
const PacketItem: React.FC<{
  packet: IPv4PacketData | IPv6PacketData;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ packet, index, isExpanded, onToggle }) => {
  const intl = useIntl();
  const [showHexView, setShowHexView] = useState(false);
  const isIPv4 = 'protocol' in packet;

  const getDirectionText = (direction: number): string => {
    return direction === 0 ? intl.formatMessage({ id: 'PacketDetails.inbound' }) : intl.formatMessage({ id: 'PacketDetails.outbound' });
  };

  const getDirectionColor = (direction: number): string => {
    return direction === 0 ? 'text-green-400' : 'text-blue-400';
  };

  const getDirectionBg = (direction: number): string => {
    return direction === 0 ? 'bg-green-600/10' : 'bg-blue-600/10';
  };

  const formatHexContent = (content: string) => {
    const bytes = content.replace(/\s+/g, ' ').trim().split(' ');
    const lines = [];

    for (let i = 0; i < bytes.length; i += 16) {
      const line = bytes.slice(i, i + 16);
      const offset = i.toString(16).padStart(4, '0').toUpperCase();
      const hex = line.join(' ').padEnd(47, ' ');
      const ascii = line
        .map((byte) => {
          const val = parseInt(byte, 16);
          return val >= 32 && val <= 126 ? String.fromCharCode(val) : '.';
        })
        .join('');

      lines.push(`${offset}  ${hex}  ${ascii}`);
    }

    return lines.join('\n');
  };

  // 数据包摘要信息 - IDE风格
  const packetSummary = (
    <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50/50 cursor-pointer transition-colors duration-100 select-none">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-gray-500 w-8">#{index + 1}</span>
          <span className={`text-xs font-medium ${getDirectionColor(packet.direction)}`}>{getDirectionText(packet.direction)}</span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-mono text-gray-600">{packet.timestamp}</span>
          <span className="text-gray-400">|</span>
          <span className="font-mono text-blue-600">{packet.length}B</span>
          <span className="text-gray-400">|</span>
          <span className="text-purple-600 font-medium">{isIPv4 ? packet.protocol : packet.headerType}</span>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <span className="text-xs font-mono text-gray-600">
          {packet.srcAddress}:{packet.srcPort} → {packet.dstAddress}:{packet.dstPort}
        </span>
        <div className="w-4 h-4 flex items-center justify-center">
          {isExpanded ? <CaretDownOutlined className="text-gray-400 text-xs" /> : <CaretRightOutlined className="text-gray-400 text-xs" />}
        </div>
      </div>
    </div>
  );

  const packetDetails = (
    <div className={`ml-6 ${getDirectionBg(packet.direction)}`}>
      <DetailCard title={intl.formatMessage({ id: 'PacketDetails.captureDetails' })}>
        <DetailRow icon={<ClockCircleOutlined />} label={intl.formatMessage({ id: 'PacketDetails.timestamp' })}>
          <span className="font-mono text-xs text-gray-700">{packet.timestamp}</span>
        </DetailRow>
        <DetailRow icon={<GatewayOutlined />} label={intl.formatMessage({ id: 'PacketDetails.interface' })}>
          <span className="text-xs text-gray-600">{intl.formatMessage({ id: 'PacketDetails.interfaceNumber' }, { number: packet.interface })}</span>
        </DetailRow>
        <DetailRow icon={<SwapOutlined />} label={intl.formatMessage({ id: 'PacketDetails.direction' })}>
          <span className={`text-xs font-medium ${getDirectionColor(packet.direction)}`}>{getDirectionText(packet.direction)}</span>
        </DetailRow>
        <DetailRow icon={<NodeIndexOutlined />} label={intl.formatMessage({ id: 'PacketDetails.packetLength' })}>
          <span className="font-mono text-blue-600 text-xs">{packet.length} bytes</span>
        </DetailRow>
      </DetailCard>

      <DetailCard title={intl.formatMessage({ id: 'PacketDetails.networkLayer' }, { version: isIPv4 ? '4' : '6' })}>
        <DetailRow icon={<GlobalOutlined style={{ color: 'rgb(34, 197, 94)' }} />} label={intl.formatMessage({ id: 'PacketDetails.sourceAddress' })}>
          <span className="font-mono text-green-600 text-xs">{packet.srcAddress}</span>
        </DetailRow>
        <DetailRow icon={<GlobalOutlined style={{ color: 'rgb(239, 68, 68)' }} />} label={intl.formatMessage({ id: 'PacketDetails.destinationAddress' })}>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-red-600 text-xs">{packet.dstAddress}</span>
            <Link
              to={`/locator?target=${packet.dstAddress}`}
              className="text-blue-500 hover:text-blue-700 text-xs flex items-center hover:underline"
            >
              {intl.formatMessage({ id: 'PacketDetails.trace' })} <ExportOutlined className="ml-1" />
            </Link>
          </div>
        </DetailRow>
        {isIPv4 && (
          <>
            <DetailRow icon={<FlagOutlined />} label={intl.formatMessage({ id: 'PacketDetails.protocolType' })}>
              <span className="text-purple-600 text-xs font-medium">{packet.protocol}</span>
            </DetailRow>
            <DetailRow icon={<FieldTimeOutlined />} label={intl.formatMessage({ id: 'PacketDetails.ttl' })}>
              <span className="font-mono text-xs">{packet.ttl}</span>
            </DetailRow>
            <DetailRow icon={<ApartmentOutlined />} label={intl.formatMessage({ id: 'PacketDetails.fragmentInfo' })}>
              <span className="text-xs text-gray-600">{packet.fragInfo || intl.formatMessage({ id: 'PacketDetails.none' })}</span>
            </DetailRow>
            <DetailRow icon={<ToolOutlined />} label={intl.formatMessage({ id: 'PacketDetails.options' })}>
              <span className="text-xs text-gray-600">{packet.options || intl.formatMessage({ id: 'PacketDetails.none' })}</span>
            </DetailRow>
          </>
        )}
        {!isIPv4 && (
          <DetailRow icon={<FlagOutlined />} label={intl.formatMessage({ id: 'PacketDetails.headerType' })}>
            <span className="text-purple-600 text-xs font-medium">{packet.headerType}</span>
          </DetailRow>
        )}
      </DetailCard>

      <DetailCard title={intl.formatMessage({ id: 'PacketDetails.transportLayer' })}>
        <DetailRow icon={<GatewayOutlined style={{ color: 'rgb(34, 197, 94)' }} />} label={intl.formatMessage({ id: 'PacketDetails.sourcePort' })}>
          <span className="font-mono text-green-600 text-xs">{packet.srcPort}</span>
        </DetailRow>
        <DetailRow icon={<GatewayOutlined style={{ color: 'rgb(239, 68, 68)' }} />} label={intl.formatMessage({ id: 'PacketDetails.destinationPort' })}>
          <span className="font-mono text-red-600 text-xs">{packet.dstPort}</span>
        </DetailRow>
      </DetailCard>

      <DetailCard title={intl.formatMessage({ id: 'PacketDetails.content' })} defaultCollapsed={true}>
        <div className="px-4 py-3">
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setShowHexView(!showHexView)}
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                showHexView ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {showHexView ? 'Raw' : 'Hex'}
            </button>
          </div>
          {showHexView ? (
            <div className="bg-gray-900 text-green-400 p-3 font-mono text-xs overflow-x-auto">
              <pre>{formatHexContent(packet.content)}</pre>
            </div>
          ) : (
            <div className="bg-gray-50 p-3">
              <div className="font-mono text-xs break-all leading-relaxed text-gray-700">{packet.content}</div>
            </div>
          )}
        </div>
      </DetailCard>
    </div>
  );

  return (
    <div className="border-l-2 border-transparent hover:border-blue-300 transition-colors duration-100">
      <div onClick={onToggle}>{packetSummary}</div>
      {isExpanded && packetDetails}
    </div>
  );
};

const PacketDetails: React.FC<PacketDetailsProps> = ({ queryParams }) => {
  const intl = useIntl();
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
    return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-500 mb-2">{intl.formatMessage({ id: 'PacketDetails.analyzer' })}</div>
          <div className="text-sm text-slate-400">{intl.formatMessage({ id: 'PacketDetails.selectConnection' })}</div>
        </div>
      </div>
    );
  }

  // 判断是否全部展开
  const allExpanded = packetData.length > 0 && expandedPackets.size === packetData.length;

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 min-w-[500px] border-l border-gray-200">
      {/* 头部摘要 */}
      <div className="bg-white border-b border-gray-200 p-2">
        <div className="flex items-center justify-between mb-3">
          {/* <h3 className="font-bold text-gray-800">会话流摘要</h3> */}
          <div className="flex items-center gap-3">
            <Boxes className="text-blue-600" size={20} />
            <div className="font-semibold text-base text-slate-900">{intl.formatMessage({ id: 'PacketDetails.analyzer' })}</div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleAllPackets}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center"
              disabled={packetData.length === 0}
            >
              {allExpanded ? (
                <>
                  <CompressOutlined className="mr-1" />
                  {intl.formatMessage({ id: 'PacketDetails.collapseAll' })}
                </>
              ) : (
                <>
                  <ExpandOutlined className="mr-1" />
                  {intl.formatMessage({ id: 'PacketDetails.expandAll' })}
                </>
              )}
            </button>
            <button
              onClick={() => handleRefresh()}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center"
              disabled={loading}
            >
              <ReloadOutlined className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
              {intl.formatMessage({ id: 'PacketDetails.refresh' })}
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-sm">
          <span className="flex items-center bg-green-50 text-green-800 px-3 py-1 rounded-full font-mono">
            {queryParams.srcip}:{queryParams.srcport}
          </span>
          <span className="text-gray-400 font-sans text-lg">→</span>
          <span className="flex items-center bg-red-50 text-red-800 px-3 py-1 rounded-full font-mono">
            {queryParams.dstip}:{queryParams.dstport}
          </span>
          <span className="ml-auto bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-semibold text-xs">IPv{queryParams.ipver}</span>
        </div>
        {packetData.length > 0 && (
          <div className="mt-3 text-sm text-gray-600 flex space-x-3">
            <span className="flex items-center">
              <NumberOutlined className="mr-1" />
              {packetData.length === 80 
                ? intl.formatMessage({ id: 'PacketDetails.showingRecent' }, { count: packetData.length })
                : intl.formatMessage({ id: 'PacketDetails.foundPackets' }, { count: packetData.length })
              }
            </span>
            {packetData.length === 80 && (
              <button
                onClick={() => {
                  handleRefresh({ ...queryParams, count: 20000 });
                }}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center cursor-pointer"
              >
                <PackageSearch size={14} className="mr-1" />
                {intl.formatMessage({ id: 'PacketDetails.viewAllPackets' })}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-64">
            {/* <div className="text-center"> */}
            {/* <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div> */}
            <Spin size="default" className="mr-2" />
            <p className="text-gray-600">{intl.formatMessage({ id: 'PacketDetails.loading' })}</p>
            {/* </div> */}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="text-red-600 mr-3">⚠️</div>
              <div>
                <h4 className="text-red-800 font-medium">{intl.formatMessage({ id: 'PacketDetails.loadFailed' })}</h4>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && packetData.length === 0 && (
          <div className="text-center py-16">
            <div className="text-gray-400 text-6xl mb-4">📭</div>
            <h4 className="text-lg font-medium text-gray-600 mb-2">{intl.formatMessage({ id: 'PacketDetails.noPacketsFound' })}</h4>
            <p className="text-gray-500">{intl.formatMessage({ id: 'PacketDetails.noPacketsDescription' })}</p>
          </div>
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