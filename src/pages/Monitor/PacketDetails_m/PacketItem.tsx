import React, { useState } from 'react';
import { 
  CaretDownOutlined, 
  CaretRightOutlined,
  GlobalOutlined,
  ExportOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  GatewayOutlined,
  NodeIndexOutlined,
  FieldTimeOutlined,
  ToolOutlined,
  ApartmentOutlined,
  FlagOutlined
} from '@ant-design/icons';
import { Link } from 'react-router';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import DetailRow from './DetailRow';
import DetailCard from './DetailCard';

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

interface PacketItemProps {
  packet: IPv4PacketData | IPv6PacketData;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const PacketItem: React.FC<PacketItemProps> = ({ packet, index, isExpanded, onToggle }) => {
  const intl = useIntl();
  const [showHexView, setShowHexView] = useState(false);
  const isIPv4 = 'protocol' in packet;
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const getDirectionText = (direction: number): string => {
    return direction === 0 ? intl.formatMessage({ id: 'PacketDetails.inbound' }) : intl.formatMessage({ id: 'PacketDetails.outbound' });
  };

  const getDirectionColor = (direction: number): string => {
    return direction === 0 ? 'text-green-400' : 'text-blue-400';
  };

  const getDirectionBg = (direction: number): string => {
    if (isDark) {
      return direction === 0 ? 'bg-green-900/20' : 'bg-blue-900/20';
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

  // 数据包摘要信息
  const packetSummary = (
    <div className={classNames(
      "flex items-center justify-between px-4 py-2 cursor-pointer transition-colors duration-100 select-none",
      isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-200/50"
    )}>
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className={classNames(
            "text-xs font-mono w-8",
            isDark ? "text-gray-400" : "text-gray-500"
          )}>
            #{index + 1}
          </span>
          <span className={`text-xs font-medium ${getDirectionColor(packet.direction)}`}>{getDirectionText(packet.direction)}</span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className={classNames(
            "font-mono",
            isDark ? "text-gray-300" : "text-gray-600"
          )}>
            {packet.timestamp}
          </span>
          <span className={isDark ? "text-gray-500" : "text-gray-400"}>|</span>
          <span className="font-mono text-blue-600">{packet.length}B</span>
          <span className={isDark ? "text-gray-500" : "text-gray-400"}>|</span>
          <span className="text-purple-600 font-medium">{isIPv4 ? packet.protocol : packet.headerType}</span>
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
            <CaretDownOutlined className={classNames(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-400"
            )} /> : 
            <CaretRightOutlined className={classNames(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-400"
            )} />
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
          )}>
            {packet.timestamp}
          </span>
        </DetailRow>
        <DetailRow icon={<GatewayOutlined />} label={intl.formatMessage({ id: 'PacketDetails.interface' })}>
          <span className={classNames(
            "text-xs",
            isDark ? "text-gray-300" : "text-gray-600"
          )}>
            {intl.formatMessage({ id: 'PacketDetails.interfaceNumber' }, { number: packet.interface })}
          </span>
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
              <span className={classNames(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-600"
              )}>
                {packet.fragInfo || intl.formatMessage({ id: 'PacketDetails.none' })}
              </span>
            </DetailRow>
            <DetailRow icon={<ToolOutlined />} label={intl.formatMessage({ id: 'PacketDetails.options' })}>
              <span className={classNames(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-600"
              )}>
                {packet.options || intl.formatMessage({ id: 'PacketDetails.none' })}
              </span>
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
              className={classNames(
                "px-2 py-1 text-xs font-medium transition-colors",
                showHexView 
                  ? "bg-blue-600 text-white" 
                  : isDark 
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600" 
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
              )}>
                {packet.content}
              </div>
            </div>
          )}
        </div>
      </DetailCard>
    </div>
  );

  return (
    <div className={classNames(
      "border-l-2 border-transparent transition-colors duration-100",
      isDark ? "hover:border-blue-400" : "hover:border-blue-300"
    )}>
      <div onClick={onToggle}>{packetSummary}</div>
      {isExpanded && packetDetails}
    </div>
  );
};

export default PacketItem;