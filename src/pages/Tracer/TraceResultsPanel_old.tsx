import React, { useEffect, useRef, useState } from 'react';
import { Table, Tooltip, Spin } from 'antd';
import { useIntl } from 'react-intl';
import {
  DeploymentUnitOutlined,
  GlobalOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  DragOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { DndContext, useDraggable, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';

const PANEL_WIDTH_MARGIN = 600;
const PANEL_HEIGHT_MARGIN = 460;

// 可拖动包装器组件（支持折叠）
const DraggableWrapper = ({ children, onPositionChange, initialPosition = { x: 100, y: 230 } }) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setWindowSize({ width, height });

      setPosition((prev) => ({
        x: Math.max(0, Math.min(prev.x, width - PANEL_WIDTH_MARGIN)),
        y: Math.max(0, Math.min(prev.y, height - PANEL_HEIGHT_MARGIN)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDragStart = () => setIsDragging(true);

  const handleDragEnd = ({ delta }) => {
    const newX = position.x + delta.x;
    const newY = position.y + delta.y;

    const clampedX = Math.max(0, Math.min(newX, windowSize.width - PANEL_WIDTH_MARGIN));
    const clampedY = Math.max(0, Math.min(newY, windowSize.height - PANEL_HEIGHT_MARGIN));

    const newPosition = { x: clampedX, y: clampedY };
    setPosition(newPosition);
    onPositionChange?.(newPosition);

    setTimeout(() => setIsDragging(false), 0);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <DraggableItem
        position={position}
        isDragging={isDragging}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      >
        {!isCollapsed && children}
      </DraggableItem>
    </DndContext>
  );
};

// 可拖动项目组件
const DraggableItem = ({ children, position, isDragging, isCollapsed, onToggleCollapse }) => {
  const intl = useIntl();
  const { attributes, listeners, setNodeRef, transform, isDragging: dndIsDragging } = useDraggable({ id: 'trace-panel' });

  const style = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    zIndex: 10,
    transform: (isDragging || dndIsDragging) && transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : 'translate3d(0, 0, 0)',
    transition: isDragging || dndIsDragging ? 'none' : 'transform 0.2s ease-out',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        w-[600px] ${isCollapsed ? 'h-auto' : 'max-h-[460px]'}
        bg-blue-900/90 backdrop-blur-md rounded-lg shadow-2xl 
        border border-white/20 overflow-hidden flex flex-col
        ${isDragging || dndIsDragging ? 'shadow-3xl scale-[1.02] bg-blue-900/95' : 'hover:shadow-2xl'}
      `}
    >
      <div
        {...listeners}
        {...attributes}
        className="
          px-3 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 
          border-b border-white/10 cursor-move select-none
          flex items-center justify-between
          hover:from-blue-600/30 hover:to-purple-600/30
          transition-all duration-200
        "
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium text-white flex items-center gap-2">
            <DeploymentUnitOutlined className="text-blue-400 text-sm" />
            {intl.formatMessage({ id: 'TraceResultsPanel.title' })}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-300">{intl.formatMessage({ id: 'TraceResultsPanel.draggable' })}</span>
          <Tooltip title={isCollapsed ? intl.formatMessage({ id: 'TraceResultsPanel.expand' }) : intl.formatMessage({ id: 'TraceResultsPanel.collapse' })}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse?.();
              }}
              className="text-white text-xs hover:text-blue-400 transition"
            >
              {isCollapsed ? <DownOutlined /> : <UpOutlined />}
            </button>
          </Tooltip>
        </div>
      </div>
      {children}
    </div>
  );
};

// 主组件：TraceResultsPanel
const TraceResultsPanel = ({ traceResults = [], loading = false }) => {
  const intl = useIntl();
  const tableRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const tableBody = containerRef.current.querySelector('.ant-table-body');
      if (tableBody) {
        tableBody.scrollTop = tableBody.scrollHeight;
      }
    }
  }, [traceResults]);

  const columns = [
    {
      title: <div className="text-gray-200 font-medium text-xs">{intl.formatMessage({ id: 'TraceResultsPanel.ttl' })}</div>,
      dataIndex: 'ttl',
      key: 'ttl',
      width: 65,
      align: 'center',
      render: (_, __, index) => <span className="font-mono text-xs text-gray-300">{index + 1}</span>,
    },
    {
      title: <div className="text-gray-200 font-medium text-xs">{intl.formatMessage({ id: 'TraceResultsPanel.ipAddress' })}</div>,
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      ellipsis: true,
      render: (ip) => (
        <Tooltip title={ip === '*' ? intl.formatMessage({ id: 'TraceResultsPanel.timeout' }) : ip}>
          <div className="flex items-center gap-1.5">
            {ip === '*' ? <CloseCircleOutlined className="text-red-400 text-xs" /> : <GlobalOutlined className="text-blue-400 text-xs" />}
            <span
              className={`font-mono block w-full overflow-hidden whitespace-nowrap text-ellipsis text-xs ${ip === '*' ? 'text-red-400' : 'text-gray-200'}`}
            >
              {ip === '*' ? `* (${intl.formatMessage({ id: 'TraceResultsPanel.timeoutShort' })})` : ip}
            </span>
          </div>
        </Tooltip>
      ),
    },
    {
      title: <div className="text-gray-200 font-medium text-xs">{intl.formatMessage({ id: 'TraceResultsPanel.latency' })}</div>,
      dataIndex: 'latency',
      key: 'latency',
      width: 100,
      align: 'right',
      ellipsis: true,
      render: (latency, record) => {
        if (record.packet_loss === '100%') {
          return (
            <Tooltip title={intl.formatMessage({ id: 'TraceResultsPanel.allPacketsLost' })}>
              <span className="text-red-400 font-medium text-xs">-</span>
            </Tooltip>
          );
        }
        const value = parseFloat(latency);
        let colorClass = 'text-green-400';
        let bgClass = 'bg-green-500/20';
        if (value > 200) {
          colorClass = 'text-red-400';
          bgClass = 'bg-red-500/20';
        } else if (value > 100) {
          colorClass = 'text-yellow-400';
          bgClass = 'bg-yellow-500/20';
        }
        return (
          <Tooltip title={`${latency} ms`}>
            <span className={`font-mono text-xs font-medium px-1 py-0.5 rounded ${colorClass} ${bgClass}`}>{latency} ms</span>
          </Tooltip>
        );
      },
    },
    {
      title: <div className="text-gray-200 font-medium text-xs">{intl.formatMessage({ id: 'TraceResultsPanel.asn' })}</div>,
      dataIndex: 'asn',
      key: 'asn',
      width: 100,
      align: 'center',
      ellipsis: true,
      render: (asn) => (
        <Tooltip title={asn || '-'}>
          <span className="font-mono text-xs text-gray-300 bg-gray-500/30 px-1.5 py-0.5 rounded">{asn || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: <div className="text-gray-200 font-medium text-xs">{intl.formatMessage({ id: 'TraceResultsPanel.location' })}</div>,
      dataIndex: 'location',
      key: 'location',
      ellipsis: true,
      render: (location) => (
        <Tooltip title={location && location !== 'Unknown' ? location : intl.formatMessage({ id: 'TraceResultsPanel.unknown' })}>
          <div className="text-xs">
            {location && location !== 'Unknown' ? (
              <span className="text-gray-200 px-1.5 py-0.5 block w-full overflow-hidden whitespace-nowrap text-ellipsis">{location}</span>
            ) : (
              <span className="text-gray-300 italic">{intl.formatMessage({ id: 'TraceResultsPanel.unknown' })}</span>
            )}
          </div>
        </Tooltip>
      ),
    },
  ];

  const dataSource = traceResults.map((hop, index) => ({ ...hop, key: index }));
  if (loading) {
    dataSource.push({ key: 'loading', ip: 'loading' });
  }

  return (
    <DraggableWrapper>
      <div className="h-full flex flex-col text-gray-200">
        {traceResults.length > 0 && (
          <div className="px-3 py-1.5 bg-blue-800/50 border-b border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300">
                {intl.formatMessage({ id: 'TraceResultsPanel.totalHops' }, { count: traceResults.length })}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-green-400 text-xs">● {intl.formatMessage({ id: 'TraceResultsPanel.normal' })}</span>
                <span className="text-yellow-400 text-xs">● {intl.formatMessage({ id: 'TraceResultsPanel.highLatency' })}</span>
                <span className="text-red-400 text-xs">● {intl.formatMessage({ id: 'TraceResultsPanel.timeoutShort' })}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-grow overflow-hidden" ref={containerRef}>
          {traceResults.length === 0 && !loading ? (
            <div className="text-gray-300 text-center py-12">
              <DeploymentUnitOutlined className="text-3xl mb-3 opacity-30" />
              <p className="text-sm">{intl.formatMessage({ id: 'TraceResultsPanel.noData' })}</p>
              <p className="text-xs text-gray-400 mt-1">{intl.formatMessage({ id: 'TraceResultsPanel.inputTarget' })}</p>
            </div>
          ) : (
            <Table
              ref={tableRef}
              columns={columns}
              dataSource={dataSource}
              pagination={false}
              size="small"
              scroll={{ y: 320 }}
              className="trace-results-table"
              rowClassName={(record, index) => {
                if (record.ip === 'loading') return 'loading-row';
                if (record.packet_loss === '100%') return 'error-row';
                return index % 2 === 0 ? 'even-row' : 'odd-row';
              }}
              components={{
                body: {
                  row: (props) => {
                    const { children } = props;
                    if (children[0]?.props.record.ip === 'loading') {
                      return (
                        <tr>
                          <td colSpan={columns.length} className="p-4 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <Spin indicator={<LoadingOutlined style={{ fontSize: 20, color: '#60a5fa' }} spin />} />
                              <p className="text-gray-300 text-xs">{intl.formatMessage({ id: 'TraceResultsPanel.tracing' })}</p>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return <tr {...props}>{children}</tr>;
                  },
                },
              }}
            />
          )}
        </div>

        {(traceResults.length > 0 || loading) && (
          <div className="px-3 py-1.5 bg-blue-800/50 border-t border-white/10 flex items-center justify-between">
            <div className="text-xs text-gray-300">
              {loading ? intl.formatMessage({ id: 'TraceResultsPanel.tracingInProgress' }) : intl.formatMessage({ id: 'TraceResultsPanel.traceComplete' })}
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .trace-results-table .ant-table {
          background: transparent;
          font-size: 12px;
        }
        .trace-results-table .ant-table-thead > tr > th {
          background: rgba(31, 41, 55, 0);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          color: #d1d5db;
          font-weight: 500;
          padding: 6px 8px;
          font-size: 11px;
        }
        .trace-results-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 6px 8px;
          background: transparent;
          font-size: 12px;
        }
        .trace-results-table .even-row,
        .trace-results-table .odd-row {
          background: transparent;
        }
        .trace-results-table .error-row {
          background: rgba(220, 38, 38, 0.15);
        }
        .trace-results-table .ant-table-tbody > tr:hover > td {
          background: rgba(59, 130, 246, 0.2) !important;
        }
        .trace-results-table .ant-table-body {
          scroll-behavior: smooth;
        }
        .trace-results-table .ant-table-body::-webkit-scrollbar {
          width: 4px;
        }
        .trace-results-table .ant-table-body::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .trace-results-table .ant-table-body::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.5);
          border-radius: 2px;
        }
        .trace-results-table .ant-table-body::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.7);
        }
      `}</style>
    </DraggableWrapper>
  );
};

export default TraceResultsPanel;