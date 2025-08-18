import React from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import ProtocolStats from './ProtocolStats';

interface HeaderStatsProps {
  summaryInfo: any;
  filteredDataLength: number;
  tableDataLength: number;
}

const HeaderStats: React.FC<HeaderStatsProps> = ({ summaryInfo, filteredDataLength, tableDataLength }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      {/* Protocol statistics grid */}
      <div className="grid grid-cols-4 gap-1.5">
        <ProtocolStats
          label="TCP"
          count={(summaryInfo.TCPv4 || 0) + (summaryInfo.TCPv6 || 0)}
          colorClass={classNames(
            "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100/60 text-emerald-600",
            isDark && "from-emerald-900/40 to-green-900/40 border-emerald-600/30 text-emerald-400"
          )}
        />
        <ProtocolStats
          label="UDP"
          count={(summaryInfo.UDPv4 || 0) + (summaryInfo.UDPv6 || 0)}
          colorClass={classNames(
            "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100/60 text-orange-600",
            isDark && "from-orange-900/40 to-amber-900/40 border-orange-600/30 text-orange-400"
          )}
        />
        <ProtocolStats
          label="RAW"
          count={(summaryInfo.RAWv4 || 0) + (summaryInfo.RAWv6 || 0)}
          colorClass={classNames(
            "bg-gradient-to-br from-red-50 to-rose-50 border-red-100/60 text-red-600",
            isDark && "from-red-900/40 to-rose-900/40 border-red-600/30 text-red-400"
          )}
        />
        <ProtocolStats
          label="ICMP"
          count={(summaryInfo.ICMPv4 || 0) + (summaryInfo.ICMPv6 || 0)}
          colorClass={classNames(
            "bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-100/60 text-cyan-600",
            isDark && "from-cyan-900/40 to-teal-900/40 border-cyan-600/30 text-cyan-400"
          )}
        />
      </div>

      {/* Display statistics */}
      <div className={classNames(
        "bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 rounded-lg px-3 py-2 border border-violet-100/60 shadow-sm",
        isDark && "from-violet-900/40 via-purple-900/40 to-indigo-900/40 border-violet-600/30 shadow-gray-800/20"
      )}>
        <div className="text-center relative min-w-[80px]">
          <div className="flex items-baseline justify-center gap-0.5 relative top-2 whitespace-nowrap">
            <span className={classNames(
              "text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent",
              isDark && "from-violet-400 to-purple-400"
            )}>
              {filteredDataLength}
            </span>
            <span className={classNames(
              "text-xs font-medium",
              isDark ? "text-violet-400" : "text-violet-500"
            )}>
              /{tableDataLength}
            </span>
          </div>
          <div className={classNames(
            "absolute text-xs font-semibold left-[-5px] top-[-6px]",
            isDark ? "text-violet-400/60" : "text-violet-700/40"
          )}>
            {intl.formatMessage({ id: 'SocketViewer.entryCount' })}
          </div>
        </div>
      </div>

      {/* Network interface */}
      <div className={classNames(
        "bg-gradient-to-br from-green-50 via-green-50 to-green-50 rounded-lg px-3 py-2 border border-green-100/60 shadow-sm",
        isDark && "from-green-900/40 via-green-900/40 to-green-900/40 border-green-600/30 shadow-gray-800/20"
      )}>
        <div className="text-center relative min-w-[80px]">
          <div className="flex items-baseline justify-center gap-0.5 relative top-2">
            <span className={classNames(
              "text-lg font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text whitespace-nowrap text-transparent",
              isDark && "from-green-400 to-green-300"
            )}>
              {summaryInfo.interface ?? 'N/A'}
            </span>
          </div>
          <div className={classNames(
            "absolute text-xs font-semibold left-[-5px] top-[-6px]",
            isDark ? "text-green-400/60" : "text-green-800/40"
          )}>
            {intl.formatMessage({ id: 'SocketViewer.interface' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderStats;