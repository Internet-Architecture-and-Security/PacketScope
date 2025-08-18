import React from 'react';
import { Play, ArrowLeft, Clock, Hash, BarChart2 } from 'lucide-react';
import { Tree, ConfigProvider, Button } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface ChainTreeProps {
  filteredData: any[];
  selectedCall: any;
  onSelectCall: (call: any) => void;
  expandedKeys: string[];
  onExpandedKeysChange: (keys: string[]) => void;
  onOpenGraphModal: (index: number) => void;
  formatTime: (timestamp: number) => string;
}

const ChainTree: React.FC<ChainTreeProps> = ({
  filteredData,
  selectedCall,
  onSelectCall,
  expandedKeys,
  onExpandedKeysChange,
  onOpenGraphModal,
  formatTime
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const treeData = React.useMemo(() => {
    return filteredData.map(({ chainIndex, calls, originalLength }) => {
      const stack = [];
      const treeNodes = [];
      let nodeId = 0;
      
      calls.forEach((call) => {
        const currentNodeId = `${chainIndex}-${nodeId++}`;
        const nodeData = {
          key: currentNodeId,
          title: (
            <div 
              onClick={() => onSelectCall({ chainIndex: call.chainIndex, callIndex: call.callIndex })} 
              className={classNames(
                "flex items-center gap-3 py-0 px-2 rounded cursor-pointer transition-colors w-full border-l-2",
                selectedCall?.chainIndex === call.chainIndex && selectedCall?.callIndex === call.callIndex
                  ? (isDark ? 'bg-blue-900 border-blue-400' : 'bg-blue-100 border-blue-500')
                  : (isDark ? 'hover:bg-gray-700 border-transparent' : 'hover:bg-gray-100 border-transparent')
              )}
            >
              <div className="flex items-center gap-3">
                {call.isReturn ? 
                  <ArrowLeft size={16} className="text-red-500" /> : 
                  <Play size={16} className="text-green-500" />
                }
                <span className={classNames(
                  "text-xs font-medium",
                  call.isReturn ? "text-red-600" : "text-green-600"
                )}>
                  {call.callType}
                </span>
                <code className={classNames(
                  "px-2 py-1 rounded text-sm font-medium",
                  isDark ? "text-blue-300 bg-blue-900" : "text-blue-700 bg-blue-50"
                )}>
                  {call.funcName}
                </code>
              </div>
              <div className={classNames(
                "ml-auto flex items-center gap-6 text-xs",
                isDark ? "text-gray-400" : "text-slate-500"
              )}>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatTime(call.timestamp)}
                </span>
                <span className="flex items-center gap-1">
                  <Hash size={12} />
                  {call.funcId}
                </span>
              </div>
            </div>
          ),
          children: [], 
          callData: call,
        };
        
        if (!call.isReturn) {
          if (stack.length === 0) treeNodes.push(nodeData);
          else stack[stack.length - 1].children.push(nodeData);
          stack.push(nodeData);
        } else {
          if (stack.length > 0) {
            stack[stack.length - 1].children.push(nodeData);
            stack.pop();
          } else {
            treeNodes.push(nodeData);
          }
        }
      });
      
      return {
        key: `chain-${chainIndex}`,
        title: (
          <div className="flex items-center justify-between px-2">
            <div className={classNames(
              "flex items-center gap-2 font-semibold mr-4",
              isDark ? "text-blue-300" : "text-blue-700"
            )}>
              <span className="text-sm">
                {intl.formatMessage({ id: 'FunctionCallChainViewer.chainTitle' }, { chainIndex: chainIndex + 1 })}
              </span>
              <span className={classNames(
                "text-xs font-normal",
                isDark ? "text-amber-400" : "text-amber-700"
              )}>
                {intl.formatMessage({ id: 'FunctionCallChainViewer.threadId' }, { threadId: calls[0]?.threadId })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={classNames(
                "text-xs px-2 py-0.5 rounded",
                isDark ? "text-gray-300 bg-blue-900" : "text-slate-500 bg-blue-50"
              )}>
                {intl.formatMessage({ 
                  id: 'FunctionCallChainViewer.callCountInChain' 
                }, { 
                  callCount: calls.length, 
                  originalLength: originalLength 
                })}
              </div>
              <ConfigProvider
                theme={{
                  components: {
                    Button: {
                      colorText: isDark ? '#e5e7eb' : '#374151',
                      colorBorder: isDark ? '#4b5563' : '#d1d5db',
                      colorBgContainer: isDark ? '#374151' : '#ffffff',
                      colorBgContainerHover: isDark ? '#4b5563' : '#f3f4f6',
                    },
                  },
                }}
              >
                <Button
                  className="text-xs" 
                  size="small" 
                  type="text" 
                  icon={<BarChart2 size={14} />}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onOpenGraphModal(chainIndex); 
                  }}
                  title={intl.formatMessage({ 
                    id: 'FunctionCallChainViewer.viewChainGraphTooltip' 
                  }, { chainIndex: chainIndex + 1 })}
                >
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.viewGraph' })}
                </Button>
              </ConfigProvider>
            </div>
          </div>
        ),
        children: treeNodes, 
        selectable: false,
      };
    });
  }, [filteredData, selectedCall, intl, isDark, formatTime, onSelectCall, onOpenGraphModal]);

  return (
    <div className="min-w-[600px]">
      <ConfigProvider 
        theme={{ 
          components: { 
            Tree: { 
              nodeHoverBg: 'transparent', 
              nodeSelectedBg: 'transparent',
              colorBgContainer: isDark ? '#1f2937' : '#ffffff',
              colorText: isDark ? '#e5e7eb' : '#374151',
              colorBorder: isDark ? '#374151' : '#e5e7eb',
              directoryNodeSelectedBg: isDark ? '#374151' : '#f3f4f6',
              directoryNodeSelectedColor: isDark ? '#e5e7eb' : '#374151',
            } 
          } 
        }}
      >
        <Tree 
          treeData={treeData} 
          expandedKeys={expandedKeys} 
          onExpand={onExpandedKeysChange} 
          onSelect={(keys, info) => { 
            if (info.node.callData) {
              onSelectCall({ 
                chainIndex: info.node.callData.chainIndex, 
                callIndex: info.node.callData.callIndex 
              }); 
            }
          }} 
          showLine={{ showLeafIcon: false }} 
          className={classNames(
            "border rounded-md p-4",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}
        />
      </ConfigProvider>
    </div>
  );
};

export default ChainTree;
          