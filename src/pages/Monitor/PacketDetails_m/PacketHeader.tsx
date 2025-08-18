import React from 'react';
import { 
  CompressOutlined, 
  ExpandOutlined, 
  ReloadOutlined, 
  NumberOutlined 
} from '@ant-design/icons';
import { PackageSearch, Boxes } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface QueryParams {
  srcip: string;
  dstip: string;
  srcport: number;
  dstport: number;
  ipver?: number;
}

interface PacketHeaderProps {
  queryParams: QueryParams;
  packetData: any[];
  loading: boolean;
  allExpanded: boolean;
  onToggleAll: () => void;
  onRefresh: () => void;
  onViewAllPackets: () => void;
}

const PacketHeader: React.FC<PacketHeaderProps> = ({
  queryParams,
  packetData,
  loading,
  allExpanded,
  onToggleAll,
  onRefresh,
  onViewAllPackets
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className={classNames(
      "border-b p-2",
      isDark 
        ? "bg-gray-800 border-gray-700" 
        : "bg-white border-gray-200"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Boxes className="text-blue-600" size={20} />
          <div className={classNames(
            "font-semibold text-base",
            isDark ? "text-gray-100" : "text-slate-900"
          )}>
            {intl.formatMessage({ id: 'PacketDetails.analyzer' })}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleAll}
            className={classNames(
              "px-3 py-1 text-xs rounded transition-colors flex items-center",
              isDark
                ? "bg-blue-900/50 text-blue-300 hover:bg-blue-900/70"
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
            onClick={onRefresh}
            className={classNames(
              "px-3 py-1 text-xs rounded transition-colors flex items-center",
              isDark
                ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
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
            ? "bg-green-900/30 text-green-300"
            : "bg-green-50 text-green-800"
        )}>
          {queryParams.srcip}:{queryParams.srcport}
        </span>
        <span className={classNames(
          "font-sans text-lg",
          isDark ? "text-gray-500" : "text-gray-400"
        )}>
          →
        </span>
        <span className={classNames(
          "flex items-center px-3 py-1 rounded-full font-mono",
          isDark
            ? "bg-red-900/30 text-red-300"
            : "bg-red-50 text-red-800"
        )}>
          {queryParams.dstip}:{queryParams.dstport}
        </span>
        <span className={classNames(
          "ml-auto px-3 py-1 rounded-full font-semibold text-xs",
          isDark
            ? "bg-gray-800 text-gray-300"
            : "bg-gray-100 text-gray-700"
        )}>
          IPv{queryParams.ipver}
        </span>
      </div>
      {packetData.length > 0 && (
        <div className={classNames(
          "mt-3 text-sm flex space-x-3",
          isDark ? "text-gray-300" : "text-gray-600"
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
              onClick={onViewAllPackets}
              className={classNames(
                "px-3 py-1 text-xs rounded transition-colors flex items-center cursor-pointer",
                isDark
                  ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
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
  );
};

export default PacketHeader;