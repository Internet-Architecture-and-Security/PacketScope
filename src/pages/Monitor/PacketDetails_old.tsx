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
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

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
const DetailRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  
  return (
    <div className={classNames(
      "flex items-center px-4 py-1.5 transition-colors duration-100",
      isDark 
        ? "hover:bg-gray-800/30" 
        : "hover:bg-gray-50/30"
    )}>
      <div className={classNames(
        "flex items-center text-xs w-32 flex-shrink-0",
        isDark ? "text-gray-400" : "text-gray-500"
      )}>
        <span className={classNames(
          "w-4 text-center mr-2",
          isDark ? "text-gray-500" : "text-gray-400"
        )}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={classNames(
        "text-xs flex items-center",
        isDark ? "text-gray-300" : "text-gray-700"
      )}>{children}</div>
    </div>
  );
};

// 辅助组件：可折叠详情区块 - IDE风格
const DetailCard: React.FC<{ title: string; children: React.ReactNode; defaultCollapsed?: boolean }> = ({
  title,
  children,
  defaultCollapsed = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <div
        className={classNames(
          "flex items-center px-4 py-2 text-xs font-medium cursor-pointer transition-colors duration-100 select-none",
          isDark 
            ? "text-gray-400 hover:bg-gray-800/50" 
            : "text-gray-600 hover:bg-gray-100/50"
        )}
        onClick={toggleExpand}
      >
        {isExpanded ? 
          <CaretDownOutlined className={classNames("mr-2", isDark ? "text-gray-500" : "text-gray-400")} /> : 
          <CaretRightOutlined className={classNames("mr-2", isDark ? "text-gray-500" : "text-gray-400")} />
        }
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
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const isIPv4 = 'protocol' in packet;

  const getDirectionText = (direction: number): string => {
    return direction === 0 ? intl.formatMessage({ id: 'PacketDetails.inbound' }) : intl.formatMessage({ id: 'PacketDetails.outbound' });
  };

  const getDirectionColor = (direction: number): string => {
    if (isDark) {
      return direction === 0 ? 'text-green-400' : 'text-blue-400';
    }
    return direction === 0 ? 'text-green-600' : 'text-blue-600';
  };

  const getDirectionBg = (direction: number): string => {
    if (isDark) {
      return direction === 0 ? 'bg-green-500/10' : 'bg-blue-500/10';
    }
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
    <div className={classNames(
      "flex items-center justify-between px-4 py-2 cursor-pointer transition-colors duration-100 select-none",
      isDark 
        ? "hover:bg-gray-800/50" 
        : "hover:bg-gray-50/50"
    )}>
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className={classNames(
            "text-xs font-mono w-8",
            isDark ? "text-gray-400" : "text-gray-500"
          )}>#{index + 1}</span>
          <span className={`text-xs font-medium ${getDirectionColor(packet.direction)}`}>{getDirectionText(packet.direction)}</span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className={classNames(
            "font-mono",
            isDark ? "text-gray-300" : "text-gray-600"
          )}>{packet.timestamp}</span>
          <span className={classNames(
            isDark ? "text-gray-500" : "text-gray-400"
          )}>|</span>
          <span className={classNames(
            "font-mono font-medium",
            isDark ? "text-blue-400" : "text-blue-600"
          )}>{packet.length}B</span>
          <span className={classNames(
            isDark ? "text-gray-500" : "text-gray-400"
          )}>|</span>
          <span className={classNames(
            "font-medium",
            isDark ? "text-purple-400" : "text-purple-600"
          )}>{isIPv4 ? packet.protocol : packet.headerType}</span>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <span className={classNames(
          "text-xs font-mono",
          isDark ? "text-gray-300" : "text-gray-600"
        )}>
          {packet.srcAddress}:{packet.srcPort} → {packet.dstAddress}:{packet.dstPort}
        </span>
        <div className="w-4 h-4 flex items-center justify-center">
          {isExpanded ? 
            <CaretDownOutlined className={classNames("text-xs", isDark ? "text-gray-500" : "text-gray-400")} /> : 
            <CaretRightOutlined className={classNames("text-xs", isDark ? "text-gray-500" : "text-gray-400")} />
          }
        </div>
      </div>
    </div>
  );

  const packetDetails = (
    <div className={`ml-6 ${getDirectionBg(packet.direction)}`}>
      <DetailCard title={intl.formatMessage({ id: 'PacketDetails.captureDetails' })}>
        <DetailRow icon={<ClockCircleOutlined />} label={intl.formatMessage({ id: 'PacketDetails.timestamp' })}>
          <span className={classNames(
            "font-mono text-xs",
            isDark ? "text-gray-300" : "text-gray-700"
          )}>{packet.timestamp}</span>
        </DetailRow>
        <DetailRow icon={<GatewayOutlined />} label={intl.formatMessage({ id: 'PacketDetails.interface' })}>
          <span className={classNames(
            "text-xs",
            isDark ? "text-gray-300" : "text-gray-600"
          )}>{intl.formatMessage({ id: 'PacketDetails.interfaceNumber' }, { number: packet.interface })}</span>
        </DetailRow>
        <DetailRow icon={<SwapOutlined />} label={intl.formatMessage({ id: 'PacketDetails.direction' })}>
          <span className={`text-xs font-medium ${getDirectionColor(packet.direction)}`}>{getDirectionText(packet.direction)}</span>
        </DetailRow>
        <DetailRow icon={<NodeIndexOutlined />} label={intl.formatMessage({ id: 'PacketDetails.packetLength' })}>
          <span className={classNames(
            "font-mono text-xs",
            isDark ? "text-blue-400" : "text-blue-600"
          )}>{packet.length} bytes</span>
        </DetailRow>
      </DetailCard>

      <DetailCard title={intl.formatMessage({ id: 'PacketDetails.networkLayer' }, { version: isIPv4 ? '4' : '6' })}>
        <DetailRow icon={<GlobalOutlined style={{ color: isDark ? 'rgb(74, 222, 128)' : 'rgb(34, 197, 94)' }} />} label={intl.formatMessage({ id: 'PacketDetails.sourceAddress' })}>
          <span className={classNames(
            "font-mono text-xs",
            isDark ? "text-green-400" : "text-green-600"
          )}>{packet.srcAddress}</span>
        </DetailRow>
        <DetailRow icon={<GlobalOutlined style={{ color: isDark ? 'rgb(248, 113, 113)' : 'rgb(239, 68, 68)' }} />} label={intl.formatMessage({ id: 'PacketDetails.destinationAddress' })}>
          <div className="flex items-center space-x-2">
            <span className={classNames(
              "font-mono text-xs",
              isDark ? "text-red-400" : "text-red-600"
            )}>{packet.dstAddress}</span>
            <Link
              to={`/locator?target=${packet.dstAddress}`}
              className={classNames(
                "text-xs flex items-center hover:underline transition-colors",
                isDark 
                  ? "text-blue-400 hover:text-blue-300" 
                  : "text-blue-500 hover:text-blue-700"
              )}
            >
              {intl.formatMessage({ id: 'PacketDetails.trace' })} <ExportOutlined className="ml-1" />
            </Link>
          </div>
        </DetailRow>
        {isIPv4 && (
          <>
            <DetailRow icon={<FlagOutlined />} label={intl.formatMessage({ id: 'PacketDetails.protocolType' })}>
              <span className={classNames(
                "text-xs font-medium",
                isDark ? "text-purple-400" : "text-purple-600"
              )}>{packet.protocol}</span>
            </DetailRow>
            <DetailRow icon={<FieldTimeOutlined />} label={intl.formatMessage({ id: 'PacketDetails.ttl' })}>
              <span className="font-mono text-xs">{packet.ttl}</span>
            </DetailRow>
            <DetailRow icon={<ApartmentOutlined />} label={intl.formatMessage({ id: 'PacketDetails.fragmentInfo' })}>
              <span className={classNames(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-600"
              )}>{packet.fragInfo || intl.formatMessage({ id: 'PacketDetails.none' })}</span>
            </DetailRow>
            <DetailRow icon={<ToolOutlined />} label={intl.formatMessage({ id: 'PacketDetails.options' })}>
              <span className={classNames(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-600"
              )}>{packet.options || intl.formatMessage({ id: 'PacketDetails.none' })}</span>
            </DetailRow>
          </>
        )}
        {!isIPv4 && (
          <DetailRow icon={<FlagOutlined />} label={intl.formatMessage({ id: 'PacketDetails.headerType' })}>
            <span className={classNames(
              "text-xs font-medium",
              isDark ? "text-purple-400" : "text-purple-600"
            )}>{packet.headerType}</span>
          </DetailRow>
        )}
      </DetailCard>

      <DetailCard title={intl.formatMessage({ id: 'PacketDetails.transportLayer' })}>
        <DetailRow icon={<GatewayOutlined style={{ color: isDark ? 'rgb(74, 222, 128)' : 'rgb(34, 197, 94)' }} />} label={intl.formatMessage({ id: 'PacketDetails.sourcePort' })}>
          <span className={classNames(
            "font-mono text-xs",
            isDark ? "text-green-400" : "text-green-600"
          )}>{packet.srcPort}</span>
        </DetailRow>
        <DetailRow icon={<GatewayOutlined style={{ color: isDark ? 'rgb(248, 113, 113)' : 'rgb(239, 68, 68)' }} />} label={intl.formatMessage({ id: 'PacketDetails.destinationPort' })}>
          <span className={classNames(
            "font-mono text-xs",
            isDark ? "text-red-400" : "text-red-600"
          )}>{packet.dstPort}</span>
        </DetailRow>
      </DetailCard>

      <DetailCard title={intl.formatMessage({ id: 'PacketDetails.content' })} defaultCollapsed={true}>
        <div className="px-4 py-3">
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setShowHexView(!showHexView)}
              className={classNames(
                "px-2 py-1 text-xs font-medium transition-colors",
                showHexView 
                  ? (isDark ? "bg-blue-500 text-white" : "bg-blue-600 text-white")
                  : (isDark 
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )
              )}
            >
              {showHexView ? 'Raw' : 'Hex'}
            </button>
          </div>
          {showHexView ? (
            <div className={classNames(
              "p-3 font-mono text-xs overflow-x-auto",
              isDark 
                ? "bg-gray-900 text-green-400" 
                : "bg-gray-900 text-green-400"
            )}>
              <pre>{formatHexContent(packet.content)}</pre>
            </div>
          ) : (
            <div className={classNames(
              "p-3",
              isDark ? "bg-gray-800" : "bg-gray-50"
            )}>
              <div className={classNames(
                "font-mono text-xs break-all leading-relaxed",
                isDark ? "text-gray-300" : "text-gray-700"
              )}>{packet.content}</div>
            </div>
          )}
        </div>
      </DetailCard>
    </div>
  );

  return (
    <div className={classNames(
      "border-l-2 border-transparent transition-colors duration-100",
      isDark 
        ? "hover:border-blue-400" 
        : "hover:border-blue-300"
    )}>
      <div onClick={onToggle}>{packetSummary}</div>
      {isExpanded && packetDetails}
    </div>
  );
};

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
      <div className={classNames(
        "h-full w-full flex items-center justify-center",
        isDark ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="text-center">
          <Boxes className={classNames(
            "w-12 h-12 mx-auto mb-4",
            isDark ? "text-gray-600" : "text-gray-300"
          )} />
          <div className={classNames(
            "text-lg font-semibold mb-2",
            isDark ? "text-gray-400" : "text-slate-500"
          )}>{intl.formatMessage({ id: 'PacketDetails.analyzer' })}</div>
          <div className={classNames(
            "text-sm",
            isDark ? "text-gray-500" : "text-slate-400"
          )}>{intl.formatMessage({ id: 'PacketDetails.selectConnection' })}</div>
        </div>
      </div>
    );
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
      <div className={classNames(
        "border-b p-2",
        isDark 
          ? "bg-gray-800 border-gray-700" 
          : "bg-white border-gray-200"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Boxes className={classNames(
              isDark ? "text-blue-400" : "text-blue-600"
            )} size={20} />
            <div className={classNames(
              "font-semibold text-base",
              isDark ? "text-gray-200" : "text-slate-900"
            )}>{intl.formatMessage({ id: 'PacketDetails.analyzer' })}</div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleAllPackets}
              className={classNames(
                "px-3 py-1 text-xs rounded transition-colors flex items-center",
                isDark
                  ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              )}
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
              className={classNames(
                "px-3 py-1 text-xs rounded transition-colors flex items-center",
                isDark
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
              disabled={loading}
            >
              <ReloadOutlined className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
              {intl.formatMessage({ id: 'PacketDetails.refresh' })}
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-sm">
          <span className={classNames(
            "flex items-center px-3 py-1 rounded-full font-mono",
            isDark 
              ? "bg-green-500/20 text-green-400" 
              : "bg-green-50 text-green-800"
          )}>
            {queryParams.srcip}:{queryParams.srcport}
          </span>
          <span className={classNames(
            "font-sans text-lg",
            isDark ? "text-gray-500" : "text-gray-400"
          )}>→</span>
          <span className={classNames(
            "flex items-center px-3 py-1 rounded-full font-mono",
            isDark 
              ? "bg-red-500/20 text-red-400" 
              : "bg-red-50 text-red-800"
          )}>
            {queryParams.dstip}:{queryParams.dstport}
          </span>
          <span className={classNames(
            "ml-auto px-3 py-1 rounded-full font-semibold text-xs",
            isDark 
              ? "bg-gray-700 text-gray-300" 
              : "bg-gray-100 text-gray-700"
          )}>IPv{queryParams.ipver}</span>
        </div>
        {packetData.length > 0 && (
          <div className={classNames(
            "mt-3 text-sm flex space-x-3",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
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
                className={classNames(
                  "px-3 py-1 text-xs rounded transition-colors flex items-center cursor-pointer",
                  isDark
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
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
            <Spin size="default" className="mr-2" />
            <p className={classNames(
              isDark ? "text-gray-400" : "text-gray-600"
            )}>{intl.formatMessage({ id: 'PacketDetails.loading' })}</p>
          </div>
        )}

        {error && (
          <div className={classNames(
            "border rounded-lg p-4 mb-4",
            isDark 
              ? "bg-red-900/20 border-red-800/50" 
              : "bg-red-50 border-red-200"
          )}>
            <div className="flex items-center">
              <div className={classNames(
                "mr-3",
                isDark ? "text-red-400" : "text-red-600"
              )}>⚠️</div>
              <div>
                <h4 className={classNames(
                  "font-medium",
                  isDark ? "text-red-400" : "text-red-800"
                )}>{intl.formatMessage({ id: 'PacketDetails.loadFailed' })}</h4>
                <p className={classNames(
                  "text-sm mt-1",
                  isDark ? "text-red-300" : "text-red-600"
                )}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && packetData.length === 0 && (
          <div className="text-center py-16">
            <div className={classNames(
              "text-6xl mb-4",
              isDark ? "text-gray-600" : "text-gray-400"
            )}>📭</div>
            <h4 className={classNames(
              "text-lg font-medium mb-2",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>{intl.formatMessage({ id: 'PacketDetails.noPacketsFound' })}</h4>
            <p className={classNames(
              isDark ? "text-gray-500" : "text-gray-500"
            )}>{intl.formatMessage({ id: 'PacketDetails.noPacketsDescription' })}</p>
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