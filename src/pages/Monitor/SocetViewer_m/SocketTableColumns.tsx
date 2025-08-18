import React from 'react';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

// Protocol color mapping for both light and dark modes
const PROTOCOL_COLORS = {
  light: {
    TCP: 'bg-green-100 text-green-800',
    UDP: 'bg-orange-100 text-orange-800',
    RAW: 'bg-red-100 text-red-800',
    ICMP: 'bg-cyan-100 text-cyan-800',
    default: 'bg-gray-100 text-gray-800',
  },
  dark: {
    TCP: 'bg-green-900/50 text-green-300 border border-green-800/50',
    UDP: 'bg-orange-900/50 text-orange-300 border border-orange-800/50',
    RAW: 'bg-red-900/50 text-red-300 border border-red-800/50',
    ICMP: 'bg-cyan-900/50 text-cyan-300 border border-cyan-800/50',
    default: 'bg-gray-800/50 text-gray-300 border border-gray-700/50',
  },
};

// State color mapping for both light and dark modes
const STATE_COLORS = {
  light: {
    ESTABLISHED: 'bg-green-100 text-green-800',
    LISTEN: 'bg-blue-100 text-blue-800',
    TIME_WAIT: 'bg-yellow-100 text-yellow-800',
    SYN_SENT: 'bg-purple-100 text-purple-800',
    SYN_RECV: 'bg-indigo-100 text-indigo-800',
    FIN_WAIT1: 'bg-orange-100 text-orange-800',
    FIN_WAIT2: 'bg-orange-100 text-orange-800',
    CLOSE: 'bg-gray-100 text-gray-800',
    CLOSE_WAIT: 'bg-red-100 text-red-800',
    LAST_ACK: 'bg-red-100 text-red-800',
    CLOSING: 'bg-red-100 text-red-800',
    UNDEFINED: 'bg-slate-100 text-slate-800',
    default: 'bg-gray-100 text-gray-800',
  },
  dark: {
    ESTABLISHED: 'bg-green-900/50 text-green-300 border border-green-800/50',
    LISTEN: 'bg-blue-900/50 text-blue-300 border border-blue-800/50',
    TIME_WAIT: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800/50',
    SYN_SENT: 'bg-purple-900/50 text-purple-300 border border-purple-800/50',
    SYN_RECV: 'bg-indigo-900/50 text-indigo-300 border border-indigo-800/50',
    FIN_WAIT1: 'bg-orange-900/50 text-orange-300 border border-orange-800/50',
    FIN_WAIT2: 'bg-orange-900/50 text-orange-300 border border-orange-800/50',
    CLOSE: 'bg-gray-800/50 text-gray-300 border border-gray-700/50',
    CLOSE_WAIT: 'bg-red-900/50 text-red-300 border border-red-800/50',
    LAST_ACK: 'bg-red-900/50 text-red-300 border border-red-800/50',
    CLOSING: 'bg-red-900/50 text-red-300 border border-red-800/50',
    UNDEFINED: 'bg-slate-800/50 text-slate-300 border border-slate-700/50',
    default: 'bg-gray-800/50 text-gray-300 border border-gray-700/50',
  },
};

// Utility function to get protocol color based on theme
export const getProtocolColor = (protocol: string, isDark: boolean): string => {
  const colors = isDark ? PROTOCOL_COLORS.dark : PROTOCOL_COLORS.light;
  return colors[protocol] || colors.default;
};

// Utility function to get state color based on theme
export const getStateColor = (state: string, isDark: boolean): string => {
  const colors = isDark ? STATE_COLORS.dark : STATE_COLORS.light;
  
  // Check for hex state codes and named states
  if (state.includes('01') || state.includes('ESTABLISHED')) return colors.ESTABLISHED;
  if (state.includes('0A') || state.includes('LISTEN')) return colors.LISTEN;
  if (state.includes('06') || state.includes('TIME_WAIT')) return colors.TIME_WAIT;
  if (state.includes('02') || state.includes('SYN_SENT')) return colors.SYN_SENT;
  if (state.includes('03') || state.includes('SYN_RECV')) return colors.SYN_RECV;
  if (state.includes('04') || state.includes('FIN_WAIT1')) return colors.FIN_WAIT1;
  if (state.includes('05') || state.includes('FIN_WAIT2')) return colors.FIN_WAIT2;
  if (state.includes('07') || state.includes('CLOSE')) return colors.CLOSE;
  if (state.includes('08') || state.includes('CLOSE_WAIT')) return colors.CLOSE_WAIT;
  if (state.includes('09') || state.includes('LAST_ACK')) return colors.LAST_ACK;
  if (state.includes('0B') || state.includes('CLOSING')) return colors.CLOSING;
  if (state.includes('UNDEFINED')) return colors.UNDEFINED;
  return colors.default;
};

// Socket table columns configuration
export const createSocketTableColumns = (intl: any) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  
  return [
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.id' }),
      dataIndex: 'id',
      key: 'id',
      width: 30,
      align: 'center' as const,
      sorter: (a: any, b: any) => a.id - b.id,
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.type' }),
      dataIndex: 'type',
      key: 'type',
      width: 60,
      align: 'center' as const,
      render: (type: string) => {        
        return (
          <span
            className={classNames(
              "px-2 py-1 rounded text-xs font-medium",
              type === 'ipv4' 
                ? isDark 
                  ? 'bg-blue-900/50 text-blue-300 border border-blue-800/50' 
                  : 'bg-blue-100 text-blue-800'
                : isDark 
                  ? 'bg-purple-900/50 text-purple-300 border border-purple-800/50' 
                  : 'bg-purple-100 text-purple-800'
            )}
          >
            {type.toUpperCase()}
          </span>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.protocol' }),
      dataIndex: 'protocol',
      key: 'protocol',
      width: 60,
      align: 'center' as const,
      render: (protocol: string) => {        
        return (
          <span className={classNames(
            "px-2 py-1 rounded text-xs font-medium",
            getProtocolColor(protocol, isDark)
          )}>
            {protocol}
          </span>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.timestamp' }),
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (ts: number) => {        
        return (
          <span className={classNames(
            "text-sm",
            isDark ? 'text-gray-400' : 'text-gray-600'
          )}>
            {new Date(ts * 1000).toLocaleString()}
          </span>
        );
      },
      width: 180,
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.src' }),
      dataIndex: 'src',
      key: 'src',
      width: 220,
      sorter: (a: any, b: any) => a.src.localeCompare(b.src),
      render: (src: string) => {        
        return (
          <span className={classNames(
            "font-mono text-sm",
            isDark ? 'text-blue-400' : 'text-blue-600'
          )}>
            {src}
          </span>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.dist' }),
      dataIndex: 'dist',
      key: 'dist',
      width: 220,
      sorter: (a: any, b: any) => a.dist.localeCompare(b.dist),
      render: (dist: string) => {        
        return (
          <span className={classNames(
            "font-mono text-sm",
            isDark ? 'text-green-400' : 'text-green-600'
          )}>
            {dist}
          </span>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.state' }),
      dataIndex: 'state',
      key: 'state',
      width: 120,
      sorter: (a: any, b: any) => a.state.localeCompare(b.state),
      render: (state: string) => {        
        return (
          <span className={classNames(
            "px-2 py-1 rounded text-xs font-medium",
            getStateColor(state, isDark)
          )}>
            {state}
          </span>
        );
      },
    },
  ];
};