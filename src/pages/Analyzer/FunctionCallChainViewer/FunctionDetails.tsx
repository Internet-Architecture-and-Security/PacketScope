import React from 'react';
import { X } from 'lucide-react';
import { Button, ConfigProvider } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface FunctionDetailsProps {
  selectedCall: any;
  processedData: any[];
  funcTable: any;
  formatTime: (timestamp: number) => string;
  onClose: () => void;
}

const FunctionDetails: React.FC<FunctionDetailsProps> = ({
  selectedCall,
  processedData,
  funcTable,
  formatTime,
  onClose
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  if (!selectedCall || processedData.length === 0) return null;

  const call = processedData[selectedCall.chainIndex][selectedCall.callIndex];
  const funcInfo = funcTable[call.funcId];

  return (
    <div className={classNames(
      "w-1/4 min-w-[280px] border-l flex flex-col",
      isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
    )}>
      <div className={classNames(
        "px-2 py-1 border-b flex items-center justify-between",
        isDark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
      )}>
        <div className={classNames(
          "text-sm font-semibold",
          isDark ? "text-gray-200" : "text-slate-700"
        )}>
          {intl.formatMessage({ id: 'FunctionCallChainViewer.functionDetails' })}
        </div>
        <ConfigProvider
          theme={{
            components: {
              Button: {
                colorText: isDark ? '#9ca3af' : '#6b7280',
                colorBgContainer: 'transparent',
                borderRadius: 4,
                paddingContentHorizontal: 4,
              },
            },
          }}
        >
          <Button 
            type="text" 
            size="small" 
            icon={<X className={classNames(
              "w-4 h-4",
              isDark ? "text-gray-400" : "text-slate-500"
            )} />} 
            onClick={onClose} 
          />
        </ConfigProvider>
      </div>
      
      <div className="flex-1 p-4 overflow-auto">
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
              <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <div className={classNames(
                "text-sm font-bold uppercase tracking-wide",
                isDark ? "text-gray-200" : "text-slate-800"
              )}>
                {intl.formatMessage({ id: 'FunctionCallChainViewer.basicInfo' })}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className={classNames(
                  "text-xs mb-1",
                  isDark ? "text-gray-400" : "text-slate-500"
                )}>
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.functionName' })}
                </div>
                <code className={classNames(
                  "px-2 py-1 rounded text-sm font-medium block break-all",
                  isDark ? "text-blue-300 bg-blue-900" : "text-blue-700 bg-blue-50"
                )}>
                  {call.funcName}
                </code>
              </div>
              <div>
                <div className={classNames(
                  "text-xs mb-1",
                  isDark ? "text-gray-400" : "text-slate-500"
                )}>
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.callType' })}
                </div>
                <span className={classNames(
                  "text-sm font-medium px-2 py-1 rounded",
                  call.isReturn 
                    ? (isDark ? 'text-red-400 bg-red-900' : 'text-red-600 bg-red-50')
                    : (isDark ? 'text-green-400 bg-green-900' : 'text-green-600 bg-green-50')
                )}>
                  {call.callType}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
              <div className="w-1 h-4 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
              <div className={classNames(
                "text-sm font-bold uppercase tracking-wide",
                isDark ? "text-gray-200" : "text-slate-800"
              )}>
                {intl.formatMessage({ id: 'FunctionCallChainViewer.executionInfo' })}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className={classNames(
                  "text-xs mb-1",
                  isDark ? "text-gray-400" : "text-slate-500"
                )}>
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.timestamp' })}
                </div>
                <div className={classNames(
                  "text-sm font-mono break-all",
                  isDark ? "text-gray-300" : "text-slate-700"
                )}>
                  {formatTime(call.timestamp)}
                </div>
              </div>
              <div>
                <div className={classNames(
                  "text-xs mb-1",
                  isDark ? "text-gray-400" : "text-slate-500"
                )}>
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.functionId' })}
                </div>
                <div className={classNames(
                  "text-sm font-mono",
                  isDark ? "text-gray-300" : "text-slate-700"
                )}>
                  {call.funcId}
                </div>
              </div>
              <div>
                <div className={classNames(
                  "text-xs mb-1",
                  isDark ? "text-gray-400" : "text-slate-500"
                )}>
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.threadIdLabel' })}
                </div>
                <div className={classNames(
                  "text-sm font-mono",
                  isDark ? "text-gray-300" : "text-slate-700"
                )}>
                  {call.threadId}
                </div>
              </div>
              <div>
                <div className={classNames(
                  "text-xs mb-1",
                  isDark ? "text-gray-400" : "text-slate-500"
                )}>
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.callDepth' })}
                </div>
                <div className={classNames(
                  "text-sm",
                  isDark ? "text-gray-300" : "text-slate-700"
                )}>
                  {call.depth}
                </div>
              </div>
            </div>
          </div>
          
          {funcInfo && (
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
                <div className={classNames(
                  "text-sm font-bold uppercase tracking-wide",
                  isDark ? "text-gray-200" : "text-slate-800"
                )}>
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.metadata' })}
                </div>
              </div>
              <div className={classNames(
                "rounded p-3 space-y-2",
                isDark ? "bg-gray-700" : "bg-gray-50"
              )}>
                <div className="flex justify-between">
                  <span className={classNames(
                    "text-xs",
                    isDark ? "text-gray-400" : "text-slate-500"
                  )}>
                    Kind:
                  </span>
                  <span className={classNames(
                    "text-xs font-mono",
                    isDark ? "text-gray-300" : "text-slate-700"
                  )}>
                    {funcInfo.kind}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={classNames(
                    "text-xs",
                    isDark ? "text-gray-400" : "text-slate-500"
                  )}>
                    Type ID:
                  </span>
                  <span className={classNames(
                    "text-xs font-mono",
                    isDark ? "text-gray-300" : "text-slate-700"
                  )}>
                    {funcInfo.type_id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={classNames(
                    "text-xs",
                    isDark ? "text-gray-400" : "text-slate-500"
                  )}>
                    Linkage:
                  </span>
                  <span className={classNames(
                    "text-xs font-mono",
                    isDark ? "text-gray-300" : "text-slate-700"
                  )}>
                    {funcInfo.linkage}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FunctionDetails;